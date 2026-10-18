from pathlib import Path
from subprocess import CompletedProcess
from unittest.mock import patch

from PIL import Image

from src.providers.audio_separation_provider import DemucsAudioSeparationProvider
from src.providers.face_swap_provider import FaceFusionProvider
from src.providers.face_identity_provider import cluster_face_detections
from src.providers.music_video_provider import (
    LocalStoryboardProvider,
    LocalVideoClipProvider,
    suggest_scene_cuts,
)
from src.providers.transcription_provider import FasterWhisperTranscriptionProvider


def test_demucs_provider_returns_real_model_outputs(tmp_path):
    source = tmp_path / "song.wav"
    source.write_bytes(b"audio")
    output_dir = tmp_path / "output"
    provider = DemucsAudioSeparationProvider(model="htdemucs", device="cpu")

    def fake_run(command, **kwargs):
        track_dir = output_dir / "htdemucs" / "song"
        track_dir.mkdir(parents=True)
        (track_dir / "vocals.wav").write_bytes(b"vocals")
        (track_dir / "no_vocals.wav").write_bytes(b"instrumental")
        assert "--two-stems" in command
        assert "vocals" in command
        return CompletedProcess(command, 0, stdout="separated")

    with patch("src.providers.audio_separation_provider.subprocess.run", side_effect=fake_run):
        result = provider.separate(str(source), str(output_dir))

    assert Path(result["vocals"]).read_bytes() == b"vocals"
    assert Path(result["instrumental"]).read_bytes() == b"instrumental"
    assert result["provider"] == "demucs"
    assert result["model"] == "htdemucs"


def test_facefusion_provider_runs_headless_with_selected_face(tmp_path):
    facefusion_dir = tmp_path / "facefusion"
    facefusion_dir.mkdir()
    (facefusion_dir / "facefusion.py").write_text("# entrypoint", encoding="utf-8")
    source = tmp_path / "source.png"
    target = tmp_path / "target.mp4"
    output = tmp_path / "result.mp4"
    source.write_bytes(b"image")
    target.write_bytes(b"video")
    provider = FaceFusionProvider(str(facefusion_dir), "cpu", "inswapper_128_fp16")

    def fake_run(command, **kwargs):
        output.write_bytes(b"processed-video")
        assert "headless-run" in command
        assert command[command.index("--reference-face-position") + 1] == "2"
        assert command[command.index("--reference-frame-number") + 1] == "145"
        assert command[command.index("--execution-providers") + 1] == "cpu"
        return CompletedProcess(command, 0, stdout="completed")

    with patch("src.providers.face_swap_provider.subprocess.run", side_effect=fake_run):
        result = provider.swap(
            str(source),
            str(target),
            str(output),
            reference_frame_number=145,
            reference_face_position=2,
        )

    assert result == str(output)
    assert output.read_bytes() == b"processed-video"


def test_face_detections_are_grouped_by_identity_across_scenes():
    detections = [
        {"embedding": [1.0, 0.0, 0.0], "quality": 10, "frameNumber": 0},
        {"embedding": [0.99, 0.02, 0.0], "quality": 12, "frameNumber": 90},
        {"embedding": [0.0, 1.0, 0.0], "quality": 8, "frameNumber": 0},
        {"embedding": [0.01, 0.98, 0.0], "quality": 9, "frameNumber": 180},
    ]

    clusters = cluster_face_detections(detections, distance_threshold=0.2)

    assert len(clusters) == 2
    assert [len(cluster["detections"]) for cluster in clusters] == [2, 2]
    assert clusters[0]["best"]["frameNumber"] == 90


