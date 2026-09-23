package render

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/pedroborges/universal-post-creator/internal/domain"
	"github.com/pedroborges/universal-post-creator/internal/hf"
)

func TestTrustedCampaignAndArtifactValidation(t *testing.T) {
	brief := domain.GenerateRequest{Theme: "Python data", Goal: "Validate render", Platform: "instagram-square", PostCount: 5, ContentLevel: "balanced", LastPageCTA: true, AdditionalContext: strings.Repeat("a", 400)}
	brief.Normalize("mock")
	draft := hf.MockDraft(brief)
	// Quotes and code-like editorial data must not become Python source.
	draft.Pages[0].Body = "print('hello'); __import__('os')"
	script, err := BuildScript(draft)
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	runner := NewRunner(root, "../../design_system", "python3")
	result, err := runner.Render(context.Background(), script)
	if err != nil {
		t.Fatalf("%v: %s", err, result.Log)
	}
	assets, err := ValidateArtifacts(root, result, draft)
	if err != nil {
		t.Fatal(err)
	}
	if len(assets) != 7 || assets[0].Width != 1080 || assets[0].Height != 1080 || assets[5].Kind != "preview" || assets[6].Kind != "document" {
		t.Fatalf("bad assets: %+v", assets)
	}
	wrong := draft
	wrong.Brief.Platform = "instagram-portrait"
	if _, err := ValidateArtifacts(root, result, wrong); err == nil {
		t.Fatal("accepted wrong dimensions")
	}
	result.Files = result.Files[:len(result.Files)-1]
	if _, err := ValidateArtifacts(root, result, draft); err == nil {
		t.Fatal("accepted missing asset")
	}
	result.Files = append(result.Files, File{Name: "output/campaign.pdf", MediaType: "application/pdf"})
	if err := os.WriteFile(filepath.Join(root, result.JobID, "output", "campaign.pdf"), []byte("%PDF-1.4\n/Type /Page\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := ValidateArtifacts(root, result, draft); err == nil {
		t.Fatal("accepted wrong PDF page count")
	}
}
