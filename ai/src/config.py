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

settings = Settings()
