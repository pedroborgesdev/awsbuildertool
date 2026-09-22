package domain

import (
	"sort"
	"strings"
	"testing"
)

func TestEditorialContract(t *testing.T) {
	brief := GenerateRequest{Theme: "Test", Goal: "Teach", Platform: "instagram-square", PostCount: 1, ContentLevel: "balanced", LastPageCTA: true, AdditionalContext: strings.Repeat("a", 400)}
	valid := func() CampaignDraft {
		return CampaignDraft{Version: 1, Brief: brief, Pages: []PageContent{{Role: "cover", Title: "Learn from examples", CTA: "Save for later", IconIntent: "key"}}}
	}
	if err := valid().Validate(); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name   string
		change func(*CampaignDraft)
	}{
		{"count", func(d *CampaignDraft) { d.Pages = nil }},
		{"code-as-role", func(d *CampaignDraft) { d.Pages[0].Role = "exec" }},
		{"missing-cta", func(d *CampaignDraft) { d.Pages[0].CTA = "" }},
		{"budget", func(d *CampaignDraft) { d.Pages[0].Body = strings.Repeat("text ", 40) }},
		{"invalid-icon", func(d *CampaignDraft) { d.Pages[0].IconIntent = "../../file" }},
		{"comparison", func(d *CampaignDraft) { d.Pages[0].Role = "comparison" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			d := valid()
			tc.change(&d)
			if d.Validate() == nil {
				t.Fatal("invalid content accepted")
			}
		})
	}
}

func TestChartRequiresPercentagesThatSumToOneHundred(t *testing.T) {
	brief := GenerateRequest{Theme: "Test", Goal: "Teach", Platform: "instagram-square", PostCount: 1, ContentLevel: "balanced", AdditionalContext: strings.Repeat("a", 400)}
	draft := CampaignDraft{Version: 1, Brief: brief, Pages: []PageContent{{
		Role: "chart", Title: "Distribution", IconIntent: "chart", Items: []ContentItem{
			{Title: "Produto", IconIntent: "package", Value: 60},
			{Title: "Plataforma", IconIntent: "server", Value: 40},
		},
	}}}
	if err := draft.Validate(); err != nil {
		t.Fatal(err)
	}
	draft.Pages[0].Items[1].Value = 30
	if draft.Validate() == nil {
		t.Fatal("chart whose percentages do not sum to 100 was accepted")
	}
}

func TestExpandedListAndComparisonCardinality(t *testing.T) {
	brief := GenerateRequest{Theme: "Test", Goal: "Teach", Platform: "instagram-portrait", PostCount: 1, ContentLevel: "deep", AdditionalContext: strings.Repeat("a", 400)}
	items := make([]ContentItem, 9)
	for i := range items {
		items[i] = ContentItem{Title: "Item", IconIntent: "key"}
	}
	list := CampaignDraft{Version: 1, Brief: brief, Pages: []PageContent{{Role: "list", Title: "Nove pontos", IconIntent: "key", Items: items}}}
	if err := list.Validate(); err != nil {
		t.Fatal(err)
	}
	comparisonItems := []ContentItem{{Title: "A", IconIntent: "key"}, {Title: "B", IconIntent: "cloud"}, {Title: "C", IconIntent: "server"}}
	comparison := CampaignDraft{Version: 1, Brief: brief, Pages: []PageContent{{Role: "comparison", Title: "Compare options", IconIntent: "key", Items: comparisonItems}}}
	if err := comparison.Validate(); err != nil {
		t.Fatal(err)
	}
}
func TestNormalizeEditorialUnicode(t *testing.T) {
	if got := NormalizeText("  Join the action…\u00a0today\u200b "); got != "Join the action... today" {
		t.Fatalf("got %q", got)
	}
}

func TestNormalizeInfersSemanticItemIcons(t *testing.T) {
	draft := CampaignDraft{Pages: []PageContent{{IconIntent: "key", Items: []ContentItem{
		{Title: "Commit", Text: "Code in the repository"},
		{Title: "Tests", Text: "Validate quality"},
		{Title: "Deploy", Text: "Delivery in production"},
		{Title: "Database", Text: "Persisted data"},
		{Title: "Chat", Text: "Send a message in the chat"},
		{Title: "Protection", Text: "Security and compliance"},
		{Title: "Share", Text: "Publish to the community"},
	}}}}
	draft.Normalize()
	got := make([]string, len(draft.Pages[0].Items))
	for i, item := range draft.Pages[0].Items {
		got[i] = item.IconIntent
	}
	want := []string{"brackets", "play-target", "lightning", "database", "chat", "shield", "share"}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("item %d: got %s, want %s", i, got[i], want[i])
		}
	}
}

func TestIconCatalogHasEveryPixelarticonSorted(t *testing.T) {
	names := IconNames()
	if len(names) < 191 {
		t.Fatalf("got %d icon intents, want at least 191", len(names))
	}
	if !sort.StringsAreSorted(names) {
		t.Fatal("icon names must be stable and sorted")
	}
	for _, want := range []string{"cloud", "database", "git-branch", "terminal", "chat", "share", "mail", "hashtag"} {
		if !Icons[want] {
			t.Fatalf("missing icon intent %q", want)
		}
	}
}
