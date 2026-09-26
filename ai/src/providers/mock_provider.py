import os
import shutil
from typing import Dict, Any, List
from src.providers.base import (
    AudioSeparationProvider,
    FaceSwapProvider,
    VideoGenerationProvider,
    LLMProvider
)

class MockAudioSeparationProvider(AudioSeparationProvider):
    def separate(self, audio_path: str, output_dir: str) -> Dict[str, str]:
        os.makedirs(output_dir, exist_ok=True)
        instrumental_path = os.path.join(output_dir, "instrumental.wav")
        vocals_path = os.path.join(output_dir, "vocals.wav")
        
        # In mock mode, copy input audio as both stems
        shutil.copyfile(audio_path, instrumental_path)
        shutil.copyfile(audio_path, vocals_path)
        return {
            "instrumental": instrumental_path,
            "vocals": vocals_path
        }

class MockFaceSwapProvider(FaceSwapProvider):
    def swap(self, source_image_path: str, target_video_path: str, output_path: str) -> str:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        shutil.copyfile(target_video_path, output_path)
        return output_path

class MockVideoGenerationProvider(VideoGenerationProvider):
    def generate_clip(self, prompt: str, duration_seconds: float, output_path: str) -> str:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        # Create a dummy file if needed
        with open(output_path, "wb") as f:
            f.write(b"MOCK_VIDEO_CONTENT")
        return output_path

class MockLLMProvider(LLMProvider):
    def generate_storyboard(self, song_metadata: Dict[str, Any], prompt: str) -> List[Dict[str, Any]]:
        duration = song_metadata.get("duration", 30.0)
        num_scenes = 4
        scene_duration = duration / num_scenes
        
        scenes = []
        for i in range(num_scenes):
            scenes.append({
                "scene_index": i + 1,
                "start_time": round(i * scene_duration, 2),
                "end_time": round((i + 1) * scene_duration, 2),
                "description": f"Scene {i + 1}: {prompt} - cinematic style",
                "camera_movement": "pan right"
            })
        return scenes
