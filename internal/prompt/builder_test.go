package prompt

import (
	"strings"
	"testing"

	"github.com/pedroborges/universal-post-creator/internal/domain"
)

func TestEditorialPromptIsSmall(t *testing.T) {
	brief := domain.GenerateRequest{Theme: "CI/CD", Goal: "Teach students", Platform: "instagram-square", PostCount: 5, ContentLevel: "deep", CTA: "Save this post"}
	value, err := NewBuilder(t.TempDir()).Build(brief)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(value, "word limit") {
		t.Fatal("prompt must not impose a per-page word limit")
	}
	for _, want := range []string{"exactly 5 pages", "Save this post", `"pages"`, `"theme": "CI/CD"`, "cloud", "git-branch", "hashtag", `always write its complete name exactly as "AWS Builder Center"`, `"highlights"`, "exact excerpt"} {
		if !strings.Contains(value, want) {
			t.Errorf("missing %q", want)
		}
	}
	if len(value) > 6000 || strings.Contains(value, "from PIL") || strings.Contains(value, "def ") {
		t.Fatal("prompt must not include renderer code")
	}
}

func TestEditorialPromptRequiresEveryUploadedImage(t *testing.T) {
	brief := domain.GenerateRequest{
		Theme: "Community", Goal: "Show collaboration", Platform: "instagram-square", PostCount: 1,
		Images: []domain.ExternalImage{{
			ID: "image-1", Name: "team.jpg", DataURL: "data:image/jpeg;base64,secret-pixels",
			Analysis: domain.ImageAnalysis{Description: "A smiling team", RelevantCells: []string{"A1", "A2"}},
		}},
	}
	value, err := NewBuilder(t.TempDir()).Build(brief)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"Every image in the catalog must appear exactly once", `"id": "image-1"`, "A smiling team"} {
		if !strings.Contains(value, want) {
			t.Fatalf("prompt is missing %q", want)
		}
	}
	if strings.Contains(value, "secret-pixels") {
		t.Fatal("raw image data leaked into the editorial prompt")
	}
}

func TestBundledRuntimeDesignSystemIsComplete(t *testing.T) {
	if !NewBuilder("../../design_system").Ready() {
		t.Fatal("minimum design system is incomplete")
	}
}
