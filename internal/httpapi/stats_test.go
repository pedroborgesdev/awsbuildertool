package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/pedroborges/universal-post-creator/internal/config"
)

func TestStatsCountPageImagesAndUniqueVisitors(t *testing.T) {
	dir := t.TempDir()
	jobID := "0123456789abcdef0123456789abcdef"
	output := filepath.Join(dir, jobID, "output")
	if err := os.MkdirAll(output, 0o755); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"page-01.png", "page-02.png", "preview.png"} {
		if err := os.WriteFile(filepath.Join(output, name), []byte("png"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	cfg := config.Config{HFModel: "mock", MockHF: true, DesignSystemDir: t.TempDir(), GeneratedDir: dir, WebDist: t.TempDir()}
	server := New(cfg, testLogger())

	images, _ := server.site.snapshot()
	if images != 2 {
		t.Fatalf("images = %d", images)
	}

	home := httptest.NewRecorder()
	server.Handler().ServeHTTP(home, httptest.NewRequest(http.MethodGet, "/", nil))
	var cookie *http.Cookie
	for _, item := range home.Result().Cookies() {
		if item.Name == visitorCookie {
			cookie = item
		}
	}
	if cookie == nil || cookie.Value == "" {
		t.Fatal("expected a visitor cookie")
	}

	if _, visitors := readStats(t, server); visitors != 1 {
		t.Fatalf("visitors after first page = %d", visitors)
	}

	again := httptest.NewRequest(http.MethodGet, "/", nil)
	again.AddCookie(cookie)
	server.Handler().ServeHTTP(httptest.NewRecorder(), again)
	api := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	server.Handler().ServeHTTP(httptest.NewRecorder(), api)
	if _, visitors := readStats(t, server); visitors != 1 {
		t.Fatalf("visitors after repeat = %d", visitors)
	}

	deadline := time.Now().Add(2 * time.Second)
	for {
		data, err := os.ReadFile(filepath.Join(dir, "visitors.json"))
		if err == nil && string(data) == `{"visitors":1}` {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("visitors were not saved: %s %v", data, err)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestCommunityImagesReturnsOnlyPageImages(t *testing.T) {
	dir := t.TempDir()
	for campaign := 1; campaign <= 5; campaign++ {
		jobID := fmt.Sprintf("%032x", campaign)
		output := filepath.Join(dir, jobID, "output")
		if err := os.MkdirAll(output, 0o755); err != nil {
			t.Fatal(err)
		}
		for _, name := range []string{"page-02.png", "page-01.png", "preview.png", "campaign.pdf"} {
			if err := os.WriteFile(filepath.Join(output, name), []byte("asset"), 0o600); err != nil {
				t.Fatal(err)
			}
		}
	}
	cfg := config.Config{HFModel: "mock", MockHF: true, DesignSystemDir: t.TempDir(), GeneratedDir: dir, WebDist: t.TempDir()}
	server := New(cfg, testLogger())

	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/community-images", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
	var payload struct {
		Images []communityImage `json:"images"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Images) != 8 {
		t.Fatalf("images = %+v", payload.Images)
	}
	seenCampaigns := make(map[string]bool)
	currentCampaign := ""
	wantPage := 1
	for _, image := range payload.Images {
		parts := strings.SplitN(image.ID, "/", 2)
		if len(parts) != 2 {
			t.Fatalf("invalid image ID: %q", image.ID)
		}
		if parts[0] != currentCampaign {
			if seenCampaigns[parts[0]] {
				t.Fatalf("campaign is not contiguous: %+v", payload.Images)
			}
			currentCampaign = parts[0]
			seenCampaigns[currentCampaign] = true
			wantPage = 1
		}
		if parts[1] != fmt.Sprintf("page-%02d.png", wantPage) {
			t.Fatalf("campaign pages are out of order: %+v", payload.Images)
		}
		wantPage++
		if !strings.HasPrefix(image.URL, "/api/jobs/"+currentCampaign+"/files/output/page-") {
			t.Fatalf("unexpected URL: %q", image.URL)
		}
	}
	if len(seenCampaigns) != 4 {
		t.Fatalf("campaign count = %d", len(seenCampaigns))
	}
	if cache := response.Header().Get("Cache-Control"); cache != "no-store" {
		t.Fatalf("cache control = %q", cache)
	}
}

func TestSelectRecentCampaignImagesPrefersLastThreeDaysAndFillsFromOlder(t *testing.T) {
	now := time.Date(2026, time.September, 30, 12, 0, 0, 0, time.UTC)
	image := func(campaign, page string, age time.Duration) communityImage {
		return communityImage{
			ID:          campaign + "/" + page,
			URL:         "/" + campaign + "/" + page,
			generatedAt: now.Add(-age),
		}
	}
	images := []communityImage{
		image("recent-newest", "page-02.png", 2*time.Hour),
		image("recent-newest", "page-01.png", 2*time.Hour),
		image("recent-second", "page-01.png", 48*time.Hour),
		image("older-nearest", "page-01.png", 4*24*time.Hour),
		image("older-next", "page-01.png", 8*24*time.Hour),
		image("older-last", "page-01.png", 12*24*time.Hour),
	}

	selected := selectRecentCampaignImages(images, 4, now)
	want := map[string]bool{
		"recent-newest/page-01.png": true,
		"recent-newest/page-02.png": true,
		"recent-second/page-01.png": true,
		"older-nearest/page-01.png": true,
		"older-next/page-01.png":    true,
	}
	if len(selected) != len(want) {
		t.Fatalf("selected %d images, want %d: %+v", len(selected), len(want), selected)
	}
	seen := make(map[string]bool, len(selected))
	for _, image := range selected {
		if !want[image.ID] {
			t.Fatalf("unexpected image %q in selection: %+v", image.ID, selected)
		}
		if seen[image.ID] {
			t.Fatalf("duplicate image %q in selection: %+v", image.ID, selected)
		}
		seen[image.ID] = true
	}
	pageOne, pageTwo := -1, -1
	for index, image := range selected {
		switch image.ID {
		case "recent-newest/page-01.png":
			pageOne = index
		case "recent-newest/page-02.png":
			pageTwo = index
		}
	}
	if pageTwo != pageOne+1 {
		t.Fatalf("campaign pages are not contiguous and ordered: %+v", selected)
	}
}

func TestSelectRecentCampaignImagesDoesNotUseOlderWhenWindowIsFull(t *testing.T) {
	now := time.Date(2026, time.September, 30, 12, 0, 0, 0, time.UTC)
	images := make([]communityImage, 0, 7)
	for campaign, age := range []time.Duration{time.Hour, 6 * time.Hour, 12 * time.Hour, 24 * time.Hour, 36 * time.Hour, 48 * time.Hour} {
		id := fmt.Sprintf("recent-%d", campaign)
		images = append(images, communityImage{ID: id + "/page-01.png", generatedAt: now.Add(-age)})
	}
	images = append(images, communityImage{ID: "older/page-01.png", generatedAt: now.Add(-4 * 24 * time.Hour)})

	selected := selectRecentCampaignImages(images, 4, now)
	if len(selected) != 4 {
		t.Fatalf("selected %d images: %+v", len(selected), selected)
	}
	for _, image := range selected {
		if strings.HasPrefix(image.ID, "older/") {
			t.Fatalf("older campaign was selected even though the recent window was full: %+v", selected)
		}
	}
}

func readStats(t *testing.T, server *Server) (int, int) {
	t.Helper()
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/stats", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
	var payload struct {
		Images   int `json:"images"`
		Visitors int `json:"visitors"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	return payload.Images, payload.Visitors
}

func TestStatsIgnoreEmptyOutputDirectory(t *testing.T) {
	if countPageImages("") != 0 {
		t.Fatal("empty directory should not be scanned")
	}
	asset := httptest.NewRequest(http.MethodGet, "/logo.png", nil)
	if isPageView(asset) {
		t.Fatal("static files are not unique visitors")
	}
}
