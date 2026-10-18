import os
import subprocess
from typing import Dict, List

from src.media_input import ffmpeg_executable


class KaraokeVideoProvider:
    """Burns word-timed karaoke lyrics into the original video."""

    def __init__(self, lead_seconds: float = 1.0):
        self.lead_seconds = max(0.0, min(float(lead_seconds), 3.0))

    def render(
        self,
        source_video_path: str,
        instrumental_path: str,
        transcription: Dict,
        output_path: str,
        subtitle_path: str,
    ) -> Dict:
        lines = self.write_ass(transcription, subtitle_path)
        if not lines:
            raise ValueError(
                "No se detecto una letra cantada con tiempos suficientes para crear el karaoke"
            )

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        escaped_subtitle_path = self._escape_filter_path(subtitle_path)
        command = [
            ffmpeg_executable(),
            "-y",
            "-i",
            source_video_path,
            "-i",
            instrumental_path,
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-vf",
            f"ass='{escaped_subtitle_path}'",
            "-map_metadata",
            "0",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            "-movflags",
            "+faststart",
            output_path,
        ]
        completed = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
        if completed.returncode != 0 or not os.path.isfile(output_path):
            detail = (completed.stderr or "FFmpeg returned no diagnostic output")[-2000:]
            raise RuntimeError(f"No se pudo renderizar el video karaoke: {detail}")

        return {
            "provider": "demucs_whisper_ass_karaoke",
            "subtitleFormat": "ASS",
            "subtitleLeadSeconds": self.lead_seconds,
            "lineCount": len(lines),
            "wordCount": sum(len(line["words"]) for line in lines),
        }

    def write_ass(self, transcription: Dict, output_path: str) -> List[Dict]:
        lines = self._lyric_lines(transcription.get("segments") or [])
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke,DejaVu Sans,42,&H0000D7FF,&H00FFFFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,55,55,48,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        events = []
        for line in lines:
            event_start = max(0.0, line["start"] - self.lead_seconds)
            pre_roll_cs = max(0, round((line["start"] - event_start) * 100))
            parts = []
            if pre_roll_cs:
                parts.append(
                    f"{{\\k{pre_roll_cs}\\alpha&HFF&}}·{{\\alpha&H00&}}"
                )
            words = line["words"]
            for index, word in enumerate(words):
                next_start = (
                    float(words[index + 1]["start"])
                    if index + 1 < len(words)
                    else float(word["end"])
                )
                duration_cs = max(1, round((next_start - float(word["start"])) * 100))
                separator = "" if index == 0 else " "
                parts.append(
                    f"{{\\kf{duration_cs}}}{separator}{self._escape_ass_text(word['word'])}"
                )
            events.append(
                "Dialogue: 0,"
                f"{self._ass_time(event_start)},{self._ass_time(line['end'])},"
                f"Karaoke,,0,0,0,,{''.join(parts)}"
            )

        with open(output_path, "w", encoding="utf-8-sig", newline="\n") as ass_file:
            ass_file.write(header)
            if events:
                ass_file.write("\n".join(events))
                ass_file.write("\n")
        return lines

    def _lyric_lines(self, segments: List[Dict]) -> List[Dict]:
        lines: List[Dict] = []
        for segment in segments:
            words = self._timed_words(segment)
            current: List[Dict] = []
            current_length = 0
            for word in words:
                word_text = str(word.get("word") or "").strip()
                if not word_text:
                    continue
                projected_length = current_length + len(word_text) + (1 if current else 0)
                if current and (len(current) >= 7 or projected_length > 44):
                    lines.append(self._line_from_words(current))
                    current = []
                    current_length = 0
                current.append({**word, "word": word_text})
                current_length += len(word_text) + (1 if len(current) > 1 else 0)
            if current:
                lines.append(self._line_from_words(current))
        return [line for line in lines if line["end"] > line["start"]]

    def _timed_words(self, segment: Dict) -> List[Dict]:
        words = [
            word
            for word in (segment.get("words") or [])
            if word.get("start") is not None and word.get("end") is not None
        ]
        if words:
            return words

        text_words = str(segment.get("text") or "").split()
        if not text_words:
            return []
        start = float(segment.get("start") or 0)
        end = max(start + 0.2, float(segment.get("end") or start + 0.2))
        duration = (end - start) / len(text_words)
        return [
            {
                "word": word,
                "start": start + index * duration,
                "end": start + (index + 1) * duration,
            }
            for index, word in enumerate(text_words)
        ]

    def _line_from_words(self, words: List[Dict]) -> Dict:
        return {
            "start": float(words[0]["start"]),
            "end": max(float(words[-1]["end"]), float(words[0]["start"]) + 0.2),
            "text": " ".join(str(word["word"]) for word in words),
            "words": words,
        }

    def _ass_time(self, seconds: float) -> str:
        centiseconds = max(0, round(float(seconds) * 100))
        hours, remainder = divmod(centiseconds, 360000)
        minutes, remainder = divmod(remainder, 6000)
        whole_seconds, fraction = divmod(remainder, 100)
        return f"{hours}:{minutes:02d}:{whole_seconds:02d}.{fraction:02d}"

    def _escape_ass_text(self, value: str) -> str:
        return str(value).replace("{", "(").replace("}", ")").replace("\n", " ")

    def _escape_filter_path(self, value: str) -> str:
        return value.replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
