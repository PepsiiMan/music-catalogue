// Package musicbrainz: http client for the musicbrainz API
package musicbrainz

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

var userAgent = fmt.Sprintf("%s/%s (%s)", os.Getenv("PROJECT_NAME"), os.Getenv("PROJECT_VERSION"), os.Getenv("CONTACT_EMAIL"))

const BASEURL string = "https://musicbrainz.org/ws/2"

type ReleaseDTO struct {
	ID     string `json:"mbid"`
	Title  string `json:"title"`
	Artist string `json:"artist"`
	Date   string `json:"date"`
}

type MusicbrainzResponse struct {
	Created  time.Time `json:"created"`
	Count    int       `json:"count"`
	Offset   int       `json:"offset"`
	Releases []Release `json:"releases"`
}

type Release struct {
	ID                 string             `json:"id"`
	Title              string             `json:"title"`
	Disambiguation     string             `json:"disambiguation"`
	ArtistCredit       []ArtistCredit     `json:"artist-credit"`
	Date               string             `json:"date"`
	Country            string             `json:"country"`
	ReleaseEvents      []ReleaseEvents    `json:"release-events"`
	LabelInfo          []LabelInfo        `json:"label-info"`
	Barcode            any                `json:"barcode"`
	PackagingID        any                `json:"packaging-id"`
	Packaging          any                `json:"packaging"`
	StatusID           string             `json:"status-id"`
	Status             string             `json:"status"`
	Quality            string             `json:"quality"`
	TextRepresentation TextRepresentation `json:"text-representation"`
	Asin               any                `json:"asin"`
	Media              []Media            `json:"media"`
	CoverArtArchive    CoverArtArchive    `json:"cover-art-archive"`
}
type Artist struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	SortName       string `json:"sort-name"`
	Disambiguation string `json:"disambiguation"`
}
type ArtistCredit struct {
	Name       string `json:"name"`
	Joinphrase string `json:"joinphrase"`
	Artist     Artist `json:"artist"`
}
type Area struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	SortName       string   `json:"sort-name"`
	Iso31661Codes  []string `json:"iso-3166-1-codes"`
	Disambiguation string   `json:"disambiguation"`
}
type ReleaseEvents struct {
	Date string `json:"date"`
	Area Area   `json:"area"`
}
type Label struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Disambiguation string `json:"disambiguation"`
	LabelCode      any    `json:"label-code"`
}
type LabelInfo struct {
	CatalogNumber string `json:"catalog-number"`
	Label         Label  `json:"label"`
}
type TextRepresentation struct {
	Language string `json:"language"`
	Script   string `json:"script"`
}
type Discs struct {
	ID          string `json:"id"`
	Sectors     int    `json:"sectors"`
	Offsets     []int  `json:"offsets"`
	OffsetCount int    `json:"offset-count"`
}
type Recording struct {
	ID             string         `json:"id"`
	Title          string         `json:"title"`
	Disambiguation string         `json:"disambiguation"`
	Length         int            `json:"length"`
	Video          bool           `json:"video"`
	ArtistCredit   []ArtistCredit `json:"artist-credit"`
}
type Tracks struct {
	ID           string         `json:"id"`
	Title        string         `json:"title"`
	Length       int            `json:"length"`
	Number       string         `json:"number"`
	Position     int            `json:"position"`
	ArtistCredit []ArtistCredit `json:"artist-credit"`
	Recording    Recording      `json:"recording"`
}
type Media struct {
	Discs       []Discs  `json:"discs"`
	Position    int      `json:"position"`
	Title       string   `json:"title"`
	FormatID    string   `json:"format-id"`
	Format      string   `json:"format"`
	TrackCount  int      `json:"track-count"`
	TrackOffset int      `json:"track-offset"`
	Tracks      []Tracks `json:"tracks"`
}
type CoverArtArchive struct {
	Count    int  `json:"count"`
	Artwork  bool `json:"artwork"`
	Front    bool `json:"front"`
	Back     bool `json:"back"`
	Darkened bool `json:"darkened"`
}

type Client struct {
	http    http.Client
	limiter <-chan time.Time
}

func NewClient() *Client {
	c := http.Client{Timeout: 10 * time.Second}
	return &Client{
		http:    c,
		limiter: time.Tick(time.Second),
	}
}

func (c *Client) SearchAlbums(title, artist string, limit int) ([]ReleaseDTO, error) {
	<-c.limiter

	var parts []string
	if title != "" {
		parts = append(parts, fmt.Sprintf(`title:"%s"`, title))
	}
	if artist != "" {
		parts = append(parts, fmt.Sprintf(`artist:"%s"`, artist))
	}

	params := url.Values{
		"query": {strings.Join(parts, " AND ")},
		"fmt":   {"json"},
		"limit": {fmt.Sprintf("%d", limit)},
	}

	url := fmt.Sprintf("%s/release/?%s", BASEURL, params.Encode())

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", userAgent)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("musicbrainz returned: %d", resp.StatusCode)
	}

	var result MusicbrainzResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	releases := make([]ReleaseDTO, 0)
	for _, release := range result.Releases {
		releases = append(releases, ReleaseDTO{
			Title:  release.Title,
			Artist: release.ArtistCredit[0].Artist.Name,
			Date:   release.Date,
			ID:     release.ID,
		})
	}

	return releases, err
}
