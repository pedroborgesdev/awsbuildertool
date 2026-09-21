package render

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

func TestCollectFilesFindsSupportedOutputs(t *testing.T) {
	dir := t.TempDir()
	output := filepath.Join(dir, "output")
	if err := os.MkdirAll(output, 0o700); err != nil {
		t.Fatal(err)
	}
	for name, content := range map[string]string{
		"post-02.png": "two",
		"post-01.png": "one",
		"posts.pdf":   "pdf",
		"notes.txt":   "ignored",
	} {
		if err := os.WriteFile(filepath.Join(output, name), []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	files, err := collectFiles(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 3 {
		t.Fatalf("arquivos = %+v", files)
	}
	if files[0].Name != "output/post-01.png" || files[2].Name != "output/posts.pdf" {
		t.Fatalf("ordem inesperada: %+v", files)
	}
}

func TestLimitedBufferCapsCapturedLog(t *testing.T) {
	buffer := &limitedBuffer{limit: 5}
	written, err := buffer.Write([]byte("123456789"))
	if err != nil || written != 9 {
		t.Fatalf("Write = %d, %v", written, err)
	}
	if got := buffer.String(); got[:5] != "12345" {
		t.Fatalf("content = %q", got)
	}
}

func TestRunnerExecutesPillowScript(t *testing.T) {
	if _, err := exec.LookPath("python3"); err != nil {
		t.Skip("python3 unavailable")
	}
	generated := t.TempDir()
	design := t.TempDir()
	runner := NewRunner(generated, design, "python3", 10*time.Second)
	result, err := runner.Render(context.Background(), `from pathlib import Path
from PIL import Image, ImageFont
output = Path(__file__).resolve().parent / "output"
output.mkdir(parents=True, exist_ok=True)
font = ImageFont.load_default()
width, height = font.getsize("compatibilidade")
assert width > 0 and height > 0
Image.new("RGB", (32, 32), "#00E582").save(output / "post-01.png")
print("ok")
`)
	if err != nil {
		t.Fatalf("rendering failed (%s): %v\n%s", runner.Status().Mode, err, result.Log)
	}
	if len(result.Files) != 1 || result.Files[0].Name != "output/post-01.png" {
		t.Fatalf("arquivos = %+v", result.Files)
	}
}

func TestRunnerBlocksNetworkModules(t *testing.T) {
	if _, err := exec.LookPath("python3"); err != nil {
		t.Skip("python3 unavailable")
	}
	runner := NewRunner(t.TempDir(), t.TempDir(), "python3", 10*time.Second)
	result, err := runner.Render(context.Background(), "import socket\nprint(socket.gethostname())\n")
	if err == nil {
		t.Fatal("expected network module to be blocked")
	}
	if result.Log == "" {
		t.Fatal("expected a log explaining the block")
	}
}
