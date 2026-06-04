import type { AlbumFilters } from "../api/albums"

interface Props {
    filters: AlbumFilters
    onChange: (filters: AlbumFilters) => void
}

export function FilterWidget({ filters, onChange }: Props) {
    return (
        <div className="bg-gray-700 rounded-lg p-4 mb-6 flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-300">Search in</label>
                <select
                    className="bg-gray-800 text-white rounded px-3 py-2"
                    value={filters.searchIn || ""}
                    onChange={(e) =>
                        onChange({
                            ...filters,
                            searchIn: e.target.value as "title" | "artist" | "both" | undefined,
                        })
                    }
                >
                    <option value="">Select...</option>
                    <option value="title">Title</option>
                    <option value="artist">Artist</option>
                    <option value="both">Both</option>
                </select>
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-300">Search</label>
                <input
                    type="text"
                    placeholder="Search..."
                    className="bg-gray-800 text-white rounded px-3 py-2"
                    value={filters.search || ""}
                    onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
                />
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-300">Sort by</label>
                <select
                    className="bg-gray-800 text-white rounded px-3 py-2"
                    value={filters.sortBy || ""}
                    onChange={(e) =>
                        onChange({
                            ...filters,
                            sortBy: e.target.value as "release" | "id" | "title" | "artist" | undefined,
                        })
                    }
                >
                    <option value="">Select...</option>
                    <option value="release">Release date</option>
                    <option value="id">Date added</option>
                    <option value="title">Title</option>
                    <option value="artist">Artist</option>
                </select>
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-300">Order</label>
                <select
                    className="bg-gray-800 text-white rounded px-3 py-2"
                    value={filters.order || ""}
                    onChange={(e) =>
                        onChange({
                            ...filters,
                            order: e.target.value as "asc" | "desc" | undefined,
                        })
                    }
                >
                    <option value=""> Select...</option>
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                </select>
            </div>
        </div>
    )
}