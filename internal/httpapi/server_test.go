package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	logmate "github.com/loghill-oss/logmate-clients/logmate-client-go"

	"github.com/pedroborges/universal-post-creator/internal/config"
	"github.com/pedroborges/universal-post-creator/internal/domain"
	"github.com/pedroborges/universal-post-creator/internal/hf"
	"github.com/pedroborges/universal-post-creator/internal/render"
)

type fakeRenderer struct {
	result render.Result
	err    error
}

type countingGenerator struct {
	calls   int
	prompts []string
}

func (g *countingGenerator) Configured() bool { return true }
func (g *countingGenerator) GenerateContent(_ context.Context, request domain.GenerateRequest, productionPrompt string) (domain.CampaignDraft, error) {
	g.calls++
	g.prompts = append(g.prompts, productionPrompt)
	return hf.MockDraft(request), nil
}

type countingFailRenderer struct {
	calls int
	err   error
}

func (f *countingFailRenderer) Render(context.Context, string) (render.Result, error) {
	f.calls++
	err := f.err
	if err == nil {
		err = errors.New("forced layout calculation error")
	}
	return render.Result{JobID: fmt.Sprintf("%032x", f.calls)}, err
}
func (f *countingFailRenderer) Status() render.Status {
	return render.Status{Ready: true, Mode: "teste"}
}

type unavailableRenderer struct{}

func testLogger() *logmate.Logger {
	return logmate.Instrument(logmate.Config{
		DisableConsole:       true,
		DisableSystemCapture: true,
		DisablePersistence:   true,
	})
}

func (unavailableRenderer) Render(context.Context, string) (render.Result, error) {
	return render.Result{}, errors.New("should not render")
}
func (unavailableRenderer) Status() render.Status {
	return render.Status{Ready: false, Mode: "Pillow or CairoSVG unavailable"}
}

func (f fakeRenderer) Render(context.Context, string) (render.Result, error) {
	return f.result, f.err
}

func (f fakeRenderer) Status() render.Status {
	return render.Status{Ready: true, Mode: "teste"}
}

func testDesignSystem(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "assets", "brand"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "assets", "brand", "lockup-dark.png"), []byte("fake-png"), 0o600); err != nil {
		t.Fatal(err)
	}
	return dir
}

func TestGenerateInMockMode(t *testing.T) {
	cfg := config.Config{
		HFModel: "mock/model", HFBaseURL: "http://example.invalid", HFMaxTokens: 1000,
		DesignSystemDir: "../../design_system",
		GeneratedDir:    t.TempDir(), PythonBin: "python3",
		WebDist: filepath.Join(t.TempDir(), "missing"), MockHF: true,
	}
	logger := testLogger()
	server := New(cfg, logger)
	body := map[string]any{
		"theme": "CI/CD", "goal": "Teach students", "platform": "instagram-portrait", "postCount": 5,
		"additionalContext": strings.Repeat("a", 400),
	}
	payload, _ := json.Marshal(body)
	status, raw := awaitGeneration(t, server, payload)
	if status != http.StatusOK {
		t.Fatalf("status = %d, body = %s", status, raw)
	}
	var result map[string]any
	if err := json.Unmarshal(raw, &result); err != nil {
		t.Fatal(err)
	}
	if result["filename"] != "generate-ci-cd.py" {
		t.Fatalf("filename = %#v", result["filename"])
	}
	if id, ok := result["jobId"].(string); !ok || len(id) != 32 {
		t.Fatalf("jobId = %#v", result["jobId"])
	}
	if script, ok := result["script"].(string); !ok || script == "" {
		t.Fatalf("script ausente: %#v", result["script"])
	}
	draft, ok := result["draft"].(map[string]any)
	if !ok || draft["layoutSeed"].(float64) == 0 {
		t.Fatalf("layoutSeed ausente: %#v", result["draft"])
	}
}

func TestGenerateRetriesRenderingWithoutRegeneratingContent(t *testing.T) {
	cfg := config.Config{HFModel: "mock/model", DesignSystemDir: "../../design_system", GeneratedDir: t.TempDir(), WebDist: t.TempDir(), MockHF: true}
	server := New(cfg, testLogger())
	generator := &countingGenerator{}
	renderer := &countingFailRenderer{}
	server.hf = generator
	server.render = renderer
	body := []byte(`{"theme":"CI/CD","goal":"Teach students","platform":"instagram-square","postCount":3,"additionalContext":"` + strings.Repeat("a", 400) + `"}`)
	status, raw := awaitGeneration(t, server, body)
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, body = %s", status, raw)
	}
	if generator.calls != 1 || renderer.calls != maxGenerationAttempts {
		t.Fatalf("calls: IA=%d renderer=%d", generator.calls, renderer.calls)
	}
	if strings.Contains(generator.prompts[0], "MANDATORY CORRECTION") {
		t.Fatal("the render failure was incorrectly sent back to the AI")
	}
	if !strings.Contains(string(raw), "after 5 complete attempts") {
		t.Fatalf("final error has no attempt history: %s", raw)
	}
}

