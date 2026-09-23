package hf

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/pedroborges/universal-post-creator/internal/domain"
)

func TestDescribedIconsExistInCatalog(t *testing.T) {
	if !domain.IconCatalogReady() {
		t.Fatal("icon catalog was not loaded")
	}
	names := map[string]bool{}
	for _, name := range domain.IconNames() {
		names[name] = true
	}
	for _, choice := range describedIcons {
		if !names[choice.name] {
			t.Errorf("described icon %s is not in the catalog", choice.name)
		}
	}
}

func TestSelectIconsUsesDescribedCatalogAndRepairsInvalidNames(t *testing.T) {
	var prompt string
	calls := 0
	client := NewClient("secret", "https://example.invalid/v1", 1000, time.Second, false)
	client.http.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		var request chatRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		prompt = request.Messages[1].Content
		body := "```json\n{\"page-0\":\"not-an-icon\",\"page-1\":\"shield\",\"page-2\":\"lightning\"}\n```"
		data, _ := json.Marshal(map[string]any{"choices": []any{map[string]any{"message": map[string]string{"content": body}, "finish_reason": "stop"}}})
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(string(data)))}, nil
	})
	got, err := client.SelectIcons(context.Background(), "test-model", []IconSelection{
		{ID: "page-0", Word: "Dados", Context: "O banco guarda os registros"},
		{ID: "page-1", Word: "Equipe", Context: "pessoas do time"},
		{ID: "page-2", Word: "Deploy", Context: "entrega continua"},
	}, []string{"database", "shield", "zap", "sparkles", "users", "arrow-down-narrow-wide"})
	if err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatalf("calls = %d, want 1", calls)
	}
	if !strings.Contains(prompt, "database — database cylinder") || !strings.Contains(prompt, "O banco guarda os registros") {
		t.Fatalf("prompt missing described catalog or page text:\n%s", prompt)
	}
	if strings.Contains(prompt, "arrow-down-narrow-wide") {
		t.Fatal("prompt still offers near-duplicate arrows")
	}
	if got["page-0"] != "database" || got["page-1"] != "shield" || got["page-2"] != "zap" {
		t.Fatalf("icons = %#v", got)
	}
}

func TestSelectIconsReturnsTransportErrors(t *testing.T) {
	client := NewClient("secret", "https://example.invalid/v1", 1000, time.Second, false)
	client.http.Transport = roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, errors.New("dial failed")
	})
	_, err := client.SelectIcons(context.Background(), "test-model", []IconSelection{{ID: "page-0", Word: "Dados"}}, []string{"database"})
	if err == nil || !strings.Contains(err.Error(), "failed to query Hugging Face") {
		t.Fatalf("expected transport error, got %v", err)
	}
}

func TestFallbackIconMatchesMeaning(t *testing.T) {
	choices := availableIcons([]string{"database", "shield", "users", "sparkles", "arrow-down-narrow-wide"})
	if got := fallbackIcon("O banco guarda os dados", choices); got != "database" {
		t.Fatalf("database text selected %s", got)
	}
	if got := fallbackIcon("Revisão de segurança antes de publicar", choices); got != "shield" {
		t.Fatalf("security text selected %s", got)
	}
	if got := fallbackIcon("tema abstrato sem pista", choices); got != "sparkles" {
		t.Fatalf("unknown text selected %s", got)
	}
}
