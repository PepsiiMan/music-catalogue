from album_detector.models import Album
from album_detector.deduplicator import deduplicate, normalize


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


def test_deduplicator_normalizes_punctuation():
    albums = [
        Album(row=0, col=0, source_frame=0, title="Rheia (Redux)", artist="Oathbreaker"),
        Album(row=0, col=1, source_frame=1, title="Rheia(Redux)", artist="Oathbreaker"),
    ]
    result = deduplicate(albums)
    assert len(result) == 1


def test_deduplicator_fuzzy_matches_ocr_typos():
    albums = [
        Album(row=0, col=0, source_frame=0, title="NieRReplicant", artist="Square Enix Music,MONACA,Keiichi.."),
        Album(row=0, col=1, source_frame=1, title="NieRReplicant", artist="Square EnixMusic,MONACA,Kelichi.."),
    ]
    result = deduplicate(albums)
    assert len(result) == 1


def test_deduplicator_keeps_distinct_albums():
    albums = [
        Album(row=0, col=0, source_frame=0, title="BlueRev", artist="Alvvays"),
        Album(row=0, col=1, source_frame=1, title="BlueWave", artist="Alvvays"),
    ]
    result = deduplicate(albums)
    assert len(result) == 2


def test_normalize_removes_punctuation_and_whitespace():
    assert normalize("Rheia (Redux)") == "rheiaredux"
    assert normalize("Hello, World!") == "helloworld"
    assert normalize("A.B.C") == "abc"
