import base64
import math
import os
import sys
from pathlib import Path
from typing import Callable, Dict, List, Optional

import numpy as np


def cluster_face_detections(
    detections: List[Dict], distance_threshold: float = 0.55
) -> List[Dict]:
    """Groups ArcFace embeddings that represent the same person."""
    clusters: List[Dict] = []
    for detection in detections:
        embedding = np.asarray(detection["embedding"], dtype=np.float32)
        norm = float(np.linalg.norm(embedding))
        if norm == 0:
            continue
        embedding = embedding / norm

        best_cluster = None
        best_distance = float("inf")
        for cluster in clusters:
            distance = 1.0 - float(np.dot(embedding, cluster["centroid"]))
            if distance < best_distance:
                best_distance = distance
                best_cluster = cluster

        if best_cluster is None or best_distance > distance_threshold:
            clusters.append(
                {
                    "centroid": embedding,
                    "detections": [detection],
                    "best": detection,
                }
            )
            continue

        best_cluster["detections"].append(detection)
        embeddings = [
            np.asarray(item["embedding"], dtype=np.float32)
            for item in best_cluster["detections"]
        ]
        centroid = np.mean(embeddings, axis=0)
        best_cluster["centroid"] = centroid / max(float(np.linalg.norm(centroid)), 1e-8)
        if detection["quality"] > best_cluster["best"]["quality"]:
            best_cluster["best"] = detection

    return sorted(
        clusters,
        key=lambda cluster: (
            len(cluster["detections"]),
            cluster["best"]["quality"],
        ),
        reverse=True,
    )


