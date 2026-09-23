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
	for _, want := range []string{"exactly 5 pages", "Save this post", `"pages"`, `"theme": "CI/CD"`, "cloud", "git-branch", "hashtag", `always write its complete name exactly as "AWS Builder Center"`} {
		if !strings.Contains(value, want) {
			t.Errorf("missing %q", want)
		}
	}
	if len(value) > 6000 || strings.Contains(value, "from PIL") || strings.Contains(value, "def ") {
		t.Fatal("prompt must not include renderer code")
	}
}

func TestBundledRuntimeDesignSystemIsComplete(t *testing.T) {
	if !NewBuilder("../../design_system").Ready() {
		t.Fatal("minimum design system is incomplete")
	}
}
