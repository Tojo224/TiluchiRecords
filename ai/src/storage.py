import os
import boto3
from botocore.client import Config
from src.config import settings

class StorageService:
    def __init__(self):
        self.s3_client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"})
        )
        self.bucket = settings.s3_bucket_name

    def download_file(self, storage_key: str, local_path: str):
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        self.s3_client.download_file(self.bucket, storage_key, local_path)
        return local_path

    def upload_file(self, local_path: str, storage_key: str, content_type: str = "application/octet-stream"):
        self.s3_client.upload_file(
            local_path,
            self.bucket,
            storage_key,
            ExtraArgs={"ContentType": content_type}
        )
        return storage_key

storage_service = StorageService()
