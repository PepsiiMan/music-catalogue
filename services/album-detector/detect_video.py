#!/usr/bin/env python3
"""CLI for video album detection."""

import sys
from pathlib import Path

# Add src/ to path so album_detector can be imported without installing
sys.path.insert(0, str(Path(__file__).parent / "src"))

import argparse

from album_detector.album_detector import AlbumDetector
from album_detector.video_sampler import VideoSampler


def main():
    parser = argparse.ArgumentParser(description="Detect albums from a video file.")
    parser.add_argument("video", type=Path, help="Path to the input video file")
    parser.add_argument(
        "--interval", "-i", type=float, default=0.5,
        help="Frame sampling interval in seconds (default: 0.5)",
    )
    parser.add_argument(
        "--dedup", action="store_true", default=True,
        help="Deduplicate albums across frames (default: True)",
    )
    parser.add_argument(
        "--no-dedup", action="store_false", dest="dedup",
        help="Disable deduplication",
    )
    args = parser.parse_args()

    detector = AlbumDetector(
        sampler=VideoSampler(interval=args.interval),
    )
    result = detector.detect(args.video)

    albums = result.albums
    print(f"Found {len(albums)} unique albums:")
    print()

    for album in albums:
        print(f"  [{album.row},{album.col}] {album.title!r} — {album.artist!r}")


if __name__ == "__main__":
    main()
