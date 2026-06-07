package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type NHClient struct {
	cfg  Config
	app  *App
	http *http.Client
}

func NewNHClient(cfg Config, app *App) *NHClient {
	return &NHClient{
		cfg: cfg,
		app: app,
		http: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

func (c *NHClient) request(ctx context.Context, method, rawURL string) (*http.Request, error) {
	if _, err := url.ParseRequestURI(rawURL); err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, method, rawURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", c.cfg.DefaultUserAgent)
	if value, ok := c.app.loadSecret("nhentai_api_key"); ok && strings.TrimSpace(value) != "" {
		req.Header.Set("Authorization", "Key "+strings.TrimSpace(value))
	}
	return req, nil
}

func (c *NHClient) feedFromLocal() []Gallery {
	return c.app.galleries()
}

func (c *NHClient) search(ctx context.Context, query string) ([]Gallery, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return c.feedFromLocal(), nil
	}
	// Remote access is intentionally explicit and conservative. The service never
	// attempts captcha, Cloudflare, login, or anti-scraping bypasses.
	if _, ok := c.app.loadSecret("nhentai_api_key"); !ok {
		return []Gallery{}, nil
	}
	endpoint := "https://nhentai.net/api/galleries/search?query=" + url.QueryEscape(query)
	req, err := c.request(ctx, http.MethodGet, endpoint)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, errors.New(resp.Status)
	}
	var payload struct {
		Result []struct {
			ID    int `json:"id"`
			Title struct {
				English  string `json:"english"`
				Japanese string `json:"japanese"`
			} `json:"title"`
			NumPages int `json:"num_pages"`
			Tags     []struct {
				Name string `json:"name"`
				Type string `json:"type"`
			} `json:"tags"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	out := make([]Gallery, 0, len(payload.Result))
	for _, item := range payload.Result {
		work := Work{
			ID:            item.ID,
			Title:         valueOr(item.Title.English, item.Title.Japanese),
			OriginalTitle: item.Title.Japanese,
			Source:        "nhentai",
			SourceID:      intString(item.ID),
			Pages:         item.NumPages,
			Language:      "unknown",
			Status:        "queued",
			MetadataScore: 20,
			Cover:         "/api/images/proxy?source=nhentai&id=" + intString(item.ID) + "&page=cover",
		}
		for _, tag := range item.Tags {
			if tag.Type == "language" && work.Language == "unknown" {
				work.Language = tag.Name
			}
			if tag.Type == "tag" && len(work.Tags) < 6 {
				work.Tags = append(work.Tags, tag.Name)
			}
		}
		out = append(out, Gallery{Work: work, Imported: false, Related: []int{}})
	}
	return out, nil
}
