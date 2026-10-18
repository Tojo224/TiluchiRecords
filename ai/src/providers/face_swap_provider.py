import os
import subprocess
import sys
from pathlib import Path

from src.providers.base import FaceSwapProvider


class FaceFusionProvider(FaceSwapProvider):
    """Runs FaceFusion headlessly and returns an actually processed video."""

    def __init__(
        self,
        facefusion_path: str = "/opt/facefusion",
        execution_provider: str = "auto",
        model: str = "inswapper_128_fp16",
    ):
        self.facefusion_path = Path(facefusion_path)
        self.execution_provider = self._resolve_execution_provider(execution_provider)
        self.model = model

    def swap(
        self,
        source_image_path: str,
        target_video_path: str,
        output_path: str,
        reference_frame_number: int = 0,
        reference_face_position: int = 0,
    ) -> str:
        self._require_file(source_image_path, "Source face image")
        self._require_file(target_video_path, "Target video")

        entrypoint = self.facefusion_path / "facefusion.py"
        if not entrypoint.is_file():
            raise RuntimeError(f"FaceFusion installation not found at {entrypoint}")

        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        command = [
            sys.executable,
            str(entrypoint),
            "headless-run",
            "--source-paths",
            source_image_path,
            "--target-path",
            target_video_path,
            "--output-path",
            output_path,
            "--processors",
            "face_swapper",
            "--face-swapper-model",
            self.model,
            "--face-selector-mode",
            "reference",
            "--reference-face-position",
            str(max(0, int(reference_face_position))),
            "--reference-frame-number",
            str(max(0, int(reference_frame_number))),
            "--reference-face-distance",
            "0.3",
            "--execution-providers",
            self.execution_provider,
            "--execution-thread-count",
            "2",
            "--video-memory-strategy",
            "strict",
            "--output-video-encoder",
            "libx264",
            "--output-video-quality",
            "90",
            "--log-level",
            "info",
        ]
        completed = subprocess.run(
            command,
            cwd=self.facefusion_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            check=False,
        )
        if completed.returncode != 0:
            raise RuntimeError(f"FaceFusion failed: {self._tail(completed.stdout)}")
        if not output.is_file() or output.stat().st_size == 0:
            raise RuntimeError(
                "FaceFusion completed without a valid result video. "
                f"Output: {self._tail(completed.stdout)}"
            )
        return str(output)

    def process_music_clip(
        self,
        source_image_path: str,
        target_video_path: str,
        output_path: str,
        source_audio_path: str | None = None,
        lip_sync: bool = False,
    ) -> str:
        """Keep the synthetic performer identity and optionally sync singing."""
        self._require_file(source_image_path, "Performer reference image")
        self._require_file(target_video_path, "Generated music-video clip")
        if lip_sync:
            if not source_audio_path:
                raise ValueError("Lip sync requires the matching scene audio")
            self._require_file(source_audio_path, "Scene audio")

        entrypoint = self.facefusion_path / "facefusion.py"
        if not entrypoint.is_file():
            raise RuntimeError(f"FaceFusion installation not found at {entrypoint}")

        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        source_paths = [source_image_path]
        processors = ["face_swapper"]
        if lip_sync:
            source_paths.append(str(source_audio_path))
            processors.append("lip_syncer")

        command = [
            sys.executable,
            str(entrypoint),
            "headless-run",
            "--source-paths",
            *source_paths,
            "--target-path",
            target_video_path,
            "--output-path",
            output_path,
            "--processors",
            *processors,
            "--face-swapper-model",
            self.model,
            "--face-selector-mode",
            "one",
        ]
        if lip_sync:
            command.extend([
                "--lip-syncer-model",
                "edtalk_256",
                "--lip-syncer-weight",
                "0.7",
            ])
        command.extend([
            "--execution-providers",
            self.execution_provider,
            "--execution-thread-count",
            "2",
            "--video-memory-strategy",
            "strict",
            "--output-video-encoder",
            "libx264",
            "--output-video-quality",
            "90",
            "--log-level",
            "info",
        ])
        completed = subprocess.run(
            command,
            cwd=self.facefusion_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            check=False,
        )
        if completed.returncode != 0:
            raise RuntimeError(
                f"FaceFusion music-video processing failed: {self._tail(completed.stdout)}"
            )
        if not output.is_file() or output.stat().st_size == 0:
            raise RuntimeError(
                "FaceFusion completed without a valid music-video clip. "
                f"Output: {self._tail(completed.stdout)}"
            )
        return str(output)

    def _resolve_execution_provider(self, configured: str) -> str:
        if configured in {"cpu", "cuda"}:
            return configured
        try:
            import onnxruntime

            if "CUDAExecutionProvider" in onnxruntime.get_available_providers():
                return "cuda"
        except ImportError:
            pass
        return "cpu"

    def _require_file(self, path: str, label: str) -> None:
        if not os.path.isfile(path):
            raise FileNotFoundError(f"{label} not found: {path}")

    def _tail(self, value: str, length: int = 3000) -> str:
        normalized = (value or "no process output").strip()
        return normalized[-length:]


LocalFaceSwapProvider = FaceFusionProvider
