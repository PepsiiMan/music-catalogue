import logging
import tempfile
from pathlib import Path

from fastapi import FastAPI, UploadFile

from album_detector.album_detector import AlbumDetector

logger = logging.getLogger(__name__)

app = FastAPI()
detector = AlbumDetector()


@app.post("/detect")
async def detect(video: UploadFile):
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        logger.info("Streaming upload to %s", tmp.name)
        while chunk := await video.read(8192):
            tmp.write(chunk)
        tmp_path = Path(tmp.name)

    try:
        logger.info("Running album detection pipeline")
        result = detector.detect(tmp_path)
        logger.info(
            "Pipeline complete: %d albums, %d frames processed",
            len(result.albums),
            result.total_frames_processed,
        )
        return {
            "albums": [
                {
                    "title": a.title,
                    "artist": a.artist,
                    "row": a.row,
                    "col": a.col,
                    "source_frame": a.source_frame,
                }
                for a in result.albums
            ],
            "total_frames_processed": result.total_frames_processed,
            "frames_with_detections": result.frames_with_detections,
        }
    finally:
        tmp_path.unlink(missing_ok=True)
        logger.info("Temp file %s removed", tmp.name)