def test_facefusion_music_clip_combines_identity_and_lip_sync(tmp_path):
    facefusion_dir = tmp_path / "facefusion"
    facefusion_dir.mkdir()
    (facefusion_dir / "facefusion.py").write_text("# entrypoint", encoding="utf-8")
    source = tmp_path / "performer.png"
    target = tmp_path / "scene.mp4"
    audio = tmp_path / "voice.wav"
    output = tmp_path / "result.mp4"
    source.write_bytes(b"image")
    target.write_bytes(b"video")
    audio.write_bytes(b"audio")
    provider = FaceFusionProvider(str(facefusion_dir), "cuda", "inswapper_128_fp16")

    def fake_run(command, **kwargs):
        output.write_bytes(b"lip-synced-video")
        sources = command[command.index("--source-paths") + 1:command.index("--target-path")]
        processors = command[command.index("--processors") + 1:command.index("--face-swapper-model")]
        assert sources == [str(source), str(audio)]
        assert processors == ["face_swapper", "lip_syncer"]
        assert command[command.index("--lip-syncer-model") + 1] == "edtalk_256"
        assert command[command.index("--execution-providers") + 1] == "cuda"
        return CompletedProcess(command, 0, stdout="completed")

    with patch("src.providers.face_swap_provider.subprocess.run", side_effect=fake_run):
        result = provider.process_music_clip(
            str(source), str(target), str(output), str(audio), lip_sync=True
        )

    assert result == str(output)
    assert output.read_bytes() == b"lip-synced-video"


def test_video_provider_generates_related_keyframes_and_temporal_frames(tmp_path):
    class FakeImageGenerator:
        calls = []

        def generate(
            self,
            prompt,
            output_path,
            reference_path=None,
            seed=None,
            strength=0.38,
        ):
            self.calls.append((prompt, reference_path, seed))
            Image.new("RGB", (64, 36), (seed % 255, 20, 30)).save(output_path)
            assert prompt.startswith("same singer")
            assert "neon city" in prompt
            return {"provider": "stable_diffusion", "model": "test-model", "seed": seed}

        def release(self):
            pass

    class FakeMotionGenerator:
        calls = []

        def generate_frames(self, **kwargs):
            self.calls.append(kwargs)
            kwargs["progress_callback"](0.5)
            kwargs["progress_callback"](1.0)
            frames = [
                Image.new("RGB", (64, 36), (index * 30, 50, 80))
                for index in range(4)
            ]
            return frames, {
                "provider": "stable_video_diffusion",
                "generatedFrameCount": len(frames),
            }

        def release(self):
            pass

    image_generator = FakeImageGenerator()
    motion_generator = FakeMotionGenerator()
    provider = LocalVideoClipProvider(
        image_generator=image_generator,
        motion_generator=motion_generator,
    )
    outputs = [tmp_path / "scene-1.mp4", tmp_path / "scene-2.mp4"]
    commands = []

    def fake_run(command):
        commands.append(command)
        Path(command[-1]).write_bytes(b"playable-video")

    provider._ffmpeg_exe = lambda: "ffmpeg"
    provider._run = fake_run
    progress = []
    result = provider.generate_sequence(
        [
            {
                "description": "neon city at night",
                "durationSeconds": 6,
                "intensity": "suave",
            },
            {
                "description": "neon city rooftop performance",
                "durationSeconds": 7,
                "intensity": "alta",
            },
        ],
        "cinematic",
        str(tmp_path),
        [str(output) for output in outputs],
        progress_callback=lambda value, stage: progress.append((value, stage)),
    )

    assert result == [str(output) for output in outputs]
    assert all(output.read_bytes() == b"playable-video" for output in outputs)
    assert image_generator.calls[0][1] is None
    assert image_generator.calls[1][1] is None
    assert motion_generator.calls[0]["transition_reference_path"] is None
    assert motion_generator.calls[1]["transition_reference_path"] is None
    assert any(stage.startswith("animation:") and value > 32 for value, stage in progress)
    assert "fps=16" in " ".join(commands[0])
    assert "minterpolate" not in " ".join(commands[0])
    assert "zoompan" not in " ".join(commands[0])
    assert commands[0][commands[0].index("-r") + 1] == "16"
    assert commands[0][commands[0].index("-frames:v") + 1] == "96"
    metadata = Path(f"{outputs[1]}.json").read_text()
    assert '"provider": "stable_video_diffusion_sequence"' in metadata
    assert '"visualGuide"' in metadata


