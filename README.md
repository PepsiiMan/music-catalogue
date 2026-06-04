# Music-Catalogue
As an avid listener of music, one of my biggest pain points is keeping track of what I listen to. For example, I often find myself forgetting about the tribute album to "Yellow Loveless" because, outside of owning a physical copy (which I don't), it only exists in the form of a video on YouTube. Other records exists in some streaming platforms but not others, some music is even unreleased and you'd only know about it if you happen to catch it live. The main point here is that I really want a place where I can catalogue everything I listen to and be able to reference back to it. This repository is my attempt to achieve that.

The work here is very much a WIP, with more features and refinement coming.

I'm hosting the app on a VPS, reachable through my [meme domain](batates.org) (not always be online)

## What I'm using
Besides getting a useful application, I'm trying to attain new skills to expand my development repertoire with the following:
- Frontend: React + Typescript
- Backend: Go + Chi to fetch music metadata
- Database: SQLite through OPFS using `wa-sqlite`
  - After much deliberation, I decided I did not want to support account creation/management, and instead go for a local-first approach where each user's collection lives on their machine.

In addition, I'm using OpenCode to try out coding agents in practice

# Current Features
- Searching for albums through the [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)
- Retrieving album thumbnails through the [Cover Art Archive](https://coverartarchive.org/)
- Recording albums + basic search and filtering
