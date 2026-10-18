from abc import ABC, abstractmethod
from typing import Dict, Any, List

class AudioSeparationProvider(ABC):
    @abstractmethod
    def separate(self, audio_path: str, output_dir: str) -> Dict[str, str]:
        """Separates audio into stems (e.g. instrumental, vocals). Returns dict with stem paths."""
        pass

class FaceSwapProvider(ABC):
    @abstractmethod
    def swap(
        self,
        source_image_path: str,
        target_video_path: str,
        output_path: str,
        reference_frame_number: int = 0,
        reference_face_position: int = 0,
    ) -> str:
        """Applies face swap onto target video and returns the processed video path."""
        pass

class VideoGenerationProvider(ABC):
    @abstractmethod
    def generate_clip(self, prompt: str, duration_seconds: float, output_path: str) -> str:
        """Generates an AI video clip according to prompt and duration."""
        pass

class LLMProvider(ABC):
    @abstractmethod
    def generate_storyboard(self, song_metadata: Dict[str, Any], prompt: str) -> List[Dict[str, Any]]:
        """Generates timed storyboard scenes based on song analysis and user description."""
        pass
