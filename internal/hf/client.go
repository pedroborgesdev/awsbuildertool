package hf

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	token     string
	baseURL   string
	maxTokens int
	http      *http.Client
	mock      bool
	usage     Usage
}

type Usage struct {
	PromptTokens     int
	CompletionTokens int
}

func (c *Client) Usage() Usage { return c.usage }

func NewClient(token, baseURL string, maxTokens int, timeout time.Duration, mock bool) *Client {
	return &Client{
		token:     token,
		baseURL:   strings.TrimRight(baseURL, "/"),
		maxTokens: maxTokens,
		http:      &http.Client{Timeout: timeout},
		mock:      mock,
	}
}

func (c *Client) Configured() bool {
	return c.mock || strings.TrimSpace(c.token) != ""
}

type IconSelection struct {
	ID      string
	Word    string
	Context string
}

func (c *Client) complete(ctx context.Context, model, system, prompt string, temperature float64, maxTokens int) (string, error) {
	if strings.TrimSpace(c.token) == "" {
		return "", errors.New("HF_TOKEN is not configured")
	}

	body := chatRequest{
		Model: model,
		Messages: []message{
			{Role: "system", Content: system},
			{Role: "user", Content: prompt},
		},
		Temperature: temperature,
		MaxTokens:   maxTokens,
		Stream:      false,
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("failed to serialize request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")

	response, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to query Hugging Face: %w", err)
	}
	defer response.Body.Close()

	data, err := io.ReadAll(io.LimitReader(response.Body, 8<<20))
	if err != nil {
		return "", fmt.Errorf("failed to read Hugging Face response: %w", err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", fmt.Errorf("Hugging Face returned %d: %s", response.StatusCode, compact(string(data), 800))
	}

	var decoded chatResponse
	if err := json.Unmarshal(data, &decoded); err != nil {
		return "", fmt.Errorf("invalid Hugging Face response: %w", err)
	}
	c.usage.PromptTokens += decoded.Usage.PromptTokens
	c.usage.CompletionTokens += decoded.Usage.CompletionTokens
	if len(decoded.Choices) == 0 || strings.TrimSpace(decoded.Choices[0].Message.Content) == "" {
		return "", errors.New("the model returned no content")
	}
	if decoded.Choices[0].FinishReason == "length" {
		return "", errors.New("the model exceeded the response limit; reduce the page count or increase HF_MAX_TOKENS")
	}
	return strings.TrimSpace(decoded.Choices[0].Message.Content), nil

}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model       string    `json:"model"`
	Messages    []message `json:"messages"`
	Temperature float64   `json:"temperature"`
	MaxTokens   int       `json:"max_tokens"`
	Stream      bool      `json:"stream"`
}

type chatResponse struct {
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	} `json:"usage"`
	Choices []struct {
		FinishReason string  `json:"finish_reason"`
		Message      message `json:"message"`
	} `json:"choices"`
}

func compact(value string, limit int) string {
	value = strings.Join(strings.Fields(value), " ")
	if len(value) <= limit {
		return value
	}
	return value[:limit] + "…"
}
