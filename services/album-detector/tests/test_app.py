import io
from pathlib import Path

import cv2
import numpy as np
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


def _video_bytes_from_image(img, fps=1.0) -> bytes:
    """Encode a single-frame OpenCV image as an MP4 byte string."""
    h, w = img.shape[:2]
    fourcc = cv2.VideoWriter.fourcc(*"mp4v")
    tmp = Path("_tmp_fixture.mp4")
    writer = cv2.VideoWriter(str(tmp), fourcc, fps, (w, h))
    writer.write(img)
    writer.release()
    data = tmp.read_bytes()
    tmp.unlink(missing_ok=True)
    return data


def test_detect_no_video_field_returns_422(client: TestClient):
    response = client.post("/detect")
    assert response.status_code == 422


def test_detect_no_grid_returns_422(client: TestClient):
    """A blank video with no detectable grid should return 422."""
    blank = np.zeros((480, 640, 3), dtype=np.uint8)
    video = _video_bytes_from_image(blank)
    response = client.post(
        "/detect",
        files={"video": ("blank.mp4", video, "video/mp4")},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "No album grid detected in any frame"


def _grid_only_image() -> np.ndarray:
    """Create a 640x480 image with a 3x2 grid of white squares, no text."""
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    sq = 80
    positions = [
        (80, 100), (280, 100), (480, 100),
        (80, 300), (280, 300), (480, 300),
    ]
    for x, y in positions:
        img[y : y + sq, x : x + sq] = 255
    return img


def test_detect_no_text_returns_422(client: TestClient):
    """A video with grids but no readable text should return 422."""
    img = _grid_only_image()
    video = _video_bytes_from_image(img)
    response = client.post(
        "/detect",
        files={"video": ("grid_no_text.mp4", video, "video/mp4")},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "No readable text found"


def test_detect_invalid_video_returns_400(client: TestClient):
    """Uploading a non-video file should return 400."""
    response = client.post(
        "/detect",
        files={"video": ("bad.mp4", b"not a video at all", "video/mp4")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid video file"


def test_detect_cleans_up_temp_file_on_error(client: TestClient):
    """Temp file should be removed even when the pipeline raises."""
    import tempfile
    from unittest.mock import patch

    created_paths: list[Path] = []
    original = tempfile.NamedTemporaryFile

    def tracking_named_temp(*args, **kwargs):
        f = original(*args, **kwargs)
        created_paths.append(Path(f.name))
        return f

    with patch("album_detector.app.tempfile.NamedTemporaryFile", tracking_named_temp):
        client.post(
            "/detect",
            files={"video": ("bad.mp4", b"not a video", "video/mp4")},
        )

    assert len(created_paths) == 1
    assert not created_paths[0].exists(), "Temp file was not cleaned up"
