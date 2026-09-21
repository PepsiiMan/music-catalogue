# Music Catalogue

A local-first web app for cataloguing the music you listen to, including records that exist outside streaming platforms. The collection lives on the user's machine; the backend only fetches metadata.

## Language

**Album**:
An album the user has saved to their personal catalogue. Has an `id`; may have an `mbid` if it was matched to MusicBrainz.
_Avoid_: Record, entry, item

**Release**:
A release returned by a MusicBrainz search, identified by its `mbid`. Exists only as upstream metadata — it is not in the user's catalogue until saved as an Album.
_Avoid_: SearchResult, ReleaseDTO

**DetectedAlbum**:
A raw OCR detection from the video import pipeline: title/artist strings plus grid position. Unconfirmed and possibly garbled until the user turns it into an Album.
_Avoid_: Album (ambiguous — that is the saved entity), detection
