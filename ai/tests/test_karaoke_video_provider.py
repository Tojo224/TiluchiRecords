from pathlib import Path
from subprocess import CompletedProcess
from unittest.mock import patch

import pytest

from src.providers.karaoke_video_provider import KaraokeVideoProvider


def sample_transcription():
    return {
        "segments": [
            {
                "start": 2.0,
                "end": 4.0,
                "text": "Baila bajo la luna",
                "words": [
                    {"start": 2.0, "end": 2.5, "word": "Baila"},
                    {"start": 2.5, "end": 3.0, "word": "bajo"},
                    {"start": 3.0, "end": 3.25, "word": "la"},
                    {"start": 3.25, "end": 4.0, "word": "luna"},
                ],
            }
        ]
    }


def test_ass_appears_one_second_early_and_highlights_each_word(tmp_path):
    output = tmp_path / "karaoke.ass"
    provider = KaraokeVideoProvider(lead_seconds=1.0)

    lines = provider.write_ass(sample_transcription(), str(output))
    content = output.read_text(encoding="utf-8-sig")

    assert len(lines) == 1
    assert "Dialogue: 0,0:00:01.00,0:00:04.00" in content
    assert r"{\k100\alpha&HFF&}·{\alpha&H00&}" in content
    assert r"{\kf50}Baila" in content
    assert r"{\kf50} bajo" in content
    assert r"{\kf25} la" in content
    assert r"{\kf75} luna" in content


def test_long_lyrics_are_split_into_readable_lines(tmp_path):
    transcription = {
        "segments": [
            {
                "start": 1,
                "end": 10,
                "text": "uno dos tres cuatro cinco seis siete ocho nueve diez once",
            }
        ]
    }
    provider = KaraokeVideoProvider()

    lines = provider.write_ass(transcription, str(tmp_path / "split.ass"))

    assert len(lines) == 2
    assert all(len(line["words"]) <= 7 for line in lines)
    assert all(len(line["text"]) <= 44 for line in lines)


def test_render_maps_original_video_and_instrumental_audio(tmp_path):
    source = tmp_path / "source.mp4"
    instrumental = tmp_path / "instrumental.wav"
    output = tmp_path / "karaoke.mp4"
    subtitle = tmp_path / "karaoke.ass"
    source.write_bytes(b"video")
    instrumental.write_bytes(b"audio")
    provider = KaraokeVideoProvider()

    def fake_run(command, **_kwargs):
        Path(command[-1]).write_bytes(b"rendered")
        return CompletedProcess(command, 0, stdout="", stderr="")

    with (
        patch(
            "src.providers.karaoke_video_provider.ffmpeg_executable",
            return_value="ffmpeg",
        ),
        patch(
            "src.providers.karaoke_video_provider.subprocess.run",
            side_effect=fake_run,
        ) as run,
    ):
        result = provider.render(
            str(source),
            str(instrumental),
            sample_transcription(),
            str(output),
            str(subtitle),
        )

    command = run.call_args.args[0]
    assert command[command.index("-map") + 1] == "0:v:0"
    second_map = command.index("-map", command.index("-map") + 1)
    assert command[second_map + 1] == "1:a:0"
    assert "ass='" in command[command.index("-vf") + 1]
    assert result["lineCount"] == 1
    assert result["wordCount"] == 4
    assert output.read_bytes() == b"rendered"


def test_render_rejects_video_when_no_lyrics_are_detected(tmp_path):
    provider = KaraokeVideoProvider()

    with pytest.raises(ValueError, match="No se detecto"):
        provider.render(
            str(tmp_path / "source.mp4"),
            str(tmp_path / "instrumental.wav"),
            {"segments": []},
            str(tmp_path / "karaoke.mp4"),
            str(tmp_path / "karaoke.ass"),
        )
