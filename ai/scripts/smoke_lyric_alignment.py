import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config import settings
from src.media_input import extract_audio_to_wav
from src.providers.audio_separation_provider import DemucsAudioSeparationProvider
from src.providers.music_video_provider import (
    LocalAudioAnalysisProvider,
    LocalStoryboardProvider,
    LocalVideoClipProvider,
    suggest_scene_cuts,
)
from src.providers.transcription_provider import FasterWhisperTranscriptionProvider
from src.storage import storage_service


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate lyric transcription, timestamp alignment, and first clip."
    )
    parser.add_argument("--storage-key", required=True)
    parser.add_argument(
        "--visual-prompt",
        default=(
            "cinematic realism with one recurring protagonist, a coherent location, "
            "consistent wardrobe, natural light, and clear full-frame composition"
        ),
    )
    parser.add_argument("--generate-first-clip", action="store_true")
    args = parser.parse_args()

    output_dir = Path("/models/smoke-tests/lyric-alignment")
    output_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="tiluchi-lyrics-smoke-") as temporary:
        source_path = Path(temporary) / "source.mpeg"
        storage_service.download_file(args.storage_key, str(source_path))
        decoded_path = extract_audio_to_wav(str(source_path), temporary)

        analysis = LocalAudioAnalysisProvider().analyze(decoded_path)
        demucs = DemucsAudioSeparationProvider(
            model=settings.demucs_model,
            device=settings.demucs_device,
        )
        separated = demucs.separate(
            decoded_path,
            str(Path(temporary) / "stems"),
        )

        whisper = FasterWhisperTranscriptionProvider(
            model_size=settings.whisper_model,
            cache_dir=str(Path(settings.model_cache_dir) / "whisper"),
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
        )
        try:
            transcription = whisper.transcribe(separated["vocals"])
        finally:
            whisper.release()

        analysis["transcription"] = transcription
        lyric_boundaries = [
            float(segment.get("end") or 0)
            for segment in transcription.get("segments") or []
        ]
        analysis["suggestedCuts"] = suggest_scene_cuts(
            float(analysis["durationSeconds"]),
            float(analysis["tempo"]),
            [float(value) for value in analysis.get("beats") or []],
            lyric_boundaries
            + [float(value) for value in analysis.get("onsets") or []],
        )
        analysis["suggestedScenes"] = len(analysis["suggestedCuts"]) + 1
        storyboard = LocalStoryboardProvider().generate(analysis, args.visual_prompt)

        report = {
            "storageKey": args.storage_key,
            "analysis": analysis,
            "storyboard": storyboard,
        }
        report_path = output_dir / "report.json"
        report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        clip_path = None
        if args.generate_first_clip:
            clip_path = output_dir / "first-lyric-scene.mp4"
            provider = LocalVideoClipProvider(
                model_id=settings.diffusion_model,
                cache_dir=str(Path(settings.model_cache_dir) / "huggingface"),
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
            )
            try:
                provider.generate_clip(
                    storyboard["scenes"][0],
                    "cinematic",
                    str(clip_path),
                )
            finally:
                provider.release()

        print(
            json.dumps(
                {
                    "language": transcription["language"],
                    "text": transcription["text"],
                    "translatedText": transcription["translatedText"],
                    "sceneCount": len(storyboard["scenes"]),
                    "firstScene": storyboard["scenes"][0],
                    "report": str(report_path),
                    "clip": str(clip_path) if clip_path else None,
                },
                ensure_ascii=False,
                indent=2,
            )
        )


if __name__ == "__main__":
    main()
