package albumdetector

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

func (h *Handler) Detect(w http.ResponseWriter, r *http.Request) {
	file, header, err := r.FormFile("video")
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	defer file.Close()

	result, err := h.client.Detect(header.Filename, file)
	if err != nil {
		if detErr, ok := err.(*DetectionError); ok {
			w.WriteHeader(detErr.StatusCode)
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(detErr.Body))
			return
		}
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Post("/detect", h.Detect)
}