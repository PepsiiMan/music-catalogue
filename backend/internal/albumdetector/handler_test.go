package albumdetector

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
)

func newTestServer(fn http.HandlerFunc) *httptest.Server {
	return httptest.NewServer(fn)
}

func newTestClient(tsURL string) *Client {
	return &Client{
		http:    http.Client{Timeout: 5 * time.Second},
		baseURL: tsURL,
	}
}

func multipartUploadRequest(t *testing.T, url string) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, err := w.CreateFormFile("video", "test.mp4")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := io.Copy(part, bytes.NewReader([]byte("fake-video-data"))); err != nil {
		t.Fatal(err)
	}
	w.Close()

	req, err := http.NewRequest("POST", url, &buf)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	return req
}

func TestDetect_ReturnsDetectionResult(t *testing.T) {
	expected := DetectionResult{
		Albums: []Album{
			{Title: "Dark Side of the Moon", Artist: "Pink Floyd", Row: 0, Col: 0, SourceFrame: 5},
		},
		TotalFramesProcessed: 100,
		FramesWithDetections: 10,
	}

	ts := newTestServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/detect" {
			t.Errorf("expected /detect, got %s", r.URL.Path)
		}
		file, _, err := r.FormFile("video")
		if err != nil {
			t.Errorf("expected video field: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		defer file.Close()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(expected)
	})
	defer ts.Close()

	client := newTestClient(ts.URL)
	handler := NewHandler(client)

	r := chi.NewRouter()
	r.Post("/detect", handler.Detect)

	req := multipartUploadRequest(t, "/detect")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var result DetectionResult
	if err := json.NewDecoder(rr.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}

	if len(result.Albums) != 1 {
		t.Fatalf("expected 1 album, got %d", len(result.Albums))
	}
	if result.Albums[0].Title != "Dark Side of the Moon" {
		t.Errorf("expected title 'Dark Side of the Moon', got %s", result.Albums[0].Title)
	}
	if result.TotalFramesProcessed != 100 {
		t.Errorf("expected 100 total frames, got %d", result.TotalFramesProcessed)
	}
}

func TestDetect_Proxies422FromAlbumDetector(t *testing.T) {
	ts := newTestServer(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		json.NewEncoder(w).Encode(map[string]string{"detail": "No album grid detected in any frame"})
	})
	defer ts.Close()

	client := newTestClient(ts.URL)
	handler := NewHandler(client)

	r := chi.NewRouter()
	r.Post("/detect", handler.Detect)

	req := multipartUploadRequest(t, "/detect")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d", rr.Code)
	}

	var body map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["detail"] != "No album grid detected in any frame" {
		t.Errorf("expected 'No album grid detected in any frame', got %s", body["detail"])
	}
}

func TestDetect_Proxies400FromAlbumDetector(t *testing.T) {
	ts := newTestServer(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"detail": "Invalid video file"})
	})
	defer ts.Close()

	client := newTestClient(ts.URL)
	handler := NewHandler(client)

	r := chi.NewRouter()
	r.Post("/detect", handler.Detect)

	req := multipartUploadRequest(t, "/detect")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestDetect_MissingVideoFieldReturns400(t *testing.T) {
	ts := newTestServer(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("album-detector should not be called when video field is missing")
	})
	defer ts.Close()

	client := newTestClient(ts.URL)
	handler := NewHandler(client)

	r := chi.NewRouter()
	r.Post("/detect", handler.Detect)

	req, err := http.NewRequest("POST", "/detect", bytes.NewReader([]byte{}))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestDetect_ConnectionErrorReturns503(t *testing.T) {
	client := newTestClient("http://127.0.0.1:0")
	handler := NewHandler(client)

	r := chi.NewRouter()
	r.Post("/detect", handler.Detect)

	req := multipartUploadRequest(t, "/detect")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}