func TestGenerateRewritesTextWhenPagesDoNotFit(t *testing.T) {
	cfg := config.Config{HFModel: "mock/model", DesignSystemDir: "../../design_system", GeneratedDir: t.TempDir(), WebDist: t.TempDir(), MockHF: true}
	server := New(cfg, testLogger())
	generator := &countingGenerator{}
	renderer := &countingFailRenderer{err: errors.New("Page 2: could not form three valid layouts (the measured blocks could not be packed)")}
	server.hf = generator
	server.render = renderer
	body := []byte(`{"theme":"CI/CD","goal":"Teach students","platform":"instagram-square","postCount":3,"additionalContext":"` + strings.Repeat("a", 400) + `"}`)
	status, raw := awaitGeneration(t, server, body)
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, body = %s", status, raw)
	}
	if generator.calls != maxGenerationAttempts || renderer.calls != maxGenerationAttempts {
		t.Fatalf("calls: IA=%d renderer=%d", generator.calls, renderer.calls)
	}
	if len(generator.prompts) < 2 || !strings.Contains(generator.prompts[1], "much less text") {
		t.Fatal("the text-fit failure was not sent back to the AI")
	}
}

func awaitGeneration(t *testing.T, server *Server, body []byte) (int, []byte) {
	t.Helper()
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/generate", bytes.NewReader(body)))
	if response.Code != http.StatusAccepted {
		return response.Code, response.Body.Bytes()
	}
	var accepted struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &accepted); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(8 * time.Second)
	for {
		poll := httptest.NewRecorder()
		server.Handler().ServeHTTP(poll, httptest.NewRequest(http.MethodGet, "/api/generations/"+accepted.ID, nil))
		if poll.Code != http.StatusOK {
			t.Fatalf("status poll = %d, body = %s", poll.Code, poll.Body.String())
		}
		var job struct {
			Status string          `json:"status"`
			Error  string          `json:"error"`
			Result json.RawMessage `json:"result"`
		}
		if err := json.Unmarshal(poll.Body.Bytes(), &job); err != nil {
			t.Fatal(err)
		}
		switch job.Status {
		case "done":
			return http.StatusOK, job.Result
		case "failed":
			payload, err := json.Marshal(map[string]string{"error": job.Error})
			if err != nil {
				t.Fatal(err)
			}
			return http.StatusUnprocessableEntity, payload
		}
		if time.Now().After(deadline) {
			t.Fatal("generation did not finish")
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func TestGenerateDoesNotCallAIWhenRendererIsUnavailable(t *testing.T) {
	cfg := config.Config{HFModel: "mock/model", DesignSystemDir: "../../design_system", GeneratedDir: t.TempDir(), WebDist: t.TempDir(), MockHF: true}
	server := New(cfg, testLogger())
	generator := &countingGenerator{}
	server.hf = generator
	server.render = unavailableRenderer{}
	body := []byte(`{"theme":"CI/CD","goal":"Teach students","platform":"instagram-square","postCount":3,"additionalContext":"` + strings.Repeat("a", 400) + `"}`)
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/generate", bytes.NewReader(body)))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
	if generator.calls != 0 {
		t.Fatalf("AI called %d times without an available renderer", generator.calls)
	}
}

func TestRejectsUnknownJSONFields(t *testing.T) {
	cfg := config.Config{HFModel: "mock/model", DesignSystemDir: testDesignSystem(t), MockHF: true}
	server := New(cfg, testLogger())
	req := httptest.NewRequest(http.MethodPost, "/api/prompt", bytes.NewBufferString(`{"theme":"CI/CD","goal":"Teach","platform":"instagram-portrait","postCount":5,"surprise":true}`))
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, req)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", response.Code)
	}
}

func TestServesBuiltFrontendAndSPAFallback(t *testing.T) {
	dist := t.TempDir()
	if err := os.WriteFile(filepath.Join(dist, "index.html"), []byte("<main>studio</main>"), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{HFModel: "mock/model", DesignSystemDir: testDesignSystem(t), WebDist: dist, MockHF: true}
	server := New(cfg, testLogger())
	for _, path := range []string{"/", "/rota-da-interface"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		response := httptest.NewRecorder()
		server.Handler().ServeHTTP(response, req)
		if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte("studio")) {
			t.Fatalf("path %s: status = %d, body = %s", path, response.Code, response.Body.String())
		}
	}
}

func TestServesDesignSystemAssets(t *testing.T) {
	cfg := config.Config{HFModel: "mock/model", DesignSystemDir: testDesignSystem(t), WebDist: t.TempDir(), MockHF: true}
	server := New(cfg, testLogger())
	req := httptest.NewRequest(http.MethodGet, "/design-assets/brand/lockup-dark.png", nil)
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, req)
	if response.Code != http.StatusOK || response.Body.String() != "fake-png" {
		t.Fatalf("status = %d, body = %q", response.Code, response.Body.String())
	}
}

func TestServesGeneratedFile(t *testing.T) {
	generated := t.TempDir()
	jobID := "0123456789abcdef0123456789abcdef"
	output := filepath.Join(generated, jobID, "output")
	if err := os.MkdirAll(output, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(output, "post-01.png"), []byte("rendered"), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{HFModel: "mock/model", DesignSystemDir: testDesignSystem(t), GeneratedDir: generated, WebDist: t.TempDir(), MockHF: true}
	server := New(cfg, testLogger())
	req := httptest.NewRequest(http.MethodGet, "/api/jobs/"+jobID+"/files/output/post-01.png", nil)
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, req)
	if response.Code != http.StatusOK || response.Body.String() != "rendered" {
		t.Fatalf("status = %d, body = %q", response.Code, response.Body.String())
	}
}
