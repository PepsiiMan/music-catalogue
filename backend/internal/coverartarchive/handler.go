package coverartarchive

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

func (h *Handler) GetFrontCover(w http.ResponseWriter, r *http.Request) {
	mbid := chi.URLParam(r, "mbid")
	url, err := h.client.GetFrontCover(mbid)
	if err != nil {
		w.WriteHeader(503)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	err = json.NewEncoder(w).Encode(map[string]any{"url": url})
	if err != nil {
		w.WriteHeader(503)
	}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/coverart/{mbid}", func(r chi.Router) {
		r.Get("/front", h.GetFrontCover)
	})
}
