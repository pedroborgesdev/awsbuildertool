package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/pedroborges/universal-post-creator/internal/config"
)

func TestStatsCountPageImagesAndUniqueVisitors(t *testing.T) {
	dir := t.TempDir()
	output := filepath.Join(dir, "job", "output")
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
