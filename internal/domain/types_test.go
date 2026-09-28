package domain

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"strings"
	"testing"
)

func validRequest() GenerateRequest {
	return GenerateRequest{
		Theme:             "CI/CD na AWS",
		Goal:              "Teach the continuous delivery flow",
		Platform:          "instagram-portrait",
		PostCount:         5,
		AdditionalContext: strings.Repeat("a", 400),
	}
}

func TestNormalizeAppliesDefaults(t *testing.T) {
	r := validRequest()
	r.Normalize("model/default")
	if r.Language != "English" || r.Tone == "" || r.Audience == "" {
		t.Fatalf("defaults were not applied: %+v", r)
	}
	if r.Model != "model/default" {
		t.Fatalf("model = %q", r.Model)
	}
	if r.ContentLevel != "balanced" {
		t.Fatalf("content level = %q", r.ContentLevel)
	}
	if r.ColorTheme != "colorful" {
		t.Fatalf("color theme = %q", r.ColorTheme)
	}
	if r.PageTheme != "both" {
		t.Fatalf("page appearance = %q", r.PageTheme)
	}
}

func TestValidateVisualIdentity(t *testing.T) {
	r := validRequest()
	r.Normalize("model/default")
	r.UseAboutFooter = true
	r.AboutName = "Pedro Borges"
	r.AboutSubtitle = "Cloud Engineer"
	r.ColorTheme = "purple"
	if err := r.Validate(); err != nil {
		t.Fatalf("valid visual identity rejected: %v", err)
	}
	r.ColorTheme = "preto"
	if err := r.Validate(); err == nil {
		t.Fatal("expected an error for a color outside the palette")
	}
	r.ColorTheme = "purple"
	r.PageTheme = "sepia"
	if err := r.Validate(); err == nil {
		t.Fatal("expected an error for unknown appearance")
	}
}

func TestValidateAboutPhotoRequiresSquare1080(t *testing.T) {
	encode := func(size int) string {
		img := image.NewRGBA(image.Rect(0, 0, size, size))
		img.Set(0, 0, color.RGBA{R: 66, G: 180, B: 255, A: 255})
		var data bytes.Buffer
		if err := png.Encode(&data, img); err != nil {
			t.Fatal(err)
		}
		return "data:image/png;base64," + base64.StdEncoding.EncodeToString(data.Bytes())
	}
	r := validRequest()
	r.Normalize("modelo/padrao")
	r.AboutPhoto = encode(1080)
	if err := r.Validate(); err != nil {
		t.Fatalf("foto 1080×1080 rejeitada: %v", err)
	}
	r.AboutPhoto = encode(512)
	if err := r.Validate(); err == nil {
		t.Fatal("foto fora de 1080×1080 foi aceita")
	}
}

func TestValidateRejectsUnknownContentLevel(t *testing.T) {
	r := validRequest()
	r.Normalize("modelo/padrao")
	r.ContentLevel = "gigante"
	if err := r.Validate(); err == nil {
		t.Fatal("expected an error for unknown content level")
	}
}

func TestValidateRejectsInvalidCount(t *testing.T) {
	r := validRequest()
	r.PostCount = 11
	if err := r.Validate(); err == nil {
		t.Fatal("expected an error for more than 10 pages")
	}
}

func TestValidateRequiresAtLeastOnePagePerContentImage(t *testing.T) {
	r := validRequest()
	r.PostCount = 1
	r.Images = []ExternalImage{
		{ID: "image-1", Name: "one.png", DataURL: validContentImageDataURL(t)},
		{ID: "image-2", Name: "two.png", DataURL: validContentImageDataURL(t)},
	}
	if err := r.Validate(); err == nil || !strings.Contains(err.Error(), "page count") {
		t.Fatalf("expected page-count error, got %v", err)
	}
}

func TestValidateAcceptsKnownFormat(t *testing.T) {
	r := validRequest()
	r.Normalize("modelo/padrao")
	if err := r.Validate(); err != nil {
		t.Fatalf("valid request rejected: %v", err)
	}
}

func TestValidateContextMinimum(t *testing.T) {
	r := validRequest()
	r.Normalize("modelo/padrao")
	r.AdditionalContext = strings.Repeat("a", 199)
	if err := r.Validate(); err == nil {
		t.Fatal("expected an error for context shorter than 200 characters")
	}
	r.AdditionalContext = strings.Repeat("a", 200)
	if err := r.Validate(); err != nil {
		t.Fatalf("200-character context rejected: %v", err)
	}
}

func TestRelevantImageCellsMustFormRectangle(t *testing.T) {
	for _, cells := range [][]string{{"A1"}, {"A1", "A2", "B1", "B2"}, {"A2", "A3"}, {"A1", "A2", "A3", "B1", "B2", "B3"}} {
		if !CellsFormRectangle(cells) {
			t.Fatalf("valid rectangle rejected: %v", cells)
		}
	}
	for _, cells := range [][]string{{}, {"A1", "B2"}, {"A1", "A3"}, {"C1"}, {"A1", "A1"}} {
		if CellsFormRectangle(cells) {
			t.Fatalf("invalid rectangle accepted: %v", cells)
		}
	}
}

func validContentImageDataURL(t *testing.T) string {
	t.Helper()
	var data bytes.Buffer
	if err := png.Encode(&data, image.NewRGBA(image.Rect(0, 0, 64, 64))); err != nil {
		t.Fatal(err)
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(data.Bytes())
}
