package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	logmate "github.com/loghill-oss/logmate-clients/logmate-client-go"

	"github.com/pedroborges/universal-post-creator/internal/config"
	"github.com/pedroborges/universal-post-creator/internal/httpapi"
)

func main() {
	if err := config.LoadDotEnv(".env"); err != nil {
		fmt.Fprintf(os.Stderr, "failed to load .env: %v\n", err)
		os.Exit(1)
	}
	cfg := config.Load()
	level := slog.LevelInfo
	if cfg.Debug {
		level = slog.LevelDebug
	}
	logger := logmate.Instrument(logmate.Config{Level: level})
	defer logger.Close()
	defer logger.RecoverPanic()

	app := httpapi.New(cfg, logger)

	server := &http.Server{
		Addr:    cfg.Addr,
		Handler: app.Handler(),
	}

	go func() {
		defer logger.RecoverPanic()
		logger.Info(fmt.Sprintf("server started address=%s model=%s mock=%t", cfg.Addr, cfg.HFModel, cfg.MockHF))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error(fmt.Sprintf("server stopped unexpectedly error=%v", err))
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		logger.Error(fmt.Sprintf("graceful shutdown failed error=%v", err))
	}
}
