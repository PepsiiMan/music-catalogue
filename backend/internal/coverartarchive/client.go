// Package coverartarchive: http client for the coverartarchive API
package coverartarchive

import (
	"fmt"
	"net/http"
	"os"
	"time"
)

var userAgent = fmt.Sprintf("%s/%s (%s)", os.Getenv("PROJECT_NAME"), os.Getenv("PROJECT_VERSION"), os.Getenv("CONTACT_EMAIL"))

const BASEURL string = "https://coverartarchive.org/"

type Client struct {
	http http.Client
}

func NewClient() *Client {
	c := http.Client{
		Timeout: 10 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	return &Client{http: c}
}

func (c *Client) GetFrontCover(mbid string) (string, error) {
	url := fmt.Sprintf("%srelease/%s/front", BASEURL, mbid)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", userAgent)

	resp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusFound && resp.StatusCode != http.StatusTemporaryRedirect {
		return "", fmt.Errorf("coverartarchive returned: %d", resp.StatusCode)
	}
	img := resp.Header.Get("Location")

	return img, nil
}
