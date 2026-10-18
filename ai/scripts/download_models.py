import argparse
import gc
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config import settings


COMPONENTS = (
    "demucs",
    "whisper",
    "diffusion",
    "video-diffusion",
    "facefusion",
)
MINIMUM_FREE_BYTES = 15 * 1024**3


def model_root() -> Path:
    return Path(settings.model_cache_dir)


def ensure_storage() -> None:
    root = model_root()
    root.mkdir(parents=True, exist_ok=True)
    probe = root / ".write-test"
    try:
        probe.write_text("ok", encoding="ascii")
        probe.unlink()
    except OSError as error:
        raise RuntimeError(f"Model cache is not writable: {root}") from error

    free = shutil.disk_usage(root).free
    if free < MINIMUM_FREE_BYTES:
        raise RuntimeError(
            "At least 15 GB of free space is required to prepare the AI models. "
            f"Available: {free / 1024**3:.2f} GB"
        )
    print(f"[models] Cache: {root} ({free / 1024**3:.2f} GB free)")


def download_demucs() -> dict:
    import torch
    from demucs.pretrained import get_model

    torch_home = Path(os.getenv("TORCH_HOME", model_root() / "torch"))
    torch_home.mkdir(parents=True, exist_ok=True)
    torch.hub.set_dir(str(torch_home / "hub"))
    model = get_model(settings.demucs_model)
    del model
    gc.collect()
    return {"model": settings.demucs_model, "cache": str(torch_home)}


def download_whisper() -> dict:
    from faster_whisper import WhisperModel

    cache = model_root() / "whisper"
    cache.mkdir(parents=True, exist_ok=True)
    model = WhisperModel(
        settings.whisper_model,
        device="cpu",
        compute_type="int8",
        download_root=str(cache),
    )
    del model
    gc.collect()
    return {"model": settings.whisper_model, "cache": str(cache)}


def download_huggingface(repo_id: str) -> dict:
    from huggingface_hub import snapshot_download

    cache = model_root() / "huggingface"
    cache.mkdir(parents=True, exist_ok=True)
    token = os.getenv("HF_TOKEN") or None
    snapshot_path = snapshot_download(
        repo_id=repo_id,
        cache_dir=str(cache),
        token=token,
    )
    return {"model": repo_id, "snapshot": snapshot_path, "cache": str(cache)}


def download_diffusion() -> dict:
    return download_huggingface(settings.diffusion_model)


def download_video_diffusion() -> dict:
    return download_huggingface(settings.video_diffusion_model)


def download_facefusion() -> dict:
    entrypoint = Path(settings.facefusion_path) / "facefusion.py"
    if not entrypoint.is_file():
        raise RuntimeError(f"FaceFusion installation not found: {entrypoint}")

    command = [
        sys.executable,
        str(entrypoint),
        "force-download",
        "--download-providers",
        "github",
        "huggingface",
        "--download-scope",
        "full",
        "--log-level",
        "info",
    ]
    completed = subprocess.run(
        command,
        cwd=settings.facefusion_path,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            f"FaceFusion model download failed with code {completed.returncode}"
        )
    return {
        "model": settings.facefusion_model,
        "assets": str(Path(settings.facefusion_path) / ".assets"),
    }


DOWNLOADERS: dict[str, Callable[[], dict]] = {
    "demucs": download_demucs,
    "whisper": download_whisper,
    "diffusion": download_diffusion,
    "video-diffusion": download_video_diffusion,
    "facefusion": download_facefusion,
}


def resolve_components(requested: list[str]) -> list[str]:
    if "all" in requested:
        return list(COMPONENTS)
    return list(dict.fromkeys(requested))


def prepare_models(requested: list[str]) -> dict:
    ensure_storage()
    selected = resolve_components(requested)
    results = {}
    for index, component in enumerate(selected, start=1):
        print(f"[models] ({index}/{len(selected)}) Preparing {component}...")
        try:
            results[component] = DOWNLOADERS[component]()
        except Exception as error:
            raise RuntimeError(
                f"Could not prepare '{component}'. Check Internet access, free "
                f"space, model permissions and HF_TOKEN. Detail: {error}"
            ) from error
        print(f"[models] {component} ready.")

    manifest = {
        "preparedAt": datetime.now(timezone.utc).isoformat(),
        "components": results,
    }
    manifest_path = model_root() / "model-manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=True),
        encoding="utf-8",
    )
    print(f"[models] Manifest written to {manifest_path}")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download and persist the local AI models used by TiluchiRecords."
    )
    parser.add_argument(
        "components",
        nargs="+",
        choices=("all", *COMPONENTS),
        help="Model groups to prepare.",
    )
    args = parser.parse_args()
    try:
        prepare_models(args.components)
    except Exception as error:
        print(f"[models] ERROR: {error}", file=sys.stderr)
        return 1
    print("[models] All requested models are ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