def test_storyboard_uses_clear_phases_and_scene_directions():
    storyboard = LocalStoryboardProvider().generate(
        {
            "durationSeconds": 60,
            "tempo": 123,
            "suggestedScenes": 4,
            "transcription": {
                "segments": [
                    {"start": 0, "end": 9, "text": "Camino solo bajo la lluvia"},
                    {"start": 9, "end": 20, "text": "recuerdo tu voz"},
                ],
                "translatedSegments": [
                    {"start": 0, "end": 9, "text": "I walk alone in the rain"},
                    {"start": 9, "end": 20, "text": "I remember your voice"},
                ],
            },
        },
        "una presentacion musical en una ciudad nocturna",
    )

    titles = [scene["title"] for scene in storyboard["scenes"]]
    durations = [scene["durationSeconds"] for scene in storyboard["scenes"]]
    assert titles[0] == "Apertura"
    assert storyboard["schemaVersion"] == "music-video-v2"
    assert "Punto alto" in titles
    assert titles[-1] == "Cierre"
    assert storyboard["scenes"][0]["startTime"] == 0
    assert storyboard["scenes"][-1]["endTime"] == 60
    assert all(5 <= duration <= 10 for duration in durations)
    assert len({scene["description"] for scene in storyboard["scenes"]}) == len(
        storyboard["scenes"]
    )
    assert storyboard["scenes"][0]["lyrics"] == "Camino solo bajo la lluvia"
    assert "I walk alone in the rain" in storyboard["scenes"][0]["generationPrompt"]
    assert all("Representa la letra" in scene["description"] for scene in storyboard["scenes"])
    assert storyboard["scenes"][0]["shotType"] == "PERFORMANCE"
    assert storyboard["scenes"][0]["lipSync"] is True
    assert any(scene["shotType"] == "NARRATIVE" for scene in storyboard["scenes"])
    assert len({scene["locationId"] for scene in storyboard["scenes"]}) >= 3
    assert all(scene["continuityMode"] == "IDENTITY_ONLY" for scene in storyboard["scenes"])


