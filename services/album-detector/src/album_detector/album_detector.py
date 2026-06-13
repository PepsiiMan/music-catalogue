from collections.abc import Generator
from pathlib import Path

from rapidfuzz import fuzz

from album_detector.deduplicator import deduplicate, normalize
from album_detector.grid_detector import GridDetector
from album_detector.models import Album, DetectionResult
from album_detector.text_extractor import TextExtractor
from album_detector.video_sampler import VideoSampler


class AlbumDetector:
    """Orchestrate the full pipeline: video → frames → grid → text → dedup."""

    def __init__(
        self,
        sampler: VideoSampler | None = None,
        grid_detector: GridDetector | None = None,
        text_extractor: TextExtractor | None = None,
    ):
        self.sampler = sampler or VideoSampler()
        self.grid_detector = grid_detector or GridDetector()
        self.text_extractor = text_extractor or TextExtractor()

    def detect(self, video_path: Path) -> DetectionResult:
        """Process a video file and return a deduplicated list of detected albums.

        Convenience wrapper around detect_stream() that returns a DetectionResult.
        """
        albums = list(self.detect_stream(video_path))
        total_frames = 0
        frames_with_detections = 0
        for frame in self.sampler.sample(video_path):
            total_frames += 1
            if self.grid_detector.detect(frame):
                frames_with_detections += 1
            del frame

        return DetectionResult(
            albums=albums,
            total_frames_processed=total_frames,
            frames_with_detections=frames_with_detections,
        )

    def detect_stream(self, video_path: Path) -> Generator[Album, None, None]:
        """Yield unique albums as they are found, with incremental deduplication."""
        seen_exact: set[tuple[str, str]] = set()
        seen_albums: list[Album] = []

        for frame_idx, frame in enumerate(self.sampler.sample(video_path)):
            cells = self.grid_detector.detect(frame)
            text_results = self.text_extractor.extract_all(frame, cells)
            del frame

            for cell, (title, artist) in zip(cells, text_results):
                album = Album(
                    row=cell.row,
                    col=cell.col,
                    source_frame=frame_idx,
                    title=title,
                    artist=artist,
                )
                key = (normalize(title), normalize(artist))
                if key in seen_exact:
                    continue
                if self._is_duplicate(album, seen_albums):
                    continue
                seen_exact.add(key)
                seen_albums.append(album)
                yield album

    def _is_duplicate(self, album: Album, seen: list[Album], fuzzy_threshold: int = 85) -> bool:
        """Check if album is a fuzzy duplicate of any previously seen album."""
        norm_title = normalize(album.title)
        norm_artist = normalize(album.artist)
        for other in seen:
            if (
                fuzz.ratio(norm_title, normalize(other.title)) >= fuzzy_threshold
                and fuzz.ratio(norm_artist, normalize(other.artist)) >= fuzzy_threshold
            ):
                return True
        return False
