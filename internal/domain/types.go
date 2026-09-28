package domain

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"regexp"
	"strings"
)

const MaxExternalImages = 5

var externalImageID = regexp.MustCompile(`^image-[1-5]$`)

type NormalizedRect struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

type ImageAnalysis struct {
	Description   string         `json:"description"`
	Subjects      []string       `json:"subjects"`
	Mood          string         `json:"mood"`
	Composition   string         `json:"composition"`
	RelevantCells []string       `json:"relevantCells"`
	FocusRect     NormalizedRect `json:"focusRect"`
	SafeTextAreas []string       `json:"safeTextAreas"`
	CropTolerance string         `json:"cropTolerance"`
	Confidence    float64        `json:"confidence"`
}

type ExternalImage struct {
	ID       string        `json:"id"`
	Name     string        `json:"name"`
	DataURL  string        `json:"dataUrl"`
	Analysis ImageAnalysis `json:"analysis"`
}

type GenerateRequest struct {
	UseAboutFooter    bool            `json:"useAboutFooter"`
	AboutName         string          `json:"aboutName"`
	AboutSubtitle     string          `json:"aboutSubtitle"`
	AboutPhoto        string          `json:"aboutPhoto"`
	ColorTheme        string          `json:"colorTheme"`
	PageTheme         string          `json:"pageTheme"`
	ShowGrid          *bool           `json:"showGrid,omitempty"`
	Theme             string          `json:"theme"`
	Goal              string          `json:"goal"`
	Audience          string          `json:"audience"`
	Platform          string          `json:"platform"`
	PostCount         int             `json:"postCount"`
	ContentLevel      string          `json:"contentLevel"`
	Tone              string          `json:"tone"`
	Language          string          `json:"language"`
	CTA               string          `json:"cta"`
	FirstPageCTA      bool            `json:"firstPageCta"`
	LastPageCTA       bool            `json:"lastPageCta"`
	AdditionalContext string          `json:"additionalContext"`
	Model             string          `json:"model"`
	Images            []ExternalImage `json:"images"`
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
	for index := range r.Images {
		r.Images[index].ID = strings.TrimSpace(r.Images[index].ID)
		r.Images[index].Name = strings.TrimSpace(r.Images[index].Name)
	}
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
	if len(r.Images) > MaxExternalImages {
		return fmt.Errorf("at most %d content images are allowed", MaxExternalImages)
	}
	if len(r.Images) > r.PostCount {
		return fmt.Errorf("the page count must be at least the number of content images")
	}
	seenImages := map[string]bool{}
	for index, item := range r.Images {
		if !externalImageID.MatchString(item.ID) || seenImages[item.ID] {
			return fmt.Errorf("content image %d has an invalid or duplicate id", index+1)
		}
		seenImages[item.ID] = true
		if strings.TrimSpace(item.Name) == "" || len([]rune(item.Name)) > 180 {
			return fmt.Errorf("content image %d needs a name of at most 180 characters", index+1)
		}
		if err := validateExternalImageData(item.DataURL); err != nil {
			return fmt.Errorf("content image %d: %w", index+1, err)
		}
		if item.Analysis.Description != "" {
			if err := ValidateImageAnalysis(item.Analysis); err != nil {
				return fmt.Errorf("content image %d analysis: %w", index+1, err)
			}
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

func validateExternalImageData(value string) error {
	parts := strings.SplitN(value, ",", 2)
	if len(parts) != 2 || (parts[0] != "data:image/jpeg;base64" && parts[0] != "data:image/png;base64") {
		return fmt.Errorf("file must be JPEG or PNG")
	}
	data, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil || len(data) == 0 || len(data) > 3<<20 {
		return fmt.Errorf("file is invalid or exceeds 3 MB")
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || (format != "jpeg" && format != "png") {
		return fmt.Errorf("file contents are not a valid JPEG or PNG")
	}
	if config.Width < 64 || config.Height < 64 || config.Width > 2048 || config.Height > 2048 || int64(config.Width)*int64(config.Height) > 4_000_000 {
		return fmt.Errorf("dimensions must be between 64 and 2048 pixels and at most 4 megapixels")
	}
	return nil
}

func ValidateImageAnalysis(value ImageAnalysis) error {
	if strings.TrimSpace(value.Description) == "" || len([]rune(value.Description)) > 700 {
		return fmt.Errorf("description is required and must be at most 700 characters")
	}
	if len(value.Subjects) > 12 || len(value.SafeTextAreas) > 6 {
		return fmt.Errorf("too many subjects or safe text areas")
	}
	if value.CropTolerance != "low" && value.CropTolerance != "medium" && value.CropTolerance != "high" {
		return fmt.Errorf("cropTolerance must be low, medium, or high")
	}
	if math.IsNaN(value.Confidence) || value.Confidence < 0 || value.Confidence > 1 {
		return fmt.Errorf("confidence must be between 0 and 1")
	}
	r := value.FocusRect
	if math.IsNaN(r.X) || math.IsNaN(r.Y) || math.IsNaN(r.Width) || math.IsNaN(r.Height) || r.X < 0 || r.Y < 0 || r.Width <= 0 || r.Height <= 0 || r.X+r.Width > 1.000001 || r.Y+r.Height > 1.000001 {
		return fmt.Errorf("focusRect must be inside normalized image coordinates")
	}
	if !CellsFormRectangle(value.RelevantCells) {
		return fmt.Errorf("relevantCells must form one complete rectangle in the 3 by 2 grid")
	}
	return nil
}

func CellsFormRectangle(cells []string) bool {
	if len(cells) == 0 {
		return false
	}
	seen := map[string]bool{}
	minCol, maxCol, minRow, maxRow := 3, -1, 2, -1
	for _, cell := range cells {
		if len(cell) != 2 || cell[0] < 'A' || cell[0] > 'B' || cell[1] < '1' || cell[1] > '3' || seen[cell] {
			return false
		}
		seen[cell] = true
		row, col := int(cell[0]-'A'), int(cell[1]-'1')
		minCol, maxCol = min(minCol, col), max(maxCol, col)
		minRow, maxRow = min(minRow, row), max(maxRow, row)
	}
	return len(seen) == (maxCol-minCol+1)*(maxRow-minRow+1)
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
