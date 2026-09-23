package httpapi

import (
	"context"
	cryptorand "crypto/rand"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/pedroborges/universal-post-creator/internal/config"
	"github.com/pedroborges/universal-post-creator/internal/domain"
	"github.com/pedroborges/universal-post-creator/internal/hf"
	"github.com/pedroborges/universal-post-creator/internal/jev"
	"github.com/pedroborges/universal-post-creator/internal/prompt"
	"github.com/pedroborges/universal-post-creator/internal/render"
)

const maxGenerationAttempts = 5

type contentGenerator interface {
	Configured() bool
	GenerateContent(context.Context, domain.GenerateRequest, string) (domain.CampaignDraft, error)
}

type Server struct {
	config  config.Config
	prompt  *prompt.Builder
	hf      contentGenerator
	jev     *jev.Client
	render  render.Renderer
	logger  *slog.Logger
	handler http.Handler
}

func New(cfg config.Config, logger *slog.Logger) *Server {
	if err := domain.LoadIcons(cfg.DesignSystemDir); err != nil {
		logger.Error("failed to load icon catalog", "error", err, "design_system", cfg.DesignSystemDir)
	}
	server := &Server{
		config: cfg,
		prompt: prompt.NewBuilder(cfg.DesignSystemDir),
		hf:     hf.NewClient(cfg.HFToken, cfg.HFBaseURL, cfg.HFMaxTokens, 0, cfg.MockHF),
		jev:    jev.NewClient(cfg.TypeSafeAPIKey, cfg.TypeSafeBaseURL, cfg.TypeSafeModel, 0),
		render: render.NewRunner(cfg.GeneratedDir, cfg.DesignSystemDir, cfg.PythonBin),
		logger: logger,
	}
	server.handler = server.routes()
	return server
}

func (s *Server) Handler() http.Handler { return s.handler }

func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("GET /api/config", s.clientConfig)
	mux.HandleFunc("POST /api/prompt", s.previewPrompt)
	mux.HandleFunc("POST /api/generate", s.generate)
	mux.HandleFunc("POST /api/content", s.generateContent)
	mux.HandleFunc("POST /api/render", s.renderContent)
	mux.HandleFunc("GET /api/jobs/{job}/files/{path...}", s.generatedFile)
	mux.Handle("GET /design-assets/", http.StripPrefix("/design-assets/", http.FileServer(http.Dir(filepath.Join(s.config.DesignSystemDir, "assets")))))
	mux.Handle("/", s.staticHandler())
	return s.middleware(mux)
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) clientConfig(w http.ResponseWriter, _ *http.Request) {
	rendererStatus := s.render.Status()
	writeJSON(w, http.StatusOK, domain.ConfigResponse{
		Model:             s.config.HFModel,
		TokenConfigured:   strings.TrimSpace(s.config.HFToken) != "",
		DesignSystemReady: s.prompt.Ready(),
		MockMode:          s.config.MockHF,
		RendererReady:     rendererStatus.Ready,
		RendererMode:      rendererStatus.Mode,
	})
}

