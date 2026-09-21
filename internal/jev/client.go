package jev

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"
)

const maxChoiceOptions = 255

type Client struct {
	apiKey  string
	baseURL string
	model   string
	http    *http.Client
	usage   Usage
}

type Usage struct {
	InputTokens  int
	OutputTokens int
}

func (c *Client) Usage() Usage { return c.usage }

type Selection struct {
	ID      string
	Word    string
	Context string
}

func NewClient(apiKey, baseURL, model string, timeout time.Duration) *Client {
	return &Client{apiKey: strings.TrimSpace(apiKey), baseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"), model: strings.TrimSpace(model), http: &http.Client{Timeout: timeout}}
}

func (c *Client) Configured() bool { return c.apiKey != "" }

func (c *Client) SelectIcon(ctx context.Context, selection Selection, iconNames []string) (string, error) {
	icons, err := c.SelectIcons(ctx, []Selection{selection}, iconNames)
	if err != nil {
		return "", err
	}
	return icons[selection.ID], nil
}

type request struct {
	State     map[string]string         `json:"state"`
	Model     string                    `json:"model"`
	Questions map[string]choiceQuestion `json:"questions"`
}

type choiceQuestion struct {
	Type         string            `json:"type"`
	Instructions string            `json:"instructions"`
	Criteria     map[string]string `json:"criteria"`
}

type response struct {
	Usage struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
	Answers map[string]struct {
		Choice string `json:"choice"`
	} `json:"answers"`
}

func (c *Client) SelectIcons(ctx context.Context, selections []Selection, iconNames []string) (map[string]string, error) {
	if len(selections) == 0 {
		return map[string]string{}, nil
	}
	if !c.Configured() {
		return nil, errors.New("TYPESAFE_API_KEY is not configured")
	}
	if len(iconNames) == 0 {
		return nil, errors.New("icon catalog is empty")
	}

	criteriaGroups := splitCriteria(iconNames)
	questions := make(map[string]choiceQuestion, len(selections)*len(criteriaGroups))
	for _, selection := range selections {
		for groupIndex, group := range criteriaGroups {
			questions[questionID(selection.ID, groupIndex)] = choiceQuestion{
				Type:         "choice",
				Instructions: "Which icon best visually represents the word in the state? Judge by immediate semantic and visual association.",
				Criteria:     describeIcons(group),
			}
		}
	}
	firstRound, err := c.evaluate(ctx, selections[0].state(), questions)
	if err != nil {
		return nil, err
	}

	finalQuestions := make(map[string]choiceQuestion, len(selections))
	for _, selection := range selections {
		finalists := make(map[string]string)
		for groupIndex := range criteriaGroups {
			choice := firstRound[questionID(selection.ID, groupIndex)]
			if choice != "" {
				finalists[choice] = describeIcon(choice)
			}
		}
		if len(finalists) == 0 {
			return nil, fmt.Errorf("Jev returned no candidates for %q", selection.Word)
		}
		finalQuestions[selection.ID] = choiceQuestion{
			Type:         "choice",
			Instructions: "Which icon best visually represents the word in the state? Judge by immediate semantic and visual association.",
			Criteria:     finalists,
		}
	}
	finalRound, err := c.evaluate(ctx, selections[0].state(), finalQuestions)
	if err != nil {
		return nil, err
	}
	result := make(map[string]string, len(selections))
	for _, selection := range selections {
		choice := finalRound[selection.ID]
		if choice == "" {
			return nil, fmt.Errorf("Jev returned no icon for %q", selection.Word)
		}
		result[selection.ID] = choice
	}
	return result, nil
}

func (s Selection) state() map[string]string {
	return map[string]string{"word": s.Word, "context": s.Context}
}

func (c *Client) evaluate(ctx context.Context, state map[string]string, questions map[string]choiceQuestion) (map[string]string, error) {
	payload, err := json.Marshal(request{State: state, Model: c.model, Questions: questions})
	if err != nil {
		return nil, fmt.Errorf("failed to serialize Jev request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to create Jev request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query Jev: %w", err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, fmt.Errorf("failed to read Jev response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("TypeSafe respondeu %d: %s", resp.StatusCode, compact(string(data), 800))
	}
	var decoded response
	if err := json.Unmarshal(data, &decoded); err != nil {
		return nil, fmt.Errorf("invalid Jev response: %w", err)
	}
	c.usage.InputTokens += decoded.Usage.InputTokens
	c.usage.OutputTokens += decoded.Usage.OutputTokens
	result := make(map[string]string, len(decoded.Answers))
	for id, answer := range decoded.Answers {
		result[id] = strings.TrimSpace(answer.Choice)
	}
	return result, nil
}

func splitCriteria(names []string) [][]string {
	groups := make([][]string, 0, (len(names)+maxChoiceOptions-1)/maxChoiceOptions)
	for start := 0; start < len(names); start += maxChoiceOptions {
		end := start + maxChoiceOptions
		if end > len(names) {
			end = len(names)
		}
		group := append([]string(nil), names[start:end]...)
		sort.Strings(group)
		groups = append(groups, group)
	}
	return groups
}

func describeIcons(names []string) map[string]string {
	criteria := make(map[string]string, len(names))
	for _, name := range names {
		criteria[name] = describeIcon(name)
	}
	return criteria
}

func describeIcon(name string) string {
	descriptions := map[string]string{
		"database": "Database cylinder icon. Represents structured data, databases and persistent data storage.",
		"box":      "Box icon. Represents containers, packages or grouped physical/digital items.",
		"kit":      "Toolkit icon. Represents a collection of tools or utilities.",
		"folder":   "Folder icon. Represents files, documents and file organization.",
		"cloud":    "Cloud icon. Represents cloud storage, remote storage and cloud infrastructure.",
		"archive":  "Archive box icon. Represents archived, historical or stored files.",
	}
	if description, ok := descriptions[name]; ok {
		return description
	}
	return "Pixelart icon named " + strings.ReplaceAll(name, "-", " ") + ". Choose it only when its immediate visual meaning fits the word."
}

func questionID(selectionID string, groupIndex int) string {
	return fmt.Sprintf("%s_group_%d", selectionID, groupIndex)
}

func compact(value string, limit int) string {
	value = strings.Join(strings.Fields(value), " ")
	if len(value) <= limit {
		return value
	}
	return value[:limit] + "..."
}
