import os
import sys
import json
import time
import shutil
import subprocess
import redis
from src.config import settings
from src.storage import storage_service

def verify_ffmpeg() -> bool:
    ffmpeg_cmd = shutil.which("ffmpeg")
    if not ffmpeg_cmd:
        print("[AI Worker] WARNING: ffmpeg not found in PATH!")
        return False
    try:
        res = subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        first_line = res.stdout.split("\n")[0] if res.stdout else "unknown"
        print(f"[AI Worker] FFmpeg detected: {first_line}")
        return True
    except Exception as e:
        print(f"[AI Worker] Error verifying ffmpeg: {e}")
        return False

def connect_redis() -> redis.Redis:
    print(f"[AI Worker] Connecting to Redis at {settings.redis_host}:{settings.redis_port}...")
    r = redis.Redis(
        host=settings.redis_host,
        port=settings.redis_port,
        password=settings.redis_password or None,
        decode_responses=True
    )
    return r

def main():
    print("==================================================")
    print("  TiluchiRecords - AI Worker Daemon Starting      ")
    print("==================================================")
    
    verify_ffmpeg()
    
    r = connect_redis()
    
    # Try pinging Redis with retry loop
    connected = False
    for attempt in range(1, 11):
        try:
            r.ping()
            print(f"[AI Worker] Successfully connected to Redis on attempt {attempt}.")
            connected = True
            break
        except Exception as e:
            print(f"[AI Worker] Redis connection attempt {attempt}/10 failed: {e}. Retrying in 2s...")
            time.sleep(2)

    if not connected:
        print("[AI Worker] Could not connect to Redis. Running in standalone idle mode.")
        while True:
            time.sleep(5)

    print(f"[AI Worker] Listening for jobs on Redis queue '{settings.jobs_queue_name}'...")
    
    while True:
        try:
            # BLPOP waits for items in the Redis list
            task_data = r.blpop(settings.jobs_queue_name, timeout=5)
            if not task_data:
                continue

            queue_name, raw_message = task_data
            job = json.loads(raw_message)
            job_id = job.get("job_id")
            job_type = job.get("type")
            
            print(f"[AI Worker] Received Job: ID={job_id}, Type={job_type}")
            
            # Publish initial progress update
            progress_msg = json.dumps({
                "job_id": job_id,
                "status": "PROCESSING",
                "progress": 10
            })
            r.publish(settings.jobs_progress_channel, progress_msg)
            
            # Simulated processing or provider dispatch
            time.sleep(1)
            
            # Finished
            progress_msg = json.dumps({
                "job_id": job_id,
                "status": "COMPLETED",
                "progress": 100,
                "result": {"status": "ok"}
            })
            r.publish(settings.jobs_progress_channel, progress_msg)
            print(f"[AI Worker] Finished Job ID={job_id}")

        except Exception as e:
            print(f"[AI Worker] Error processing job from queue: {e}")
            time.sleep(1)

if __name__ == "__main__":
    main()
