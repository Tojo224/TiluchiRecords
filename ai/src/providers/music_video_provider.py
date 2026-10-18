import json
import hashlib
import gc
import math
import os
import re
import subprocess
import unicodedata
from difflib import SequenceMatcher
from typing import Callable, Dict, List, Optional

import librosa
import numpy as np
from PIL import Image

try:
    import imageio_ffmpeg
except Exception:  # pragma: no cover - runtime fallback for minimal environments
    imageio_ffmpeg = None


def suggest_scene_cuts(
    duration: float,
    tempo: float,
    beats: List[float],
    onsets: List[float],
) -> List[float]:
    """Choose musical cut points while keeping every normal scene at 5-10 seconds."""
    if duration <= 10:
        return []

    beat_duration = 60.0 / tempo if tempo > 0 else 0.5
    target_duration = max(5.0, min(10.0, beat_duration * 16))
    onset_candidates = sorted(
        {round(float(value), 3) for value in onsets if 0 < float(value) < duration}
    )
    beat_candidates = sorted(
        {round(float(value), 3) for value in beats if 0 < float(value) < duration}
    )
    cuts: List[float] = []
    current = 0.0

    while duration - current > 10:
        minimum = current + 5
        maximum = min(current + 10, duration - 5)
        desired = min(current + target_duration, maximum)
        available_onsets = [
            value for value in onset_candidates if minimum <= value <= maximum
        ]
        available_beats = [
            value for value in beat_candidates if minimum <= value <= maximum
        ]
        available = available_onsets or available_beats
        selected = (
            min(available, key=lambda value: abs(value - desired))
            if available
            else desired
        )
        selected = round(selected, 3)
        if selected <= current:
            break
        cuts.append(selected)
        current = selected

    return cuts


class LocalAudioAnalysisProvider:
    """Cost-free audio analysis provider based on librosa."""

    def analyze(self, audio_path: str) -> Dict:
        samples, sample_rate = librosa.load(audio_path, sr=None, mono=True)
        if samples.size == 0:
            raise ValueError("Input audio is empty")

        duration = float(librosa.get_duration(y=samples, sr=sample_rate))

        try:
            tempo, beat_frames = librosa.beat.beat_track(y=samples, sr=sample_rate)
            tempo_value = float(np.asarray(tempo).flatten()[0])
            beats = librosa.frames_to_time(beat_frames, sr=sample_rate).tolist()
        except Exception:
            tempo_value = 0.0
            beats = []

        energy = librosa.feature.rms(y=samples)[0]
        energy_mean = float(np.mean(energy)) if energy.size else 0.0
        energy_peak = float(np.max(energy)) if energy.size else 0.0
        try:
            onset_frames = librosa.onset.onset_detect(y=samples, sr=sample_rate)
            onsets = librosa.frames_to_time(onset_frames, sr=sample_rate).tolist()
        except Exception:
            onsets = []
        suggested_cuts = suggest_scene_cuts(
            duration,
            tempo_value,
            beats,
            onsets,
        )
        section_features = self._section_features(
            samples,
            sample_rate,
            [0.0, *suggested_cuts, duration],
        )

        return {
            "durationSeconds": round(duration, 3),
            "tempo": round(tempo_value, 2),
            "beats": [round(float(value), 3) for value in beats[:512]],
            "onsets": [round(float(value), 3) for value in onsets[:512]],
            "suggestedScenes": len(suggested_cuts) + 1,
            "suggestedCuts": [round(float(value), 3) for value in suggested_cuts],
            "energy": {
                "mean": round(energy_mean, 6),
                "peak": round(energy_peak, 6),
            },
            "sectionFeatures": section_features,
            "provider": "local_librosa",
        }

    def _section_features(
        self,
        samples: np.ndarray,
        sample_rate: int,
        boundaries: List[float],
    ) -> List[Dict]:
        """Summarize each proposed scene for repetition and energy comparison."""
        features: List[Dict] = []
        for index in range(len(boundaries) - 1):
            start = max(0.0, float(boundaries[index]))
            end = max(start, float(boundaries[index + 1]))
            start_sample = min(len(samples), int(start * sample_rate))
            end_sample = min(len(samples), max(start_sample + 1, int(end * sample_rate)))
            section = samples[start_sample:end_sample]
            if section.size == 0:
                features.append(self._empty_section_feature(index, start, end))
                continue
            section_rms = librosa.feature.rms(y=section)[0]
            try:
                chroma = librosa.feature.chroma_stft(y=section, sr=sample_rate)
                chroma_profile = np.mean(chroma, axis=1)
                norm = float(np.linalg.norm(chroma_profile))
                if norm > 0:
                    chroma_profile = chroma_profile / norm
            except Exception:
                chroma_profile = np.zeros(12, dtype=float)
            features.append({
                "sceneIndex": index + 1,
                "startTime": round(start, 3),
                "endTime": round(end, 3),
                "energyMean": round(float(np.mean(section_rms)), 6),
                "energyPeak": round(float(np.max(section_rms)), 6),
                "chroma": [round(float(value), 6) for value in chroma_profile],
            })
        return features

    def _empty_section_feature(self, index: int, start: float, end: float) -> Dict:
        return {
            "sceneIndex": index + 1,
            "startTime": round(start, 3),
            "endTime": round(end, 3),
            "energyMean": 0.0,
            "energyPeak": 0.0,
            "chroma": [0.0] * 12,
        }


