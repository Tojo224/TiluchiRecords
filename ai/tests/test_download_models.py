import json

from scripts import download_models


def test_resolve_components_expands_all_without_duplicates():
    assert download_models.resolve_components(["all"]) == list(
        download_models.COMPONENTS
    )
    assert download_models.resolve_components(["whisper", "whisper"]) == [
        "whisper"
    ]


def test_prepare_models_writes_manifest(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(download_models, "model_root", lambda: tmp_path)
    monkeypatch.setattr(download_models, "ensure_storage", lambda: None)
    monkeypatch.setattr(
        download_models,
        "DOWNLOADERS",
        {
            "demucs": lambda: calls.append("demucs") or {"model": "test"},
        },
    )

    manifest = download_models.prepare_models(["demucs"])

    assert calls == ["demucs"]
    assert manifest["components"]["demucs"]["model"] == "test"
    saved = json.loads((tmp_path / "model-manifest.json").read_text())
    assert saved["components"] == manifest["components"]
