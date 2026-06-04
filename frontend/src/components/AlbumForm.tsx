import { useState } from "react"
import type { Album } from "../types"

interface Props {
    onSubmit: (album: Omit<Album, "id">) => void
}

export function AddAlbumForm({onSubmit}: Props) {
    const [name, setName] = useState("")
    const [artist, setArtist] = useState("")
    const [release, setRelease] = useState("")

    const handleSubmit = () => {
        if (!name || !artist) return
        onSubmit({title: name, artist, release})
        setName("")
        setArtist("")
        setRelease("")
    }

return (
    <div className="flex gap-2">
        <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Album Name"
            className="border rounded-lg px-3 py-2 flex-1"
        />
        <input
            value={artist}
            onChange={e => setArtist(e.target.value)}
            placeholder="Artist"
            className="border rounded-lg px-3 py-2 flex-1"
        />
        <input
            value={release}
            onChange={e => setRelease(e.target.value)}
            placeholder="Release"
            className="border rounded-lg px-3 py-2 w-24"
        />
        <button
            onClick={handleSubmit}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
            Add
        </button>
    </div>
)
}