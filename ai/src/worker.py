import os
import sys
import json
import time
import shutil
import subprocess
import tempfile
from pathlib import Path
import redis
from src.config import settings
from src.storage import storage_service
from src.providers.audio_separation_provider import DemucsAudioSeparationProvider
from src.providers.face_swap_provider import FaceFusionProvider
from src.providers.face_identity_provider import FaceIdentityProvider
from src.providers.music_video_provider import LocalAudioAnalysisProvider, LocalStoryboardProvider, LocalVideoClipProvider, imageio_ffmpeg, suggest_scene_cuts
from src.providers.transcription_provider import FasterWhisperTranscriptionProvider
from src.providers.karaoke_video_provider import KaraokeVideoProvider
from src.media_input import extract_audio_to_wav

audio_provider = DemucsAudioSeparationProvider(
    model=settings.demucs_model,
    device=settings.demucs_device,
)
face_swap_provider = FaceFusionProvider(
    facefusion_path=settings.facefusion_path,
    execution_provider=settings.facefusion_execution_provider,
    model=settings.facefusion_model,
)
face_identity_provider = FaceIdentityProvider(
    facefusion_path=settings.facefusion_path,
    execution_provider=settings.facefusion_execution_provider,
)
audio_analysis_provider = LocalAudioAnalysisProvider()
transcription_provider = FasterWhisperTranscriptionProvider(
    model_size=settings.whisper_model,
    cache_dir=os.path.join(settings.model_cache_dir, "whisper"),
    device=settings.whisper_device,
    compute_type=settings.whisper_compute_type,
)
karaoke_provider = KaraokeVideoProvider(lead_seconds=1.0)
storyboard_provider = LocalStoryboardProvider()
video_clip_provider = LocalVideoClipProvider(
    model_id=settings.diffusion_model,
    cache_dir=os.path.join(settings.model_cache_dir, "huggingface"),
    device=settings.diffusion_device,
    inference_steps=settings.diffusion_steps,
    width=settings.diffusion_width,
    height=settings.diffusion_height,
    video_model_id=settings.video_diffusion_model,
    video_frame_count=settings.video_diffusion_frames,
    video_inference_steps=settings.video_diffusion_steps,
    video_decode_chunk_size=settings.video_diffusion_decode_chunk,
    video_segment_seconds=settings.video_segment_seconds,
    video_max_segments=settings.video_max_segments,
    music_performance_provider=face_swap_provider,
)

