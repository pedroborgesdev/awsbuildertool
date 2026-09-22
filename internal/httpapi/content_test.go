package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pedroborges/universal-post-creator/internal/config"
	"github.com/pedroborges/universal-post-creator/internal/domain"
)

func TestContentReviewAndRenderEndpoints(t *testing.T) {
	cfg := config.Config{HFModel: "mock", MockHF: true, PythonBin: "python3", DesignSystemDir: "../../design_system", GeneratedDir: t.TempDir(), RenderTimeout: 20 * time.Second, WebDist: t.TempDir()}
	server := New(cfg, slog.New(slog.NewTextHandler(io.Discard, nil)))
	body := []byte(`{"theme":"Kubernetes","goal":"Teach students","platform":"instagram-square","postCount":5,"lastPageCta":true,"additionalContext":"` + strings.Repeat("a", 400) + `"}`)
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/content", bytes.NewReader(body)))
	if response.Code != 200 {
		t.Fatal(response.Body.String())
	}
	var content domain.ContentResponse
	if err := json.Unmarshal(response.Body.Bytes(), &content); err != nil {
		t.Fatal(err)
	}
	if content.Draft.LayoutSeed == 0 {
		t.Fatal("layout seed was not assigned")
	}
	content.Draft.Pages[0].Title = "Reviewed content"
	payload, _ := json.Marshal(content.Draft)
	// Rendering must not depend on an inference token or a further inference call.
	server.config.MockHF = false
	response = httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/render", bytes.NewReader(payload)))
	if response.Code != 200 {
		t.Fatal(response.Body.String())
	}
	var rendered domain.GenerateResponse
	if err := json.Unmarshal(response.Body.Bytes(), &rendered); err != nil {
		t.Fatal(err)
	}
	if rendered.Draft.Pages[0].Title != "Reviewed content" || len(rendered.Files) != 7 {
		t.Fatal("reviewed content not rendered")
	}
	server.render = fakeRenderer{err: errors.New("forced overflow")}
	response = httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/render", bytes.NewReader(payload)))
	if response.Code != 422 {
		t.Fatalf("render failure returned %d", response.Code)
	}
	content.Draft.Pages = nil
	payload, _ = json.Marshal(content.Draft)
	response = httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/render", bytes.NewReader(payload)))
	if response.Code != 422 {
		t.Fatal("invalid draft accepted")
	}
}
