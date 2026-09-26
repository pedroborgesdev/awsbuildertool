package domain

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"strings"
)

type GenerateRequest struct {
	UseAboutFooter    bool   `json:"useAboutFooter"`
	AboutName         string `json:"aboutName"`
	AboutSubtitle     string `json:"aboutSubtitle"`
	AboutPhoto        string `json:"aboutPhoto"`
	ColorTheme        string `json:"colorTheme"`
	PageTheme         string `json:"pageTheme"`
	Theme             string `json:"theme"`
	Goal              string `json:"goal"`
	Audience          string `json:"audience"`
	Platform          string `json:"platform"`
	PostCount         int    `json:"postCount"`
	ContentLevel      string `json:"contentLevel"`
	Tone              string `json:"tone"`
	Language          string `json:"language"`
	CTA               string `json:"cta"`
	FirstPageCTA      bool   `json:"firstPageCta"`
	LastPageCTA       bool   `json:"lastPageCta"`
	AdditionalContext string `json:"additionalContext"`
	Model             string `json:"model"`
}

type Format struct {
	Label       string
	Width       int
	Height      int
	Description string
}

var Formats = map[string]Format{
	"instagram-portrait": {Label: "Instagram — retrato", Width: 1080, Height: 1350, Description: "carrossel vertical 4:5"},
	"instagram-square":   {Label: "Instagram — quadrado", Width: 1080, Height: 1080, Description: "carrossel quadrado 1:1"},
	"instagram-story":    {Label: "Instagram Stories", Width: 1080, Height: 1920, Description: "story vertical 9:16"},
	"linkedin-portrait":  {Label: "LinkedIn — retrato", Width: 1080, Height: 1350, Description: "carrossel vertical 4:5"},
	"linkedin-document":  {Label: "PDF / Slides", Width: 1920, Height: 1080, Description: "PDF e slides horizontais 16:9"},
	"x-landscape":        {Label: "X — landscape", Width: 1600, Height: 900, Description: "horizontal post 16:9"},
	"facebook-portrait":  {Label: "Facebook — portrait", Width: 1200, Height: 1500, Description: "vertical post 4:5"},
	"youtube-community":  {Label: "YouTube — community", Width: 1080, Height: 1080, Description: "square post 1:1"},
}

var ContentLevels = map[string]bool{
	"essential": true,
	"balanced":  true,
	"deep":      true,
}

var ColorThemes = map[string]bool{
	"pink": true, "green": true, "blue": true, "orange": true, "purple": true, "colorful": true,
}

var PageThemes = map[string]bool{"dark": true, "light": true, "both": true}

func (r *GenerateRequest) Normalize(defaultModel string) {
	r.AboutName = strings.TrimSpace(r.AboutName)
	r.AboutSubtitle = strings.TrimSpace(r.AboutSubtitle)
	r.ColorTheme = strings.ToLower(strings.TrimSpace(r.ColorTheme))
	r.PageTheme = strings.ToLower(strings.TrimSpace(r.PageTheme))
	r.Theme = strings.TrimSpace(r.Theme)
	r.Goal = strings.TrimSpace(r.Goal)
	r.Audience = strings.TrimSpace(r.Audience)
	r.Platform = strings.TrimSpace(r.Platform)
	r.ContentLevel = strings.TrimSpace(r.ContentLevel)
	r.Tone = strings.TrimSpace(r.Tone)
	r.Language = strings.TrimSpace(r.Language)
	r.CTA = strings.TrimSpace(r.CTA)
	r.AdditionalContext = strings.TrimSpace(r.AdditionalContext)
	r.Model = strings.TrimSpace(r.Model)
	if r.Language == "" {
		r.Language = "English"
	}
	if r.Tone == "" {
		r.Tone = "educational, direct, and technical"
	}
	if r.Audience == "" {
		r.Audience = "people interested in the topic"
	}
	if r.ContentLevel == "" {
		r.ContentLevel = "balanced"
	}
	if r.ColorTheme == "" {
		r.ColorTheme = "colorful"
	}
	if r.PageTheme == "" {
		r.PageTheme = "both"
	}
	if r.Model == "" {
		r.Model = defaultModel
	}
}

