import cv2
import numpy as np

from album_detector.grid_detector import GridDetector


def test_grid_detector_detects_expected_layout_on_test_png():
    img = cv2.imread("test.png")
    assert img is not None

    detector = GridDetector()
    cells = detector.detect(img)

    assert len(cells) == 18

    rows = sorted({c.row for c in cells})
    cols = sorted({c.col for c in cells})
    assert rows == [0, 1, 2]
    assert cols == [0, 1, 2, 3, 4, 5]

    for cell in cells:
        assert cell.w > 0
        assert cell.h > 0
        assert cell.x >= 0
        assert cell.y >= 0


def test_grid_detector_returns_empty_for_blank_image():
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    detector = GridDetector()
    cells = detector.detect(img)
    assert cells == []
