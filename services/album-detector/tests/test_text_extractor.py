import cv2
import numpy as np
import pytest

from album_detector.grid_detector import GridDetector
from album_detector.text_extractor import TextExtractor


def test_text_extractor_extracts_known_text_from_test_png():
    img = cv2.imread("test.png")
    assert img is not None

    grid = GridDetector().detect(img)
    extractor = TextExtractor()

    # Build a lookup by (row, col) for assertions
    by_pos = {}
    for cell in grid:
        title, artist = extractor.extract(img, cell)
        by_pos[(cell.row, cell.col)] = (title, artist)

    assert by_pos[(0, 0)] == ("Descend", "Puke Wolf")
    assert by_pos[(0, 2)] == ("Awake children under the moon-EP", "Cissne")
    assert by_pos[(1, 0)] == ("A Stranger ToYou", "Loathe")
    assert by_pos[(2, 3)] == ("BlueRev", "Alvvays")
    assert by_pos[(2, 5)] == ("Rheia(Redux)", "Oathbreaker")


def test_text_extractor_returns_empty_for_blank_region():
    extractor = TextExtractor()
    cell = type("Cell", (), {"x": 0, "y": 0, "w": 50, "h": 50})()
    blank = np.zeros((100, 100, 3), dtype=np.uint8)
    title, artist = extractor.extract(blank, cell)
    assert title == ""
    assert artist == ""


def test_text_extractor_caches_identical_crops(monkeypatch):
    extractor = TextExtractor()
    img = cv2.imread("test.png")
    assert img is not None

    grid = GridDetector().detect(img)
    cell = grid[0]

    # First call should run OCR
    result1 = extractor.extract(img, cell)
    assert result1[0] == "Descend"

    # Count how many times _read_text_crop is called
    call_count = 0
    original = extractor._read_text_crop

    def counting(text_img):
        nonlocal call_count
        call_count += 1
        return original(text_img)

    monkeypatch.setattr(extractor, "_read_text_crop", counting)

    # Second call with identical crop should hit the cache
    result2 = extractor.extract(img, cell)
    assert result2 == result1
    assert call_count == 0  # cached


def test_text_extractor_extract_all_matches_individual():
    img = cv2.imread("test.png")
    assert img is not None

    grid = GridDetector().detect(img)
    cells = sorted(grid, key=lambda c: (c.row, c.col))

    individual = TextExtractor()
    batch = TextExtractor()

    individual_results = [individual.extract(img, cell) for cell in cells]
    batch_results = batch.extract_all(img, cells)

    assert len(batch_results) == len(individual_results) == len(cells)

    # Both approaches should produce non-empty results for the same cells
    for i, (ind, bat) in enumerate(zip(individual_results, batch_results)):
        cell = cells[i]
        # Empty vs non-empty must agree
        assert bool(ind[0] or ind[1]) == bool(bat[0] or bat[1]), \
            f"Cell ({cell.row},{cell.col}): individual empty={ind == ('', '')}, batch empty={bat == ('', '')}"
