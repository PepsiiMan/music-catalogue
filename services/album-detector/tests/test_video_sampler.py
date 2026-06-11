import cv2
import numpy as np
import pytest
from pathlib import Path

from album_detector.video_sampler import VideoSampler


@pytest.fixture
def synthetic_video_path(tmp_path: Path) -> Path:
    """Create a 3-second synthetic video (2 fps) with 6 frames of different colors."""
    path = tmp_path / "synthetic.mp4"
    fourcc = cv2.VideoWriter.fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(path), fourcc, 2.0, (100, 100))
    colors = [
        (255, 0, 0),    # blue
        (0, 255, 0),    # green
        (0, 0, 255),    # red
        (255, 255, 0),  # cyan
        (255, 0, 255),  # magenta
        (0, 255, 255),  # yellow
    ]
    for color in colors:
        frame = np.full((100, 100, 3), color, dtype=np.uint8)
        writer.write(frame)
    writer.release()
    return path


def test_video_sampler_returns_frames_at_default_interval(synthetic_video_path: Path):
    sampler = VideoSampler()
    frames = list(sampler.sample(synthetic_video_path))

    # 3-second video at 0.5s interval -> ~6 frames (0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0)
    # But since it's only 3 seconds, we might get 7 or a few less depending on exact duration
    assert len(frames) >= 5
    assert len(frames) <= 7

    for frame in frames:
        assert isinstance(frame, np.ndarray)
        assert frame.shape == (100, 100, 3)


def test_video_sampler_returns_frames_at_custom_interval(synthetic_video_path: Path):
    sampler = VideoSampler(interval=1.0)
    frames = list(sampler.sample(synthetic_video_path))

    # 3-second video at 1.0s interval -> ~4 frames (0.0, 1.0, 2.0, 3.0)
    assert len(frames) >= 3
    assert len(frames) <= 4


def test_video_sampler_raises_on_missing_file():
    sampler = VideoSampler()
    with pytest.raises(RuntimeError):
        list(sampler.sample(Path("/nonexistent/path.mp4")))
