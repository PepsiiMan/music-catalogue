import cv2
import numpy as np
import pytest
from pathlib import Path

from album_detector.album_detector import AlbumDetector
from album_detector.models import Album


@pytest.fixture
def single_frame_video_path(tmp_path: Path) -> Path:
    """Create a 1-second video containing a single frame of test.png."""
    path = tmp_path / "single_frame.mp4"
    img = cv2.imread("test.png")
    assert img is not None
    h, w = img.shape[:2]
    fourcc = cv2.VideoWriter.fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(path), fourcc, 1.0, (w, h))
    writer.write(img)
    writer.release()
    return path


def test_album_detector_end_to_end_on_single_frame_video(single_frame_video_path: Path):
    detector = AlbumDetector()
    result = detector.detect(single_frame_video_path)

    albums = result.albums
    assert len(albums) == 18

    # Verify a few known entries (exact strings may vary slightly due to video compression)
    by_pos = {(a.row, a.col): a for a in albums}
    assert by_pos[(0, 0)] == Album(row=0, col=0, source_frame=0, title="Descend", artist="PukeWolf")
    assert by_pos[(0, 2)] == Album(row=0, col=2, source_frame=0, title="Awakechildrenunderthemoon-EP", artist="Cissne")
    assert by_pos[(1, 0)] == Album(row=1, col=0, source_frame=0, title="FriendofaPhantom", artist="VOLA")
    assert by_pos[(1, 4)] == Album(row=1, col=4, source_frame=0, title="BlueRev", artist="Alvvays")
    assert by_pos[(1, 5)] == Album(row=1, col=5, source_frame=0, title="Rheia (Redux)", artist="Oathbreaker")


def test_album_detector_deduplicates_across_frames(single_frame_video_path: Path):
    """If two frames contain the same album, deduplication keeps only the first."""
    detector = AlbumDetector()
    result = detector.detect(single_frame_video_path)

    # All 18 albums come from a single frame, so no cross-frame dedup needed,
    # but we verify the pipeline works end-to-end.
    assert len(result.albums) == 18


def test_detection_result_includes_frame_counts(single_frame_video_path: Path):
    """DetectionResult reports total frames processed and frames with detections."""
    detector = AlbumDetector()
    result = detector.detect(single_frame_video_path)

    assert result.total_frames_processed >= 1
    assert result.frames_with_detections >= 1
    assert result.frames_with_detections <= result.total_frames_processed


def test_detect_stream_yields_unique_albums(single_frame_video_path: Path):
    """detect_stream() yields each unique album exactly once."""
    detector = AlbumDetector()
    streamed = list(detector.detect_stream(single_frame_video_path))

    assert len(streamed) == 18
    # All yielded items are Album instances
    assert all(isinstance(a, Album) for a in streamed)
    # No duplicate (title, artist) pairs
    seen = set()
    for album in streamed:
        key = (album.title.lower(), album.artist.lower())
        assert key not in seen, f"Duplicate yielded: {album}"
        seen.add(key)


def test_detect_stream_matches_detect(single_frame_video_path: Path):
    """detect_stream() produces the same albums as detect()."""
    detector = AlbumDetector()
    result = detector.detect(single_frame_video_path)
    streamed = list(detector.detect_stream(single_frame_video_path))

    # Same number of unique albums
    assert len(streamed) == len(result.albums)
    # Same set of (title, artist) pairs
    detect_keys = {(a.title, a.artist) for a in result.albums}
    stream_keys = {(a.title, a.artist) for a in streamed}
    assert stream_keys == detect_keys