def test_storyboard_reuses_only_compatible_repeated_lyrics():
    chroma_a = [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
    chroma_b = [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
    storyboard = LocalStoryboardProvider().generate(
        {
            "durationSeconds": 40,
            "tempo": 120,
            "suggestedCuts": [8, 16, 24, 32],
            "sectionFeatures": [
                {"energyMean": 0.20, "chroma": chroma_a},
                {"energyMean": 0.16, "chroma": chroma_b},
                {"energyMean": 0.21, "chroma": chroma_a},
                {"energyMean": 0.18, "chroma": chroma_b},
                {"energyMean": 0.35, "chroma": chroma_a},
            ],
            "transcription": {
                "segments": [
                    {"start": 0, "end": 8, "text": "Baila conmigo bajo la luna"},
                    {"start": 8, "end": 16, "text": "Cruzo la ciudad buscando tu voz"},
                    {"start": 16, "end": 24, "text": "Baila conmigo bajo la luna"},
                    {"start": 24, "end": 32, "text": "Regreso a casa al amanecer"},
                    {"start": 32, "end": 40, "text": "Baila conmigo bajo la luna"},
                ],
            },
        },
        "videoclip nocturno",
    )

    first, different, repeated, bridge, climax = storyboard["scenes"]
    assert first["reusePolicy"] == "MASTER"
    assert first["sectionType"] == "CHORUS"
    assert different["reusePolicy"] == "MASTER"
    assert repeated["reusePolicy"] == "DIRECT"
    assert repeated["sourceSceneIndex"] == 1
    assert repeated["occurrenceIndex"] == 2
    assert bridge["reusePolicy"] == "MASTER"
    assert climax["reusePolicy"] == "VARIANT"
    assert climax["sourceSceneIndex"] == 1
    assert climax["energyDifference"] > 0.15
    assert storyboard["generationPlan"] == {
        "totalScenes": 5,
        "diffusionRuns": 3,
        "directReuses": 1,
        "variants": 1,
        "savedDiffusionRuns": 2,
    }


def test_storyboard_does_not_reuse_same_words_over_different_music():
    storyboard = LocalStoryboardProvider().generate(
        {
            "durationSeconds": 16,
            "tempo": 120,
            "suggestedCuts": [8],
            "sectionFeatures": [
                {"energyMean": 0.20, "chroma": [1.0] + [0.0] * 11},
                {"energyMean": 0.20, "chroma": [0.0, 1.0] + [0.0] * 10},
            ],
            "transcription": {
                "segments": [
                    {"start": 0, "end": 8, "text": "Vuelvo a bailar bajo la luna"},
                    {"start": 8, "end": 16, "text": "Vuelvo a bailar bajo la luna"},
                ],
            },
        },
        "videoclip nocturno",
    )

    assert [scene["reusePolicy"] for scene in storyboard["scenes"]] == [
        "MASTER",
        "MASTER",
    ]
    assert storyboard["generationPlan"]["savedDiffusionRuns"] == 0


def test_video_provider_skips_diffusion_for_repeated_scene(tmp_path):
    class FakeImageGenerator:
        def __init__(self):
            self.calls = []

        def generate(self, prompt, output_path, reference_path=None, seed=None, strength=0.38):
            self.calls.append(prompt)
            Image.new("RGB", (64, 36), (20, 30, 40)).save(output_path)
            return {"provider": "fake-image", "seed": seed}

        def release(self):
            pass

    class FakeMotionGenerator:
        def __init__(self):
            self.calls = []

        def generate_frames(self, **kwargs):
            self.calls.append(kwargs)
            return [Image.new("RGB", (64, 36), (index * 20, 30, 40)) for index in range(4)], {
                "provider": "fake-motion"
            }

        def release(self):
            pass

    images = FakeImageGenerator()
    motion = FakeMotionGenerator()
    provider = LocalVideoClipProvider(image_generator=images, motion_generator=motion)
    provider._ffmpeg_exe = lambda: "ffmpeg"
    commands = []

    def fake_run(command):
        commands.append(command)
        Path(command[-1]).write_bytes(b"video")

    provider._run = fake_run
    outputs = [tmp_path / "master.mp4", tmp_path / "variant.mp4"]
    scenes = [
        {
            "sceneIndex": 1,
            "description": "singer under moonlight",
            "durationSeconds": 6,
            "reusePolicy": "MASTER",
        },
        {
            "sceneIndex": 2,
            "description": "singer under moonlight",
            "durationSeconds": 6,
            "reusePolicy": "VARIANT",
            "sourceSceneIndex": 1,
            "occurrenceIndex": 2,
        },
    ]

    provider.generate_sequence(
        scenes,
        "cinematic",
        str(tmp_path),
        [str(path) for path in outputs],
    )

    assert len(images.calls) == 1
    assert len(motion.calls) == 1
    assert outputs[1].read_bytes() == b"video"
    assert any("crop=640:360" in " ".join(command) for command in commands)
    metadata = Path(f"{outputs[1]}.json").read_text()
    assert '"provider": "reused_generated_clip"' in metadata
    assert '"reusedFromSceneIndex": 1' in metadata


def test_scene_cuts_prefer_detected_musical_events():
    cuts = suggest_scene_cuts(
        duration=30,
        tempo=120,
        beats=[float(value) / 2 for value in range(1, 60)],
        onsets=[7.2, 13.4, 21.1],
    )

    boundaries = [0.0, *cuts, 30.0]
    durations = [boundaries[index + 1] - boundaries[index] for index in range(len(boundaries) - 1)]
    assert all(5 <= duration <= 10 for duration in durations)
    assert any(cut in {7.2, 13.4, 21.1} for cut in cuts)


def test_whisper_provider_returns_original_and_translated_timestamps():
    class Segment:
        def __init__(self, start, end, text):
            self.start = start
            self.end = end
            self.text = text
            self.words = []

    class Info:
        language = "es"
        language_probability = 0.98

    class FakeModel:
        def transcribe(self, _path, task, **_kwargs):
            if task == "translate":
                return iter([Segment(0, 4, "I still remember you")]), Info()
            return iter([Segment(0, 4, "Aun te recuerdo")]), Info()

    provider = FasterWhisperTranscriptionProvider()
    provider._model = FakeModel()
    result = provider.transcribe("song.wav")

    assert result["language"] == "es"
    assert result["text"] == "Aun te recuerdo"
    assert result["translatedText"] == "I still remember you"
    assert result["segments"][0]["start"] == 0
