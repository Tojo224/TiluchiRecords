import argparse
import hashlib
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.providers.audio_separation_provider import DemucsAudioSeparationProvider
from src.providers.face_swap_provider import FaceFusionProvider
from src.providers.music_video_provider import (
    LocalVideoClipProvider,
    StableDiffusionImageGenerator,
    StableVideoDiffusionGenerator,
)


OUTPUT_DIR = Path(os.getenv("SMOKE_OUTPUT_DIR", "/models/smoke-tests"))


def smoke_demucs() -> None:
    work_dir = OUTPUT_DIR / "demucs"
    work_dir.mkdir(parents=True, exist_ok=True)
    sample_rate = 44100
    timeline = np.linspace(0, 3, sample_rate * 3, endpoint=False)
    left = 0.35 * np.sin(2 * np.pi * 220 * timeline)
    right = left + 0.2 * np.sin(2 * np.pi * 880 * timeline)
    source = work_dir / "input.wav"
    sf.write(source, np.stack([left, right], axis=1), sample_rate)

    provider = DemucsAudioSeparationProvider("htdemucs", "auto")
    result = provider.separate(str(source), str(work_dir / "output"))
    sizes = {
        name: Path(result[name]).stat().st_size
        for name in ("vocals", "instrumental")
    }
    if any(size <= 44 for size in sizes.values()):
        raise RuntimeError(f"Demucs generated invalid stems: {sizes}")
    print({"engine": "demucs", "device": provider.device, "sizes": sizes})


def diffusion_generator() -> StableDiffusionImageGenerator:
    return StableDiffusionImageGenerator(
        model_id=os.getenv(
            "DIFFUSION_MODEL",
            "stable-diffusion-v1-5/stable-diffusion-v1-5",
        ),
        cache_dir="/models/huggingface",
        device="auto",
        inference_steps=int(os.getenv("DIFFUSION_STEPS", "25")),
        width=int(os.getenv("DIFFUSION_WIDTH", "768")),
        height=int(os.getenv("DIFFUSION_HEIGHT", "432")),
    )


def smoke_diffusion() -> None:
    work_dir = OUTPUT_DIR / "diffusion"
    work_dir.mkdir(parents=True, exist_ok=True)
    generator = diffusion_generator()
    motion_generator = StableVideoDiffusionGenerator(
        model_id=os.getenv(
            "VIDEO_DIFFUSION_MODEL",
            "stabilityai/stable-video-diffusion-img2vid-xt",
        ),
        cache_dir="/models/huggingface",
        device="auto",
        frame_count=int(os.getenv("VIDEO_DIFFUSION_FRAMES", "14")),
        inference_steps=int(os.getenv("VIDEO_DIFFUSION_STEPS", "12")),
        decode_chunk_size=int(os.getenv("VIDEO_DIFFUSION_DECODE_CHUNK", "2")),
        segment_seconds=10,
        max_segments=1,
    )
    provider = LocalVideoClipProvider(
        image_generator=generator,
        motion_generator=motion_generator,
    )
    output = work_dir / "temporal-scene.mp4"
    provider.generate_clip(
        {
            "description": (
                "A Bolivian musician performing under colorful stage lights, "
                "charango in hand, expressive cinematic portrait"
            ),
            "durationSeconds": 3,
            "intensity": "media",
        },
        "cinematic realism",
        str(output),
    )
    if output.stat().st_size <= 1024:
        raise RuntimeError("Temporal diffusion smoke test generated an invalid video")

    sample_dir = work_dir / "samples"
    sample_dir.mkdir(exist_ok=True)
    for existing in sample_dir.glob("*.png"):
        existing.unlink()
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(output), "-vf", "fps=2",
            str(sample_dir / "sample-%02d.png"),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=True,
    )
    samples = sorted(sample_dir.glob("*.png"))
    hashes = {
        hashlib.sha256(sample.read_bytes()).hexdigest()
        for sample in samples
    }
    if len(samples) < 2 or len(hashes) < 2:
        raise RuntimeError("Temporal video does not contain distinct sampled frames")
    print({
        "engine": "stable_video_diffusion",
        "output": str(output),
        "bytes": output.stat().st_size,
        "sampledFrames": len(samples),
        "distinctFrameHashes": len(hashes),
    })


def smoke_facefusion() -> None:
    work_dir = OUTPUT_DIR / "facefusion"
    work_dir.mkdir(parents=True, exist_ok=True)
    generator = diffusion_generator()
    source = work_dir / "source-face.png"
    target = work_dir / "target-face.png"
    source_metadata = generator.generate(
        "front-facing studio portrait photo of an adult man, neutral expression, centered face, realistic",
        str(source),
    )
    generator.generate(
        "front-facing studio portrait photo of an adult woman, neutral expression, centered face, realistic",
        str(target),
    )
    generator.release()

    target_video = work_dir / "target.mp4"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            str(target),
            "-t",
            "2",
            "-r",
            "12",
            "-vf",
            "scale=512:512,format=yuv420p",
            "-c:v",
            "libx264",
            str(target_video),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=True,
    )

    provider = FaceFusionProvider(
        "/opt/facefusion",
        os.getenv("FACEFUSION_EXECUTION_PROVIDER", "auto"),
        os.getenv("FACEFUSION_MODEL", "inswapper_128_fp16"),
    )
    output = work_dir / "face-swap.mp4"
    provider.swap(str(source), str(target_video), str(output), target_face_index=0)
    if output.stat().st_size <= 1024:
        raise RuntimeError("FaceFusion smoke test generated an invalid video")
    print({
        "engine": "facefusion",
        "executionProvider": provider.execution_provider,
        "sourceSeed": source_metadata["seed"],
        "output": str(output),
        "bytes": output.stat().st_size,
    })


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("engine", choices=("demucs", "diffusion", "facefusion", "all"))
    args = parser.parse_args()

    if args.engine in ("demucs", "all"):
        smoke_demucs()
    if args.engine in ("diffusion", "all"):
        smoke_diffusion()
    if args.engine in ("facefusion", "all"):
        smoke_facefusion()


if __name__ == "__main__":
    main()