class LocalStoryboardProvider:
    """Deterministic local storyboard provider that keeps the LLM contract."""

    def generate(self, audio_analysis: Dict, visual_prompt: str) -> Dict:
        duration = float(audio_analysis.get("durationSeconds") or 30)
        tempo = float(audio_analysis.get("tempo") or 0)
        beats = [float(value) for value in audio_analysis.get("beats") or []]
        cuts = [float(value) for value in audio_analysis.get("suggestedCuts") or []]
        transcription = audio_analysis.get("transcription") or {}
        if not self._valid_cuts(cuts, duration):
            cuts = suggest_scene_cuts(duration, tempo, beats, [])
        boundaries = [0.0, *cuts, duration]
        scene_count = len(boundaries) - 1
        section_features = audio_analysis.get("sectionFeatures") or []

        scenes: List[Dict] = []
        for index in range(scene_count):
            start = round(boundaries[index], 3)
            end = round(boundaries[index + 1], 3)
            title, intensity, direction = self._scene_direction(index, scene_count)
            original_lyrics = self._text_for_interval(
                transcription.get("segments") or [], start, end
            )
            translated_lyrics = self._text_for_interval(
                transcription.get("translatedSegments") or [], start, end
            )
            lyric_source = original_lyrics or "Pasaje instrumental"
            lyric_meaning = (
                translated_lyrics
                or original_lyrics
                or "instrumental musical passage"
            )
            shot = self._shot_design(index, scene_count, lyric_meaning)
            musical_features = self._features_for_scene(
                section_features,
                index,
                start,
                end,
            )
            scenes.append({
                "sceneIndex": index + 1,
                "title": title,
                "startTime": start,
                "endTime": end,
                "durationSeconds": round(max(end - start, 1.0), 2),
                "description": (
                    f'{direction}. {shot["action"]}. Representa la letra: '
                    f'"{lyric_source}".'
                ),
                "lyrics": original_lyrics,
                "translatedLyrics": translated_lyrics,
                "generationPrompt": self._generation_prompt(
                    visual_prompt,
                    lyric_meaning,
                    shot,
                ),
                "visualConcept": visual_prompt,
                "intensity": intensity,
                "shotType": shot["shotType"],
                "locationId": shot["locationId"],
                "locationDescription": shot["location"],
                "camera": shot["camera"],
                "subjectAction": shot["action"],
                "showsPerformer": shot["showsPerformer"],
                "lipSync": bool(shot["lipSync"] and original_lyrics),
                "continuityMode": "IDENTITY_ONLY",
                "visualStyle": "cinematic",
                "musicCue": (
                    f"Alinear con la frase entre {start:.1f}s y {end:.1f}s y con "
                    f"un ritmo aproximado de {round(float(tempo))} BPM."
                ),
                "musicalFeatures": musical_features,
            })

        self._annotate_repetitions(scenes)
        generation_plan = {
            "totalScenes": len(scenes),
            "diffusionRuns": sum(
                1 for scene in scenes if scene.get("reusePolicy") == "MASTER"
            ),
            "directReuses": sum(
                1 for scene in scenes if scene.get("reusePolicy") == "DIRECT"
            ),
            "variants": sum(
                1 for scene in scenes if scene.get("reusePolicy") == "VARIANT"
            ),
        }
        generation_plan["savedDiffusionRuns"] = (
            generation_plan["totalScenes"] - generation_plan["diffusionRuns"]
        )

        return {
            "provider": "lyric_aligned_storyboard_generator",
            "schemaVersion": "music-video-v2",
            "visualPrompt": visual_prompt,
            "audioAnalysis": audio_analysis,
            "generationPlan": generation_plan,
            "scenes": scenes,
        }

    def _features_for_scene(
        self,
        features: List[Dict],
        index: int,
        start: float,
        end: float,
    ) -> Dict:
        if index < len(features):
            return dict(features[index])
        return {
            "sceneIndex": index + 1,
            "startTime": start,
            "endTime": end,
            "energyMean": 0.0,
            "energyPeak": 0.0,
            "chroma": [0.0] * 12,
        }

    def _annotate_repetitions(self, scenes: List[Dict]) -> None:
        groups: List[Dict] = []
        for scene in scenes:
            normalized = self._normalize_lyrics(scene.get("lyrics") or "")
            scene["normalizedLyrics"] = normalized
            best_match = None
            best_score = 0.0
            best_components = None

            for group in groups:
                components = self._repetition_components(scene, group["master"])
                if not self._can_reuse(normalized, group["normalized"], components):
                    continue
                if components["score"] > best_score:
                    best_match = group
                    best_score = components["score"]
                    best_components = components

            if best_match is None:
                group_id = f"section-{len(groups) + 1}"
                scene.update({
                    "sectionType": "INSTRUMENTAL" if not normalized else "VERSE",
                    "repetitionGroupId": group_id,
                    "occurrenceIndex": 1,
                    "reusePolicy": "MASTER",
                    "sourceSceneIndex": None,
                    "repetitionScore": 1.0,
                })
                groups.append({
                    "id": group_id,
                    "master": scene,
                    "normalized": normalized,
                    "members": [scene],
                })
                continue

            occurrence = len(best_match["members"]) + 1
            source = best_match["master"]
            energy_difference = best_components["energyDifference"]
            is_climax = (
                "alta" in str(scene.get("intensity") or "").lower()
                or str(scene.get("intensity") or "").lower() == "final"
            )
            policy = (
                "VARIANT"
                if is_climax
                or energy_difference > 0.15
                or best_components["durationSimilarity"] < 0.96
                else "DIRECT"
            )
            scene.update({
                "sectionType": "CHORUS",
                "repetitionGroupId": best_match["id"],
                "occurrenceIndex": occurrence,
                "reusePolicy": policy,
                "sourceSceneIndex": source["sceneIndex"],
                "repetitionScore": round(best_score, 4),
                "textSimilarity": round(best_components["textSimilarity"], 4),
                "musicalSimilarity": round(best_components["musicalSimilarity"], 4),
                "energyDifference": round(energy_difference, 4),
            })
            source["sectionType"] = "CHORUS"
            best_match["members"].append(scene)

    def _repetition_components(self, scene: Dict, master: Dict) -> Dict:
        current_text = scene.get("normalizedLyrics") or ""
        master_text = master.get("normalizedLyrics") or ""
        text_similarity = SequenceMatcher(None, current_text, master_text).ratio()
        duration = max(float(scene.get("durationSeconds") or 0), 0.001)
        master_duration = max(float(master.get("durationSeconds") or 0), 0.001)
        duration_similarity = min(duration, master_duration) / max(duration, master_duration)
        current_features = scene.get("musicalFeatures") or {}
        master_features = master.get("musicalFeatures") or {}
        musical_similarity = self._cosine_similarity(
            current_features.get("chroma") or [],
            master_features.get("chroma") or [],
        )
        has_musical_profile = self._has_musical_profile(
            current_features.get("chroma") or []
        ) and self._has_musical_profile(master_features.get("chroma") or [])
        current_energy = float(current_features.get("energyMean") or 0)
        master_energy = float(master_features.get("energyMean") or 0)
        energy_scale = max(current_energy, master_energy, 0.000001)
        energy_difference = abs(current_energy - master_energy) / energy_scale
        energy_similarity = max(0.0, 1.0 - energy_difference)
        score = (
            text_similarity * 0.45
            + duration_similarity * 0.20
            + musical_similarity * 0.20
            + energy_similarity * 0.15
        )
        return {
            "score": score,
            "textSimilarity": text_similarity,
            "durationSimilarity": duration_similarity,
            "musicalSimilarity": musical_similarity,
            "hasMusicalProfile": has_musical_profile,
            "energyDifference": energy_difference,
        }

    def _can_reuse(
        self,
        current_text: str,
        master_text: str,
        components: Dict,
    ) -> bool:
        if current_text and master_text:
            exact = current_text == master_text
            near_exact = (
                components["textSimilarity"] >= 0.90
                and min(len(current_text.split()), len(master_text.split())) >= 4
            )
            return bool(
                (exact or near_exact)
                and components["durationSimilarity"] >= 0.85
                and (
                    not components["hasMusicalProfile"]
                    or components["musicalSimilarity"] >= 0.65
                )
                and components["score"] >= 0.78
            )
        if current_text or master_text:
            return False
        return bool(
            components["durationSimilarity"] >= 0.90
            and components["musicalSimilarity"] >= 0.94
            and components["score"] >= 0.78
        )

    def _normalize_lyrics(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", str(value).lower())
        normalized = "".join(
            character for character in normalized
            if not unicodedata.combining(character)
        )
        normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
        return " ".join(normalized.split())

    def _cosine_similarity(self, left: List[float], right: List[float]) -> float:
        if not left or not right or len(left) != len(right):
            return 0.0
        left_vector = np.asarray(left, dtype=float)
        right_vector = np.asarray(right, dtype=float)
        denominator = float(np.linalg.norm(left_vector) * np.linalg.norm(right_vector))
        if denominator <= 0:
            return 0.0
        return max(0.0, min(1.0, float(np.dot(left_vector, right_vector) / denominator)))

    def _has_musical_profile(self, values: List[float]) -> bool:
        return bool(values and any(abs(float(value)) > 0.000001 for value in values))

    def _text_for_interval(self, segments: List[Dict], start: float, end: float) -> str:
        selected = [
            segment
            for segment in segments
            if start
            <= (
                float(segment.get("start") or 0)
                + float(segment.get("end") or 0)
            )
            / 2
            < end
        ]
        if not selected:
            selected = [
                segment
                for segment in segments
                if float(segment.get("end") or 0) > start
                and float(segment.get("start") or 0) < end
            ]
        text = " ".join(
            str(segment.get("text") or "").strip() for segment in selected
        ).strip()
        return " ".join(text.split())

    def _generation_prompt(
        self,
        visual_prompt: str,
        lyric_meaning: str,
        shot: Dict,
    ) -> str:
        concept = " ".join(visual_prompt.split()[:4])
        lyric = " ".join(lyric_meaning.split()[:10])
        camera = " ".join(str(shot["camera"]).split()[:7])
        location = " ".join(str(shot["location"]).split()[:7])
        action = " ".join(str(shot["action"]).split()[:10])
        return (
            f"Lyric: {lyric}. {camera}. {location}. {action}. {concept}"
        )

    def _shot_design(self, index: int, total: int, lyric_meaning: str) -> Dict:
        performance_locations = [
            "intimate firelit outdoor stage at night",
            "moonlit rooftop performance above city lights",
            "dark studio stage with practical warm spotlights",
        ]
        narrative_locations = [
            "quiet rain-wet city street with reflections",
            "open hill at sunset with wind moving the grass",
            "deep blue forest clearing with projected light",
            "empty theater aisle with warm aisle lights",
        ]
        pattern = ["PERFORMANCE", "NARRATIVE", "PERFORMANCE", "ESTABLISHING"]
        shot_type = pattern[index % len(pattern)]
        if index == total - 1:
            shot_type = "PERFORMANCE"
        if shot_type == "PERFORMANCE":
            location_index = (index // 2) % len(performance_locations)
            cameras = [
                "medium close-up, clear unobstructed face looking toward camera",
                "waist-up tracking shot, clear face and expressive hands",
                "tight emotional close-up, both eyes and mouth sharply visible",
            ]
            actions = [
                "A solo fictional singer performs the line naturally to camera",
                "The same singer walks slowly while singing with restrained gestures",
                "The same singer delivers the lyric with a visible emotional expression",
            ]
            return {
                "shotType": shot_type,
                "locationId": f"performance-{location_index + 1}",
                "location": performance_locations[location_index],
                "camera": cameras[index % len(cameras)],
                "action": actions[index % len(actions)],
                "showsPerformer": True,
                "lipSync": True,
            }

        location_index = index % len(narrative_locations)
        is_establishing = shot_type == "ESTABLISHING"
        return {
            "shotType": shot_type,
            "locationId": f"narrative-{location_index + 1}",
            "location": narrative_locations[location_index],
            "camera": (
                "wide environmental shot with strong depth and a moving camera"
                if is_establishing
                else "medium narrative tracking shot with a distinct composition"
            ),
            "action": (
                f"Visual metaphor for {self._compact_meaning(lyric_meaning)} unfolds in the environment"
                if is_establishing
                else f"The recurring protagonist physically acts out the emotion of {self._compact_meaning(lyric_meaning)}"
            ),
            "showsPerformer": not is_establishing,
            "lipSync": False,
        }

    def _compact_meaning(self, value: str) -> str:
        return " ".join(str(value).strip().split()[:10]) or "the instrumental passage"

    def _scene_direction(self, index: int, total: int):
        if index == 0:
            return (
                "Apertura",
                "suave",
                "Presenta el ambiente y el motivo principal con planos amplios y movimiento pausado",
            )
        if index == total - 1:
            return (
                "Cierre",
                "final",
                "Resuelve la secuencia recuperando el motivo principal y termina con un plano reconocible",
            )
        if total > 2 and index == total - 2:
            return (
                "Punto alto",
                "alta",
                "Aumenta la energia visual con encuadres cercanos, movimiento y cortes mas frecuentes",
            )
        development_directions = [
            (
                "Presentacion",
                "media",
                "Introduce al protagonista o elemento central con un plano medio y un avance suave de camara",
            ),
            (
                "Movimiento",
                "media",
                "Sigue la accion con un desplazamiento lateral y cambia de encuadre al golpe musical mas marcado",
            ),
            (
                "Detalles",
                "media",
                "Muestra primeros planos y detalles del entorno alternados con la accion principal",
            ),
            (
                "Variacion",
                "media-alta",
                "Cambia el punto de vista y conecta el nuevo plano mediante una transicion al ritmo",
            ),
            (
                "Impulso",
                "alta",
                "Incrementa el movimiento de camara y combina planos abiertos y cercanos antes del punto alto",
            ),
        ]
        return development_directions[(index - 1) % len(development_directions)]

    def _valid_cuts(self, cuts: List[float], duration: float) -> bool:
        if not cuts:
            return duration <= 10
        boundaries = [0.0, *sorted(cuts), duration]
        durations = [boundaries[index + 1] - boundaries[index] for index in range(len(boundaries) - 1)]
        return all(5 <= value <= 10 for value in durations)


class StableDiffusionImageGenerator:
    """Creates related keyframes with text-to-image and image-to-image diffusion."""

    def __init__(
        self,
        model_id: str,
        cache_dir: str,
        device: str = "auto",
        inference_steps: int = 25,
        width: int = 768,
        height: int = 432,
    ):
        self.model_id = model_id
        self.cache_dir = cache_dir
        self.device = device
        self.inference_steps = max(4, inference_steps)
        self.width = self._dimension(width)
        self.height = self._dimension(height)
        self._pipeline = None
        self._image_to_image_pipeline = None
        self._resolved_device = None

    def generate(
        self,
        prompt: str,
        output_path: str,
        reference_path: Optional[str] = None,
        seed: Optional[int] = None,
        strength: float = 0.38,
    ) -> Dict:
        pipeline, torch, device = self._get_pipeline()
        seed = seed if seed is not None else int(
            hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:8], 16
        )
        generator = torch.Generator(device=device).manual_seed(seed)
        common = {
            "prompt": prompt,
            "negative_prompt": (
                "text, watermark, logo, low quality, blurry, malformed, "
                "duplicate subjects, distorted anatomy, different character, "
                "different wardrobe, inconsistent color palette, split screen, "
                "collage, contact sheet, picture in picture, multiple panels, "
                "frame border"
            ),
            "num_inference_steps": self.inference_steps,
            "guidance_scale": 7.5,
            "generator": generator,
        }
        if reference_path:
            pipeline = self._get_image_to_image_pipeline(pipeline)
            reference = Image.open(reference_path).convert("RGB").resize(
                (self.width, self.height), Image.Resampling.LANCZOS
            )
            result = pipeline(
                **common,
                image=reference,
                strength=max(0.2, min(float(strength), 0.65)),
            )
        else:
            result = pipeline(
                **common,
                width=self.width,
                height=self.height,
            )
        if not result.images:
            raise RuntimeError("Stable Diffusion completed without producing an image")
        result.images[0].save(output_path, format="PNG")
        return {
            "provider": "stable_diffusion",
            "model": self.model_id,
            "device": device,
            "seed": seed,
            "steps": self.inference_steps,
            "width": self.width,
            "height": self.height,
            "referenceKeyframe": os.path.basename(reference_path) if reference_path else None,
            "continuityStrength": strength if reference_path else None,
        }

    def _get_image_to_image_pipeline(self, text_to_image_pipeline):
        if self._image_to_image_pipeline is not None:
            return self._image_to_image_pipeline
        try:
            from diffusers import AutoPipelineForImage2Image
        except ImportError as error:
            raise RuntimeError("Image-to-image diffusion dependencies are missing") from error
        self._image_to_image_pipeline = AutoPipelineForImage2Image.from_pipe(
            text_to_image_pipeline
        )
        self._image_to_image_pipeline.set_progress_bar_config(disable=True)
        return self._image_to_image_pipeline

    def _get_pipeline(self):
        if self._pipeline is not None:
            import torch

            return self._pipeline, torch, self._resolved_device

        try:
            import torch
            from diffusers import StableDiffusionPipeline
        except ImportError as error:
            raise RuntimeError(
                "Stable Diffusion dependencies are not installed in the AI worker"
            ) from error

        device = self.device
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"
        if device == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("DIFFUSION_DEVICE=cuda but CUDA is not available")

        dtype = torch.float16 if device == "cuda" else torch.float32
        os.makedirs(self.cache_dir, exist_ok=True)
        pipeline = StableDiffusionPipeline.from_pretrained(
            self.model_id,
            cache_dir=self.cache_dir,
            dtype=dtype,
            use_safetensors=True,
        )
        pipeline.set_progress_bar_config(disable=True)
        pipeline.enable_attention_slicing()
        if hasattr(pipeline.vae, "enable_slicing"):
            pipeline.vae.enable_slicing()
        pipeline = pipeline.to(device)
        self._pipeline = pipeline
        self._resolved_device = device
        return pipeline, torch, device

    def _dimension(self, value: int) -> int:
        return max(256, min(768, int(value) // 8 * 8))

    def release(self) -> None:
        if self._pipeline is None:
            return
        try:
            import torch

            self._pipeline = None
            self._image_to_image_pipeline = None
            self._resolved_device = None
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.ipc_collect()
        except Exception:
            self._pipeline = None
            self._image_to_image_pipeline = None
            self._resolved_device = None
            gc.collect()


class StableVideoDiffusionGenerator:
    """Animates keyframes with real temporal diffusion on local hardware."""

    def __init__(
        self,
        model_id: str,
        cache_dir: str,
        device: str = "auto",
        frame_count: int = 14,
        inference_steps: int = 12,
        decode_chunk_size: int = 2,
        segment_seconds: float = 10.0,
        max_segments: int = 1,
    ):
        self.model_id = model_id
        self.cache_dir = cache_dir
        self.device = device
        self.frame_count = max(14, min(int(frame_count), 25))
        self.inference_steps = max(4, min(int(inference_steps), 30))
        self.decode_chunk_size = max(1, min(int(decode_chunk_size), 8))
        self.segment_seconds = max(2.0, float(segment_seconds))
        self.max_segments = max(1, min(int(max_segments), 4))
        self._pipeline = None
        self._resolved_device = None

    def generate_frames(
        self,
        keyframe_path: str,
        duration_seconds: float,
        seed: int,
        intensity: str = "media",
        transition_reference_path: Optional[str] = None,
        progress_callback: Optional[Callable[[float], None]] = None,
    ) -> tuple[List[Image.Image], Dict]:
        pipeline, torch, device = self._get_pipeline()
        initial_image = Image.open(keyframe_path).convert("RGB")
        initial_image = initial_image.resize((768, 432), Image.Resampling.LANCZOS)
        if transition_reference_path:
            previous = Image.open(transition_reference_path).convert("RGB")
            previous = previous.resize(initial_image.size, Image.Resampling.LANCZOS)
            initial_image = Image.blend(previous, initial_image, 0.85)

        segment_count = max(
            1,
            min(self.max_segments, math.ceil(duration_seconds / self.segment_seconds)),
        )
        all_frames: List[Image.Image] = []
        conditioning_image = initial_image
        motion_bucket = self._motion_bucket(intensity)

        for segment_index in range(segment_count):
            generator = torch.Generator(device="cpu").manual_seed(seed + segment_index)

            def report_step(_pipeline, step_index, _timestep, callback_kwargs):
                if progress_callback:
                    completed = segment_index + (step_index + 1) / self.inference_steps
                    progress_callback(min(1.0, completed / segment_count))
                return callback_kwargs

            result = pipeline(
                conditioning_image,
                num_frames=self.frame_count,
                num_inference_steps=self.inference_steps,
                decode_chunk_size=self.decode_chunk_size,
                generator=generator,
                motion_bucket_id=motion_bucket,
                noise_aug_strength=0.01,
                fps=7,
                callback_on_step_end=report_step,
            )
            segment_frames = list(result.frames[0])
            if not segment_frames:
                raise RuntimeError("Stable Video Diffusion returned no frames")
            if all_frames:
                segment_frames = segment_frames[1:]
            all_frames.extend(frame.convert("RGB") for frame in segment_frames)
            conditioning_image = segment_frames[-1].convert("RGB")

        return all_frames, {
            "provider": "stable_video_diffusion",
            "model": self.model_id,
            "device": device,
            "seed": seed,
            "generatedFrameCount": len(all_frames),
            "inferenceSteps": self.inference_steps,
            "segmentCount": segment_count,
            "motionBucketId": motion_bucket,
            "decodeChunkSize": self.decode_chunk_size,
        }

    def _get_pipeline(self):
        if self._pipeline is not None:
            import torch

            return self._pipeline, torch, self._resolved_device
        try:
            import torch
            from diffusers import StableVideoDiffusionPipeline
        except ImportError as error:
            raise RuntimeError("Stable Video Diffusion dependencies are missing") from error

        device = self.device
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"
        if device == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("VIDEO_DIFFUSION_DEVICE=cuda but CUDA is not available")

        os.makedirs(self.cache_dir, exist_ok=True)
        dtype = torch.float16 if device == "cuda" else torch.float32
        load_options = {
            "cache_dir": self.cache_dir,
            "torch_dtype": dtype,
        }
        if device == "cuda":
            load_options["variant"] = "fp16"
        pipeline = StableVideoDiffusionPipeline.from_pretrained(
            self.model_id,
            **load_options,
        )
        pipeline.set_progress_bar_config(disable=True)
        pipeline.unet.enable_forward_chunking()
        if hasattr(pipeline.vae, "enable_slicing"):
            try:
                pipeline.vae.enable_slicing()
            except NotImplementedError:
                pass
        if device == "cuda":
            pipeline.enable_model_cpu_offload()
        else:
            pipeline = pipeline.to(device)
        self._pipeline = pipeline
        self._resolved_device = device
        return pipeline, torch, device

    def _motion_bucket(self, intensity: str) -> int:
        normalized = str(intensity).lower()
        if "alta" in normalized or "final" in normalized:
            return 140
        if "suave" in normalized:
            return 80
        return 110

    def release(self) -> None:
        if self._pipeline is None:
            return
        self._pipeline = None
        self._resolved_device = None
        gc.collect()
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.ipc_collect()
        except Exception:
            pass


class LocalVideoClipProvider:
    """Builds a visually coherent sequence and animates every scene temporally."""

    def __init__(
        self,
        model_id: str = "stable-diffusion-v1-5/stable-diffusion-v1-5",
        cache_dir: str = "/models/huggingface",
        device: str = "auto",
        inference_steps: int = 25,
        width: int = 768,
        height: int = 432,
        video_model_id: str = "stabilityai/stable-video-diffusion-img2vid-xt",
        video_frame_count: int = 14,
        video_inference_steps: int = 12,
        video_decode_chunk_size: int = 2,
        video_segment_seconds: float = 10.0,
        video_max_segments: int = 1,
        image_generator=None,
        motion_generator=None,
        music_performance_provider=None,
    ):
        self.image_generator = image_generator or StableDiffusionImageGenerator(
            model_id=model_id,
            cache_dir=cache_dir,
            device=device,
            inference_steps=inference_steps,
            width=width,
            height=height,
        )
        self.motion_generator = motion_generator or StableVideoDiffusionGenerator(
            model_id=video_model_id,
            cache_dir=cache_dir,
            device=device,
            frame_count=video_frame_count,
            inference_steps=video_inference_steps,
            decode_chunk_size=video_decode_chunk_size,
            segment_seconds=video_segment_seconds,
            max_segments=video_max_segments,
        )
        self.music_performance_provider = music_performance_provider

    def generate_clip(self, scene: Dict, style: str, output_path: str) -> str:
        output_dir = os.path.dirname(output_path) or "."
        return self.generate_sequence([scene], style, output_dir, [output_path])[0]

    def generate_sequence(
        self,
        scenes: List[Dict],
        style: str,
        output_dir: str,
        output_paths: Optional[List[str]] = None,
        progress_callback: Optional[Callable[[int, str], None]] = None,
        source_audio_path: Optional[str] = None,
    ) -> List[str]:
        if not scenes:
            raise ValueError("At least one storyboard scene is required")
        os.makedirs(output_dir, exist_ok=True)
        sequence_seed = self._sequence_seed(scenes, style)
        visual_guide = self._visual_guide(scenes, style)
        keyframes: List[str] = []
        keyframe_metadata: List[Dict] = []

        for index, scene in enumerate(scenes):
            if progress_callback:
                progress_callback(
                    10 + int(index / len(scenes) * 20),
                    f"keyframes:{index + 1}:{len(scenes)}",
                )
            source_index = self._reusable_source_index(scene, index)
            if source_index is not None:
                keyframes.append(keyframes[source_index])
                keyframe_metadata.append({
                    "provider": "reused_keyframe",
                    "sourceSceneIndex": source_index + 1,
                    "reusePolicy": scene.get("reusePolicy"),
                    "prompt": self._build_prompt(scene, style, visual_guide),
                })
                continue
            keyframe_path = os.path.join(output_dir, f"keyframe-{index + 1:03d}.png")
            prompt = self._build_prompt(scene, style, visual_guide)
            generation = self.image_generator.generate(
                prompt,
                keyframe_path,
                reference_path=None,
                seed=sequence_seed + index,
            )
            keyframes.append(keyframe_path)
            keyframe_metadata.append({**generation, "prompt": prompt})

        image_release = getattr(self.image_generator, "release", None)
        if callable(image_release):
            image_release()
        generated_paths: List[str] = []
        performer_reference = next(
            (
                keyframes[index]
                for index, scene in enumerate(scenes)
                if scene.get("showsPerformer") and scene.get("shotType") == "PERFORMANCE"
            ),
            keyframes[0],
        )
        outputs = output_paths or [
            os.path.join(output_dir, f"scene-{index + 1}.mp4")
            for index in range(len(scenes))
        ]
        if len(outputs) != len(scenes):
            raise ValueError("output_paths must match the number of scenes")

        for index, (scene, keyframe_path, output_path) in enumerate(
            zip(scenes, keyframes, outputs)
        ):
            scene_progress_start = 32 + index / len(scenes) * 60
            scene_progress_span = 60 / len(scenes)
            if progress_callback:
                progress_callback(
                    int(scene_progress_start),
                    f"animation:{index + 1}:{len(scenes)}",
                )

            def report_motion_progress(fraction: float):
                if progress_callback:
                    progress_callback(
                        min(92, int(scene_progress_start + fraction * scene_progress_span)),
                        f"animation:{index + 1}:{len(scenes)}",
                    )

            duration = max(1.0, min(float(scene.get("durationSeconds") or 3.0), 120.0))
            reusable_source_index = self._reusable_source_index(scene, index)
            reused_from_scene = None
            if reusable_source_index is not None:
                source_scene = scenes[reusable_source_index]
                reused_from_scene = reusable_source_index + 1
                if progress_callback:
                    progress_callback(
                        min(92, int(scene_progress_start + scene_progress_span * 0.8)),
                        f"reuse:{index + 1}:{len(scenes)}",
                    )
                self._reuse_clip(
                    outputs[reusable_source_index],
                    output_path,
                    float(source_scene.get("durationSeconds") or duration),
                    duration,
                    variant=str(scene.get("reusePolicy") or "") == "VARIANT",
                    occurrence=int(scene.get("occurrenceIndex") or 2),
                )
                motion_metadata = {
                    "provider": "reused_generated_clip",
                    "sourceSceneIndex": reused_from_scene,
                    "reusePolicy": scene.get("reusePolicy"),
                    "durationAdjusted": round(duration, 3),
                }
            else:
                frames, motion_metadata = self.motion_generator.generate_frames(
                    keyframe_path=keyframe_path,
                    duration_seconds=duration,
                    seed=sequence_seed + 10_000 + index * 101,
                    intensity=str(scene.get("intensity") or "media"),
                    transition_reference_path=None,
                    progress_callback=report_motion_progress,
                )
                frame_dir = os.path.join(output_dir, f"frames-{index + 1:03d}")
                os.makedirs(frame_dir, exist_ok=True)
                for frame_index, frame in enumerate(frames):
                    frame.save(
                        os.path.join(frame_dir, f"frame-{frame_index:05d}.png"),
                        format="PNG",
                    )
                last_frame_path = os.path.join(
                    output_dir, f"transition-{index + 1:03d}.png"
                )
                frames[-1].save(last_frame_path, format="PNG")
                self._encode_frames(frame_dir, len(frames), duration, output_path)
            face_processed = False
            lip_synced = False
            if self.music_performance_provider and scene.get("showsPerformer"):
                audio_segment = None
                lip_synced = bool(scene.get("lipSync") and source_audio_path)
                if lip_synced:
                    audio_segment = os.path.join(output_dir, f"voice-{index + 1:03d}.wav")
                    self._extract_audio_segment(
                        source_audio_path,
                        float(scene.get("startTime") or 0),
                        duration,
                        audio_segment,
                    )
                processed_path = os.path.join(output_dir, f"processed-{index + 1:03d}.mp4")
                if progress_callback:
                    progress_callback(
                        min(96, int(scene_progress_start + scene_progress_span * 0.92)),
                        f"identity_and_lips:{index + 1}:{len(scenes)}",
                    )
                self.music_performance_provider.process_music_clip(
                    performer_reference,
                    output_path,
                    processed_path,
                    source_audio_path=audio_segment,
                    lip_sync=lip_synced,
                )
                os.replace(processed_path, output_path)
                face_processed = True
            self._write_sidecar_metadata(output_path, {
                "tiluchiAssetType": "VIDEO_CLIP",
                "provider": "stable_video_diffusion_sequence",
                "sequenceSeed": sequence_seed,
                "visualGuide": visual_guide,
                "keyframe": keyframe_metadata[index],
                "motion": motion_metadata,
                "transitionReference": None,
                "reusedFromSceneIndex": reused_from_scene,
                "reusePolicy": scene.get("reusePolicy", "MASTER"),
                "performerIdentityApplied": face_processed,
                "lipSyncApplied": lip_synced,
                "style": style,
                "scene": scene,
            })
            generated_paths.append(output_path)

        if progress_callback:
            progress_callback(94, "encoding")
        return generated_paths

    def _reusable_source_index(self, scene: Dict, current_index: int) -> Optional[int]:
        if scene.get("reusePolicy") not in {"DIRECT", "VARIANT"}:
            return None
        source_scene_index = scene.get("sourceSceneIndex")
        if source_scene_index is None:
            return None
        try:
            source_index = int(source_scene_index) - 1
        except (TypeError, ValueError):
            return None
        if source_index < 0 or source_index >= current_index:
            return None
        return source_index

    def _reuse_clip(
        self,
        source_path: str,
        output_path: str,
        source_duration: float,
        target_duration: float,
        variant: bool,
        occurrence: int,
    ) -> None:
        speed_factor = max(0.85, min(1.18, target_duration / max(source_duration, 0.1)))
        filters = []
        if variant:
            horizontal_bias = 0.25 if occurrence % 2 == 0 else 0.75
            filters.extend([
                "scale=672:378",
                f"crop=640:360:x=(iw-ow)*{horizontal_bias}:y=(ih-oh)/2",
                "eq=contrast=1.025:saturation=1.04",
            ])
        filters.extend([
            f"setpts={speed_factor:.6f}*PTS",
            "fps=16:round=up",
            "format=yuv420p",
        ])
        self._run([
            self._ffmpeg_exe(),
            "-y",
            "-i",
            source_path,
            "-an",
            "-vf",
            ",".join(filters),
            "-frames:v",
            str(max(1, round(target_duration * 16))),
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-movflags",
            "+faststart",
            output_path,
        ])

    def _encode_frames(
        self,
        frame_dir: str,
        frame_count: int,
        duration: float,
        output_path: str,
    ) -> None:
        source_fps = max(1.0, frame_count / duration)
        output_frame_count = max(1, round(duration * 16))
        self._run([
            self._ffmpeg_exe(),
            "-y",
            "-framerate",
            f"{source_fps:.6f}",
            "-i",
            os.path.join(frame_dir, "frame-%05d.png"),
            "-vf",
            (
                "scale=640:360:force_original_aspect_ratio=decrease,"
                "pad=640:360:(ow-iw)/2:(oh-ih)/2,"
                "fps=16:round=up,"
                "setpts=PTS-STARTPTS,"
                "tpad=stop_mode=clone:stop=16,"
                "format=yuv420p"
            ),
            "-r",
            "16",
            "-fps_mode",
            "cfr",
            "-frames:v",
            str(output_frame_count),
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-movflags",
            "+faststart",
            output_path,
        ])

    def _extract_audio_segment(
        self,
        source_path: str,
        start_time: float,
        duration: float,
        output_path: str,
    ) -> None:
        self._run([
            self._ffmpeg_exe(),
            "-y",
            "-ss",
            f"{max(0, start_time):.3f}",
            "-t",
            f"{max(0.1, duration):.3f}",
            "-i",
            source_path,
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            output_path,
        ])

    def compose(self, audio_name: str, clip_paths: List[str], scenes: List[Dict], output_path: str) -> str:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        ffmpeg_exe = self._ffmpeg_exe()
        concat_path = os.path.join(os.path.dirname(output_path), "clips.txt")
        with open(concat_path, "w", encoding="utf-8") as concat_file:
            for clip_path in clip_paths:
                normalized = clip_path.replace("\\", "/").replace("'", "'\\''")
                concat_file.write(f"file '{normalized}'\n")

        audio_path = os.path.join(os.path.dirname(output_path), f"music-source{os.path.splitext(audio_name)[1] or '.wav'}")
        if not os.path.exists(audio_path):
            for candidate in os.listdir(os.path.dirname(output_path)):
                if candidate.startswith("music."):
                    audio_path = os.path.join(os.path.dirname(output_path), candidate)
                    break

        command = [
            ffmpeg_exe,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            concat_path,
        ]
        if os.path.exists(audio_path):
            command.extend([
                "-i",
                audio_path,
                "-shortest",
                "-map",
                "0:v:0",
                "-map",
                "1:a:0",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                output_path,
            ])
        else:
            command.extend(["-c", "copy", output_path])
        self._run(command)
        self._write_sidecar_metadata(output_path, {
            "tiluchiAssetType": "FINAL_VIDEOCLIP",
            "provider": "stable_video_diffusion_sequence",
            "audioName": audio_name,
            "clipCount": len(clip_paths),
            "scenes": scenes,
        })
        return output_path

    def _ffmpeg_exe(self):
        if imageio_ffmpeg is not None:
            try:
                return imageio_ffmpeg.get_ffmpeg_exe()
            except Exception:
                pass
        raise RuntimeError("FFmpeg is required to generate and compose video clips")

    def _run(self, command: List[str]):
        subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)

    def _build_prompt(self, scene: Dict, style: str, visual_guide: str = "") -> str:
        description = str(
            scene.get("generationPrompt")
            or scene.get("description")
            or "abstract music performance"
        )
        return (
            f"{visual_guide}. {description}"
        )

    def _visual_guide(self, scenes: List[Dict], style: str) -> str:
        return (
            f"same singer, short dark hair, black jacket, teal amber {style} palette"
        )

    def _sequence_seed(self, scenes: List[Dict], style: str) -> int:
        identity = f"{style}|{self._visual_guide(scenes, style)}"
        return int(hashlib.sha256(identity.encode("utf-8")).hexdigest()[:8], 16)

    def _write_sidecar_metadata(self, output_path: str, payload: Dict):
        with open(f"{output_path}.json", "w", encoding="utf-8") as metadata_file:
            json.dump(payload, metadata_file, ensure_ascii=True, indent=2)

    def release(self) -> None:
        for generator in (self.image_generator, self.motion_generator):
            release = getattr(generator, "release", None)
            if callable(release):
                release()
