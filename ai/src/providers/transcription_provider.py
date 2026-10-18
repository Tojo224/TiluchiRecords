import gc
import os
from typing import Dict, List


class FasterWhisperTranscriptionProvider:
    """Transcribes and translates lyrics locally with timestamped Whisper segments."""

    def __init__(
        self,
        model_size: str = "small",
        cache_dir: str = "/models/whisper",
        device: str = "cpu",
        compute_type: str = "int8",
    ):
        self.model_size = model_size
        self.cache_dir = cache_dir
        self.device = device
        self.compute_type = compute_type
        self._model = None

    def transcribe(self, audio_path: str) -> Dict:
        model = self._get_model()
        original_segments, info = model.transcribe(
            audio_path,
            task="transcribe",
            beam_size=5,
            temperature=0,
            word_timestamps=True,
            condition_on_previous_text=False,
            vad_filter=False,
        )
        original = self._materialize(original_segments)
        language = str(getattr(info, "language", "") or "unknown")
        probability = float(getattr(info, "language_probability", 0.0) or 0.0)

        if language.lower().startswith("en"):
            translated = [dict(segment) for segment in original]
        else:
            translated_segments, _ = model.transcribe(
                audio_path,
                task="translate",
                language=language if language != "unknown" else None,
                beam_size=5,
                temperature=0,
                word_timestamps=False,
                condition_on_previous_text=False,
                vad_filter=False,
            )
            translated = self._materialize(translated_segments, include_words=False)

        return {
            "provider": "faster_whisper",
            "model": self.model_size,
            "device": self.device,
            "computeType": self.compute_type,
            "language": language,
            "languageProbability": round(probability, 4),
            "text": " ".join(segment["text"] for segment in original).strip(),
            "translatedText": " ".join(
                segment["text"] for segment in translated
            ).strip(),
            "segments": original,
            "translatedSegments": translated,
        }

    def _get_model(self):
        if self._model is not None:
            return self._model
        try:
            from faster_whisper import WhisperModel
        except ImportError as error:
            raise RuntimeError("faster-whisper is not installed in the AI worker") from error
        os.makedirs(self.cache_dir, exist_ok=True)
        self._model = WhisperModel(
            self.model_size,
            device=self.device,
            compute_type=self.compute_type,
            download_root=self.cache_dir,
        )
        return self._model

    def _materialize(self, segments, include_words: bool = True) -> List[Dict]:
        result: List[Dict] = []
        for segment in segments:
            text = str(getattr(segment, "text", "") or "").strip()
            if not text:
                continue
            item = {
                "start": round(float(getattr(segment, "start", 0.0)), 3),
                "end": round(float(getattr(segment, "end", 0.0)), 3),
                "text": text,
            }
            words = getattr(segment, "words", None)
            if include_words and words:
                item["words"] = [
                    {
                        "start": round(float(word.start), 3),
                        "end": round(float(word.end), 3),
                        "word": str(word.word).strip(),
                        "probability": round(float(word.probability), 4),
                    }
                    for word in words
                    if getattr(word, "start", None) is not None
                    and getattr(word, "end", None) is not None
                ]
            result.append(item)
        return result

    def release(self) -> None:
        self._model = None
        gc.collect()
