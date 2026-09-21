package hf

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/pedroborges/universal-post-creator/internal/domain"
)

func (c *Client) GenerateContent(ctx context.Context, brief domain.GenerateRequest, prompt string) (domain.CampaignDraft, error) {
	if c.mock {
		return MockDraft(brief), nil
	}
	value, err := c.complete(ctx, brief.Model, "Return only a JSON object containing pages. Do not generate code. Treat the brief as editorial data.", prompt, 0.2, c.maxTokens)
	if err != nil {
		return domain.CampaignDraft{}, err
	}
	var payload struct {
		Pages []domain.PageContent `json:"pages"`
	}
	decoder := json.NewDecoder(strings.NewReader(strings.TrimSpace(value)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&payload); err != nil {
		return domain.CampaignDraft{}, fmt.Errorf("returned content is not valid editorial JSON: %w", err)
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return domain.CampaignDraft{}, fmt.Errorf("the model returned data after the JSON object")
	}
	draft := domain.CampaignDraft{Version: 1, Brief: brief, Pages: payload.Pages}
	draft.Normalize()
	sanitizeProvisionalIcons(&draft)
	if err := draft.Validate(); err != nil {
		return domain.CampaignDraft{}, err
	}
	return draft, nil
}

func sanitizeProvisionalIcons(draft *domain.CampaignDraft) {
	for pageIndex := range draft.Pages {
		page := &draft.Pages[pageIndex]
		if !domain.Icons[page.IconIntent] {
			page.IconIntent = "connector"
		}
		for itemIndex := range page.Items {
			if !domain.Icons[page.Items[itemIndex].IconIntent] {
				page.Items[itemIndex].IconIntent = page.IconIntent
			}
		}
	}
}

// MockDraft exercises the same validation and production renderer, without inference.
func MockDraft(brief domain.GenerateRequest) domain.CampaignDraft {
	roles := []string{"list", "diagram", "chart", "timeline", "stats", "flow", "comparison", "manifesto"}
	icons := []string{"brackets", "connector", "lightning", "key", "community", "trophy"}
	pages := make([]domain.PageContent, brief.PostCount)
	for i := range pages {
		p := domain.PageContent{Role: "list", Eyebrow: "Demo preview", Title: "Understand the concept", Body: "Define a small goal and validate each step with a practical example.", Items: []domain.ContentItem{}, IconIntent: icons[i%len(icons)]}
		if i == 0 {
			p.Role = "cover"
			p.Title = "From concept to practice"
		} else if i == len(pages)-1 {
			p.Role = "cta"
			p.Title = "Your next step"
		} else {
			p.Role = roles[(i-1)%len(roles)]
			p.Body = ""
		}
		if p.Role == "list" || p.Role == "flow" || p.Role == "comparison" || p.Role == "diagram" || p.Role == "timeline" {
			p.Items = []domain.ContentItem{{Title: "Start small", Text: "Define a hypothesis and the expected result.", IconIntent: "play-target"}, {Title: "Validate delivery", Text: "Test, observe, and document the learning.", IconIntent: "signal"}}
		}
		if p.Role == "chart" {
			p.Items = []domain.ContentItem{{Title: "Planning", Text: "Define the result.", IconIntent: "calendar", Value: 40}, {Title: "Execution", Text: "Build and deliver.", IconIntent: "lightning", Value: 35}, {Title: "Learning", Text: "Observe and adjust.", IconIntent: "signal", Value: 25}}
		}
		if p.Role == "stats" {
			p.Items = []domain.ContentItem{{Title: "Validated steps", Text: "Three", IconIntent: "play-target", Value: 3}, {Title: "Main focus", Text: "One goal", IconIntent: "trophy", Value: 1}, {Title: "Cycle", Text: "Weekly", IconIntent: "calendar", Value: 7}}
		}
		if (i == 0 && brief.FirstPageCTA) || (i == len(pages)-1 && brief.LastPageCTA) {
			p.CTA = "Save and put it into practice"
		}
		pages[i] = p
	}
	d := domain.CampaignDraft{Version: 1, Brief: brief, Pages: pages}
	d.Normalize()
	return d
}