func (r GenerateRequest) Validate() error {
	if len([]rune(r.AboutName)) > 80 {
		return fmt.Errorf("name must be at most 80 characters")
	}
	if len([]rune(r.AboutSubtitle)) > 120 {
		return fmt.Errorf("subtitle must be at most 120 characters")
	}
	if r.AboutPhoto != "" {
		parts := strings.SplitN(r.AboutPhoto, ",", 2)
		if len(parts) != 2 || (parts[0] != "data:image/jpeg;base64" && parts[0] != "data:image/png;base64") {
			return fmt.Errorf("photo must be JPEG or PNG")
		}
		data, err := base64.StdEncoding.DecodeString(parts[1])
		if err != nil || len(data) > 3<<20 {
			return fmt.Errorf("photo is invalid or exceeds 3 MB")
		}
		config, _, err := image.DecodeConfig(bytes.NewReader(data))
		if err != nil || config.Width != 1080 || config.Height != 1080 {
			return fmt.Errorf("cropped photo must be exactly 1080x1080 pixels")
		}
	}
	if r.ColorTheme != "" && !ColorThemes[r.ColorTheme] {
		return fmt.Errorf("theme color must be pink, green, blue, orange, purple, or colorful")
	}
	if r.PageTheme != "" && !PageThemes[r.PageTheme] {
		return fmt.Errorf("page appearance must be dark, light, or both")
	}
	if len([]rune(r.Theme)) < 3 || len([]rune(r.Theme)) > 180 {
		return fmt.Errorf("topic must be between 3 and 180 characters")
	}
	if len([]rune(r.Goal)) < 3 || len([]rune(r.Goal)) > 500 {
		return fmt.Errorf("goal must be between 3 and 500 characters")
	}
	if _, ok := Formats[r.Platform]; !ok {
		return fmt.Errorf("invalid publication format")
	}
	if r.PostCount < 1 || r.PostCount > 10 {
		return fmt.Errorf("page count must be between 1 and 10")
	}
	if !ContentLevels[r.ContentLevel] {
		return fmt.Errorf("content level must be essential, balanced, or deep")
	}
	if length := len([]rune(r.AdditionalContext)); length < 200 || length > 8000 {
		return fmt.Errorf("context must be between 200 and 8000 characters")
	}
	if len([]rune(r.CTA)) > 280 {
		return fmt.Errorf("CTA must be at most 280 characters")
	}
	return nil
}

type GenerateResponse struct {
	Draft          CampaignDraft    `json:"draft"`
	Script         string           `json:"script"`
	Prompt         string           `json:"prompt"`
	Filename       string           `json:"filename"`
	Model          string           `json:"model"`
	JobID          string           `json:"jobId"`
	Files          []GeneratedAsset `json:"files"`
	ExecutionLog   string           `json:"executionLog,omitempty"`
	ExecutionError string           `json:"executionError,omitempty"`
	Cost           GenerationCost   `json:"cost"`
}

type GenerationCost struct {
	HF                  float64 `json:"hf"`
	Jev                 float64 `json:"jev"`
	Total               float64 `json:"total"`
	Currency            string  `json:"currency"`
	Estimated           bool    `json:"estimated"`
	HFPromptTokens      int     `json:"hfPromptTokens"`
	HFCompletionTokens  int     `json:"hfCompletionTokens"`
	JevPromptTokens     int     `json:"jevPromptTokens"`
	JevCompletionTokens int     `json:"jevCompletionTokens"`
}

type GeneratedAsset struct {
	Kind      string `json:"kind"`
	Width     int    `json:"width,omitempty"`
	Height    int    `json:"height,omitempty"`
	Name      string `json:"name"`
	URL       string `json:"url"`
	MediaType string `json:"mediaType"`
}

type PromptResponse struct {
	Prompt string `json:"prompt"`
}

type ConfigResponse struct {
	Model             string `json:"model"`
	TokenConfigured   bool   `json:"tokenConfigured"`
	DesignSystemReady bool   `json:"designSystemReady"`
	MockMode          bool   `json:"mockMode"`
	RendererReady     bool   `json:"rendererReady"`
	RendererMode      string `json:"rendererMode"`
}
