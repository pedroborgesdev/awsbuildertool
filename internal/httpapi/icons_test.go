package httpapi

import (
	"strings"
	"testing"

	"github.com/pedroborges/universal-post-creator/internal/domain"
)

func TestIconSelectionsUsePageText(t *testing.T) {
	draft := &domain.CampaignDraft{Pages: []domain.PageContent{{
		Title:   "Dados",
		Eyebrow: "Pipeline",
		Body:    "O banco guarda os registros",
		Items:   []domain.ContentItem{{Title: "Credencial", Text: "A chave libera o acesso"}},
	}}}
	got := iconSelections(draft)
	if len(got) != 2 {
		t.Fatalf("selections = %d", len(got))
	}
	if !strings.Contains(got[0].Context, "banco guarda") || !strings.Contains(got[1].Context, "chave libera") {
		t.Fatalf("selections = %#v", got)
	}
	if strings.Contains(got[0].Context, "Educational technology") {
		t.Fatal("icon context is still the generic sentence")
	}
}
