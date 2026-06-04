import { useState, useEffect } from "react"


interface Props {
    onSubmit: (data: { title: string; artist: string }) => void
    initialTitle?: string
    initialArtist?: string
}

export function SearchForm({onSubmit, initialTitle = "", initialArtist = ""}: Props) {
    const [artist, setArtist] = useState(initialArtist)
    const [title, setTitle] = useState(initialTitle)

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTitle(initialTitle)
        setArtist(initialArtist)
    }, [initialTitle, initialArtist])

    const handleSubmit = () => {
        if (!title && !artist) return
        onSubmit({ title, artist })
    }

return (
    <div className="flex gap-2">
        <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Album Title"
            className="border rounded-lg px-3 py-2 flex-1"
        />
        <input
            value={artist}
            onChange={e => setArtist(e.target.value)}
            placeholder="Artist"
            className="border rounded-lg px-3 py-2 flex-1"
        />
        <button
            onClick={handleSubmit}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
            Search
        </button>

    </div>
)
}