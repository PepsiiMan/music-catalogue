from pathlib import Path

import cv2
import numpy as np


class VideoSampler:
    """Sample frames evenly from a video file at a given interval."""

    def __init__(self, interval: float = 0.5):
        self.interval = interval

    def sample(self, video_path: Path) -> list[np.ndarray]:
        """Return a list of BGR frames sampled at the configured interval."""
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0

        # Compute target frame indices for sequential reading
        target_indices = set()
        t = 0.0
        while t <= duration:
            target_indices.add(int(round(t * fps)))
            t += self.interval
        # Clamp to valid range
        target_indices = {i for i in target_indices if 0 <= i < frame_count}
        target_indices = sorted(target_indices)

        frames: list[np.ndarray] = []
        frame_idx = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx in target_indices:
                frames.append(frame)
            frame_idx += 1

        cap.release()
        return frames