class FaceIdentityProvider:
    """Samples a video and creates persistent identities from facial embeddings."""

    def __init__(
        self,
        facefusion_path: str,
        execution_provider: str = "auto",
        sample_interval_seconds: float = 2.0,
        max_samples: int = 120,
        max_identities: int = 12,
    ):
        self.facefusion_path = Path(facefusion_path)
        self.execution_provider = self._resolve_execution_provider(execution_provider)
        self.sample_interval_seconds = max(0.5, sample_interval_seconds)
        self.max_samples = max(1, max_samples)
        self.max_identities = max(1, max_identities)
        self._initialized = False

    def analyze(
        self,
        video_path: str,
        output_dir: str,
        progress_callback: Optional[Callable[[int], None]] = None,
    ) -> List[Dict]:
        if not os.path.isfile(video_path):
            raise FileNotFoundError(f"Target video not found: {video_path}")
        if not (self.facefusion_path / "facefusion.py").is_file():
            raise RuntimeError(
                f"FaceFusion installation not found at {self.facefusion_path}"
            )

        self._initialize_facefusion()
        import cv2
        from facefusion.face_creator import get_many_faces

        capture = cv2.VideoCapture(video_path)
        if not capture.isOpened():
            raise ValueError("No se pudo abrir el video para detectar rostros")

        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
        frame_total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if fps <= 0 or frame_total <= 0:
            capture.release()
            raise ValueError("El video no contiene una linea de tiempo valida")

        duration = frame_total / fps
        sample_count = min(
            self.max_samples,
            max(1, int(math.ceil(duration / self.sample_interval_seconds))),
        )
        if sample_count == 1:
            frame_numbers = [0]
        else:
            frame_numbers = sorted(
                {
                    min(frame_total - 1, round(index * (frame_total - 1) / (sample_count - 1)))
                    for index in range(sample_count)
                }
            )

        detections: List[Dict] = []
        try:
            for sample_index, frame_number in enumerate(frame_numbers):
                capture.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
                ok, frame = capture.read()
                if not ok or frame is None:
                    continue

                faces = get_many_faces([frame])
                ordered_faces = sorted(faces, key=self._face_area, reverse=True)
                for position, face in enumerate(ordered_faces):
                    area = self._face_area(face)
                    detector_score = float(face.score_set.get("detector") or 0)
                    detections.append(
                        {
                            "embedding": face.embedding_norm,
                            "frame": frame.copy(),
                            "frameNumber": frame_number,
                            "timestampSeconds": round(frame_number / fps, 3),
                            "facePosition": position,
                            "boundingBox": [float(value) for value in face.bounding_box],
                            "quality": detector_score * max(area, 1.0),
                            "confidence": detector_score,
                        }
                    )

                if progress_callback:
                    progress_callback(
                        min(95, 10 + round(85 * (sample_index + 1) / len(frame_numbers)))
                    )
        finally:
            capture.release()

        clusters = cluster_face_detections(detections)[: self.max_identities]
        identities = []
        output = Path(output_dir)
        output.mkdir(parents=True, exist_ok=True)
        for index, cluster in enumerate(clusters, start=1):
            best = cluster["best"]
            thumbnail_path = output / f"person-{index}.jpg"
            self._write_thumbnail(best, str(thumbnail_path))
            encoded = base64.b64encode(thumbnail_path.read_bytes()).decode("ascii")
            identities.append(
                {
                    "id": f"person-{index}",
                    "label": f"Persona {index}",
                    "thumbnailDataUrl": f"data:image/jpeg;base64,{encoded}",
                    "referenceFrameNumber": best["frameNumber"],
                    "referenceFacePosition": best["facePosition"],
                    "timestampSeconds": best["timestampSeconds"],
                    "appearanceCount": len(cluster["detections"]),
                    "confidence": round(best["confidence"], 3),
                }
            )
        return identities

    def _initialize_facefusion(self) -> None:
        if self._initialized:
            return
        root = str(self.facefusion_path)
        if root not in sys.path:
            sys.path.insert(0, root)

        from facefusion import state_manager
        from facefusion import face_classifier, face_detector, face_recognizer

        values = {
            "face_detector_model": "yolo_face",
            "face_detector_size": "640x640",
            "face_detector_margin": [0, 0, 0, 0],
            "face_detector_angles": [0],
            "face_detector_score": 0.6,
            "face_landmarker_model": "2dfan4",
            "face_landmarker_score": 0.0,
            "execution_device_ids": ["0"],
            "execution_providers": [self.execution_provider],
            "download_providers": ["github", "huggingface"],
            "download_scope": "full",
        }
        for key, value in values.items():
            state_manager.init_item(key, value)

        checks = [
            face_detector.pre_check(),
            face_recognizer.pre_check(),
            face_classifier.pre_check(),
        ]
        if not all(checks):
            raise RuntimeError("No se pudieron preparar los modelos de deteccion facial")
        self._initialized = True

    def _write_thumbnail(self, detection: Dict, output_path: str) -> None:
        import cv2

        frame = detection["frame"]
        height, width = frame.shape[:2]
        left, top, right, bottom = detection["boundingBox"]
        face_width = max(1.0, right - left)
        face_height = max(1.0, bottom - top)
        padding = 0.45
        x1 = max(0, int(left - face_width * padding))
        y1 = max(0, int(top - face_height * padding))
        x2 = min(width, int(right + face_width * padding))
        y2 = min(height, int(bottom + face_height * padding))
        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            raise ValueError("No se pudo crear la miniatura de un rostro detectado")
        crop = cv2.resize(crop, (256, 256), interpolation=cv2.INTER_AREA)
        if not cv2.imwrite(output_path, crop, [cv2.IMWRITE_JPEG_QUALITY, 82]):
            raise RuntimeError("No se pudo guardar la miniatura facial")

    @staticmethod
    def _face_area(face) -> float:
        left, top, right, bottom = face.bounding_box
        return max(0.0, float(right - left)) * max(0.0, float(bottom - top))

    @staticmethod
    def _resolve_execution_provider(configured: str) -> str:
        if configured in {"cpu", "cuda"}:
            return configured
        try:
            import onnxruntime

            if "CUDAExecutionProvider" in onnxruntime.get_available_providers():
                return "cuda"
        except ImportError:
            pass
        return "cpu"
