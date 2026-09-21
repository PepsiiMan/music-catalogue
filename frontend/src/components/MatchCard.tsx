import { useQuery } from "@tanstack/react-query"
import type { Match, SearchResult } from "../types"
import { getCoverArt } from "../api/search"
import { RecordPlaceholder } from "./RecordPlaceholder"

export interface RowDecision {
  action: "accept" | "dismiss"
  chosen?: SearchResult
  addWithoutMbid?: boolean
}

export function resolveChosen(match: Match, decision: RowDecision): SearchResult | null {
  return decision.chosen ?? match.best
}

interface Props {
  match: Match
  decision: RowDecision
  alternativesOpen: boolean
  onToggleAlternatives: () => void
  onDecide: (decision: RowDecision) => void
}

export function MatchCard({ match, decision, alternativesOpen, onToggleAlternatives, onDecide }: Props) {
  const release = resolveChosen(match, decision)
  const dismissed = decision.action === "dismiss"
  const unmatched = !match.best

  const { data: coverUrl } = useQuery({
    queryKey: ["coverart", release?.mbid],
    queryFn: () => (release?.mbid ? getCoverArt(release.mbid) : null),
    enabled: !!release?.mbid,
    staleTime: 1000 * 60 * 60,
  })

  return (
    <div
      data-testid="match-card"
      className={`bg-gray-800 rounded-xl p-4 border border-gray-700 flex gap-4 ${dismissed ? "opacity-40" : ""}`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-gray-500 text-sm">OCR</p>
          {unmatched && (
            <span
              data-testid="unmatched-badge"
              className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/60 text-yellow-300 border border-yellow-700"
            >
              Unmatched
            </span>
          )}
          {match.error && <span className="text-xs text-red-400">{match.error}</span>}
        </div>
        <h3 className="text-white font-semibold">{match.input.title}</h3>
        <p className="text-gray-400 text-sm">{match.input.artist}</p>

        {release && (
          <div className="mt-3 border-t border-gray-700 pt-3">
            <p className="text-gray-500 text-sm">MusicBrainz match</p>
            <p className="text-white">{release.title}</p>
            <p className="text-gray-400 text-sm">{release.artist}</p>
            {release.date && <p className="text-gray-500 text-sm">{release.date}</p>}
          </div>
        )}

        {alternativesOpen && match.alternatives.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" data-testid="alternatives-strip">
            {match.alternatives.slice(0, 4).map((alt) => (
              <button
                key={alt.mbid}
                type="button"
                onClick={() => onDecide({ action: "accept", chosen: alt })}
                className={`text-sm px-2 py-1 rounded-lg border ${
                  decision.chosen?.mbid === alt.mbid
                    ? "bg-green-900/60 border-green-500 text-white"
                    : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {alt.title}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-3">
          {!unmatched && !dismissed && (
            <button
              type="button"
              onClick={() => onDecide({ action: "accept" })}
              className={`text-sm px-2 py-1 rounded-lg ${
                decision.action === "accept"
                  ? "bg-green-600 hover:bg-green-500 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-300"
              }`}
            >
              Accept
            </button>
          )}
          {!unmatched && !dismissed && (
            <button
              type="button"
              onClick={onToggleAlternatives}
              className={`text-sm px-2 py-1 rounded-lg ${
                alternativesOpen
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-300"
              }`}
            >
              Pick alternative
            </button>
          )}
          {unmatched && !dismissed && (
            <button
              type="button"
              onClick={() => onDecide({ ...decision, addWithoutMbid: !decision.addWithoutMbid })}
              className={`text-sm px-2 py-1 rounded-lg ${
                decision.addWithoutMbid
                  ? "bg-green-600 hover:bg-green-500 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-300"
              }`}
            >
              {decision.addWithoutMbid ? "Added without MBID" : "Add without MBID"}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDecide({ ...decision, action: dismissed ? "accept" : "dismiss" })}
            className={`text-sm px-2 py-1 rounded-lg ${
              dismissed
                ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                : "bg-red-900/60 hover:bg-red-800 text-red-300"
            }`}
          >
            {dismissed ? "Restore" : "Dismiss"}
          </button>
        </div>
      </div>
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={release?.title ?? ""}
          crossOrigin="anonymous"
          className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
        />
      ) : (
        <RecordPlaceholder />
      )}
    </div>
  )
}
