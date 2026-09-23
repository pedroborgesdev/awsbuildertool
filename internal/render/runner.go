package render

import (
	"bytes"
	"context"
	"crypto/rand"
	_ "embed"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const (
	maxLogBytes    = 64 << 10
	maxOutputFiles = 50
	maxOutputBytes = 250 << 20
)

type File struct {
	Name      string
	MediaType string
}

type Result struct {
	JobID string
	Files []File
	Log   string
}

type Status struct {
	Ready bool
	Mode  string
}

type Renderer interface {
	Render(context.Context, string) (Result, error)
	Status() Status
}

type Runner struct {
	generatedDir string
	designDir    string
	pythonBin    string
	bwrapPath    string
	pythonPath   string
}

func NewRunner(generatedDir, designDir, pythonBin string) *Runner {
	bwrapPath, _ := exec.LookPath("bwrap")
	pythonPath, _ := exec.LookPath(pythonBin)
	if bwrapPath != "" && !bubblewrapWorks(bwrapPath) {
		bwrapPath = ""
	}
	return &Runner{
		generatedDir: generatedDir,
		designDir:    designDir,
		pythonBin:    pythonBin,
		bwrapPath:    bwrapPath,
		pythonPath:   pythonPath,
	}
}

func (r *Runner) Status() Status {
	if r.pythonPath != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if err := exec.CommandContext(ctx, r.pythonPath, "-I", "-c", "from PIL import Image, ImageDraw, ImageFont; import cairosvg").Run(); err != nil {
			return Status{Ready: false, Mode: "Python found, but Pillow or CairoSVG is unavailable"}
		}
	}
	if r.bwrapPath != "" {
		return Status{Ready: true, Mode: "bubblewrap"}
	}
	if r.pythonPath != "" {
		return Status{Ready: true, Mode: "Python audit guard"}
	}
	return Status{Ready: false, Mode: "Python not found"}
}

func (r *Runner) Render(parent context.Context, script string) (Result, error) {
	status := r.Status()
	if !status.Ready {
		return Result{}, errors.New("renderer unavailable: install Python 3 and Pillow")
	}
	jobID, err := randomID()
	if err != nil {
		return Result{}, fmt.Errorf("could not create job identifier: %w", err)
	}
	jobDir, err := filepath.Abs(filepath.Join(r.generatedDir, jobID))
	if err != nil {
		return Result{}, fmt.Errorf("invalid output path: %w", err)
	}
	if err := os.MkdirAll(jobDir, 0o700); err != nil {
		return Result{}, fmt.Errorf("could not create render directory: %w", err)
	}
	scriptPath := filepath.Join(jobDir, "generate_posts.py")
	if err := os.WriteFile(scriptPath, []byte(script), 0o600); err != nil {
		return Result{JobID: jobID}, fmt.Errorf("could not save script: %w", err)
	}
	guardPath := filepath.Join(jobDir, "_render_guard.py")
	if err := os.WriteFile(guardPath, auditGuard, 0o600); err != nil {
		return Result{JobID: jobID}, fmt.Errorf("could not prepare protected executor: %w", err)
	}

	command, err := r.command(parent, jobDir, scriptPath, guardPath)
	if err != nil {
		return Result{JobID: jobID}, err
	}
	logBuffer := &limitedBuffer{limit: maxLogBytes}
	command.Stdout = logBuffer
	command.Stderr = logBuffer
	runErr := command.Run()

	result := Result{JobID: jobID, Log: logBuffer.String()}
	result.Files, err = collectFiles(jobDir)
	if err != nil {
		return result, err
	}
	if runErr != nil {
		return result, fmt.Errorf("script exited with an error: %w", runErr)
	}
	if len(result.Files) == 0 {
		return result, errors.New("script finished without generating images or a PDF")
	}
	return result, nil
}

