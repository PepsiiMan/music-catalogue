import hashlib

import cv2
import numpy as np
from rapidocr_onnxruntime import RapidOCR

from album_detector.models import GridCell

# ── Tunables ────────────────────────────────────────────────────────────────

# How far below the thumbnail the text region starts, and how tall it is,
# expressed as a fraction of thumbnail height.
TEXT_OFFSET_FRACTION = 0.01
TEXT_HEIGHT_FRACTION = 0.35

_ocr = RapidOCR()


class TextExtractor:
    """Extract (title, artist) text from the region below a thumbnail cell.

    Caches OCR results keyed by a hash of the cropped text-region pixels so
    that identical text regions across different frames are processed only
    once.
    """

    def __init__(self):
        self._cache: dict[str, tuple[str, str]] = {}

    def extract(self, image: np.ndarray, cell: GridCell) -> tuple[str, str]:
        """Given a BGR image and a GridCell, return (title, artist)."""
        text_crop = self._crop_text_region(image, cell)
        if text_crop is None or text_crop.size == 0:
            return "", ""

        key = hashlib.md5(text_crop.tobytes()).hexdigest()
        if key in self._cache:
            return self._cache[key]

        result = self._read_text_crop(text_crop)
        self._cache[key] = result
        return result

    def extract_all(self, image: np.ndarray, cells: list[GridCell]) -> list[tuple[str, str]]:
        """Batch-extract text for multiple cells via a single OCR call.

        Stacks all text crops vertically (with a 5px black separator between
        each crop) and runs OCR once on the combined image.  Uses the bounding
        box y-coordinates returned by RapidOCR to map each detected line back
        to the correct cell.
        """
        crops: list[np.ndarray] = []
        heights: list[int] = []
        for cell in cells:
            crop = self._crop_text_region(image, cell)
            if crop is not None and crop.size > 0:
                crops.append(crop)
                heights.append(crop.shape[0])
            else:
                crops.append(np.empty((0, 0, 3), dtype=np.uint8))
                heights.append(0)

        if not crops:
            return [("", "") for _ in cells]

        max_w = max(c.shape[1] for c in crops if c.size > 0)
        sep = np.zeros((5, max_w, 3), dtype=np.uint8) if max_w > 0 else np.empty((0, 0, 3), dtype=np.uint8)

        y_offsets: list[int] = []
        current_y = 0
        parts: list[np.ndarray] = []
        for crop in crops:
            y_offsets.append(current_y)
            if crop.size == 0:
                parts.append(np.zeros((0, max_w, 3), dtype=np.uint8) if max_w > 0 else crop)
            else:
                if crop.shape[1] < max_w:
                    pad = np.zeros((crop.shape[0], max_w - crop.shape[1], 3), dtype=np.uint8)
                    crop = np.hstack([crop, pad])
                parts.append(crop)
                current_y += crop.shape[0]
            parts.append(sep.copy())
            current_y += sep.shape[0]

        combined = np.vstack(parts)

        raw_result, _ = _ocr(combined)
        if not raw_result:
            return [("", "") for _ in cells]

        cell_lines: list[list[tuple[str, float]]] = [[] for _ in cells]
        for bbox, text, conf in raw_result:
            y_center = (bbox[0][1] + bbox[2][1]) / 2
            for i in range(len(crops)):
                cell_top = y_offsets[i]
                cell_bottom = cell_top + heights[i]
                if cell_top <= y_center < cell_bottom:
                    cell_lines[i].append((text, conf))
                    break

        results: list[tuple[str, str]] = []
        for lines in cell_lines:
            filtered = [text for text, conf in lines if conf > 0.6]
            title = ""
            for line in filtered[:-1]:
                title += line
            artist = filtered[-1] if len(filtered) > 1 else ""
            results.append((title, artist))
        return results

    def _crop_text_region(self, img: np.ndarray, cell: GridCell) -> np.ndarray | None:
        """Return the image strip just below a thumbnail (title + artist area)."""
        ih, iw = img.shape[:2]
        gap = int(cell.h * TEXT_OFFSET_FRACTION)
        text_h = int(cell.h * TEXT_HEIGHT_FRACTION)
        ty = cell.y + cell.h + gap
        ty2 = min(ty + text_h, ih)
        tx1 = max(cell.x, 0)
        tx2 = min(cell.x + cell.w, iw)
        if ty >= ih or tx1 >= tx2:
            return None
        return img[ty:ty2, tx1:tx2]

    def _read_text_crop(self, text_img: np.ndarray) -> tuple[str, str]:
        result, _ = _ocr(text_img)
        if not result:
            return "", ""

        lines = [text for (_, text, conf) in result if conf > 0.6]
        title = ""
        for line in lines[:-1]:
            title += line
        artist = lines[-1] if len(lines) > 1 else ""
        return title, artist
