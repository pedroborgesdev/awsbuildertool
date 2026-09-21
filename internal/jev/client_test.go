package jev

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestSelectIconUsesAllCatalogIconsInBoundedRounds(t *testing.T) {
	client := NewClient("secret", "https://example.invalid/v1/systemone", "jev-latest", time.Second)
	calls := 0
	client.http.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		if r.URL.Path != "/v1/systemone" || r.Header.Get("Authorization") != "Bearer secret" {
			t.Fatal("invalid Jev request")
		}
		var payload request
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.Model != "jev-latest" || payload.State["word"] != "Armazenamento" {
			t.Fatal("state or model missing")
		}
		answers := make(map[string]any, len(payload.Questions))
		for id, question := range payload.Questions {
			if question.Type != "choice" || len(question.Criteria) > maxChoiceOptions {
				t.Fatal("invalid choice question")
			}
			choice := "cloud"
			if calls == 1 {
				for name := range question.Criteria {
					choice = name
					break
				}
			}
			answers[id] = map[string]string{"type": "choice", "choice": choice}
		}
		body, _ := json.Marshal(map[string]any{"answers": answers})
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(string(body)))}, nil
	})

	icon, err := client.SelectIcon(context.Background(), Selection{ID: "item-0", Word: "Armazenamento", Context: "Educational technology graphic. We need to choose the icon that most clearly and immediately represents this word in the state."}, []string{"archive", "box", "cloud", "database", "folder", "kit"})
	if err != nil {
		t.Fatal(err)
	}
	if calls != 2 || icon != "cloud" {
		t.Fatalf("calls = %d, icon = %q", calls, icon)
	}
}

func TestSelectIconRequiresAPIKey(t *testing.T) {
	client := NewClient("", "https://example.invalid", "jev-latest", time.Second)
	if _, err := client.SelectIcon(context.Background(), Selection{ID: "item-0", Word: "Armazenamento"}, []string{"cloud"}); err == nil {
		t.Fatal("expected missing key error")
	}
}
