import io
from pathlib import Path

import cv2
import pytest
from fastapi.testclient import TestClient

from album_detector.app import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def single_frame_video_bytes() -> bytes:
    """Create a 1-second video containing a single frame of test.png as bytes."""
    img = cv2.imread("test.png")
    assert img is not None
    h, w = img.shape[:2]
    fourcc = cv2.VideoWriter.fourcc(*"mp4v")
    buf = io.BytesIO()
    writer = cv2.VideoWriter("test_output.mp4", fourcc, 1.0, (w, h))
    writer.write(img)
    writer.release()
    with open("test_output.mp4", "rb") as f:
        data = f.read()
    Path("test_output.mp4").unlink(missing_ok=True)
    return data


def test_detect_returns_200_with_valid_video(client: TestClient, single_frame_video_bytes: bytes):
    response = client.post(
        "/detect",
        files={"video": ("test.mp4", single_frame_video_bytes, "video/mp4")},
    )
    assert response.status_code == 200
    body = response.json()
    assert "albums" in body
    assert "total_frames_processed" in body
    assert "frames_with_detections" in body
    assert isinstance(body["albums"], list)
    assert len(body["albums"]) > 0
    assert body["total_frames_processed"] >= 1
    assert body["frames_with_detections"] >= 1


def test_detect_album_shape(client: TestClient, single_frame_video_bytes: bytes):
    """Each album in the response has the expected fields."""
    response = client.post(
        "/detect",
        files={"video": ("test.mp4", single_frame_video_bytes, "video/mp4")},
    )
    body = response.json()
    album = body["albums"][0]
    assert "title" in album
    assert "artist" in album
    assert "row" in album
    assert "col" in album
    assert "source_frame" in album


def test_detect_no_video_field_returns_422(client: TestClient):
    response = client.post("/detect")
    assert response.status_code == 422
