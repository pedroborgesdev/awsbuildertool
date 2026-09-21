package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotEnv(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	content := "# comment\nDOTENV_SIMPLE=value\nexport DOTENV_QUOTED=\"value with spaces\"\nDOTENV_INLINE=active # comment\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"DOTENV_SIMPLE", "DOTENV_QUOTED", "DOTENV_INLINE"} {
		t.Cleanup(func() { _ = os.Unsetenv(key) })
	}
	if err := LoadDotEnv(path); err != nil {
		t.Fatal(err)
	}
	if got := os.Getenv("DOTENV_SIMPLE"); got != "value" {
		t.Fatalf("DOTENV_SIMPLE = %q", got)
	}
	if got := os.Getenv("DOTENV_QUOTED"); got != "value with spaces" {
		t.Fatalf("DOTENV_QUOTED = %q", got)
	}
	if got := os.Getenv("DOTENV_INLINE"); got != "active" {
		t.Fatalf("DOTENV_INLINE = %q", got)
	}
}

func TestLoadDotEnvDoesNotOverrideExistingEnvironment(t *testing.T) {
	t.Setenv("DOTENV_PRIORITY", "shell")
	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte("DOTENV_PRIORITY=file\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := LoadDotEnv(path); err != nil {
		t.Fatal(err)
	}
	if got := os.Getenv("DOTENV_PRIORITY"); got != "shell" {
		t.Fatalf("existing variable was replaced: %q", got)
	}
}

func TestLoadDotEnvAllowsMissingFile(t *testing.T) {
	if err := LoadDotEnv(filepath.Join(t.TempDir(), "missing.env")); err != nil {
		t.Fatalf("missing file should be optional: %v", err)
	}
}

func TestLoadDotEnvRejectsInvalidLine(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte("malformed line\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := LoadDotEnv(path); err == nil {
		t.Fatal("expected an error for an invalid line")
	}
}
