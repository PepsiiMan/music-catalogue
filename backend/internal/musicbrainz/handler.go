package musicbrainz

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	client *Client
}

func NewHandler(client *Client) *Handler {
	return &Handler{client: client}
}

func (h *Handler) SearchAlbums(w http.ResponseWriter, r *http.Request) {
	title := r.URL.Query().Get("title")
	artist := r.URL.Query().Get("artist")
	releases, err := h.client.SearchAlbums(title, artist, 20)
	if err != nil {
		w.WriteHeader(503)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	err = json.NewEncoder(w).Encode(releases)
	if err != nil {
		w.WriteHeader(503)
	}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/albums", h.SearchAlbums)
}
