# Music-Catalogue
As an avid listener of music, one of my biggest pain points is keeping track of what I listen to. For example, I often find myself forgetting about the My Blood Valentine tribute album "Yellow Loveless" because, outside of owning a physical copy (which I don't), it only exists in the form of a video on YouTube. Other records exists in some streaming platforms but not others, some music is even unreleased and you'd only know about it if you happen to catch it live. The main point here is that I really want a place where I can catalogue everything I listen to and be able to reference back to it. This repository is my attempt to achieve that.

I'm hosting the app on a VPS, reachable through my [meme domain](batates.org) (not always online)

# Architecture
- `\frontend` built with React + Typescript.
- `\backend` built with Go + Chi. It retrieves metadata (using MusicBrainz, and Cover Art Archive), as well as coordinating additional services.
- `\services` contains additional services to add new features and functionality to my app, which would then talk to the backend.

Caddy serves the frontend, and proxies the backend and services. Everything runs together through docker files.

## Some details
Besides getting a useful application, I'm trying out new technologies to expand my development repertoire. Some things I've learned/still learning:
- Frontend: React, Typescript, Tailwindcss, and Vite for local dev.
- Backend: Go and Chi due to its familiar feel with respect to the Go standard library.
- Database: SQLite through OPFS using `wa-sqlite`
  - I decided I did not want to support account creation/management, and instead go for a local-first approach where each user's collection lives on their machine.
- Additional services are planned to be FastAPI instances, due to its ease of use and popularity (+ I'm pretty familiar with Python already).

In addition, I'm using OpenCode to try out coding agents in practice. Concretely, I use it to make my requirements and decisions into plans, which are split into issues the agent then tackles features issue-by-issue. My workflow is inspired by a few talks from senior engineers using coding agents in practice (see [this video](https://www.youtube.com/watch?v=-QFHIoCo-Ko) as an example).

## Current services
### Album Detection
At the current state, my application is functional in principle. I can search for and add albums to my collection based on real world data. However, I need an import feature of sorts as I can't be bothered to search add hundreds of entries by hand. At the same time, Connecting with streaming platform APIs like Spotify and Apple Music is very convenient, but it costs money that I don't want to pay. Which is why I thought I could simply record a screen capture of my laptop screen where I'm scrolling through my collection, and use computer vision techniques to solve my problem.  

The import flow:
1. Video recording of your album grid (currently tested with Apple Music's desktop web app)
2. Video is uploaded and processed through a computer vision + OCR pipeline.
3. A list of all detected entries is returned with the ability to fix malformed results.
4. (WIP) detected entries are mapped to MusicBrainz entities and added to the collection. 
