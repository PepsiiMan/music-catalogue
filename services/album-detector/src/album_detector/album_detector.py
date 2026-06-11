from pathlib import Path

from album_detector.deduplicator import deduplicate
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
        """Process a video file and return a deduplicated list of detected albums."""
        all_albums: list[Album] = []

        for frame_idx, frame in enumerate(self.sampler.sample(video_path)):
            cells = self.grid_detector.detect(frame)
            text_results = self.text_extractor.extract_all(frame, cells)
            del frame  # free the frame before processing next
            for cell, (title, artist) in zip(cells, text_results):
                all_albums.append(
                    Album(
                        row=cell.row,
                        col=cell.col,
                        source_frame=frame_idx,
                        title=title,
                        artist=artist,
                    )
                )

        unique_albums = deduplicate(all_albums)
        return DetectionResult(albums=unique_albums)
