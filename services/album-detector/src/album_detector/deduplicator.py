import string

from rapidfuzz import fuzz

from album_detector.models import Album

# Characters to strip during normalization
_STRIP_TABLE = str.maketrans("", "", string.punctuation)


def normalize(text: str) -> str:
    """Lowercase, remove whitespace and punctuation."""
    return text.lower().translate(_STRIP_TABLE).replace(" ", "")


def deduplicate(albums: list[Album], fuzzy_threshold: int = 85) -> list[Album]:
    """Remove duplicates by comparing normalized (title, artist) pairs.

    Two-pass approach:
    1. Exact match on aggressively normalized keys (fast, handles whitespace
       and punctuation variations).
    2. Fuzzy match on survivors using rapidfuzz (catches OCR typos).

    fuzzy_threshold: minimum similarity ratio (0-100) to consider two strings
    a match. Applied independently to both title and artist.
    """
    # ── Pass 1: exact match on normalized keys ──────────────────────────
    seen_exact: set[tuple[str, str]] = set()
    survivors: list[Album] = []
    for album in albums:
        key = (normalize(album.title), normalize(album.artist))
        if key not in seen_exact:
            seen_exact.add(key)
            survivors.append(album)

    if len(survivors) <= 1:
        return survivors

    # ── Pass 2: fuzzy match on survivors ────────────────────────────────
    result: list[Album] = []
    merged: set[int] = set()  # indices into survivors that were merged

    for i, album_a in enumerate(survivors):
        if i in merged:
            continue
        result.append(album_a)
        norm_title_a = normalize(album_a.title)
        norm_artist_a = normalize(album_a.artist)

        for j in range(i + 1, len(survivors)):
            if j in merged:
                continue
            album_b = survivors[j]

            title_sim = fuzz.ratio(norm_title_a, normalize(album_b.title))
            artist_sim = fuzz.ratio(norm_artist_a, normalize(album_b.artist))

            if title_sim >= fuzzy_threshold and artist_sim >= fuzzy_threshold:
                merged.add(j)

    return result
