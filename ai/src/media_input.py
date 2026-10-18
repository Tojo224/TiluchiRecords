import os
import shutil
import subprocess

try:
    import imageio_ffmpeg
except Exception:  # pragma: no cover - system FFmpeg remains available in Docker
    imageio_ffmpeg = None


def ffmpeg_executable() -> str:
    executable = shutil.which("ffmpeg")
    if not executable and imageio_ffmpeg is not None:
        try:
            executable = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            executable = None
    if not executable:
        raise RuntimeError("FFmpeg is required to decode the uploaded music file")
    return executable


def extract_audio_to_wav(input_path: str, output_dir: str, name: str = "decoded-audio.wav") -> str:
    """Decode an audio track from audio or video containers into a stable PCM input."""
    if not os.path.isfile(input_path):
        raise FileNotFoundError(f"Music input not found: {input_path}")

    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, name)
    completed = subprocess.run(
        [
            ffmpeg_executable(),
            "-y",
            "-i",
            input_path,
            "-map",
            "0:a:0",
            "-vn",
            "-ac",
            "2",
            "-ar",
            "44100",
            "-c:a",
            "pcm_s16le",
            output_path,
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if completed.returncode != 0 or not os.path.isfile(output_path):
        detail = (completed.stderr or "FFmpeg returned no diagnostic output").strip()[-2000:]
        raise ValueError(f"The uploaded file has no decodable audio track: {detail}")
    return output_path