func (s *Server) previewPrompt(w http.ResponseWriter, r *http.Request) {
	request, ok := s.decodeRequest(w, r)
	if !ok {
		return
	}
	productionPrompt, err := s.prompt.Build(request)
	if err != nil {
		s.problem(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, domain.PromptResponse{Prompt: productionPrompt})
}

func (s *Server) generateContent(w http.ResponseWriter, r *http.Request) {
	request, ok := s.decodeRequest(w, r)
	if !ok {
		return
	}
	draft, built, err := s.createDraft(r.Context(), request, "")
	if err != nil {
		s.problem(w, http.StatusUnprocessableEntity, err)
		return
	}
	writeJSON(w, http.StatusOK, domain.ContentResponse{Draft: draft, Prompt: built})
}
func (s *Server) createDraft(ctx context.Context, request domain.GenerateRequest, retryFeedback string) (domain.CampaignDraft, string, error) {
	started := time.Now()
	s.logger.Debug("stage started", "stage", "draft", "post_count", request.PostCount, "retry", retryFeedback != "")
	defer func() { s.logger.Debug("stage finished", "stage", "draft", "duration", time.Since(started)) }()
	if !s.hf.Configured() {
		return domain.CampaignDraft{}, "", errors.New("configure HF_TOKEN or enable MOCK_HF=true")
	}
	if !s.config.MockHF && s.iconSelector() == "jev" && !s.jev.Configured() {
		return domain.CampaignDraft{}, "", errors.New("configure TYPESAFE_API_KEY to select icons with Jev")
	}
	built, err := s.prompt.Build(request)
	if err != nil {
		return domain.CampaignDraft{}, "", err
	}
	s.logger.Debug("stage finished", "stage", "prompt", "duration", time.Since(started), "bytes", len(built))
	if retryFeedback != "" {
		built += "\n\nMANDATORY CORRECTION FOR THIS NEW ATTEMPT:\nThe previous attempt failed because: " + retryFeedback +
			"\nGenerate new editorial content, simplifying it when necessary, that avoids this failure and continues to fully obey the contract."
	}
	draft, err := s.hf.GenerateContent(ctx, request, built)
	if err != nil {
		return draft, built, fmt.Errorf("text generation: %w", err)
	}
	s.logger.Debug("stage finished", "stage", "text generation", "duration", time.Since(started), "pages", len(draft.Pages))
	if !s.config.MockHF {
		if err := s.selectIcons(ctx, &draft); err != nil {
			return draft, built, fmt.Errorf("icon selection: %w", err)
		}
	}
	if err := draft.Validate(); err != nil {
		return draft, built, err
	}
	draft.LayoutSeed = newLayoutSeed()
	return draft, built, nil
}

func (s *Server) selectIcons(ctx context.Context, draft *domain.CampaignDraft) error {
	started := time.Now()
	s.logger.Debug("stage started", "stage", "icon selection", "pages", len(draft.Pages))
	defer func() { s.logger.Debug("stage finished", "stage", "icon selection", "duration", time.Since(started)) }()
	iconNames := domain.IconNames()
	const contextText = "Educational technology graphic. We need to choose the icon that most clearly and immediately represents this word in the state."
	selections := make([]jev.Selection, 0, len(draft.Pages))
	for pageIndex := range draft.Pages {
		page := &draft.Pages[pageIndex]
		selections = append(selections, jev.Selection{ID: fmt.Sprintf("page-%d", pageIndex), Word: page.Title, Context: contextText})
		for itemIndex := range page.Items {
			item := &page.Items[itemIndex]
			selections = append(selections, jev.Selection{ID: fmt.Sprintf("page-%d-item-%d", pageIndex, itemIndex), Word: item.Title, Context: contextText})
		}
	}
	if len(selections) == 0 {
		return nil
	}
	if s.iconSelector() == "hf" {
		client, ok := s.hf.(*hf.Client)
		if !ok {
			return errors.New("HF icon selector is unavailable")
		}
		hfSelections := make([]hf.IconSelection, 0, len(selections))
		for _, selection := range selections {
			hfSelections = append(hfSelections, hf.IconSelection{ID: selection.ID, Word: selection.Word, Context: selection.Context})
		}
		s.logger.Debug("stage started", "stage", "HF icon selection", "selections", len(hfSelections))
		icons, err := client.SelectIcons(ctx, draft.Brief.Model, hfSelections, iconNames)
		if err != nil {
			return err
		}
		return applySelectedIcons(draft, icons)
	}
	// The TypeSafe response limit is reached with more than one selection because
	// every selection expands into several catalog questions and a final round.
	// Keep requests small and rely on the preserved draft when a batch fails.
	const maxBatchSelections = 1
	icons := make(map[string]string, len(selections))
	for start := 0; start < len(selections); start += maxBatchSelections {
		end := min(start+maxBatchSelections, len(selections))
		batch := selections[start:end]
		batchStarted := time.Now()
		s.logger.Debug("stage started", "stage", "Jev batch", "batch", start/maxBatchSelections+1,
			"selections", len(batch), "total", len(selections))
		batchIcons, err := s.jev.SelectIcons(ctx, batch, iconNames)
		if err != nil {
			return err
		}
		for id, icon := range batchIcons {
			icons[id] = icon
		}
		s.logger.Debug("stage finished", "stage", "Jev batch", "batch", start/maxBatchSelections+1,
			"duration", time.Since(batchStarted), "selections", len(batch))
	}
	s.logger.Debug("stage finished", "stage", "icon selection", "duration", time.Since(started), "selections", len(selections))
	return applySelectedIcons(draft, icons)
}

func (s *Server) iconSelector() string {
	if strings.EqualFold(strings.TrimSpace(s.config.IconSelector), "hf") {
		return "hf"
	}
	return "jev"
}

func applySelectedIcons(draft *domain.CampaignDraft, icons map[string]string) error {
	for pageIndex := range draft.Pages {
		page := &draft.Pages[pageIndex]
		pageIcon, ok := icons[fmt.Sprintf("page-%d", pageIndex)]
		if !ok {
			return fmt.Errorf("icon selector returned no icon for page %d", pageIndex+1)
		}
		page.IconIntent = pageIcon
		for itemIndex := range page.Items {
			id := fmt.Sprintf("page-%d-item-%d", pageIndex, itemIndex)
			itemIcon, ok := icons[id]
			if !ok {
				return fmt.Errorf("icon selector returned no icon for %s", id)
			}
			page.Items[itemIndex].IconIntent = itemIcon
		}
	}
	return nil
}

// Compatibility endpoint: same content contract and fixed renderer.
func (s *Server) generate(w http.ResponseWriter, r *http.Request) {
	request, ok := s.decodeRequest(w, r)
	if !ok {
		return
	}
	if !s.hf.Configured() {
		s.problem(w, http.StatusUnprocessableEntity, errors.New("configure HF_TOKEN ou ative MOCK_HF=true"))
		return
	}
	rendererStatus := s.render.Status()
	if !rendererStatus.Ready {
		s.problem(w, http.StatusServiceUnavailable, errors.New(rendererStatus.Mode))
		return
	}
	failures := make([]string, 0, maxGenerationAttempts)
	retryFeedback := ""
	var draft domain.CampaignDraft
	var built string
	hfStartUsage := hf.Usage{}
	if reporter, ok := s.hf.(interface{ Usage() hf.Usage }); ok {
		hfStartUsage = reporter.Usage()
	}
	jevStartUsage := s.jev.Usage()
	for attempt := 1; attempt <= maxGenerationAttempts; attempt++ {
		attemptStarted := time.Now()
		s.logger.Debug("stage started", "stage", "generation attempt", "attempt", attempt, "max_attempts", maxGenerationAttempts)
		var err error
		if len(draft.Pages) == 0 {
			draft, built, err = s.createDraft(r.Context(), request, retryFeedback)
		} else {
			// Keep the editorial draft stable while trying a fresh visual composition.
			// Icon selection may be repeated, but content generation is not.
			if !s.config.MockHF {
				err = s.selectIcons(r.Context(), &draft)
				if err != nil {
					err = fmt.Errorf("icon selection: %w", err)
				}
			}
			draft.LayoutSeed = newLayoutSeed()
		}
		var response domain.GenerateResponse
		if err == nil {
			s.logger.Debug("stage started", "stage", "render pipeline", "attempt", attempt)
			response, err = s.buildAndRender(r.Context(), draft, built)
		}
		if err == nil {
			s.logger.Debug("stage finished", "stage", "generation attempt", "attempt", attempt, "duration", time.Since(attemptStarted))
			if reporter, ok := s.hf.(interface{ Usage() hf.Usage }); ok {
				usage := reporter.Usage()
				response.Cost.HFPromptTokens = usage.PromptTokens - hfStartUsage.PromptTokens
				response.Cost.HFCompletionTokens = usage.CompletionTokens - hfStartUsage.CompletionTokens
				response.Cost.HF = float64(response.Cost.HFPromptTokens)*s.config.HFInputCost/1_000_000 +
					float64(response.Cost.HFCompletionTokens)*s.config.HFOutputCost/1_000_000
			}
			jevUsage := s.jev.Usage()
			response.Cost.JevPromptTokens = jevUsage.InputTokens - jevStartUsage.InputTokens
			response.Cost.JevCompletionTokens = jevUsage.OutputTokens - jevStartUsage.OutputTokens
			if response.Cost.HFPromptTokens > 0 || response.Cost.HFCompletionTokens > 0 {
				response.Cost.HF = float64(response.Cost.HFPromptTokens)*s.config.HFInputCost/1_000_000 +
					float64(response.Cost.HFCompletionTokens)*s.config.HFOutputCost/1_000_000
			}
			if response.Cost.JevPromptTokens > 0 || response.Cost.JevCompletionTokens > 0 {
				response.Cost.Jev = float64(response.Cost.JevPromptTokens)*s.config.JevInputCost/1_000_000 +
					float64(response.Cost.JevCompletionTokens)*s.config.JevOutputCost/1_000_000
			}
			response.Cost.Total = response.Cost.HF + response.Cost.Jev
			response.Cost.Estimated =
				(!s.config.MockHF && response.Cost.HFPromptTokens == 0 && response.Cost.HFCompletionTokens == 0) ||
					(!s.config.MockHF && response.Cost.JevPromptTokens == 0 && response.Cost.JevCompletionTokens == 0) ||
					(response.Cost.HFPromptTokens > 0 && (s.config.HFInputCost == 0 || s.config.HFOutputCost == 0)) ||
					(response.Cost.JevPromptTokens > 0 && (s.config.JevInputCost == 0 || s.config.JevOutputCost == 0))
			writeJSON(w, http.StatusOK, response)
			return
		}
		failure := compactGenerationError(err)
		s.logger.Debug("stage failed", "stage", "generation attempt", "attempt", attempt, "duration", time.Since(attemptStarted), "error", failure)
		if textOverflow(failure) {
			s.logger.Debug("discarding draft", "reason", "text does not fit the format")
			draft = domain.CampaignDraft{}
			retryFeedback = textVolumeFeedback(failure)
		} else if len(draft.Pages) == 0 {
			retryFeedback = failure
		}
		failures = append(failures, fmt.Sprintf("tentativa %d: %s", attempt, failure))
		s.logger.Warn("generation attempt failed", "attempt", attempt, "max_attempts", maxGenerationAttempts, "error", failure)
		if r.Context().Err() != nil {
			break
		}
	}
	s.problem(w, http.StatusUnprocessableEntity,
		fmt.Errorf("generation failed after %d complete attempts: %s", len(failures), strings.Join(failures, " | ")))
}
func (s *Server) renderContent(w http.ResponseWriter, r *http.Request) {
	var draft domain.CampaignDraft
	r.Body = http.MaxBytesReader(w, r.Body, 6<<20)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&draft); err != nil {
		s.problem(w, http.StatusBadRequest, fmt.Errorf("invalid content: %w", err))
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		s.problem(w, http.StatusBadRequest, errors.New("send only one JSON object"))
		return
	}
	draft.Brief.Normalize(s.config.HFModel)
	draft.Normalize()
	s.renderDraft(w, r, draft, "")
}
func (s *Server) renderDraft(w http.ResponseWriter, r *http.Request, draft domain.CampaignDraft, built string) {
	response, err := s.buildAndRender(r.Context(), draft, built)
	if err != nil {
		s.problem(w, http.StatusUnprocessableEntity, err)
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func (s *Server) buildAndRender(ctx context.Context, draft domain.CampaignDraft, built string) (domain.GenerateResponse, error) {
	started := time.Now()
	s.logger.Debug("stage started", "stage", "build and render", "pages", len(draft.Pages), "seed", draft.LayoutSeed)
	defer func() { s.logger.Debug("stage finished", "stage", "build and render", "duration", time.Since(started)) }()
	draft.Normalize()
	if draft.LayoutSeed == 0 {
		draft.LayoutSeed = newLayoutSeed()
	}
	script, err := render.BuildScript(draft)
	if err != nil {
		return domain.GenerateResponse{}, err
	}
	s.logger.Debug("stage finished", "stage", "build script", "duration", time.Since(started), "bytes", len(script))
	rendered, err := s.render.Render(ctx, script)
	if err != nil {
		s.logger.Error("render failed", "job", rendered.JobID, "error", err)
		detail := strings.TrimSpace(rendered.Log)
		if lines := strings.Split(detail, "\n"); len(lines) > 0 {
			detail = lines[len(lines)-1]
		}
		s.cleanupFailedJob(rendered.JobID)
		return domain.GenerateResponse{}, fmt.Errorf("could not build the pages: %v. %s", err, detail)
	}
	s.logger.Debug("stage finished", "stage", "python render", "duration", time.Since(started), "job", rendered.JobID, "files", len(rendered.Files))
	assets, err := render.ValidateArtifacts(s.config.GeneratedDir, rendered, draft)
	if err != nil {
		s.cleanupFailedJob(rendered.JobID)
		return domain.GenerateResponse{}, err
	}
	s.logger.Debug("stage finished", "stage", "artifact validation", "duration", time.Since(started), "assets", len(assets), "job", rendered.JobID)
	for i := range assets {
		assets[i].URL = "/api/jobs/" + rendered.JobID + "/files/" + escapePath(assets[i].Name)
	}
	return domain.GenerateResponse{Draft: draft, Script: script, Prompt: built, Filename: filename(draft.Brief.Theme), Model: draft.Brief.Model, JobID: rendered.JobID, Files: assets, ExecutionLog: rendered.Log,
		Cost: domain.GenerationCost{Currency: "USD"}}, nil
}

func (s *Server) cleanupFailedJob(jobID string) {
	if !jobIDPattern.MatchString(jobID) || strings.TrimSpace(s.config.GeneratedDir) == "" {
		return
	}
	root, err := filepath.Abs(s.config.GeneratedDir)
	if err != nil {
		return
	}
	target := filepath.Join(root, jobID)
	relative, err := filepath.Rel(root, target)
	if err != nil || relative != jobID {
		return
	}
	if err := os.RemoveAll(target); err != nil {
		s.logger.Warn("failed to clean generation attempt", "job", jobID, "error", err)
	}
}

func textOverflow(message string) bool {
	lower := strings.ToLower(message)
	return strings.Contains(lower, "could not be packed") ||
		strings.Contains(lower, "does not fit the grid") ||
		strings.Contains(lower, "text does not fit") ||
		strings.Contains(lower, "shorten the content")
}

func textVolumeFeedback(failure string) string {
	return failure + ". The text is too long for this format. Generate every page again with much less text: shorter titles, shorter body copy, and shorter item text. Keep the same idea and the same number of pages, but cut the volume until each page can be assembled."
}

func compactGenerationError(err error) string {
	value := strings.Join(strings.Fields(err.Error()), " ")
	if len(value) > 360 {
		return value[:360] + "…"
	}
	return value
}

func newLayoutSeed() int64 {
	var value [8]byte
	if _, err := cryptorand.Read(value[:]); err == nil {
		seed := int64(binary.LittleEndian.Uint64(value[:]) & ((1 << 52) - 1))
		if seed != 0 {
			return seed
		}
	}
	return time.Now().UnixNano() & ((1 << 52) - 1)
}

var jobIDPattern = regexp.MustCompile(`^[a-f0-9]{32}$`)

func (s *Server) generatedFile(w http.ResponseWriter, r *http.Request) {
	jobID := r.PathValue("job")
	if !jobIDPattern.MatchString(jobID) {
		http.NotFound(w, r)
		return
	}
	rel := filepath.Clean(filepath.FromSlash(r.PathValue("path")))
	if rel == "." || filepath.IsAbs(rel) || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		http.NotFound(w, r)
		return
	}
	ext := strings.ToLower(filepath.Ext(rel))
	if ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".webp" && ext != ".pdf" {
		http.NotFound(w, r)
		return
	}
	jobDir, err := filepath.Abs(filepath.Join(s.config.GeneratedDir, jobID))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	target, err := filepath.EvalSymlinks(filepath.Join(jobDir, rel))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	inside, err := filepath.Rel(jobDir, target)
	if err != nil || inside == ".." || strings.HasPrefix(inside, ".."+string(filepath.Separator)) {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "private, max-age=3600")
	w.Header().Set("Content-Disposition", "inline")
	http.ServeFile(w, r, target)
}

func (s *Server) decodeRequest(w http.ResponseWriter, r *http.Request) (domain.GenerateRequest, bool) {
	var request domain.GenerateRequest
	r.Body = http.MaxBytesReader(w, r.Body, 6<<20)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		s.problem(w, http.StatusBadRequest, fmt.Errorf("invalid JSON: %w", err))
		return request, false
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		s.problem(w, http.StatusBadRequest, errors.New("send only one JSON object"))
		return request, false
	}
	request.Normalize(s.config.HFModel)
	if err := request.Validate(); err != nil {
		s.problem(w, http.StatusBadRequest, err)
		return request, false
	}
	return request, true
}

