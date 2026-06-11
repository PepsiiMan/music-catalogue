import cv2
import numpy as np
from sklearn.cluster import DBSCAN

from album_detector.models import GridCell

# ── Tunables ────────────────────────────────────────────────────────────────

# Fraction of image area: thumbnails smaller or larger than this are ignored.
MIN_THUMB_AREA_FRACTION = 0.002   # 0.2 % of frame  → filters tiny noise
MAX_THUMB_AREA_FRACTION = 0.15    # 15 % of frame   → filters huge regions

# How square a region must be to be a thumbnail candidate (1.0 = perfect square)
ASPECT_RATIO_TOLERANCE = 0.20     # ±20 % from square

# DBSCAN: max pixel distance between centres to be in the same row/column
CLUSTER_EPS = 30                  # increase if cards are far apart

# Minimum cards in a row/column to count as a real grid line
MIN_CARDS_PER_LINE = 2

# NMS-lite threshold for deduplicating overlapping candidate boxes
IOU_THRESHOLD = 0.5


class GridDetector:
    """Detect a grid of square thumbnail cells in an image."""

    def detect(self, image: np.ndarray) -> list[GridCell]:
        """Given a BGR image, return a list of GridCell objects."""
        ih, iw = image.shape[:2]
        total_area = ih * iw
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        candidates = self._find_square_candidates(gray, total_area)
        candidates = self._deduplicate_boxes(candidates)
        grid_cells = self._snap_to_grid(candidates)
        return grid_cells

    def _find_square_candidates(self, gray: np.ndarray, total_area: int):
        """Return list of (x, y, w, h) bounding boxes that look like square thumbnails."""
        candidates = []

        # Method 1: Canny + contours
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        edges = cv2.Canny(blurred, 30, 120)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edges = cv2.dilate(edges, kernel, iterations=1)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        candidates += self._filter_squares(contours, total_area)

        # Method 2: Otsu threshold + contours
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        contours2, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        candidates += self._filter_squares(contours2, total_area)

        return candidates

    def _filter_squares(self, contours, total_area):
        results = []
        min_area = total_area * MIN_THUMB_AREA_FRACTION
        max_area = total_area * MAX_THUMB_AREA_FRACTION
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            area = w * h
            if area < min_area or area > max_area:
                continue
            aspect = w / h if h > 0 else 0
            if abs(aspect - 1.0) > ASPECT_RATIO_TOLERANCE:
                continue
            results.append((x, y, w, h))
        return results

    def _deduplicate_boxes(self, boxes):
        """Remove duplicate bounding boxes with high IoU overlap (NMS-lite)."""
        if not boxes:
            return []
        boxes = sorted(boxes, key=lambda b: b[2] * b[3], reverse=True)
        kept = []
        for box in boxes:
            if all(self._iou(box, k) < IOU_THRESHOLD for k in kept):
                kept.append(box)
        return kept

    def _iou(self, a, b):
        ax, ay, aw, ah = a
        bx, by, bw, bh = b
        ix = max(0, min(ax + aw, bx + bw) - max(ax, bx))
        iy = max(0, min(ay + ah, by + bh) - max(ay, by))
        inter = ix * iy
        union = aw * ah + bw * bh - inter
        return inter / union if union > 0 else 0

    def _snap_to_grid(self, boxes):
        """Cluster centres into rows and columns, then re-infer a uniform cell size."""
        if not boxes:
            return []

        xs = np.array([[b[0] + b[2] / 2] for b in boxes], dtype=float)
        ys = np.array([[b[1] + b[3] / 2] for b in boxes], dtype=float)
        ws = np.array([b[2] for b in boxes])
        hs = np.array([b[3] for b in boxes])

        med_w = int(np.median(ws))
        med_h = int(np.median(hs))

        col_labels = DBSCAN(eps=CLUSTER_EPS, min_samples=MIN_CARDS_PER_LINE).fit(xs).labels_
        row_labels = DBSCAN(eps=CLUSTER_EPS, min_samples=MIN_CARDS_PER_LINE).fit(ys).labels_

        valid = (col_labels != -1) & (row_labels != -1)
        if valid.sum() == 0:
            valid = np.ones(len(boxes), dtype=bool)
            col_labels = np.zeros(len(boxes), dtype=int)
            row_labels = np.zeros(len(boxes), dtype=int)

        unique_cols = sorted(set(col_labels[valid]))
        unique_rows = sorted(set(row_labels[valid]))
        col_rank = {c: i for i, c in enumerate(unique_cols)}
        row_rank = {r: i for i, r in enumerate(unique_rows)}

        results = []
        for i, box in enumerate(boxes):
            if not valid[i]:
                continue
            ci = col_rank[col_labels[i]]
            ri = row_rank[row_labels[i]]
            cx = int(xs[i][0])
            cy = int(ys[i][0])
            x = cx - med_w // 2
            y = cy - med_h // 2
            results.append(GridCell(row=ri, col=ci, x=x, y=y, w=med_w, h=med_h))

        return results
