package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	mathrand "math/rand/v2"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

const visitorCookie = "builder_visitor"

type siteStats struct {
	dir           string
	visitorsPath  string
	mu            sync.RWMutex
	images        int
	pageImages    []communityImage
	visitors      int
	recount       chan struct{}
	ready         chan struct{}
	flushVisitors chan struct{}
}

type communityImage struct {
	ID  string `json:"id"`
	URL string `json:"url"`
}

func newSiteStats(dir string) *siteStats {
	stats := &siteStats{
		dir:           dir,
		visitorsPath:  filepath.Join(dir, "visitors.json"),
		recount:       make(chan struct{}, 1),
		ready:         make(chan struct{}),
		flushVisitors: make(chan struct{}, 1),
	}
	stats.visitors = stats.readVisitors()
	go stats.recountLoop()
	go stats.flushLoop()
	stats.scheduleRecount()
	return stats
}

func (s *siteStats) snapshot() (int, int) {
	select {
	case <-s.ready:
	case <-time.After(2 * time.Second):
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.images, s.visitors
}

func (s *siteStats) scheduleRecount() {
	select {
	case s.recount <- struct{}{}:
	default:
	}
}

func (s *siteStats) recountLoop() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()
	ready := false
	for {
		select {
		case <-s.recount:
		case <-ticker.C:
		}
		pageImages := findPageImages(s.dir)
		s.mu.Lock()
		s.images = len(pageImages)
		s.pageImages = pageImages
		s.mu.Unlock()
		if !ready {
			ready = true
			close(s.ready)
		}
	}
}

func (s *siteStats) addVisitor() {
	s.mu.Lock()
	s.visitors++
	s.mu.Unlock()
	select {
	case s.flushVisitors <- struct{}{}:
	default:
	}
}

func (s *siteStats) flushLoop() {
	for range s.flushVisitors {
		s.mu.RLock()
		count := s.visitors
		s.mu.RUnlock()
		s.writeVisitors(count)
	}
}

func (s *siteStats) readVisitors() int {
	data, err := os.ReadFile(s.visitorsPath)
	if err != nil {
		return 0
	}
	var stored struct {
		Visitors int `json:"visitors"`
	}
	if json.Unmarshal(data, &stored) != nil || stored.Visitors < 0 {
		return 0
	}
	return stored.Visitors
}

func (s *siteStats) writeVisitors(count int) {
	if strings.TrimSpace(s.dir) == "" {
		return
	}
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return
	}
	data, err := json.Marshal(struct {
		Visitors int `json:"visitors"`
	}{Visitors: count})
	if err != nil {
		return
	}
	temp := s.visitorsPath + ".tmp"
	if os.WriteFile(temp, data, 0o600) != nil {
		return
	}
	_ = os.Rename(temp, s.visitorsPath)
}

func countPageImages(root string) int {
	return len(findPageImages(root))
}

func findPageImages(root string) []communityImage {
	if strings.TrimSpace(root) == "" {
		return nil
	}
	images := make([]communityImage, 0)
	_ = filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return nil
		}
		name := entry.Name()
		if !strings.HasPrefix(name, "page-") || !strings.HasSuffix(strings.ToLower(name), ".png") {
			return nil
		}
		relative, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}
		parts := strings.Split(filepath.ToSlash(relative), "/")
		if len(parts) != 3 || !jobIDPattern.MatchString(parts[0]) || parts[1] != "output" {
			return nil
		}
		images = append(images, communityImage{
			ID:  parts[0] + "/" + name,
			URL: "/api/jobs/" + parts[0] + "/files/output/" + name,
		})
		return nil
	})
	return images
}

func (s *siteStats) randomCampaignImages(limit int) []communityImage {
	select {
	case <-s.ready:
	case <-time.After(2 * time.Second):
	}
	s.mu.RLock()
	images := append([]communityImage(nil), s.pageImages...)
	s.mu.RUnlock()
	if limit < 1 || limit > 4 {
		limit = 4
	}
	byCampaign := make(map[string][]communityImage)
	campaigns := make([]string, 0)
	for _, image := range images {
		campaignID := strings.SplitN(image.ID, "/", 2)[0]
		if _, exists := byCampaign[campaignID]; !exists {
			campaigns = append(campaigns, campaignID)
		}
		byCampaign[campaignID] = append(byCampaign[campaignID], image)
	}
	mathrand.Shuffle(len(campaigns), func(i, j int) {
		campaigns[i], campaigns[j] = campaigns[j], campaigns[i]
	})
	if len(campaigns) > limit {
		campaigns = campaigns[:limit]
	}
	selected := make([]communityImage, 0)
	for _, campaignID := range campaigns {
		pages := byCampaign[campaignID]
		sort.Slice(pages, func(i, j int) bool { return pages[i].ID < pages[j].ID })
		selected = append(selected, pages...)
	}
	return selected
}

func (s *Server) stats(w http.ResponseWriter, _ *http.Request) {
	images, visitors := s.site.snapshot()
	writeJSON(w, http.StatusOK, map[string]int{"images": images, "visitors": visitors})
}

func (s *Server) communityImages(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string][]communityImage{"images": s.site.randomCampaignImages(4)})
}

func (s *Server) trackVisitors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isPageView(r) {
			if _, err := r.Cookie(visitorCookie); err != nil {
				http.SetCookie(w, newVisitorCookie(r))
				s.site.addVisitor()
			}
		}
		next.ServeHTTP(w, r)
	})
}

func isPageView(r *http.Request) bool {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		return false
	}
	path := r.URL.Path
	if path == "/api" || strings.HasPrefix(path, "/api/") || strings.HasPrefix(path, "/assets/") || strings.HasPrefix(path, "/design-assets/") {
		return false
	}
	if filepath.Ext(path) != "" {
		return false
	}
	accept := r.Header.Get("Accept")
	return accept == "" || strings.Contains(accept, "text/html") || strings.Contains(accept, "*/*")
}

func newVisitorCookie(r *http.Request) *http.Cookie {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		value = [16]byte{}
	}
	return &http.Cookie{
		Name:     visitorCookie,
		Value:    hex.EncodeToString(value[:]),
		Path:     "/",
		MaxAge:   365 * 24 * 60 * 60,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https"),
	}
}
