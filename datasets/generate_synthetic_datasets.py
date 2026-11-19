"""Generate reproducible synthetic media datasets.

This utility creates media fixtures and JSONL metadata only. It does not call
the application, download models, train a model, or report model performance.
Requires Pillow and FFmpeg.
"""

from __future__ import annotations

import json
import math
import shutil
import struct
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
WIDTH, HEIGHT = 384, 216
FPS = 12
RATE = 22050


def write_wave(path: Path, seconds: float, tones: Iterable[tuple[float, float]]) -> list[int]:
    """Write a toy monophonic signal (not speech or a real musical recording)."""
    count = int(RATE * seconds)
    values: list[int] = []
    tones = tuple(tones)
    for index in range(count):
        time = index / RATE
        value = sum(
            amplitude * math.sin(2 * math.pi * frequency * time)
            for frequency, amplitude in tones
        )
        envelope = min(1.0, time * 5, max(0.0, (seconds - time) * 5))
        values.append(int(max(-1.0, min(1.0, value * envelope)) * 16000))
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(struct.pack(f"<{count}h", *values))
    return values


def mix_waves(path: Path, *signals: list[int]) -> None:
    count = min(map(len, signals))
    mixed = [
        int(max(-32768, min(32767, sum(signal[i] for signal in signals) / len(signals))))
        for i in range(count)
    ]
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(struct.pack(f"<{count}h", *mixed))


