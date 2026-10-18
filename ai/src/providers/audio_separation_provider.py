import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict

from src.providers.base import AudioSeparationProvider


class DemucsAudioSeparationProvider(AudioSeparationProvider):
    """Separates vocals with the pretrained Hybrid Transformer Demucs model."""

    def __init__(self, model: str = "htdemucs", device: str = "auto"):
        self.model = model
        self.device = self._resolve_device(device)

    def separate(self, audio_path: str, output_dir: str) -> Dict[str, str]:
        if not os.path.isfile(audio_path):
            raise FileNotFoundError(f"Input audio not found: {audio_path}")

        os.makedirs(output_dir, exist_ok=True)
        command = [
            sys.executable,
            "-m",
            "demucs.separate",
            "--two-stems",
            "vocals",
            "--name",
            self.model,
            "--device",
            self.device,
            "--out",
            output_dir,
        ]
        if self.device == "cuda":
            command.extend(["--segment", "7"])
        command.append(audio_path)

        completed = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            check=False,
        )
        if completed.returncode != 0:
            raise RuntimeError(f"Demucs failed: {self._tail(completed.stdout)}")

        track_dir = Path(output_dir) / self.model / Path(audio_path).stem
        vocals_source = track_dir / "vocals.wav"
        instrumental_source = track_dir / "no_vocals.wav"
        if not vocals_source.is_file() or not instrumental_source.is_file():
            raise RuntimeError(
                "Demucs completed without producing vocals.wav and no_vocals.wav. "
                f"Output: {self._tail(completed.stdout)}"
            )

        vocals_path = Path(output_dir) / "vocals.wav"
        instrumental_path = Path(output_dir) / "instrumental.wav"
        shutil.copyfile(vocals_source, vocals_path)
        shutil.copyfile(instrumental_source, instrumental_path)
        return {
            "instrumental": str(instrumental_path),
            "vocals": str(vocals_path),
            "provider": "demucs",
            "model": self.model,
            "device": self.device,
        }

    def _resolve_device(self, configured: str) -> str:
        if configured in {"cpu", "cuda"}:
            return configured
        try:
            import torch

            return "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            return "cpu"

    def _tail(self, value: str, length: int = 2000) -> str:
        normalized = (value or "no process output").strip()
        return normalized[-length:]


LocalKaraokeAudioSeparationProvider = DemucsAudioSeparationProvider
