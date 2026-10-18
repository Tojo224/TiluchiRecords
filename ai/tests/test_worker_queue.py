import json
from pathlib import Path

from src import worker


class FakeRedis:
    def __init__(self, inflight=None):
        self.inflight = list(inflight or [])
        self.main = []
        self.removed = []
        self.reserve_args = None

    def lmove(self, source, destination, src, dest):
        if not self.inflight:
            return None
        value = self.inflight.pop(0)
        self.main.insert(0, value)
        return value

    def blmove(self, source, destination, timeout, src, dest):
        self.reserve_args = (source, destination, timeout, src, dest)
        return self.main.pop(0) if self.main else None

    def lrem(self, queue, count, value):
        self.removed.append((queue, count, value))
        return 1


def test_interrupted_jobs_are_recovered_before_listening():
    redis = FakeRedis(["job-a", "job-b"])

    assert worker.recover_inflight_jobs(redis) == 2
    assert redis.inflight == []
    assert sorted(redis.main) == ["job-a", "job-b"]


def test_job_reservation_is_atomic_and_acknowledged():
    redis = FakeRedis()
    redis.main.append("job-a")

    assert worker.reserve_job(redis, timeout=7) == "job-a"
    assert redis.reserve_args == (
        worker.settings.jobs_queue_name,
        worker.processing_queue_name(),
        7,
        "LEFT",
        "RIGHT",
    )

    worker.acknowledge_job(redis, "job-a")
    assert redis.removed == [(worker.processing_queue_name(), 1, "job-a")]


def test_face_swap_processes_each_selected_identity_in_sequence(monkeypatch):
    progress_messages = []
    swap_calls = []
    uploaded = []

    class ProgressRedis:
        def publish(self, _channel, message):
            progress_messages.append(json.loads(message))

    def download_file(_storage_key, local_path):
        Path(local_path).parent.mkdir(parents=True, exist_ok=True)
        Path(local_path).write_bytes(b"input")

    def swap(source, target, output, **kwargs):
        swap_calls.append((source, target, output, kwargs))
        Path(output).write_bytes(b"processed")

    def upload_file(local_path, storage_key, content_type):
        assert Path(local_path).read_bytes() == b"processed"
        uploaded.append((storage_key, content_type))

    monkeypatch.setattr(worker.storage_service, "download_file", download_file)
    monkeypatch.setattr(worker.storage_service, "upload_file", upload_file)
    monkeypatch.setattr(worker.face_swap_provider, "swap", swap)
    monkeypatch.setattr(worker.video_clip_provider, "release", lambda: None)

    worker.process_face_swap(
        ProgressRedis(),
        {
            "job_id": "job-multi",
            "project_id": "project-1",
            "payload": {
                "consentLogId": "consent-1",
                "sourceVideoAsset": {
                    "id": "video-1",
                    "name": "target.mp4",
                    "mimeType": "video/mp4",
                    "storageKey": "videos/target.mp4",
                },
                "sourceImageAsset": {
                    "id": "image-1",
                    "name": "face.jpg",
                    "storageKey": "images/face.jpg",
                },
                "targetIdentities": [
                    {
                        "id": "person-1",
                        "referenceFrameNumber": 25,
                        "referenceFacePosition": 0,
                    },
                    {
                        "id": "person-2",
                        "referenceFrameNumber": 90,
                        "referenceFacePosition": 1,
                    },
                ],
            },
        },
    )

    assert len(swap_calls) == 2
    assert swap_calls[0][3] == {
        "reference_frame_number": 25,
        "reference_face_position": 0,
    }
    assert swap_calls[1][1] == swap_calls[0][2]
    assert swap_calls[1][3] == {
        "reference_frame_number": 90,
        "reference_face_position": 1,
    }
    assert uploaded == [
        (
            "projects/project-1/face_swap_result_video/job-multi-result.mp4",
            "video/mp4",
        )
    ]
    completed = progress_messages[-1]
    metadata = completed["result"]["generatedAssets"][0]["metadata"]
    assert completed["status"] == "COMPLETED"
    assert metadata["targetIdentityIds"] == ["person-1", "person-2"]
