"""
Album grid detector — extracts individual album card thumbnails from a screenshot.

Usage:
    uv run python detect_grid.py <input_image> [--output-dir <dir>] [--debug]

Examples:
    uv run python detect_grid.py screenshot.png
    uv run python detect_grid.py screenshot.png --output-dir crops/ --debug
"""

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np
from sklearn.cluster import DBSCAN
from rapidocr_onnxruntime import RapidOCR
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

# How far below the thumbnail the text region starts, and how tall it is,
# expressed as a fraction of thumbnail height.
TEXT_OFFSET_FRACTION = 0.01       # 5 % gap below thumb
TEXT_HEIGHT_FRACTION = 0.35       # 35 % of thumb height  (≈ 2 lines of text)

ocr = RapidOCR()

# ── Helpers ──────────────────────────────────────────────────────────────────

def find_square_candidates(gray: np.ndarray, total_area: int, debug_img=None):
    """
    Return list of (x, y, w, h) bounding boxes that look like square thumbnails.
    Uses both edge-based contour detection and a morphological approach so it
    degrades gracefully on images with soft or missing borders.
    """
    candidates = []

    # ── Method 1: Canny + contours ──────────────────────────────────────────
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(blurred, 30, 120)
    # Dilate to close small gaps on album art edges
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.dilate(edges, kernel, iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates += _filter_squares(contours, total_area)

    # ── Method 2: Otsu threshold + contours (catches flat-colour thumbnails) ─
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    contours2, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates += _filter_squares(contours2, total_area)

    if debug_img is not None:
        for (x, y, w, h) in candidates:
            cv2.rectangle(debug_img, (x, y), (x + w, y + h), (0, 255, 255), 1)

    return candidates


def _filter_squares(contours, total_area):
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


def deduplicate_boxes(boxes, iou_threshold=0.5):
    """Remove duplicate bounding boxes with high IoU overlap (NMS-lite)."""
    if not boxes:
        return []
    boxes = sorted(boxes, key=lambda b: b[2] * b[3], reverse=True)  # largest first
    kept = []
    for box in boxes:
        if all(_iou(box, k) < iou_threshold for k in kept):
            kept.append(box)
    return kept


def _iou(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ix = max(0, min(ax + aw, bx + bw) - max(ax, bx))
    iy = max(0, min(ay + ah, by + bh) - max(ay, by))
    inter = ix * iy
    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0


def snap_to_grid(boxes):
    """
    Given a noisy set of bounding boxes, snap them onto a clean grid by
    clustering centres into rows and columns, then re-inferring a uniform
    cell size from the median.

    Returns a list of (col_idx, row_idx, x, y, w, h) for every grid cell
    that had at least one candidate box.
    """
    if not boxes:
        return []

    xs = np.array([[b[0] + b[2] / 2] for b in boxes], dtype=float)
    ys = np.array([[b[1] + b[3] / 2] for b in boxes], dtype=float)
    ws = np.array([b[2] for b in boxes])
    hs = np.array([b[3] for b in boxes])

    # Median size → canonical cell size
    med_w = int(np.median(ws))
    med_h = int(np.median(hs))

    # Cluster column centres
    col_labels = DBSCAN(eps=CLUSTER_EPS, min_samples=MIN_CARDS_PER_LINE).fit(xs).labels_
    row_labels = DBSCAN(eps=CLUSTER_EPS, min_samples=MIN_CARDS_PER_LINE).fit(ys).labels_

    # Keep only boxes that belong to a real row AND a real column
    valid = (col_labels != -1) & (row_labels != -1)
    if valid.sum() == 0:
        # Fallback: accept all boxes even without grid structure
        valid = np.ones(len(boxes), dtype=bool)
        col_labels = np.zeros(len(boxes), dtype=int)
        row_labels = np.zeros(len(boxes), dtype=int)

    # Build sorted column / row indices
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
        # Re-center the canonical-sized box on this candidate's centre
        cx = int(xs[i][0])
        cy = int(ys[i][0])
        x = cx - med_w // 2
        y = cy - med_h // 2
        results.append((ci, ri, x, y, med_w, med_h))

    return results


def extract_text_region(img: np.ndarray, x, y, w, h):
    """Return the image strip just below a thumbnail (title + artist area)."""
    ih, iw = img.shape[:2]
    gap = int(h * TEXT_OFFSET_FRACTION)
    text_h = int(h * TEXT_HEIGHT_FRACTION)
    ty = y + h + gap
    ty2 = min(ty + text_h, ih)
    tx1 = max(x, 0)
    tx2 = min(x + w, iw)
    if ty >= ih or tx1 >= tx2:
        return None
    return img[ty:ty2, tx1:tx2]

def read_text_crop(text_img: np.ndarray) -> tuple[str, str]:
    if text_img is None or text_img.size == 0:
        return "", ""

    result, _ = ocr(text_img)
    if not result:
        return "", ""

    lines = [text for (_, text, conf) in result if conf > 0.6]
    title =  ""
    for line in lines[:-1]:
        title += line
    artist = lines[-1] if len(lines) > 1 else ""
    return title, artist

# ── Main ─────────────────────────────────────────────────────────────────────

def run(input_path: Path, output_dir: Path, debug: bool):
    img = cv2.imread(str(input_path))
    if img is None:
        print(f"[ERROR] Cannot read image: {input_path}", file=sys.stderr)
        sys.exit(1)

    ih, iw = img.shape[:2]
    total_area = ih * iw
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    print(f"[INFO] Image size: {iw}×{ih}")

    debug_img = img.copy() if debug else None

    # 1 ── Find square candidates
    candidates = find_square_candidates(gray, total_area, debug_img)
    print(f"[INFO] Raw candidates: {len(candidates)}")

    # 2 ── Deduplicate overlapping boxes
    candidates = deduplicate_boxes(candidates)
    print(f"[INFO] After dedup: {len(candidates)}")

    # 3 ── Snap onto grid
    grid_cells = snap_to_grid(candidates)
    print(f"[INFO] Grid cells accepted: {len(grid_cells)}")

    if not grid_cells:
        print("[WARN] No grid detected. Try --debug to inspect intermediate results.")
        if debug:
            _save_debug(debug_img, output_dir, "debug_no_grid.png")
        return

    # 4 ── Save crops
    output_dir.mkdir(parents=True, exist_ok=True)
    saved = 0
    for (ci, ri, x, y, w, h) in sorted(grid_cells, key=lambda c: (c[1], c[0])):
        # Clamp to image bounds
        x1, y1 = max(x, 0), max(y, 0)
        x2, y2 = min(x + w, iw), min(y + h, ih)
        if x2 <= x1 or y2 <= y1:
            continue

        thumb = img[y1:y2, x1:x2]
        thumb_path = output_dir / f"thumb_r{ri:02d}_c{ci:02d}.png"
        cv2.imwrite(str(thumb_path), thumb)

        text_crop = extract_text_region(img, x, y, w, h)
        if text_crop is not None and text_crop.size > 0:
            text_path = output_dir / f"text_r{ri:02d}_c{ci:02d}.png"
            cv2.imwrite(str(text_path), text_crop)
            title, artist = read_text_crop(text_crop)
            print(f"r{ri}c{ci} -> {title} / {artist}")

        saved += 1
        if debug_img is not None:
            cv2.rectangle(debug_img, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(debug_img, f"r{ri}c{ci}", (x1 + 4, y1 + 16),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 0), 1)
            # text region in blue
            gap = int(h * TEXT_OFFSET_FRACTION)
            text_h = int(h * TEXT_HEIGHT_FRACTION)
            ty = y + h + gap
            cv2.rectangle(debug_img, (x1, ty), (x2, min(ty + text_h, ih)), (255, 100, 0), 1)

    print(f"[INFO] Saved {saved} thumbnail crops → {output_dir}/")

    if debug:
        _save_debug(debug_img, output_dir, "debug_overlay.png")


def _save_debug(img, output_dir, name):
    output_dir.mkdir(parents=True, exist_ok=True)
    p = output_dir / name
    cv2.imwrite(str(p), img)
    print(f"[DEBUG] Overlay saved → {p}")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", type=Path, help="Input screenshot / frame")
    parser.add_argument("--output-dir", "-o", type=Path, default=Path("crops"),
                        help="Where to write cropped images (default: ./crops/)")
    parser.add_argument("--debug", action="store_true",
                        help="Save a debug overlay image showing detected regions")
    args = parser.parse_args()

    run(args.input, args.output_dir, args.debug)


if __name__ == "__main__":
    main()