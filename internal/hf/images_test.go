package hf

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/pedroborges/universal-post-creator/internal/domain"
)

func testExternalImage(t *testing.T) domain.ExternalImage {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 640, 480))
	for y := 0; y < 480; y++ {
		for x := 0; x < 640; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x % 255), G: uint8(y % 255), B: 180, A: 255})
		}
	}
	var output bytes.Buffer
	if err := jpeg.Encode(&output, img, &jpeg.Options{Quality: 85}); err != nil {
		t.Fatal(err)
	}
	return domain.ExternalImage{ID: "image-1", Name: "person.jpg", DataURL: "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(output.Bytes())}
}

func TestGriddedImageIsValidAndLabeled(t *testing.T) {
	value, err := griddedDataURL(testExternalImage(t).DataURL)
	if err != nil {
		t.Fatal(err)
	}
	parts := strings.SplitN(value, ",", 2)
	data, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := jpeg.Decode(bytes.NewReader(data))
	if err != nil || decoded.Bounds().Dx() != 640 || decoded.Bounds().Dy() != 480 {
		t.Fatalf("invalid gridded image: %v", err)
	}
	r, g, b, _ := decoded.At(640/3, 40).RGBA()
	if r <= g || b <= g {
		t.Fatal("vertical magenta grid line is missing")
	}
}

func TestVisionAnalysisUsesGemmaCompatibleImageMessageAndClosesRectangle(t *testing.T) {
	client := NewClient("secret", "https://example.invalid/v1", 1000, time.Second, false)
	client.http.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		var request visionRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		if request.Model != "google/gemma-3-12b-it" || len(request.Messages) != 1 || len(request.Messages[0].Content) != 3 {
			t.Fatalf("unexpected vision request: %#v", request)
		}
		if request.Messages[0].Content[1].ImageURL == nil || request.Messages[0].Content[2].ImageURL == nil || !strings.HasPrefix(request.Messages[0].Content[2].ImageURL.URL, "data:image/jpeg;base64,") {
			t.Fatal("gridded image was not sent as an image_url data URL")
		}
		answer := `{"description":"A smiling person on the left.","subjects":["person"],"mood":"positive","composition":"subject left, open space right","relevantCells":["A1","B2"],"focusRect":{"x":0.05,"y":0.1,"width":0.55,"height":0.8},"safeTextAreas":["right side"],"cropTolerance":"medium","confidence":0.92}`
		data, _ := json.Marshal(map[string]any{"choices": []any{map[string]any{"message": map[string]string{"content": answer}, "finish_reason": "stop"}}})
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(string(data)))}, nil
	})
	images, err := client.AnalyzeImages(context.Background(), "google/gemma-3-12b-it", []domain.ExternalImage{testExternalImage(t)})
	if err != nil {
		t.Fatal(err)
	}
	if got := images[0].Analysis.RelevantCells; strings.Join(got, ",") != "A1,A2,B1,B2" {
		t.Fatalf("rectangle was not closed: %v", got)
	}
	if images[0].Analysis.Description == "" || images[0].Analysis.FocusRect.Width != .55 {
		t.Fatalf("analysis was not preserved: %#v", images[0].Analysis)
	}
}
