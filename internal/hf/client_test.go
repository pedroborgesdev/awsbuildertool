package hf

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/pedroborges/universal-post-creator/internal/domain"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func testBrief() domain.GenerateRequest {
	b := domain.GenerateRequest{Theme: "CI/CD", Goal: "Teach students", Platform: "instagram-square", PostCount: 3, ContentLevel: "balanced", LastPageCTA: true}
	b.Normalize("test/model")
	return b
}
func TestContentUsesJSONAndPreservesServerBrief(t *testing.T) {
	brief := testBrief()
	payload, _ := json.Marshal(map[string]any{"pages": MockDraft(brief).Pages})
	client := NewClient("secret", "https://example.invalid/v1", 1000, time.Second, false)
	client.http.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path != "/v1/chat/completions" || r.Header.Get("Authorization") != "Bearer secret" {
			t.Fatal("invalid request")
		}
		var request chatRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(request.Messages[0].Content, "JSON") {
			t.Fatal("must request editorial JSON")
		}
		data, _ := json.Marshal(map[string]any{"choices": []any{map[string]any{"message": map[string]string{"content": string(payload)}, "finish_reason": "stop"}}})
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(string(data)))}, nil
	})
	draft, err := client.GenerateContent(context.Background(), brief, "brief")
	if err != nil {
		t.Fatal(err)
	}
	if draft.Brief != brief || len(draft.Pages) != 3 {
		t.Fatal("invalid draft")
	}
}
func TestContentRejectsCodeUnknownFieldsTruncationAndExtraJSON(t *testing.T) {
	brief := testBrief()
	valid, _ := json.Marshal(map[string]any{"pages": MockDraft(brief).Pages})
	for _, tc := range []struct{ name, content, finish string }{
		{"code", "from PIL import Image", "stop"},
		{"extra", string(valid) + " {}", "stop"},
		{"geometry", strings.Replace(string(valid), `"role":`, `"coordinates":[1,2],"role":`, 1), "stop"},
		{"truncated", string(valid), "length"},
		{"wrong count", `{"pages":[]}`, "stop"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := NewClient("secret", "https://example.invalid", 1000, time.Second, false)
			client.http.Transport = roundTripFunc(func(*http.Request) (*http.Response, error) {
				data, _ := json.Marshal(map[string]any{"choices": []any{map[string]any{"message": map[string]string{"content": tc.content}, "finish_reason": tc.finish}}})
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(string(data)))}, nil
			})
			if _, err := client.GenerateContent(context.Background(), brief, "brief"); err == nil {
				t.Fatal("invalid model output accepted")
			}
		})
	}
}
func TestContentRequiresToken(t *testing.T) {
	c := NewClient("", "https://example.invalid", 1000, time.Second, false)
	if _, err := c.GenerateContent(context.Background(), testBrief(), "brief"); err == nil {
		t.Fatal("expected error")
	}
}

func TestSanitizeProvisionalIconsKeepsDraftValidForJev(t *testing.T) {
	draft := domain.CampaignDraft{Pages: []domain.PageContent{{IconIntent: "unknown-page", Items: []domain.ContentItem{{IconIntent: "unknown-item"}}}}}
	sanitizeProvisionalIcons(&draft)
	if draft.Pages[0].IconIntent != "connector" || draft.Pages[0].Items[0].IconIntent != "connector" {
		t.Fatalf("unexpected provisional icon fallback: %#v", draft.Pages[0])
	}
}
