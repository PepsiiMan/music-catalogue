package main

import (
	"net/http"
	"time"

	"music-catalogue/backend/internal/coverartarchive"
	"music-catalogue/backend/internal/musicbrainz"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(middleware.Compress(5))
	r.Use(middleware.ThrottleBacklog(5, 10, 30*time.Second))
	r.Use(middleware.RequestSize(1 << 20))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	r.Route("/api/search", func(r chi.Router) {
		musicBrainzClient := musicbrainz.NewClient()
		musicBrainzHandler := musicbrainz.NewHandler(musicBrainzClient)
		musicBrainzHandler.RegisterRoutes(r)

		coverArtClient := coverartarchive.NewClient()
		coverArtHandler := coverartarchive.NewHandler(coverArtClient)
		coverArtHandler.RegisterRoutes(r)
	})

	if err := http.ListenAndServe(":8080", r); err != nil {
		panic(err)
	}
}
