from pathlib import Path
import subprocess
from unittest.mock import Mock, patch

import pytest

from src.media_input import extract_audio_to_wav, ffmpeg_executable


def test_extract_audio_maps_first_audio_track_and_writes_pcm(tmp_path: Path):
    source = tmp_path / "music.mp4"
    source.write_bytes(b"container")

    def run(command, **_kwargs):
        Path(command[-1]).write_bytes(b"wav")
        return Mock(returncode=0, stderr="")

    with patch("src.media_input.ffmpeg_executable", return_value="ffmpeg"), patch(
        "src.media_input.subprocess.run", side_effect=run
    ) as subprocess_run:
        result = extract_audio_to_wav(str(source), str(tmp_path / "output"))

    command = subprocess_run.call_args.args[0]
    assert command[command.index("-map") + 1] == "0:a:0"
    assert "-vn" in command
    assert command[command.index("-c:a") + 1] == "pcm_s16le"
    assert Path(result).is_file()


def test_extract_audio_rejects_container_without_audio(tmp_path: Path):
    source = tmp_path / "silent.mp4"
    source.write_bytes(b"container")

    with patch("src.media_input.ffmpeg_executable", return_value="ffmpeg"), patch(
        "src.media_input.subprocess.run",
        return_value=Mock(returncode=1, stderr="Stream map '0:a:0' matches no streams"),
    ):
        with pytest.raises(ValueError, match="no decodable audio track"):
            extract_audio_to_wav(str(source), str(tmp_path / "output"))


def test_extracts_real_aac_track_from_mp4_container(tmp_path: Path):
    source = tmp_path / "music.mp4"
    subprocess.run(
        [
            ffmpeg_executable(),
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=320x180:d=1",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=1",
            "-shortest",
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            str(source),
        ],
        check=True,
    )

    decoded = Path(extract_audio_to_wav(str(source), str(tmp_path / "decoded")))

    assert decoded.is_file()
    assert decoded.stat().st_size > 44
