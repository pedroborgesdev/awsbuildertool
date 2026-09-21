package render

import (
	"bytes"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image/png"
	"os"
	"path/filepath"
	"regexp"

	"github.com/pedroborges/universal-post-creator/internal/domain"
)

//go:embed python/engine.py
var engine string

func BuildScript(draft domain.CampaignDraft) (string, error) {
	if err := draft.Validate(); err != nil {
		return "", err
	}
	data, err := json.Marshal(draft)
	if err != nil {
		return "", err
	}
	// Base64 keeps user text exclusively in data, including quotes and Python-like strings.
	return "CAMPAIGN_B64 = \"" + base64.StdEncoding.EncodeToString(data) + "\"\n" + engine, nil
}

// ValidateArtifacts independently verifies the files produced by the trusted engine.
func ValidateArtifacts(root string, result Result, draft domain.CampaignDraft) ([]domain.GeneratedAsset, error) {
	output := filepath.Join(root, result.JobID, "output")
	format := domain.Formats[draft.Brief.Platform]
	if len(result.Files) != len(draft.Pages)+2 {
		return nil, fmt.Errorf("export contract: expected %d visual files, received %d", len(draft.Pages)+2, len(result.Files))
	}
	assets := make([]domain.GeneratedAsset, 0, len(result.Files))
	for i := 0; i < len(draft.Pages)+2; i++ {
		name, kind := fmt.Sprintf("page-%02d.png", i+1), "page"
		if i == len(draft.Pages) {
			name, kind = "preview.png", "preview"
		}
		if i == len(draft.Pages)+1 {
			name, kind = "campaign.pdf", "document"
		}
		data, err := os.ReadFile(filepath.Join(output, name))
		if err != nil {
			return nil, fmt.Errorf("required file is missing: %s", name)
		}
		asset := domain.GeneratedAsset{Name: "output/" + name, Kind: kind, MediaType: "image/png"}
		if kind == "document" {
			asset.MediaType = "application/pdf"
			pages := regexp.MustCompile(`/Type\s*/Page\b`).FindAll(data, -1)
			if !bytes.HasPrefix(data, []byte("%PDF-")) || len(pages) != len(draft.Pages) {
				return nil, fmt.Errorf("invalid PDF or incorrect page count")
			}
		} else {
			img, err := png.Decode(bytes.NewReader(data))
			if err != nil {
				return nil, fmt.Errorf("invalid PNG: %s", name)
			}
			asset.Width, asset.Height = img.Bounds().Dx(), img.Bounds().Dy()
			if kind == "page" && (asset.Width != format.Width || asset.Height != format.Height) {
				return nil, fmt.Errorf("invalid dimensions in %s: %dx%d", name, asset.Width, asset.Height)
			}
			if asset.Width < 1 || asset.Height < 1 {
				return nil, fmt.Errorf("invalid preview")
			}
			if kind == "preview" {
				cols := min(3, len(draft.Pages))
				rows := (len(draft.Pages) + cols - 1) / cols
				thumbHeight := int(float64(format.Height)*270/float64(format.Width) + 0.5)
				if asset.Width != cols*286+16 || asset.Height != rows*(thumbHeight+16)+16 {
					return nil, fmt.Errorf("invalid preview dimensions")
				}
			}
		}
		assets = append(assets, asset)
	}
	return assets, nil
}