def draw_card(title: str, subtitle: str, frame: int, palette: tuple[str, str]) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), palette[0])
    draw = ImageDraw.Draw(image)
    offset = (frame * 5) % WIDTH
    draw.ellipse((25 + offset // 5, 25, 115 + offset // 5, 115), fill=palette[1])
    draw.rectangle((0, HEIGHT - 35, WIDTH, HEIGHT), fill="#0d1720")
    font = ImageFont.load_default()
    draw.text((22, 139), title, fill="white", font=font)
    draw.text((22, 159), subtitle, fill="#c9d7e2", font=font)
    draw.text((WIDTH - 130, 18), f"SYNTHETIC {frame:02d}", fill="#e9f4ff", font=font)
    return image


def draw_avatar(draw: ImageDraw.ImageDraw, x: int, y: int, color: str, label: str) -> None:
    """Draw a deliberately stylized geometric avatar, not a human photograph."""
    draw.ellipse((x - 40, y - 44, x + 40, y + 36), fill=color, outline="#ffffff", width=3)
    draw.ellipse((x - 20, y - 7, x - 10, y + 3), fill="#14202a")
    draw.ellipse((x + 10, y - 7, x + 20, y + 3), fill="#14202a")
    draw.arc((x - 17, y + 2, x + 17, y + 23), 5, 175, fill="#14202a", width=3)
    draw.rounded_rectangle((x - 53, y + 38, x + 53, y + 105), radius=20, fill="#243847")
    draw.text((x - 38, y + 112), label, fill="white", font=ImageFont.load_default())


def encode_video(frames: Path, output: Path, duration: float, audio: Path | None = None) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-framerate", str(FPS), "-i", str(frames / "frame_%03d.png"),
    ]
    if audio:
        command.extend(["-i", str(audio)])
    command.extend([
        "-t", f"{duration:.3f}", "-c:v", "libx264", "-preset", "ultrafast",
        "-crf", "30", "-pix_fmt", "yuv420p",
    ])
    if audio:
        command.extend(["-c:a", "aac", "-b:a", "64k", "-shortest"])
    command.append(str(output))
    subprocess.run(command, check=True, capture_output=True, text=True)


def make_frames(directory: Path, duration: float, painter) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for frame in range(int(duration * FPS)):
        painter(frame).save(directory / f"frame_{frame:03d}.png", optimize=True)


def write_manifest(dataset: str, record: dict) -> None:
    manifest = ROOT / dataset / "manifest.jsonl"
    manifest.parent.mkdir(parents=True, exist_ok=True)
    retained: list[str] = []
    if manifest.exists():
        for line in manifest.read_text(encoding="utf-8").splitlines():
            try:
                existing = json.loads(line)
            except json.JSONDecodeError:
                retained.append(line)
                continue
            source = existing.get("source", {}) if isinstance(existing, dict) else {}
            generated_by_this_tool = isinstance(source, dict) and str(
                source.get("origin", "")
            ).startswith("generated_locally_by_generate_synthetic_")
            if not generated_by_this_tool:
                retained.append(line)
    retained.append(json.dumps(record, ensure_ascii=False))
    manifest.write_text("\n".join(retained) + "\n", encoding="utf-8")


def common_record(record_id: str, assets: dict, annotations: dict) -> dict:
    return {
        "record_id": record_id,
        "record_type": "synthetic",
        "split": "not_applicable",
        "source": {
            "origin": "generated_locally_by_generate_synthetic_datasets.py",
            "license": "TiluchiRecords synthetic data; internal use",
            "consent_status": "not_applicable",
            "notes": "Procedurally generated fixture; contains no real people or recordings.",
        },
        "assets": assets,
        "annotations": {"synthetic": True, **annotations},
    }


def generate_karaoke(temp: Path) -> None:
    dataset = ROOT / "karaoke"
    data = dataset / "data"
    data.mkdir(exist_ok=True)
    duration = 4.0
    voice_path = data / "synthetic_vocal_tone.wav"
    instrumental_path = data / "synthetic_instrument_tone.wav"
    source_path = data / "synthetic_source_audio.wav"
    voice = write_wave(voice_path, duration, ((440, 0.48), (660, 0.18)))
    instrumental = write_wave(instrumental_path, duration, ((220, 0.35), (330, 0.2)))
    mix_waves(source_path, voice, instrumental)

    with tempfile.TemporaryDirectory() as temporary:
        frames = Path(temporary)
        make_frames(
            frames,
            duration,
            lambda frame: draw_card("KARAOKE SINTETICO", "Tonos de prueba + letra sintética", frame, ("#173247", "#08a88a")),
        )
        video_path = data / "synthetic_source_video.mp4"
        encode_video(frames, video_path, duration, source_path)

    lyrics_path = data / "synthetic_lyrics.json"
    lyrics_path.write_text(
        json.dumps(
            {
                "synthetic": True,
                "language": "es",
                "segments": [
                    {"start": 0.0, "end": 1.8, "text": "Luz de muestra en el cielo"},
                    {"start": 1.8, "end": 3.8, "text": "suena el ritmo sintético"},
                ],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    write_manifest(
        "karaoke",
        common_record(
            "karaoke-synth-001",
            {
                "source_video": "data/synthetic_source_video.mp4",
                "source_audio": "data/synthetic_source_audio.wav",
                "vocals_audio": "data/synthetic_vocal_tone.wav",
                "instrumental_audio": "data/synthetic_instrument_tone.wav",
                "lyrics_json": "data/synthetic_lyrics.json",
            },
            {
                "language": "es",
                "content_kind": "synthetic_tones_and_illustrative_lyrics",
                "warning": "The vocal stem is a synthesized tone, not a human voice.",
            },
        ),
    )


def generate_face_swap(temp: Path) -> None:
    dataset = ROOT / "face_swap"
    data = dataset / "data"
    data.mkdir(exist_ok=True)
    source = Image.new("RGB", (256, 256), "#d9edf4")
    draw = ImageDraw.Draw(source)
    draw.ellipse((55, 30, 201, 205), fill="#f0bb91", outline="#263849", width=5)
    draw.arc((62, 23, 194, 96), 180, 360, fill="#263849", width=20)
    draw.ellipse((93, 103, 108, 118), fill="#192634")
    draw.ellipse((148, 103, 163, 118), fill="#192634")
    draw.arc((103, 125, 153, 166), 5, 175, fill="#9d344b", width=5)
    draw.text((57, 223), "SYNTHETIC AVATAR", fill="#172a39", font=ImageFont.load_default())
    source.save(data / "synthetic_source_face.png", optimize=True)

    duration = 3.0
    with tempfile.TemporaryDirectory() as temporary:
        frames = Path(temporary)

        def paint(frame: int) -> Image.Image:
            image = Image.new("RGB", (WIDTH, HEIGHT), "#18232d")
            draw = ImageDraw.Draw(image)
            draw.text((12, 8), "DATOS SINTETICOS - AVATARES GEOMETRICOS", fill="white", font=ImageFont.load_default())
            draw_avatar(draw, 116 + (frame % 4) * 2, 72, "#d88b63", "synthetic-person-a")
            draw_avatar(draw, 272 - (frame % 4) * 2, 72, "#8cb8ce", "synthetic-person-b")
            return image

        make_frames(frames, duration, paint)
        video_path = data / "synthetic_target_video.mp4"
        encode_video(frames, video_path, duration)

    annotation_path = data / "synthetic_face_annotations.json"
    annotation_path.write_text(
        json.dumps(
            {
                "synthetic": True,
                "frame_rate": FPS,
                "target_person_ids": ["synthetic-person-a", "synthetic-person-b"],
                "samples": [
                    {"time": 0.0, "person_id": "synthetic-person-a", "bbox_xyxy": [63, 28, 169, 177]},
                    {"time": 0.0, "person_id": "synthetic-person-b", "bbox_xyxy": [219, 28, 325, 177]},
                ],
                "warning": "Illustrated geometric avatars; not face-detection ground truth.",
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    write_manifest(
        "face_swap",
        common_record(
            "face-swap-synth-001",
            {
                "source_face_image": "data/synthetic_source_face.png",
                "target_video": "data/synthetic_target_video.mp4",
                "face_annotations_json": "data/synthetic_face_annotations.json",
            },
            {
                "target_person_ids": ["synthetic-person-a", "synthetic-person-b"],
                "annotation_kind": "illustrative_boxes_only",
                "warning": "The avatars are generated drawings, not real identities or model labels.",
            },
        ),
    )


def generate_music_video(temp: Path) -> None:
    dataset = ROOT / "music_video"
    data = dataset / "data"
    data.mkdir(exist_ok=True)
    duration = 6.0
    audio_path = data / "synthetic_music.wav"
    write_wave(audio_path, duration, ((196, 0.28), (247, 0.22), (392, 0.14)))
    with tempfile.TemporaryDirectory() as temporary:
        frames = Path(temporary)

        def paint(frame: int) -> Image.Image:
            scene = (frame // (FPS * 2)) % 3
            palettes = [("#17243c", "#46b9bd"), ("#3b2449", "#edaa59"), ("#182f2b", "#84d17d")]
            titles = ["SCENE 01 - DAWN", "SCENE 02 - MOTION", "SCENE 03 - CALM"]
            image = draw_card("VIDEO MUSICAL SINTETICO", titles[scene], frame, palettes[scene])
            return image

        make_frames(frames, duration, paint)
        reference_path = data / "synthetic_reference_video.mp4"
        encode_video(frames, reference_path, duration, audio_path)

    annotation_path = data / "synthetic_scene_annotations.json"
    annotation_path.write_text(
        json.dumps(
            {
                "synthetic": True,
                "language": "es",
                "creative_direction": "Paleta geométrica cambia por secciones musicales con ritmo sintético.",
                "scenes": [
                    {"start": 0.0, "end": 2.0, "description": "Amanecer abstracto en azul y turquesa.", "music_section": "intro"},
                    {"start": 2.0, "end": 4.0, "description": "Formas cálidas y movimiento gráfico.", "music_section": "middle"},
                    {"start": 4.0, "end": 6.0, "description": "Cierre abstracto verde con ritmo suave.", "music_section": "outro"},
                ],
                "warning": "Synthetic scene annotation, not model output.",
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    write_manifest(
        "music_video",
        common_record(
            "music-video-synth-001",
            {
                "source_audio": "data/synthetic_music.wav",
                "reference_video": "data/synthetic_reference_video.mp4",
                "scene_annotations_json": "data/synthetic_scene_annotations.json",
            },
            {
                "language": "es",
                "scenes": [
                    {"start": 0.0, "end": 2.0, "label": "intro"},
                    {"start": 2.0, "end": 4.0, "label": "middle"},
                    {"start": 4.0, "end": 6.0, "label": "outro"},
                ],
                "warning": "Synthetic audiovisual data; not generated by the application.",
            },
        ),
    )


def main() -> None:
    if not shutil.which("ffmpeg"):
        raise SystemExit("FFmpeg is required to create the synthetic video fixtures.")
    with tempfile.TemporaryDirectory() as temporary:
        temp = Path(temporary)
        generate_karaoke(temp)
        generate_face_swap(temp)
        generate_music_video(temp)
    print("Generated synthetic records for karaoke, face_swap, and music_video.")
    print("These records are marked synthetic and split=not_applicable.")


if __name__ == "__main__":
    main()