var unsafeFilename = regexp.MustCompile(`[^a-z0-9]+`)

func filename(theme string) string {
	name := strings.ToLower(theme)
	name = strings.NewReplacer("\u00e1", "a", "\u00e0", "a", "\u00e3", "a", "\u00e2", "a", "\u00e9", "e", "\u00ea", "e", "\u00ed", "i", "\u00f3", "o", "\u00f4", "o", "\u00f5", "o", "\u00fa", "u", "\u00e7", "c").Replace(name)
	name = strings.Trim(unsafeFilename.ReplaceAllString(name, "-"), "-")
	if name == "" {
		name = "posts"
	}
	if len(name) > 60 {
		name = strings.Trim(name[:60], "-")
	}
	return "generate-" + name + ".py"
}

func escapePath(path string) string {
	parts := strings.Split(filepath.ToSlash(path), "/")
	for index := range parts {
		parts[index] = url.PathEscape(parts[index])
	}
	return strings.Join(parts, "/")
}

func (s *Server) staticHandler() http.Handler {
	index := filepath.Join(s.config.WebDist, "index.html")
	if _, err := os.Stat(index); err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/" {
				writeJSON(w, http.StatusServiceUnavailable, map[string]string{
					"error": "frontend is not built yet; run cd web && npm install && npm run build",
				})
				return
			}
			http.NotFound(w, r)
		})
	}
	files := http.FileServer(http.Dir(s.config.WebDist))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rel := strings.TrimPrefix(filepath.Clean(r.URL.Path), string(filepath.Separator))
		path := filepath.Join(s.config.WebDist, rel)
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			files.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, index)
	})
}

func (s *Server) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
		s.logger.Info("request", "method", r.Method, "path", r.URL.Path, "duration", time.Since(started))
	})
}

func (s *Server) problem(w http.ResponseWriter, status int, err error) {
	s.logger.Error("request failed", "status", status, "error", err)
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
