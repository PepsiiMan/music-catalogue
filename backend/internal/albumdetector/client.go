package albumdetector

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"time"
)

type Client struct {
	http    http.Client
	baseURL string
}

func NewClient() *Client {
	baseURL := os.Getenv("ALBUM_DETECTOR_URL")
	if baseURL == "" {
		baseURL = "http://album-detector:8000"
	}
	return &Client{
		http:    http.Client{Timeout: 300 * time.Second},
		baseURL: baseURL,
	}
}

func (c *Client) Detect(filename string, content io.Reader) (*DetectionResult, error) {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	part, err := w.CreateFormFile("video", filename)
	if err != nil {
		return nil, fmt.Errorf("creating form file: %w", err)
	}

	if _, err := io.Copy(part, content); err != nil {
		return nil, fmt.Errorf("copying file content: %w", err)
	}

	if err := w.Close(); err != nil {
		return nil, fmt.Errorf("closing multipart writer: %w", err)
	}

	url := fmt.Sprintf("%s/detect", c.baseURL)
	req, err := http.NewRequest("POST", url, &buf)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Content-Type", w.FormDataContentType())

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, &DetectionError{
			StatusCode: resp.StatusCode,
			Body:       string(body),
		}
	}

	var result DetectionResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decoding response: %w", err)
	}

	return &result, nil
}

type DetectionError struct {
	StatusCode int
	Body       string
}

func (e *DetectionError) Error() string {
	return fmt.Sprintf("album-detector returned %d: %s", e.StatusCode, e.Body)
}