def verify_ffmpeg() -> bool:
    ffmpeg_cmd = shutil.which("ffmpeg")
    if not ffmpeg_cmd and imageio_ffmpeg is not None:
        try:
            ffmpeg_cmd = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            ffmpeg_cmd = None
    if not ffmpeg_cmd:
        print("[AI Worker] WARNING: ffmpeg not found in PATH!")
        return False
    try:
        res = subprocess.run([ffmpeg_cmd, "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        first_line = res.stdout.split("\n")[0] if res.stdout else "unknown"
        print(f"[AI Worker] FFmpeg detected: {first_line}")
        return True
    except Exception as e:
        print(f"[AI Worker] Error verifying ffmpeg: {e}")
        return False

def verify_model_cache() -> None:
    cache_dir = Path(settings.model_cache_dir)
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        probe = cache_dir / ".worker-write-test"
        probe.write_text("ok", encoding="ascii")
        probe.unlink()
    except OSError as error:
        raise RuntimeError(
            f"AI model cache is not writable: {cache_dir}. "
            "Check the Docker volume configuration before processing jobs."
        ) from error

    manifest = cache_dir / "model-manifest.json"
    state = "empty; models will download on first use"
    if manifest.is_file():
        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
            components = sorted((data.get("components") or {}).keys())
            state = f"prepared components: {', '.join(components)}" if components else state
        except (OSError, json.JSONDecodeError):
            state = "manifest unreadable; models will be checked on first use"
    free_gb = shutil.disk_usage(cache_dir).free / 1024**3
    print(f"[AI Worker] Model cache: {cache_dir} ({state}, {free_gb:.2f} GB free).")

def connect_redis() -> redis.Redis:
    print(f"[AI Worker] Connecting to Redis at {settings.redis_host}:{settings.redis_port}...")
    r = redis.Redis(
        host=settings.redis_host,
        port=settings.redis_port,
        password=settings.redis_password or None,
        decode_responses=True
    )
    return r

def publish_progress(r: redis.Redis, job_id: str, status: str, progress: int, result=None, error: str = None):
    message = {
        "job_id": job_id,
        "status": status,
        "progress": progress,
    }
    if result is not None:
        message["result"] = result
    if error:
        message["error"] = error
    r.publish(settings.jobs_progress_channel, json.dumps(message))


def processing_queue_name() -> str:
    return f"{settings.jobs_queue_name}:processing"


def recover_inflight_jobs(r: redis.Redis) -> int:
    """Return jobs left in-flight by an interrupted worker to the main queue."""
    recovered = 0
    processing_queue = processing_queue_name()
    while r.lmove(
        processing_queue,
        settings.jobs_queue_name,
        src="LEFT",
        dest="LEFT",
    ) is not None:
        recovered += 1
    return recovered


def reserve_job(r: redis.Redis, timeout: int = 5):
    return r.blmove(
        settings.jobs_queue_name,
        processing_queue_name(),
        timeout=timeout,
        src="LEFT",
        dest="RIGHT",
    )


def acknowledge_job(r: redis.Redis, raw_message: str) -> None:
    r.lrem(processing_queue_name(), 1, raw_message)

def process_audio_separation(r: redis.Redis, job: dict):
    job_id = job.get("job_id")
    project_id = job.get("project_id")
    payload = job.get("payload") or {}
    source_asset = payload.get("sourceAsset") or {}

    if not job_id or not project_id:
        raise ValueError("Job message missing job_id or project_id")
    if not source_asset.get("storageKey"):
        raise ValueError("AUDIO_SEPARATION requires payload.sourceAsset.storageKey")

    with tempfile.TemporaryDirectory(prefix=f"tiluchi-{job_id}-") as tmp_dir:
        input_dir = os.path.join(tmp_dir, "input")
        output_dir = os.path.join(tmp_dir, "output")
        os.makedirs(input_dir, exist_ok=True)
        os.makedirs(output_dir, exist_ok=True)

        original_name = source_asset.get("name") or "original-audio"
        input_extension = os.path.splitext(original_name)[1] or ".wav"
        input_path = os.path.join(input_dir, f"original{input_extension}")

        publish_progress(r, job_id, "PROCESSING", 15)
        storage_service.download_file(source_asset["storageKey"], input_path)

        publish_progress(r, job_id, "PROCESSING", 35)
        decoded_path = extract_audio_to_wav(input_path, input_dir)
        stems = audio_provider.separate(decoded_path, output_dir)

        generated_assets = []
        stem_specs = [
            ("instrumental", "INSTRUMENTAL_STEM", "instrumental.wav", 70),
            ("vocals", "VOCAL_STEM", "vocals.wav", 90),
        ]

        for stem_key, kind, file_name, progress in stem_specs:
            local_path = stems[stem_key]
            storage_key = f"projects/{project_id}/{kind.lower()}/{job_id}-{file_name}"
            storage_service.upload_file(local_path, storage_key, "audio/wav")
            generated_assets.append({
                "name": f"{stem_key}-{original_name}.wav",
                "kind": kind,
                "mimeType": "audio/wav",
                "sizeBytes": os.path.getsize(local_path),
                "storageKey": storage_key,
                "metadata": {
                    "provider": stems.get("provider", "demucs"),
                    "model": stems.get("model"),
                    "device": stems.get("device"),
                    "sourceAssetId": source_asset.get("id"),
                    "sourceAssetName": original_name,
                },
            })
            publish_progress(r, job_id, "PROCESSING", progress)

        publish_progress(
            r,
            job_id,
            "COMPLETED",
            100,
            {"status": "ok", "generatedAssets": generated_assets},
        )

def process_generate_karaoke(r: redis.Redis, job: dict):
    job_id = job.get("job_id")
    project_id = job.get("project_id")
    payload = job.get("payload") or {}
    source_video = payload.get("sourceVideoAsset") or {}

    if not job_id or not project_id:
        raise ValueError("Job message missing job_id or project_id")
    if not source_video.get("storageKey"):
        raise ValueError("GENERATE_KARAOKE requires payload.sourceVideoAsset.storageKey")

    video_clip_provider.release()
    with tempfile.TemporaryDirectory(prefix=f"tiluchi-karaoke-{job_id}-") as tmp_dir:
        original_name = source_video.get("name") or "video.mp4"
        extension = os.path.splitext(original_name)[1] or ".mp4"
        source_path = os.path.join(tmp_dir, f"source{extension}")
        stems_dir = os.path.join(tmp_dir, "stems")
        subtitle_path = os.path.join(tmp_dir, "karaoke.ass")
        output_path = os.path.join(tmp_dir, "karaoke.mp4")

        publish_progress(r, job_id, "PROCESSING", 8, {"stage": "downloading"})
        storage_service.download_file(source_video["storageKey"], source_path)

        publish_progress(r, job_id, "PROCESSING", 18, {"stage": "extracting_audio"})
        decoded_path = extract_audio_to_wav(
            source_path,
            tmp_dir,
            name="source-audio.wav",
        )

        publish_progress(r, job_id, "PROCESSING", 30, {"stage": "separating_vocals"})
        stems = audio_provider.separate(decoded_path, stems_dir)

        publish_progress(r, job_id, "PROCESSING", 58, {"stage": "transcribing_lyrics"})
        try:
            transcription = transcription_provider.transcribe(stems["vocals"])
        finally:
            transcription_provider.release()

        publish_progress(r, job_id, "PROCESSING", 74, {"stage": "building_subtitles"})
        karaoke_provider.lead_seconds = max(
            0.0,
            min(float(payload.get("subtitleLeadSeconds") or 1.0), 3.0),
        )

        publish_progress(r, job_id, "PROCESSING", 82, {"stage": "rendering_video"})
        render_metadata = karaoke_provider.render(
            source_path,
            stems["instrumental"],
            transcription,
            output_path,
            subtitle_path,
        )

        storage_key = f"projects/{project_id}/karaoke_video/{job_id}-karaoke.mp4"
        publish_progress(r, job_id, "PROCESSING", 96, {"stage": "uploading"})
        storage_service.upload_file(output_path, storage_key, "video/mp4")

        base_name = os.path.splitext(original_name)[0]
        publish_progress(
            r,
            job_id,
            "COMPLETED",
            100,
            {
                "status": "ok",
                "stage": "completed",
                "provider": render_metadata["provider"],
                "transcription": {
                    "language": transcription.get("language"),
                    "text": transcription.get("text"),
                    "segments": transcription.get("segments") or [],
                },
                "generatedAssets": [
                    {
                        "name": f"karaoke-{base_name}.mp4",
                        "kind": "KARAOKE_VIDEO",
                        "mimeType": "video/mp4",
                        "sizeBytes": os.path.getsize(output_path),
                        "storageKey": storage_key,
                        "metadata": {
                            **render_metadata,
                            "sourceVideoAssetId": source_video.get("id"),
                            "sourceVideoName": original_name,
                            "separationProvider": stems.get("provider"),
                            "separationModel": stems.get("model"),
                            "transcriptionProvider": transcription.get("provider"),
                            "transcriptionModel": transcription.get("model"),
                            "language": transcription.get("language"),
                        },
                    }
                ],
            },
        )


def process_analyze_video_faces(r: redis.Redis, job: dict):
    job_id = job.get("job_id")
    payload = job.get("payload") or {}
    source_video = payload.get("sourceVideoAsset") or {}

    if not job_id:
        raise ValueError("Job message missing job_id")
    if not source_video.get("storageKey"):
        raise ValueError("ANALYZE_VIDEO_FACES requires a source video storage key")

    video_clip_provider.release()
    with tempfile.TemporaryDirectory(prefix=f"tiluchi-face-analysis-{job_id}-") as tmp_dir:
        extension = os.path.splitext(source_video.get("name") or "source.mp4")[1] or ".mp4"
        video_path = os.path.join(tmp_dir, f"target{extension}")
        thumbnails_dir = os.path.join(tmp_dir, "identities")

        publish_progress(r, job_id, "PROCESSING", 8)
        storage_service.download_file(source_video["storageKey"], video_path)

        identities = face_identity_provider.analyze(
            video_path,
            thumbnails_dir,
            progress_callback=lambda progress: publish_progress(
                r, job_id, "PROCESSING", progress
            ),
        )
        publish_progress(
            r,
            job_id,
            "COMPLETED",
            100,
            {
                "status": "ok",
                "sourceVideoAssetId": source_video.get("id"),
                "identityCount": len(identities),
                "identities": identities,
            },
        )


def process_face_swap(r: redis.Redis, job: dict):
    job_id = job.get("job_id")
    project_id = job.get("project_id")
    payload = job.get("payload") or {}
    source_video = payload.get("sourceVideoAsset") or {}
    source_image = payload.get("sourceImageAsset") or {}

    if not job_id or not project_id:
        raise ValueError("Job message missing job_id or project_id")
    if not source_video.get("storageKey") or not source_image.get("storageKey"):
        raise ValueError("FACE_SWAP requires source video and image storage keys")
    if not payload.get("consentLogId"):
        raise ValueError("FACE_SWAP requires consentLogId")

    video_clip_provider.release()

    with tempfile.TemporaryDirectory(prefix=f"tiluchi-face-{job_id}-") as tmp_dir:
        input_dir = os.path.join(tmp_dir, "input")
        output_dir = os.path.join(tmp_dir, "output")
        os.makedirs(input_dir, exist_ok=True)
        os.makedirs(output_dir, exist_ok=True)

        video_extension = os.path.splitext(source_video.get("name") or "source.mp4")[1] or ".mp4"
        image_extension = os.path.splitext(source_image.get("name") or "face.png")[1] or ".png"
        video_path = os.path.join(input_dir, f"target{video_extension}")
        image_path = os.path.join(input_dir, f"source{image_extension}")
        result_path = os.path.join(output_dir, f"face-swap-result{video_extension}")

        publish_progress(r, job_id, "PROCESSING", 15)
        storage_service.download_file(source_video["storageKey"], video_path)

        publish_progress(r, job_id, "PROCESSING", 30)
        storage_service.download_file(source_image["storageKey"], image_path)

        target_identities = payload.get("targetIdentities") or []
        if not target_identities and payload.get("targetIdentityId"):
            target_identities = [
                {
                    "id": payload.get("targetIdentityId"),
                    "referenceFrameNumber": payload.get("referenceFrameNumber", 0),
                    "referenceFacePosition": payload.get("referenceFacePosition", 0),
                }
            ]
        if not target_identities:
            raise ValueError("FACE_SWAP requires at least one target identity")

        current_video_path = video_path
        for index, identity in enumerate(target_identities):
            is_last = index == len(target_identities) - 1
            pass_output_path = (
                result_path
                if is_last
                else os.path.join(output_dir, f"face-swap-pass-{index + 1}{video_extension}")
            )
            publish_progress(
                r,
                job_id,
                "PROCESSING",
                35 + round(50 * index / len(target_identities)),
            )
            face_swap_provider.swap(
                image_path,
                current_video_path,
                pass_output_path,
                reference_frame_number=max(
                    0, int(identity.get("referenceFrameNumber", 0))
                ),
                reference_face_position=max(
                    0, int(identity.get("referenceFacePosition", 0))
                ),
            )
            current_video_path = pass_output_path

        result_mime = source_video.get("mimeType") or "video/mp4"
        result_name = f"face-swap-{source_video.get('name') or 'result.mp4'}"
        storage_key = f"projects/{project_id}/face_swap_result_video/{job_id}-result{video_extension}"

        publish_progress(r, job_id, "PROCESSING", 90)
        storage_service.upload_file(result_path, storage_key, result_mime)

        publish_progress(
            r,
            job_id,
            "COMPLETED",
            100,
            {
                "status": "ok",
                "generatedAssets": [
                    {
                        "name": result_name,
                        "kind": "FACE_SWAP_RESULT_VIDEO",
                        "mimeType": result_mime,
                        "sizeBytes": os.path.getsize(result_path),
                        "storageKey": storage_key,
                        "metadata": {
                            "provider": "facefusion",
                            "model": face_swap_provider.model,
                            "executionProvider": face_swap_provider.execution_provider,
                            "sourceVideoAssetId": source_video.get("id"),
                            "sourceImageAssetId": source_image.get("id"),
                            "consentLogId": payload.get("consentLogId"),
                            "faceAnalysisJobId": payload.get("faceAnalysisJobId"),
                            "targetIdentityIds": [
                                identity.get("id") for identity in target_identities
                            ],
                            "targetIdentities": target_identities,
                        },
                    }
                ],
            },
        )

def process_final_mix(r: redis.Redis, job: dict):
    job_id = job.get("job_id")
    project_id = job.get("project_id")
    payload = job.get("payload") or {}
    instrumental_asset = payload.get("instrumentalAsset") or {}
    recorded_take_asset = payload.get("recordedTakeAsset") or {}

    if not job_id or not project_id:
        raise ValueError("Job message missing job_id or project_id")
    if not instrumental_asset.get("storageKey") or not recorded_take_asset.get("storageKey"):
        raise ValueError("GENERATE_FINAL_MIX requires instrumental and recorded take storage keys")

    with tempfile.TemporaryDirectory(prefix=f"tiluchi-mix-{job_id}-") as tmp_dir:
        instrumental_name = instrumental_asset.get("name") or "instrumental.wav"
        take_name = recorded_take_asset.get("name") or "recorded-take.wav"
        instrumental_extension = os.path.splitext(instrumental_name)[1] or ".wav"
        take_extension = os.path.splitext(take_name)[1] or ".wav"
        instrumental_path = os.path.join(tmp_dir, f"instrumental{instrumental_extension}")
        take_path = os.path.join(tmp_dir, f"take{take_extension}")
        output_path = os.path.join(tmp_dir, "final-mix.wav")

        publish_progress(r, job_id, "PROCESSING", 20)
        storage_service.download_file(instrumental_asset["storageKey"], instrumental_path)

        publish_progress(r, job_id, "PROCESSING", 35)
        storage_service.download_file(recorded_take_asset["storageKey"], take_path)

        instrumental_volume = float(payload.get("instrumentalVolume") or 0.9)
        vocal_volume = float(payload.get("vocalVolume") or 1.0)
        ffmpeg_cmd = None
        if imageio_ffmpeg is not None:
            try:
                ffmpeg_cmd = imageio_ffmpeg.get_ffmpeg_exe()
            except Exception:
                ffmpeg_cmd = None
        ffmpeg_cmd = ffmpeg_cmd or shutil.which("ffmpeg")

        publish_progress(r, job_id, "PROCESSING", 70)
        if ffmpeg_cmd:
            subprocess.run([
                ffmpeg_cmd,
                "-y",
                "-i",
                instrumental_path,
                "-i",
                take_path,
                "-filter_complex",
                f"[0:a]volume={instrumental_volume}[a0];[1:a]volume={vocal_volume}[a1];[a0][a1]amix=inputs=2:duration=longest:normalize=0[aout]",
                "-map",
                "[aout]",
                "-c:a",
                "pcm_s16le",
                output_path,
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        else:
            shutil.copyfile(instrumental_path, output_path)

        storage_key = f"projects/{project_id}/final_mix/{job_id}-final-mix.wav"
        publish_progress(r, job_id, "PROCESSING", 90)
        storage_service.upload_file(output_path, storage_key, "audio/wav")

        publish_progress(
            r,
            job_id,
            "COMPLETED",
            100,
            {
                "status": "ok",
                "provider": "local_ffmpeg_amix",
                "generatedAssets": [
                    {
                        "name": f"final-mix-{instrumental_name}.wav",
                        "kind": "FINAL_MIX",
                        "mimeType": "audio/wav",
                        "sizeBytes": os.path.getsize(output_path),
                        "storageKey": storage_key,
                        "metadata": {
                            "provider": "local_ffmpeg_amix",
                            "instrumentalAssetId": instrumental_asset.get("id"),
                            "recordedTakeAssetId": recorded_take_asset.get("id"),
                            "instrumentalVolume": instrumental_volume,
                            "vocalVolume": vocal_volume,
                        },
                    }
                ],
            },
        )

def process_analyze_audio(r: redis.Redis, job: dict):
    job_id = job.get("job_id")
    payload = job.get("payload") or {}
    source_asset = payload.get("sourceAsset") or {}

    if not job_id:
        raise ValueError("Job message missing job_id")
    if not source_asset.get("storageKey"):
        raise ValueError("ANALYZE_AUDIO requires payload.sourceAsset.storageKey")

    with tempfile.TemporaryDirectory(prefix=f"tiluchi-analysis-{job_id}-") as tmp_dir:
        original_name = source_asset.get("name") or "original-audio.wav"
        input_extension = os.path.splitext(original_name)[1] or ".wav"
        input_path = os.path.join(tmp_dir, f"audio{input_extension}")

        publish_progress(r, job_id, "PROCESSING", 20)
        storage_service.download_file(source_asset["storageKey"], input_path)

        publish_progress(r, job_id, "PROCESSING", 65)
        decoded_path = extract_audio_to_wav(input_path, tmp_dir)
        analysis = audio_analysis_provider.analyze(decoded_path)
        transcription_path = decoded_path
        analysis["transcriptionAudioSource"] = "original_mix"
        publish_progress(
            r,
            job_id,
            "PROCESSING",
            68,
            {"stage": "vocal_isolation"},
        )
        try:
            separated = audio_provider.separate(
                decoded_path,
                os.path.join(tmp_dir, "transcription-stems"),
            )
            transcription_path = separated["vocals"]
            analysis["transcriptionAudioSource"] = "demucs_vocals"
        except Exception as error:
            print(
                "[AI Worker] Vocal isolation failed; transcribing original mix: "
                f"{error}"
            )
        publish_progress(
            r,
            job_id,
            "PROCESSING",
            72,
            {"stage": "transcription"},
        )
        try:
            transcription = transcription_provider.transcribe(transcription_path)
        finally:
            transcription_provider.release()
        analysis["transcription"] = transcription
        lyric_boundaries = [
            float(segment.get("end") or 0)
            for segment in transcription.get("segments") or []
        ]
        analysis["suggestedCuts"] = suggest_scene_cuts(
            float(analysis.get("durationSeconds") or 0),
            float(analysis.get("tempo") or 0),
            [float(value) for value in analysis.get("beats") or []],
            lyric_boundaries + [
                float(value) for value in analysis.get("onsets") or []
            ],
        )
        analysis["suggestedScenes"] = len(analysis["suggestedCuts"]) + 1
        analysis["sourceAssetId"] = source_asset.get("id")
        analysis["sourceAssetName"] = original_name

        publish_progress(r, job_id, "COMPLETED", 100, analysis)

def process_generate_storyboard(r: redis.Redis, job: dict):
    job_id = job.get("job_id")
    payload = job.get("payload") or {}
    visual_prompt = (payload.get("visualPrompt") or "").strip()
    audio_analysis = payload.get("audioAnalysis") or {}

    if not job_id:
        raise ValueError("Job message missing job_id")
    if not visual_prompt:
        raise ValueError("GENERATE_STORYBOARD requires visualPrompt")
    if not audio_analysis:
        raise ValueError("GENERATE_STORYBOARD requires audioAnalysis")

    publish_progress(r, job_id, "PROCESSING", 35)
    storyboard = storyboard_provider.generate(audio_analysis, visual_prompt)
    storyboard["analysisJobId"] = payload.get("analysisJobId")

    publish_progress(r, job_id, "COMPLETED", 100, storyboard)

def process_generate_video_clips(r: redis.Redis, job: dict):
    job_id = job.get("job_id")
    project_id = job.get("project_id")
    payload = job.get("payload") or {}
    storyboard = payload.get("storyboard") or []
    style = payload.get("style") or "cinematic"
    source_audio = payload.get("sourceAudioAsset") or {}

    if not job_id or not project_id:
        raise ValueError("Job message missing job_id or project_id")
    if not storyboard:
        raise ValueError("GENERATE_VIDEO_CLIPS requires storyboard scenes")
    if not source_audio.get("storageKey"):
        raise ValueError("GENERATE_VIDEO_CLIPS requires source audio for lyric synchronization")

    with tempfile.TemporaryDirectory(prefix=f"tiluchi-clips-{job_id}-") as tmp_dir:
        generated_assets = []
        total = len(storyboard)
        output_paths = [
            os.path.join(tmp_dir, f"scene-{index}.mp4")
            for index in range(1, total + 1)
        ]
        audio_name = source_audio.get("name") or "music.wav"
        audio_path = os.path.join(tmp_dir, f"source{os.path.splitext(audio_name)[1] or '.wav'}")
        storage_service.download_file(source_audio["storageKey"], audio_path)

        def report_generation_progress(progress: int, stage: str):
            stage_parts = stage.split(":")
            stage_name = stage_parts[0]
            scene_index = int(stage_parts[1]) if len(stage_parts) > 1 else None
            stage_scene_count = int(stage_parts[2]) if len(stage_parts) > 2 else total
            publish_progress(
                r,
                job_id,
                "PROCESSING",
                min(94, max(10, progress)),
                {
                    "stage": stage_name,
                    "sceneIndex": scene_index,
                    "sceneCount": stage_scene_count,
                },
            )

        try:
            video_clip_provider.generate_sequence(
                storyboard,
                style,
                tmp_dir,
                output_paths=output_paths,
                progress_callback=report_generation_progress,
                source_audio_path=audio_path,
            )
        finally:
            video_clip_provider.release()

        for index, (scene, local_path) in enumerate(
            zip(storyboard, output_paths), start=1
        ):
            clip_name = f"scene-{index}.mp4"
            generation_metadata = {}
            metadata_path = f"{local_path}.json"
            if os.path.isfile(metadata_path):
                with open(metadata_path, "r", encoding="utf-8") as metadata_file:
                    generation_metadata = json.load(metadata_file)

            storage_key = f"projects/{project_id}/video_clip/{job_id}-{clip_name}"
            storage_service.upload_file(local_path, storage_key, "video/mp4")
            generated_assets.append({
                "name": f"clip-{index}-{style}.mp4",
                "kind": "VIDEO_CLIP",
                "mimeType": "video/mp4",
                "sizeBytes": os.path.getsize(local_path),
                "durationSeconds": scene.get("durationSeconds"),
                "storageKey": storage_key,
                "metadata": {
                    "provider": "stable_video_diffusion_sequence",
                    "generation": generation_metadata,
                    "storyboardJobId": payload.get("storyboardJobId"),
                    "sceneIndex": scene.get("sceneIndex", index),
                    "scene": scene,
                    "style": style,
                },
            })
            publish_progress(
                r,
                job_id,
                "PROCESSING",
                min(98, 94 + int(index / total * 4)),
            )

        publish_progress(
            r,
            job_id,
            "COMPLETED",
            100,
            {
                "status": "ok",
                "provider": "stable_video_diffusion_sequence",
                "sceneCount": total,
                "generatedAssets": generated_assets,
            },
        )

def process_compose_videoclip(r: redis.Redis, job: dict):
    job_id = job.get("job_id")
    project_id = job.get("project_id")
    payload = job.get("payload") or {}
    source_audio = payload.get("sourceAudioAsset") or {}
    clip_assets = payload.get("clipAssets") or []

    if not job_id or not project_id:
        raise ValueError("Job message missing job_id or project_id")
    if not source_audio.get("storageKey") or not clip_assets:
        raise ValueError("COMPOSE_VIDEOCLIP requires source audio and clip assets")

    with tempfile.TemporaryDirectory(prefix=f"tiluchi-compose-{job_id}-") as tmp_dir:
        audio_name = source_audio.get("name") or "music.wav"
        audio_extension = os.path.splitext(audio_name)[1] or ".wav"
        audio_path = os.path.join(tmp_dir, f"music{audio_extension}")

        publish_progress(r, job_id, "PROCESSING", 15)
        storage_service.download_file(source_audio["storageKey"], audio_path)
        extract_audio_to_wav(audio_path, tmp_dir, "music.wav")

        clip_paths = []
        scenes = []
        for index, clip_asset in enumerate(clip_assets, start=1):
            clip_path = os.path.join(tmp_dir, f"clip-{index}.mp4")
            storage_service.download_file(clip_asset["storageKey"], clip_path)
            clip_paths.append(clip_path)
            metadata = clip_asset.get("metadata") or {}
            if metadata.get("scene"):
                scenes.append(metadata["scene"])
            publish_progress(r, job_id, "PROCESSING", min(80, 15 + int(index / len(clip_assets) * 55)))

        output_path = os.path.join(tmp_dir, "final-videoclip.mp4")
        video_clip_provider.compose(audio_name, clip_paths, scenes, output_path)

        storage_key = f"projects/{project_id}/final_videoclip/{job_id}-final.mp4"
        publish_progress(r, job_id, "PROCESSING", 92)
        storage_service.upload_file(output_path, storage_key, "video/mp4")

        publish_progress(
            r,
            job_id,
            "COMPLETED",
            100,
            {
                "status": "ok",
                "provider": "stable_video_diffusion_sequence",
                "generatedAssets": [
                    {
                        "name": f"videoclip-{audio_name}.mp4",
                        "kind": "FINAL_VIDEOCLIP",
                        "mimeType": "video/mp4",
                        "sizeBytes": os.path.getsize(output_path),
                        "storageKey": storage_key,
                        "metadata": {
                            "provider": "stable_video_diffusion_sequence",
                            "sourceAudioAssetId": source_audio.get("id"),
                            "clipAssetIds": [asset.get("id") for asset in clip_assets],
                        },
                    }
                ],
            },
        )

def main():
    print("==================================================")
    print("  TiluchiRecords - AI Worker Daemon Starting      ")
    print("==================================================")
    
    verify_ffmpeg()
    verify_model_cache()
    
    r = connect_redis()
    
    # Try pinging Redis with retry loop
    connected = False
    for attempt in range(1, 11):
        try:
            r.ping()
            print(f"[AI Worker] Successfully connected to Redis on attempt {attempt}.")
            connected = True
            break
        except Exception as e:
            print(f"[AI Worker] Redis connection attempt {attempt}/10 failed: {e}. Retrying in 2s...")
            time.sleep(2)

    if not connected:
        print("[AI Worker] Could not connect to Redis. Running in standalone idle mode.")
        while True:
            time.sleep(5)

    print(f"[AI Worker] Listening for jobs on Redis queue '{settings.jobs_queue_name}'...")
    recovered_jobs = recover_inflight_jobs(r)
    if recovered_jobs:
        print(f"[AI Worker] Recovered {recovered_jobs} interrupted job(s).")
    
    while True:
        try:
            job = {}
            raw_message = reserve_job(r, timeout=5)
            if not raw_message:
                continue

            job = json.loads(raw_message)
            job_id = job.get("job_id")
            job_type = job.get("type")
            
            print(f"[AI Worker] Received Job: ID={job_id}, Type={job_type}")
            
            publish_progress(r, job_id, "PROCESSING", 5)

            if job_type == "AUDIO_SEPARATION":
                process_audio_separation(r, job)
            elif job_type == "GENERATE_KARAOKE":
                process_generate_karaoke(r, job)
            elif job_type == "GENERATE_FINAL_MIX":
                process_final_mix(r, job)
            elif job_type == "FACE_SWAP":
                process_face_swap(r, job)
            elif job_type == "ANALYZE_VIDEO_FACES":
                process_analyze_video_faces(r, job)
            elif job_type == "ANALYZE_AUDIO":
                process_analyze_audio(r, job)
            elif job_type == "GENERATE_STORYBOARD":
                process_generate_storyboard(r, job)
            elif job_type == "GENERATE_VIDEO_CLIPS":
                process_generate_video_clips(r, job)
            elif job_type == "COMPOSE_VIDEOCLIP":
                process_compose_videoclip(r, job)
            else:
                time.sleep(1)
                publish_progress(r, job_id, "COMPLETED", 100, {"status": "ok"})

            print(f"[AI Worker] Finished Job ID={job_id}")
            acknowledge_job(r, raw_message)

        except Exception as e:
            print(f"[AI Worker] Error processing job from queue: {e}")
            failed_job_id = locals().get("job", {}).get("job_id")
            if failed_job_id:
                publish_progress(r, failed_job_id, "FAILED", 100, error=str(e))
            failed_raw_message = locals().get("raw_message")
            if failed_raw_message:
                acknowledge_job(r, failed_raw_message)
            time.sleep(1)

if __name__ == "__main__":
    main()
