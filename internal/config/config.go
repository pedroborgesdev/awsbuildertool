package config

import (
	"os"
	"strconv"
)

type Config struct {
	Addr            string
	Debug           bool
	HFToken         string
	HFBaseURL       string
	HFModel         string
	HFMaxTokens     int
	TypeSafeAPIKey  string
	TypeSafeBaseURL string
	TypeSafeModel   string
	IconSelector    string
	DesignSystemDir string
	WebDist         string
	MockHF          bool
	GeneratedDir    string
	PythonBin       string
	HFInputCost     float64
	HFOutputCost    float64
	JevInputCost    float64
	JevOutputCost   float64
}

func Load() Config {
	return Config{
		Addr:            env("APP_ADDR", ":8080"),
		Debug:           envBool("DEBUG", false),
		HFInputCost:     envFloat("HF_INPUT_COST_PER_MILLION_USD", 0.132),
		HFOutputCost:    envFloat("HF_OUTPUT_COST_PER_MILLION_USD", 0.528),
		JevInputCost:    envFloat("JEV_INPUT_COST_PER_MILLION_USD", 0.042),
		JevOutputCost:   envFloat("JEV_OUTPUT_COST_PER_MILLION_USD", 0.042),
		HFToken:         os.Getenv("HF_TOKEN"),
		HFBaseURL:       env("HF_BASE_URL", "https://router.huggingface.co/v1"),
		HFModel:         env("HF_MODEL", "openai/gpt-oss-120b:fastest"),
		HFMaxTokens:     envInt("HF_MAX_TOKENS", 12000),
		TypeSafeAPIKey:  os.Getenv("TYPESAFE_API_KEY"),
		TypeSafeBaseURL: env("TYPESAFE_BASE_URL", "https://api.typesafe.ai/v1/systemone"),
		TypeSafeModel:   env("TYPESAFE_MODEL", "jev-latest"),
		IconSelector:    env("ICON_SELECTOR", "jev"),
		DesignSystemDir: env("DESIGN_SYSTEM_DIR", "design_system"),
		WebDist:         env("WEB_DIST", "web/dist"),
		MockHF:          envBool("MOCK_HF", false),
		GeneratedDir:    env("GENERATED_OUTPUT_DIR", "generated"),
		PythonBin:       env("PYTHON_BIN", "python3"),
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(key))
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func envBool(key string, fallback bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func envFloat(key string, fallback float64) float64 {
	value, err := strconv.ParseFloat(os.Getenv(key), 64)
	if err != nil || value < 0 {
		return fallback
	}
	return value
}
