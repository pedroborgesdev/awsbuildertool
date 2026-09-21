package domain

import (
	"fmt"
	"sort"
	"strings"
	"unicode"
)

// CampaignDraft is the editable editorial contract. Geometry belongs to the renderer.
type CampaignDraft struct {
	Version    int             `json:"version"`
	LayoutSeed int64           `json:"layoutSeed"`
	Brief      GenerateRequest `json:"brief"`
	Pages      []PageContent   `json:"pages"`
}

type PageContent struct {
	Role       string        `json:"role"`
	Eyebrow    string        `json:"eyebrow"`
	Title      string        `json:"title"`
	Body       string        `json:"body"`
	Items      []ContentItem `json:"items"`
	CTA        string        `json:"cta"`
	IconIntent string        `json:"iconIntent"`
}

type ContentItem struct {
	Title      string `json:"title"`
	Text       string `json:"text"`
	IconIntent string `json:"iconIntent"`
	Value      int    `json:"value,omitempty"`
}

var Roles = map[string]string{
	"cover": "cover-asymmetric", "list": "editorial-list", "flow": "technical-flow",
	"comparison": "structured-comparison", "manifesto": "manifesto", "cta": "final-cta",
	"diagram": "node-diagram", "chart": "proportion-chart", "timeline": "timeline", "stats": "metric-grid",
}

