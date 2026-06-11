from album_detector.models import Album
from album_detector.deduplicator import deduplicate


def test_deduplicator_removes_exact_duplicates():
    albums = [
        Album(row=0, col=0, source_frame=0, title="  Hello World  ", artist="Artist A"),
        Album(row=0, col=1, source_frame=0, title="hello world", artist="artist a"),
        Album(row=1, col=0, source_frame=1, title="Unique Title", artist="Artist B"),
    ]

    result = deduplicate(albums)

    assert len(result) == 2
    assert result[0].title == "  Hello World  "
    assert result[0].artist == "Artist A"
    assert result[1].title == "Unique Title"
    assert result[1].artist == "Artist B"


def test_deduplicator_preserves_empty_list():
    assert deduplicate([]) == []


def test_deduplicator_preserves_single_item():
    albums = [Album(row=0, col=0, source_frame=0, title="Solo", artist="One")]
    assert deduplicate(albums) == albums


def test_deduplicator_removes_all_duplicates():
    albums = [
        Album(row=0, col=0, source_frame=0, title="Same", artist="Same"),
        Album(row=0, col=1, source_frame=1, title="same", artist="same"),
        Album(row=1, col=0, source_frame=2, title="SAME", artist="SAME"),
    ]
    result = deduplicate(albums)
    assert len(result) == 1
    assert result[0].title == "Same"
