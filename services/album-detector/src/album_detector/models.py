from dataclasses import dataclass


@dataclass(frozen=True)
class GridCell:
    row: int
    col: int
    x: int
    y: int
    w: int
    h: int


@dataclass(frozen=True)
class Album:
    row: int
    col: int
    source_frame: int
    title: str
    artist: str


@dataclass(frozen=True)
class DetectionResult:
    albums: list[Album]
    total_frames_processed: int
    frames_with_detections: int
