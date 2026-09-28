package httpapi

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"image"
	"image/jpeg"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pedroborges/universal-post-creator/internal/config"
	"github.com/pedroborges/universal-post-creator/internal/domain"
)

func contentImageDataURL(t *testing.T) string {
	t.Helper()
	var output bytes.Buffer
	if err := jpeg.Encode(&output, image.NewRGBA(image.Rect(0, 0, 320, 240)), &jpeg.Options{Quality: 80}); err != nil {
		t.Fatal(err)
	}
	return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(output.Bytes())
}

func TestContentReviewAndRenderEndpoints(t *testing.T) {
	cfg := config.Config{HFModel: "mock", MockHF: true, PythonBin: "python3", DesignSystemDir: "../../design_system", GeneratedDir: t.TempDir(), WebDist: t.TempDir()}
	server := New(cfg, testLogger())
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

func TestContentEndpointAnalyzesAndAssignsUploadedImageInMockMode(t *testing.T) {
	cfg := config.Config{HFModel: "mock", HFVisionModel: "mock-vision", MockHF: true, PythonBin: "python3", DesignSystemDir: "../../design_system", GeneratedDir: t.TempDir(), WebDist: t.TempDir()}
	server := New(cfg, testLogger())
	request := map[string]any{
		"theme": "Community", "goal": "Show collaboration", "platform": "instagram-square", "postCount": 2,
		"additionalContext": strings.Repeat("a", 400),
		"images": []any{map[string]any{"id": "image-1", "name": "people.jpg", "dataUrl": contentImageDataURL(t), "analysis": map[string]any{
			"description": "", "subjects": []any{}, "mood": "", "composition": "", "relevantCells": []any{},
			"focusRect": map[string]any{"x": 0, "y": 0, "width": 0, "height": 0}, "safeTextAreas": []any{}, "cropTolerance": "", "confidence": 0,
		}}},
	}
	payload, _ := json.Marshal(request)
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/content", bytes.NewReader(payload)))
	if response.Code != http.StatusOK {
		t.Fatal(response.Body.String())
	}
	var content domain.ContentResponse
	if err := json.Unmarshal(response.Body.Bytes(), &content); err != nil {
		t.Fatal(err)
	}
	if content.Draft.Brief.Images[0].Analysis.Description == "" || content.Draft.Pages[0].ImageID != "image-1" || content.Draft.Pages[0].ImageRole != "hero" {
		t.Fatalf("image pipeline was not applied: %#v", content.Draft)
	}
	if strings.Contains(content.Prompt, content.Draft.Brief.Images[0].DataURL) || !strings.Contains(content.Prompt, `"imageId"`) {
		t.Fatal("prompt leaked image bytes or omitted the assignment contract")
	}
}
