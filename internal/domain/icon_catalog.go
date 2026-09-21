package domain

import (
	"fmt"
	"io/fs"
	"path/filepath"
	"strings"
)

// Icons is populated from the SVG files in the configured design system.
var Icons = map[string]bool{}
var iconFiles = map[string]string{}

var iconAliases = map[string]string{
	"audio":       "audio-waveform",
	"brackets":    "code",
	"chat":        "message",
	"chip":        "cpu",
	"community":   "users",
	"connector":   "link",
	"droplet":     "circle",
	"hashtag":     "hash",
	"lightning":   "zap",
	"play-target": "target",
}

func init() {
	for _, dir := range []string{"design_system", "../../design_system"} {
		if err := LoadIcons(dir); err == nil {
			break
		}
	}
}

// LoadIcons discovers every SVG under designSystemDir/icon_sources.
// The file name, without its extension, is the icon intent consumed by drafts.
func LoadIcons(designSystemDir string) error {
	root := filepath.Join(designSystemDir, "icon_sources")
	names := make(map[string]bool)
	files := make(map[string]string)
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || strings.ToLower(filepath.Ext(entry.Name())) != ".svg" {
			return nil
		}
		name := strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name()))
		if name == "" {
			return nil
		}
		names[name] = true
		files[name] = path
		return nil
	})
	if err != nil {
		return fmt.Errorf("could not read icon catalog at %s: %w", root, err)
	}
	if len(names) == 0 {
		return fmt.Errorf("no SVG files found in %s", root)
	}
	for alias, target := range iconAliases {
		if names[target] {
			names[alias] = true
			files[alias] = files[target]
		}
	}
	Icons = names
	iconFiles = files
	return nil
}

func IconCatalogReady() bool { return len(Icons) > 0 }

func IconPath(designSystemDir, name string) (string, error) {
	if !Icons[name] {
		return "", fmt.Errorf("invalid icon: %s", name)
	}
	if path, ok := iconFiles[name]; ok {
		return path, nil
	}
	return "", fmt.Errorf("icon file not found: %s", name)
}
