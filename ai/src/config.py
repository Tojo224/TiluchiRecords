import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    redis_host: str = os.getenv("REDIS_HOST", "localhost")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    redis_password: str = os.getenv("REDIS_PASSWORD", "")
    
    s3_endpoint: str = os.getenv("S3_ENDPOINT", "http://localhost:9000")
    s3_region: str = os.getenv("S3_REGION", "us-east-1")
    s3_access_key: str = os.getenv("S3_ACCESS_KEY", "minioadmin")
    s3_secret_key: str = os.getenv("S3_SECRET_KEY", "minioadmin")
    s3_bucket_name: str = os.getenv("S3_BUCKET_NAME", "tiluchi-media")
    
    jobs_queue_name: str = os.getenv("JOBS_QUEUE_NAME", "tiluchi:jobs:queue")
    jobs_progress_channel: str = os.getenv("JOBS_PROGRESS_CHANNEL", "tiluchi:jobs:progress")

    model_cache_dir: str = os.getenv("MODEL_CACHE_DIR", "/models")
    demucs_model: str = os.getenv("DEMUCS_MODEL", "htdemucs")
    demucs_device: str = os.getenv("DEMUCS_DEVICE", "auto")
    whisper_model: str = os.getenv("WHISPER_MODEL", "small")
    whisper_device: str = os.getenv("WHISPER_DEVICE", "cpu")
    whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

    facefusion_path: str = os.getenv("FACEFUSION_PATH", "/opt/facefusion")
    facefusion_execution_provider: str = os.getenv("FACEFUSION_EXECUTION_PROVIDER", "auto")
    facefusion_model: str = os.getenv("FACEFUSION_MODEL", "inswapper_128_fp16")

    diffusion_model: str = os.getenv(
        "DIFFUSION_MODEL",
        "stable-diffusion-v1-5/stable-diffusion-v1-5",
    )
    diffusion_device: str = os.getenv("DIFFUSION_DEVICE", "auto")
    diffusion_steps: int = int(os.getenv("DIFFUSION_STEPS", "25"))
    diffusion_width: int = int(os.getenv("DIFFUSION_WIDTH", "768"))
    diffusion_height: int = int(os.getenv("DIFFUSION_HEIGHT", "432"))
    video_diffusion_model: str = os.getenv(
        "VIDEO_DIFFUSION_MODEL",
        "stabilityai/stable-video-diffusion-img2vid-xt",
    )
    video_diffusion_frames: int = int(os.getenv("VIDEO_DIFFUSION_FRAMES", "14"))
    video_diffusion_steps: int = int(os.getenv("VIDEO_DIFFUSION_STEPS", "12"))
    video_diffusion_decode_chunk: int = int(
        os.getenv("VIDEO_DIFFUSION_DECODE_CHUNK", "2")
    )
    video_segment_seconds: float = float(os.getenv("VIDEO_SEGMENT_SECONDS", "10"))
    video_max_segments: int = int(os.getenv("VIDEO_MAX_SEGMENTS", "1"))

settings = Settings()
