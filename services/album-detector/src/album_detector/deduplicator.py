from album_detector.models import Album


def deduplicate(albums: list[Album]) -> list[Album]:
    """Remove duplicates by comparing normalized (title, artist) pairs.

    Normalization: strip whitespace, lowercase. Preserve first occurrence.
    """
    seen: set[tuple[str, str]] = set()
    result: list[Album] = []
    for album in albums:
        key = (album.title.strip().lower(), album.artist.strip().lower())
        if key not in seen:
            seen.add(key)
            result.append(album)
    return result
