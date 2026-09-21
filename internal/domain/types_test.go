package domain

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"testing"
)

func validRequest() GenerateRequest {
	return GenerateRequest{
		Theme:     "CI/CD na AWS",
		Goal:      "Teach the continuous delivery flow",
		Platform:  "instagram-portrait",
		PostCount: 5,
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

func TestValidateAcceptsKnownFormat(t *testing.T) {
	r := validRequest()
	r.Normalize("modelo/padrao")
	if err := r.Validate(); err != nil {
		t.Fatalf("valid request rejected: %v", err)
	}
}