func (r *Runner) command(ctx context.Context, jobDir, scriptPath, guardPath string) (*exec.Cmd, error) {
	designDir, err := filepath.Abs(r.designDir)
	if err != nil {
		return nil, fmt.Errorf("invalid design-system path: %w", err)
	}
	if r.pythonPath == "" {
		return nil, fmt.Errorf("Python not found: %s", r.pythonBin)
	}
	pythonPath, err := filepath.Abs(r.pythonPath)
	if err != nil {
		return nil, fmt.Errorf("invalid Python path: %w", err)
	}

	if r.bwrapPath == "" {
		commandName, commandArgs := limitedPythonCommand(pythonPath, guardPath, scriptPath)
		command := exec.CommandContext(ctx, commandName, commandArgs...)
		command.Dir = jobDir
		command.Env = []string{
			"PATH=/usr/bin:/bin",
			"HOME=" + jobDir,
			"RENDER_WORK=" + jobDir,
			"AWS_DESIGN_SYSTEM_DIR=" + designDir,
			"PYTHONDONTWRITEBYTECODE=1",
			"PYTHONNOUSERSITE=1",
		}
		return command, nil
	}

	args := []string{
		"--unshare-all", "--die-with-parent", "--new-session", "--clearenv",
		"--ro-bind", "/usr", "/usr",
		"--dev", "/dev", "--proc", "/proc", "--tmpfs", "/tmp",
		"--bind", jobDir, "/work",
		"--ro-bind", designDir, "/design-system",
		"--chdir", "/work",
		"--setenv", "PATH", "/usr/bin:/bin",
		"--setenv", "HOME", "/work",
		"--setenv", "RENDER_WORK", "/work",
		"--setenv", "AWS_DESIGN_SYSTEM_DIR", "/design-system",
		"--setenv", "PYTHONDONTWRITEBYTECODE", "1",
		"--setenv", "PYTHONNOUSERSITE", "1",
	}
	for _, path := range []string{"/lib", "/lib64", "/etc/fonts", "/var/cache/fontconfig"} {
		if _, err := os.Stat(path); err == nil {
			args = append(args, "--ro-bind", path, path)
		}
	}
	pythonCommand, pythonArgs := limitedPythonCommand(pythonPath, "/work/"+filepath.Base(guardPath), "/work/"+filepath.Base(scriptPath))
	args = append(args, pythonCommand)
	args = append(args, pythonArgs...)
	return exec.CommandContext(ctx, r.bwrapPath, args...), nil
}

func limitedPythonCommand(pythonPath, guardPath, scriptPath string) (string, []string) {
	prlimitPath, err := exec.LookPath("prlimit")
	if err != nil {
		return pythonPath, []string{"-I", guardPath, scriptPath}
	}
	return prlimitPath, []string{
		"--as=1073741824",
		fmt.Sprintf("--fsize=%d", maxOutputBytes+(10<<20)),
		"--nproc=64",
		"--", pythonPath, "-I", guardPath, scriptPath,
	}
}

func bubblewrapWorks(path string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, path,
		"--unshare-all", "--die-with-parent", "--new-session",
		"--ro-bind", "/usr", "/usr", "--dev", "/dev", "/usr/bin/true",
	)
	return command.Run() == nil
}

func collectFiles(jobDir string) ([]File, error) {
	var files []File
	var total int64
	err := filepath.WalkDir(jobDir, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() || entry.Type()&os.ModeSymlink != 0 {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		if ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".webp" && ext != ".pdf" {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		total += info.Size()
		if total > maxOutputBytes {
			return errors.New("os arquivos renderizados excederam 250 MB")
		}
		if len(files) >= maxOutputFiles {
			return fmt.Errorf("rendering exceeded the %d-file limit", maxOutputFiles)
		}
		rel, err := filepath.Rel(jobDir, path)
		if err != nil {
			return err
		}
		mediaType := mime.TypeByExtension(ext)
		if mediaType == "" {
			mediaType = "application/octet-stream"
		}
		files = append(files, File{Name: filepath.ToSlash(rel), MediaType: mediaType})
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("could not catalog rendered files: %w", err)
	}
	sort.Slice(files, func(i, j int) bool { return files[i].Name < files[j].Name })
	return files, nil
}

func randomID() (string, error) {
	data := make([]byte, 16)
	if _, err := rand.Read(data); err != nil {
		return "", err
	}
	return hex.EncodeToString(data), nil
}

type limitedBuffer struct {
	buffer bytes.Buffer
	limit  int
}

func (w *limitedBuffer) Write(data []byte) (int, error) {
	originalLength := len(data)
	remaining := w.limit - w.buffer.Len()
	if remaining > 0 {
		_, _ = w.buffer.Write(data[:min(remaining, len(data))])
	}
	return originalLength, nil
}

func (w *limitedBuffer) String() string {
	value := w.buffer.String()
	if w.buffer.Len() >= w.limit {
		value += "\n… log limitado a 64 KiB"
	}
	return value
}

var _ io.Writer = (*limitedBuffer)(nil)

//go:embed python/audit_guard.py
var auditGuard []byte