func IconNames() []string {
	names := make([]string, 0, len(Icons))
	for name := range Icons {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func WordBudget(brief GenerateRequest, role string) int {
	limit := map[string]int{"essential": 50, "balanced": 80, "deep": 120}[brief.ContentLevel]
	if role == "cover" || role == "manifesto" {
		limit = min(limit, 45)
	}
	if role == "cta" {
		limit = min(limit, 65)
	}
	if brief.Platform == "instagram-square" || brief.Platform == "youtube-community" || brief.Platform == "x-landscape" {
		limit = min(limit, 90)
	}
	return limit
}

func NormalizeText(value string) string {
	r := strings.NewReplacer("\u2011", "-", "\u2010", "-", "\u2013", "-", "\u2014", "-", "\u00a0", " ", "\u202f", " ", "\u2018", "'", "\u2019", "'", "\u201c", "\"", "\u201d", "\"", "\u2026", "...", "\r\n", "\n")
	return strings.TrimSpace(strings.Map(func(c rune) rune {
		if (unicode.IsControl(c) && c != '\n') || unicode.Is(unicode.Cf, c) {
			return -1
		}
		return c
	}, r.Replace(value)))
}

func (d *CampaignDraft) Normalize() {
	for i := range d.Pages {
		p := &d.Pages[i]
		p.Eyebrow = NormalizeText(p.Eyebrow)
		p.Title = NormalizeText(p.Title)
		p.Body = NormalizeText(p.Body)
		p.CTA = NormalizeText(p.CTA)
		if p.Items == nil {
			p.Items = []ContentItem{}
		}
		for j := range p.Items {
			p.Items[j].Title = NormalizeText(p.Items[j].Title)
			p.Items[j].Text = NormalizeText(p.Items[j].Text)
			if p.Items[j].IconIntent == "" {
				p.Items[j].IconIntent = inferItemIcon(p.Items[j], p.IconIntent)
			}
		}
	}
}

func inferItemIcon(item ContentItem, fallback string) string {
	value := strings.ToLower(item.Title + " " + item.Text)
	for _, match := range []struct {
		terms []string
		icon  string
	}{
		{[]string{"cloud", "serverless"}, "cloud"},
		{[]string{"database", "data", "storage", "store"}, "database"},
		{[]string{"server", "compute", "instance", "virtual machine"}, "server"},
		{[]string{"terminal", "command line", "shell", "console", " cli "}, "terminal"},
		{[]string{"security", "protection", "compliance"}, "shield"},
		{[]string{"processador", "hardware", "cpu", "chip"}, "chip"},
		{[]string{"branch", "merge", "pull request", "git"}, "git-branch"},
		{[]string{"bug", "debug", "error", "failure", "incident"}, "bug"},
		{[]string{"artificial intelligence", "machine learning", "agent", "model", "bot"}, "robot"},
		{[]string{"container", "package", "dependency"}, "package"},
		{[]string{"chat", "message", "conversation", "comment", "feedback"}, "chat"},
		{[]string{"like", "heart", "passion", "support"}, "heart"},
		{[]string{"user", "profile", "account"}, "user"},
		{[]string{"share", "publish"}, "share"},
		{[]string{"global", "world", "region", "international"}, "globe"},
		{[]string{"calendar", "agenda", "event"}, "calendar"},
		{[]string{"notification", "alert", "warning"}, "bell"},
		{[]string{"save", "favorite", "bookmark"}, "bookmark"},
		{[]string{"email", "newsletter", "contact"}, "mail"},
		{[]string{"hashtag", "topic", "tag"}, "hashtag"},
		{[]string{"code", "commit", "repository", "source"}, "brackets"},
		{[]string{"build", "compile", "artifact", "image"}, "connector"},
		{[]string{"test", "tests", "validate", "quality", "check"}, "play-target"},
		{[]string{"deploy", "delivery", "production", "automate"}, "lightning"},
		{[]string{"observe", "metric", "monitor", "signal"}, "signal"},
		{[]string{"key", "access", "credential", "identity"}, "key"},
		{[]string{"team", "community", "people", "collaborate"}, "community"},
		{[]string{"badge", "award", "achievement", "certification"}, "trophy"},
	} {
		for _, term := range match.terms {
			if strings.Contains(value, term) {
				return match.icon
			}
		}
	}
	return fallback
}

func (d CampaignDraft) Validate() error {
	if d.Version != 1 {
		return fmt.Errorf("invalid content version")
	}
	if err := d.Brief.Validate(); err != nil {
		return err
	}
	if len(d.Pages) != d.Brief.PostCount {
		return fmt.Errorf("expected %d pages; received %d", d.Brief.PostCount, len(d.Pages))
	}
	for i, p := range d.Pages {
		if _, ok := Roles[p.Role]; !ok {
			return fmt.Errorf("page %d: invalid editorial role", i+1)
		}
		if !Icons[p.IconIntent] {
			return fmt.Errorf("page %d: invalid icon", i+1)
		}
		if strings.TrimSpace(p.Title) == "" {
			return fmt.Errorf("page %d: title is required", i+1)
		}
		for _, f := range []struct {
			name, value string
			max         int
		}{{"title", p.Title, 100}, {"label", p.Eyebrow, 50}, {"body", p.Body, 700}, {"CTA", p.CTA, 140}} {
			if len([]rune(f.value)) > f.max {
				return fmt.Errorf("page %d: %s exceeds %d characters", i+1, f.name, f.max)
			}
		}
		maxItems := 5
		if p.Role == "list" {
			maxItems = 9
		}
		if p.Role == "cover" || p.Role == "manifesto" {
			maxItems = 0
		}
		if p.Role == "comparison" {
			maxItems = 3
		}
		if p.Role == "stats" {
			maxItems = 4
		}
		if p.Role == "cta" {
			maxItems = 3
		}
		if len(p.Items) > maxItems {
			return fmt.Errorf("page %d: this layout accepts at most %d items", i+1, maxItems)
		}
		if p.Role == "comparison" && (len(p.Items) < 2 || len(p.Items) > 3) {
			return fmt.Errorf("page %d: comparison requires two or three items", i+1)
		}
		if (p.Role == "list" || p.Role == "flow") && len(p.Items) == 0 {
			return fmt.Errorf("page %d: add at least one item", i+1)
		}
		if (p.Role == "diagram" || p.Role == "chart" || p.Role == "timeline" || p.Role == "stats") && (len(p.Items) < 2 || len(p.Items) > maxItems) {
			return fmt.Errorf("page %d: component %s requires 2 to %d items", i+1, p.Role, maxItems)
		}
		if p.Role == "chart" {
			total := 0
			for _, item := range p.Items {
				if item.Value < 1 || item.Value > 100 {
					return fmt.Errorf("page %d: each chart slice requires value between 1 and 100", i+1)
				}
				total += item.Value
			}
			if total != 100 {
				return fmt.Errorf("page %d: chart slices must sum to 100", i+1)
			}
		}
		words := strings.Fields(p.Eyebrow + " " + p.Title + " " + p.Body + " " + p.CTA)
		for _, item := range p.Items {
			if strings.TrimSpace(item.Title) == "" || len([]rune(item.Title)) > 60 || len([]rune(item.Text)) > 200 {
				return fmt.Errorf("page %d: each item needs a title (up to 60 characters) and text up to 200 characters", i+1)
			}
			if !Icons[item.IconIntent] {
				return fmt.Errorf("page %d: invalid item icon", i+1)
			}
			words = append(words, strings.Fields(item.Title+" "+item.Text)...)
		}
		if len(words) > WordBudget(d.Brief, p.Role) {
			return fmt.Errorf("page %d: %d words; limit is %d for this format and role. Shorten the text or redistribute it across pages", i+1, len(words), WordBudget(d.Brief, p.Role))
		}
		if ((i == 0 && d.Brief.FirstPageCTA) || (i == len(d.Pages)-1 && d.Brief.LastPageCTA)) && p.CTA == "" {
			return fmt.Errorf("page %d: CTA is required", i+1)
		}
	}
	return nil
}

type ContentResponse struct {
	Draft  CampaignDraft `json:"draft"`
	Prompt string        `json:"prompt"`
}
