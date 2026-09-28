package domain

import (
	"fmt"
	"sort"
	"strconv"
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
	Role       string          `json:"role"`
	Eyebrow    string          `json:"eyebrow"`
	Title      string          `json:"title"`
	Body       string          `json:"body"`
	Items      []ContentItem   `json:"items"`
	Highlights []TextHighlight `json:"highlights"`
	CTA        string          `json:"cta"`
	IconIntent string          `json:"iconIntent"`
	ImageID    string          `json:"imageId"`
	ImageRole  string          `json:"imageRole"`
}

// TextHighlight keeps emphasis separate from the copy. Target is a stable
// editorial path such as "title", "body", or "items.0.text".
type TextHighlight struct {
	Target string `json:"target"`
	Text   string `json:"text"`
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
		p.ImageID = strings.TrimSpace(p.ImageID)
		p.ImageRole = strings.ToLower(strings.TrimSpace(p.ImageRole))
		if p.Items == nil {
			p.Items = []ContentItem{}
		}
		if p.Highlights == nil {
			p.Highlights = []TextHighlight{}
		}
		for j := range p.Highlights {
			p.Highlights[j].Target = strings.TrimSpace(p.Highlights[j].Target)
			p.Highlights[j].Text = NormalizeText(p.Highlights[j].Text)
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
	availableImages := map[string]bool{}
	for _, image := range d.Brief.Images {
		availableImages[image.ID] = true
		if image.Analysis.Description == "" {
			return fmt.Errorf("image %s has not been analyzed", image.ID)
		}
	}
	usedImages := map[string]bool{}
	for i, p := range d.Pages {
		if _, ok := Roles[p.Role]; !ok {
			return fmt.Errorf("page %d: invalid editorial role", i+1)
		}
		if !Icons[p.IconIntent] {
			return fmt.Errorf("page %d: invalid icon", i+1)
		}
		if p.ImageID == "" && p.ImageRole != "" {
			return fmt.Errorf("page %d: imageRole requires imageId", i+1)
		}
		if p.ImageID != "" {
			if !availableImages[p.ImageID] {
				return fmt.Errorf("page %d: unknown imageId", i+1)
			}
			if usedImages[p.ImageID] {
				return fmt.Errorf("page %d: the same content image cannot be reused", i+1)
			}
			if !map[string]bool{"hero": true, "support": true, "background": true, "portrait": true, "evidence": true}[p.ImageRole] {
				return fmt.Errorf("page %d: invalid imageRole", i+1)
			}
			usedImages[p.ImageID] = true
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
		for _, item := range p.Items {
			if strings.TrimSpace(item.Title) == "" || len([]rune(item.Title)) > 60 || len([]rune(item.Text)) > 200 {
				return fmt.Errorf("page %d: each item needs a title (up to 60 characters) and text up to 200 characters", i+1)
			}
			if !Icons[item.IconIntent] {
				return fmt.Errorf("page %d: invalid item icon", i+1)
			}
		}
		if len(p.Highlights) > 3 {
			return fmt.Errorf("page %d: use at most three text highlights", i+1)
		}
		seenHighlights := map[string]bool{}
		for _, highlight := range p.Highlights {
			value, ok := highlightTargetValue(p, highlight.Target)
			if !ok {
				return fmt.Errorf("page %d: invalid highlight target %q", i+1, highlight.Target)
			}
			if highlight.Text == "" || !strings.Contains(value, highlight.Text) {
				return fmt.Errorf("page %d: highlight text must be an exact excerpt of %s", i+1, highlight.Target)
			}
			key := highlight.Target + "\x00" + highlight.Text
			if seenHighlights[key] {
				return fmt.Errorf("page %d: duplicate text highlight", i+1)
			}
			seenHighlights[key] = true
		}
		if ((i == 0 && d.Brief.FirstPageCTA) || (i == len(d.Pages)-1 && d.Brief.LastPageCTA)) && p.CTA == "" {
			return fmt.Errorf("page %d: CTA is required", i+1)
		}
	}
	if len(usedImages) != len(availableImages) {
		missing := make([]string, 0, len(availableImages)-len(usedImages))
		for imageID := range availableImages {
			if !usedImages[imageID] {
				missing = append(missing, imageID)
			}
		}
		sort.Strings(missing)
		return fmt.Errorf("every uploaded image must be assigned exactly once; missing: %s", strings.Join(missing, ", "))
	}
	return nil
}

// ReconcileHighlights removes emphasis whose source text was edited. It is
// intended for user-reviewed drafts; model responses still use strict validation.
func (d *CampaignDraft) ReconcileHighlights() {
	for pageIndex := range d.Pages {
		page := &d.Pages[pageIndex]
		valid := make([]TextHighlight, 0, len(page.Highlights))
		for _, highlight := range page.Highlights {
			value, ok := highlightTargetValue(*page, highlight.Target)
			if ok && highlight.Text != "" && strings.Contains(value, highlight.Text) {
				valid = append(valid, highlight)
			}
		}
		page.Highlights = valid
	}
}

func highlightTargetValue(page PageContent, target string) (string, bool) {
	if target == "title" {
		return page.Title, true
	}
	if target == "body" {
		return page.Body, true
	}
	parts := strings.Split(target, ".")
	if len(parts) != 3 || parts[0] != "items" || (parts[2] != "title" && parts[2] != "text") {
		return "", false
	}
	index, err := strconv.Atoi(parts[1])
	if err != nil || index < 0 || index >= len(page.Items) {
		return "", false
	}
	if parts[2] == "title" {
		return page.Items[index].Title, true
	}
	return page.Items[index].Text, true
}

type ContentResponse struct {
	Draft  CampaignDraft `json:"draft"`
	Prompt string        `json:"prompt"`
}
