"""Shared validation helpers for future dataset manifests."""

from __future__ import annotations

from pathlib import Path
from typing import Any

VALID_SPLITS = {"train", "validation", "test"}
VALID_CONSENT_STATES = {"granted", "public_domain", "not_applicable"}


def validate_common(record: dict[str, Any], dataset_dir: Path) -> list[str]:
    """Validate common metadata and ensure referenced assets stay in the dataset."""
    errors: list[str] = []
    record_type = record.get("record_type")
    if record_type not in {"real", "synthetic"}:
        errors.append("record_type must be real or synthetic")

    if not isinstance(record.get("record_id"), str) or not record["record_id"].strip():
        errors.append("record_id must be a non-empty string")

    expected_splits = VALID_SPLITS if record_type == "real" else {"not_applicable"}
    if record.get("split") not in expected_splits:
        errors.append(
            "real records require train/validation/test split; synthetic records use not_applicable"
        )

    source = record.get("source")
    if not isinstance(source, dict):
        errors.append("source must be an object")
    else:
        for field in ("origin", "license", "consent_status"):
            if not isinstance(source.get(field), str) or not source[field].strip():
                errors.append(f"source.{field} must be a non-empty string")
        if source.get("consent_status") not in VALID_CONSENT_STATES:
            errors.append(
                "source.consent_status must be granted, public_domain, or not_applicable"
            )
        if source.get("consent_status") == "granted" and not source.get("consent_reference"):
            errors.append("source.consent_reference is required when consent_status is granted")

    assets = record.get("assets")
    if not isinstance(assets, dict):
        errors.append("assets must be an object mapping asset names to relative paths")
    else:
        for name, value in assets.items():
            if not isinstance(value, str) or not value.strip():
                errors.append(f"assets.{name} must be a non-empty relative path")
                continue
            asset_path = Path(value)
            if asset_path.is_absolute():
                errors.append(f"assets.{name} must be relative to its dataset folder")
                continue
            resolved = (dataset_dir / asset_path).resolve()
            try:
                resolved.relative_to(dataset_dir.resolve())
            except ValueError:
                errors.append(f"assets.{name} points outside its dataset folder")
                continue
            if not resolved.is_file():
                errors.append(f"assets.{name} file does not exist: {value}")

    if not isinstance(record.get("annotations"), dict):
        errors.append("annotations must be an object")

    return errors
