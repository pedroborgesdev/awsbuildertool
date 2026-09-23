package hf

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"unicode"
)

const iconBatchSize = 10

// describedIcons is the set the model is allowed to choose from.
// Near-duplicate arrows, badges, and solid variants stay out: they made the
// previous full-catalog prompt pick an icon that does not depict the idea.
var describedIcons = []iconChoice{
	{"database", "database cylinder, stored data", []string{"database", "storage", "sql", "dados", "banco", "datos", "daten"}},
	{"server", "server, compute instance", []string{"server", "compute", "instance", "servidor", "instancia", "serveur"}},
	{"cloud", "cloud, remote infrastructure", []string{"cloud", "serverless", "nuvem", "nube", "nuage", "wolke"}},
	{"shield", "shield, security, protection", []string{"security", "secure", "protection", "compliance", "seguranca", "seguridad", "securite", "sicherheit", "protecao"}},
	{"lock", "padlock, private access", []string{"lock", "locked", "private", "privacy", "secret", "cadeado", "privado", "privacidade", "verrou"}},
	{"key", "key, credential, password", []string{"key", "credential", "password", "token", "chave", "credencial", "senha", "contrasena"}},
	{"bug", "insect, software bug", []string{"bug", "defect", "erro", "error", "falha", "fallo", "erreur", "fehler"}},
	{"terminal", "terminal, command line", []string{"terminal", "shell", "console", "command", "comando", "consola"}},
	{"code", "source code", []string{"code", "coding", "source", "codigo", "codigo fuente"}},
	{"git-branch", "git branch, version control", []string{"git", "branch", "version", "versao", "rama", "branche"}},
	{"git-pull-request", "pull request, code review", []string{"pull request", "revisao", "review"}},
	{"github", "GitHub logo", []string{"github"}},
	{"gitlab", "GitLab logo", []string{"gitlab"}},
	{"cpu", "processor chip", []string{"cpu", "chip", "processor", "hardware", "processador", "procesador", "processeur"}},
	{"robot", "robot, automated agent", []string{"robot", "chatbot", "machine learning", "inteligencia artificial", "automatisation"}},
	{"sparkles", "sparkles, generation, a new idea", []string{"generate", "generation", "creative", "prompt", "criar", "generar"}},
	{"users", "group of people, team", []string{"team", "community", "people", "equipe", "equipo", "usuarios", "users", "mannschaft"}},
	{"user", "one person, account", []string{"user", "profile", "account", "usuario", "perfil", "conta", "compte", "konto"}},
	{"message", "speech bubble, conversation", []string{"chat", "message", "conversation", "mensagem", "mensaje", "nachricht"}},
	{"mail", "envelope, email", []string{"email", "mail", "newsletter", "correio", "correo"}},
	{"bell", "bell, notification", []string{"notification", "alert", "alerta", "notificacion", "alarme"}},
	{"heart", "heart, care, appreciation", []string{"heart", "like", "care", "apoio"}},
	{"share", "share, publish outward", []string{"share", "publish", "publicar", "partager"}},
	{"globe", "globe, world, internet", []string{"global", "world", "region", "internet", "mundo", "monde", "welt"}},
	{"map", "map, a place", []string{"map", "location", "mapa", "ubicacion", "carte"}},
	{"calendar", "calendar, a date", []string{"calendar", "schedule", "date", "agenda", "fecha", "datum"}},
	{"alarm-clock", "clock, deadline", []string{"deadline", "prazo", "hora", "uhr", "clock"}},
	{"bookmark", "bookmark, saved item", []string{"bookmark", "favorito", "guardar"}},
	{"trophy", "trophy, award", []string{"award", "trophy", "achievement", "certification", "premio", "conquista", "recompense"}},
	{"star", "star, rating, favorite", []string{"star", "rating", "estrela", "estrella"}},
	{"target", "target, goal, test", []string{"goal", "target", "teste", "objetivo", "prueba", "ziel"}},
	{"check", "check mark, done, success", []string{"done", "success", "valid", "concluido", "correcto", "valide", "check"}},
	{"chart", "chart, proportions", []string{"chart", "metric", "proportion", "grafico", "graphique", "diagramm"}},
	{"analytics", "analytics, measurement", []string{"analytics", "insight", "analise", "analisis"}},
	{"signal", "signal bars, monitoring", []string{"monitor", "observe", "sinal", "senal", "signal"}},
	{"search", "magnifying glass, search", []string{"search", "find", "buscar", "recherche", "suche"}},
	{"filter", "filter funnel", []string{"filter", "filtro", "filtrer"}},
	{"gear", "gear, settings", []string{"settings", "config", "configuration", "configuracao", "ajustes", "parametre", "einstellung"}},
	{"tools", "tools, building", []string{"tool", "build", "ferramenta", "herramienta", "outil"}},
	{"link", "chain link, integration", []string{"link", "integration", "connection", "integracao", "enlace", "connexion"}},
	{"wifi", "wireless signal, network", []string{"network", "wifi", "rede", "reseau", "netzwerk"}},
	{"zap", "lightning bolt, speed, deploy", []string{"deploy", "delivery", "automate", "lightning", "entrega", "rapide", "schnell", "velocidade"}},
	{"play", "play button, start", []string{"start", "run", "iniciar", "demarrer", "play"}},
	{"download", "download arrow into a tray", []string{"download", "baixar", "descargar", "telecharger"}},
	{"upload", "upload arrow out of a tray", []string{"upload", "enviar", "subir"}},
	{"home", "house, home", []string{"home", "inicio", "accueil"}},
	{"book-open", "open book, learning", []string{"learn", "guide", "documentation", "lesson", "aprender", "guia", "apprendre", "lernen", "docs"}},
	{"package", "package, dependency", []string{"package", "dependency", "container", "pacote", "paquete", "paket"}},
	{"folder", "folder of files", []string{"folder", "directory", "pasta", "carpeta", "dossier"}},
	{"file-text", "text document", []string{"document", "documento", "arquivo", "fichier", "datei"}},
	{"image", "picture, photo", []string{"image", "photo", "picture", "imagem", "imagen", "bild"}},
	{"keyboard", "keyboard", []string{"keyboard", "typing", "teclado", "clavier", "tastatur"}},
	{"trash", "trash can, delete", []string{"delete", "remove", "trash", "excluir", "eliminar", "supprimer"}},
	{"clipboard", "clipboard, copy", []string{"copy", "paste", "clipboard", "copiar", "copie"}},
	{"repeat", "repeat arrows, retry", []string{"repeat", "retry", "loop", "repetir", "wiederholen"}},
	{"test-tube", "test tube, experiment", []string{"experiment", "lab", "experimento", "labor"}},
	{"linkedin", "LinkedIn logo", []string{"linkedin"}},
	{"audio-waveform", "audio waveform, sound", []string{"audio", "sound", "podcast", "som", "sonido", "klang"}},
	{"hash", "hash mark, tag", []string{"hashtag", "tag", "topic"}},
	{"arrow-right", "arrow pointing right, next step", []string{"next", "continue", "forward", "proximo", "siguiente", "suivant", "weiter"}},
}

var canonicalIcon = map[string]string{
	"audio": "audio-waveform", "brackets": "code", "chat": "message", "chip": "cpu",
	"community": "users", "connector": "link", "hashtag": "hash", "lightning": "zap",
	"play-target": "target",
}

type iconChoice struct {
	name  string
	gloss string
	terms []string
}

func (c *Client) SelectIcons(ctx context.Context, model string, selections []IconSelection, iconNames []string) (map[string]string, error) {
	if len(selections) == 0 {
		return map[string]string{}, nil
	}
	choices := availableIcons(iconNames)
	if len(choices) == 0 {
		return nil, fmt.Errorf("icon catalog is empty")
	}
	result := make(map[string]string, len(selections))
	for start := 0; start < len(selections); start += iconBatchSize {
		end := start + iconBatchSize
		if end > len(selections) {
			end = len(selections)
		}
		batch, err := c.selectIconBatch(ctx, model, selections[start:end], choices)
		if err != nil {
			return nil, err
		}
		for id, icon := range batch {
			result[id] = icon
		}
	}
	return result, nil
}

func (c *Client) selectIconBatch(ctx context.Context, model string, selections []IconSelection, choices []iconChoice) (map[string]string, error) {
	prompt, err := iconPrompt(selections, choices)
	if err != nil {
		return nil, err
	}
	allowed := make(map[string]bool, len(choices))
	for _, choice := range choices {
		allowed[choice.name] = true
	}
	value, err := c.complete(ctx, model, "You choose a pixel-art icon for each item. The text may be in any language. Match the picture to the meaning. Return strict JSON only.", prompt, 0, 1500)
	parsed := map[string]string{}
	if err == nil {
		parsed = parseIconObject(value)
	} else if !iconTransportError(err) {
		parsed = map[string]string{}
	} else {
		return nil, err
	}
	result := make(map[string]string, len(selections))
	for _, selection := range selections {
		result[selection.ID] = resolveIcon(parsed[selection.ID], selectionText(selection), choices, allowed)
	}
	return result, nil
}

func iconTransportError(err error) bool {
	message := err.Error()
	return strings.Contains(message, "failed to query Hugging Face") ||
		strings.Contains(message, "Hugging Face returned") ||
		strings.Contains(message, "HF_TOKEN") ||
		strings.Contains(message, "failed to create request") ||
		strings.Contains(message, "failed to serialize request") ||
		strings.Contains(message, "failed to read Hugging Face") ||
		strings.Contains(message, "invalid Hugging Face response")
}

func iconPrompt(selections []IconSelection, choices []iconChoice) (string, error) {
	var catalog strings.Builder
	for _, choice := range choices {
		catalog.WriteString(choice.name)
		catalog.WriteString(" — ")
		catalog.WriteString(choice.gloss)
		catalog.WriteByte('\n')
	}
	items := make([]struct {
		ID   string `json:"id"`
		Text string `json:"text"`
	}, len(selections))
	for i, selection := range selections {
		items[i].ID = selection.ID
		items[i].Text = selectionText(selection)
	}
	encoded, err := json.Marshal(items)
	if err != nil {
		return "", fmt.Errorf("failed to serialize icon selections: %w", err)
	}
	return fmt.Sprintf(`Pick one catalog name for each id. Return one JSON object and nothing else, for example {"page-0":"database"}.
Choose the picture a reader understands at a glance. Prefer a concrete object over an arrow or a gear unless the text is about direction or settings.
Use only names from the catalog. Repeat a name when two items mean the same thing.
CATALOG:
%sITEMS:
%s`, catalog.String(), encoded), nil
}

func selectionText(selection IconSelection) string {
	text := strings.TrimSpace(selection.Word)
	context := strings.TrimSpace(selection.Context)
	if context != "" && !strings.EqualFold(context, text) {
		if text != "" {
			text += ". "
		}
		text += context
	}
	runes := []rune(text)
	if len(runes) > 420 {
		return string(runes[:420])
	}
	return text
}

func availableIcons(iconNames []string) []iconChoice {
	valid := make(map[string]bool, len(iconNames))
	for _, name := range iconNames {
		valid[name] = true
	}
	choices := make([]iconChoice, 0, len(describedIcons))
	for _, choice := range describedIcons {
		if valid[choice.name] {
			choices = append(choices, choice)
		}
	}
	if len(choices) > 0 {
		return choices
	}
	for _, name := range iconNames {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		choices = append(choices, iconChoice{name: name, gloss: strings.ReplaceAll(name, "-", " ")})
	}
	return choices
}

func parseIconObject(value string) map[string]string {
	value = extractJSONObject(value)
	var raw map[string]any
	if err := json.Unmarshal([]byte(value), &raw); err != nil {
		return map[string]string{}
	}
	parsed := make(map[string]string, len(raw))
	for id, item := range raw {
		switch typed := item.(type) {
		case string:
			parsed[id] = typed
		}
	}
	return parsed
}

func extractJSONObject(value string) string {
	value = strings.TrimSpace(value)
	value = strings.TrimPrefix(value, "```json")
	value = strings.TrimPrefix(value, "```")
	value = strings.TrimSpace(value)
	value = strings.TrimSuffix(value, "```")
	start := strings.Index(value, "{")
	end := strings.LastIndex(value, "}")
	if start >= 0 && end > start {
		return value[start : end+1]
	}
	return strings.TrimSpace(value)
}

func resolveIcon(raw, text string, choices []iconChoice, allowed map[string]bool) string {
	name := normalizeIconName(raw)
	if canonical, ok := canonicalIcon[name]; ok {
		name = canonical
	}
	if allowed[name] {
		return name
	}
	return fallbackIcon(text, choices)
}

func normalizeIconName(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = strings.ReplaceAll(value, "_", "-")
	value = strings.ReplaceAll(value, " ", "-")
	return value
}

func fallbackIcon(text string, choices []iconChoice) string {
	best := ""
	bestScore := 0
	for _, choice := range choices {
		score := scoreChoice(text, choice)
		if score > bestScore {
			bestScore = score
			best = choice.name
		}
	}
	if best != "" {
		return best
	}
	for _, name := range []string{"sparkles", "book-open"} {
		for _, choice := range choices {
			if choice.name == name {
				return name
			}
		}
	}
	if len(choices) == 0 {
		return ""
	}
	return choices[0].name
}

func scoreChoice(text string, choice iconChoice) int {
	folded := foldText(text)
	words := map[string]bool{}
	for _, word := range strings.FieldsFunc(folded, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	}) {
		if word != "" {
			words[word] = true
		}
	}
	score := 0
	seen := map[string]bool{}
	terms := append([]string{strings.ReplaceAll(choice.name, "-", " ")}, choice.terms...)
	for _, term := range terms {
		term = foldText(term)
		if term == "" || seen[term] {
			continue
		}
		seen[term] = true
		if strings.Contains(term, " ") {
			if strings.Contains(folded, term) {
				score += 20 + len(term)
			}
			continue
		}
		if len(term) < 3 {
			continue
		}
		if words[term] {
			score += 10 + len(term)
		}
	}
	return score
}

func foldText(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	return strings.NewReplacer(
		"á", "a", "à", "a", "â", "a", "ã", "a", "ä", "a",
		"é", "e", "è", "e", "ê", "e", "ë", "e",
		"í", "i", "ì", "i", "î", "i", "ï", "i",
		"ó", "o", "ò", "o", "ô", "o", "õ", "o", "ö", "o",
		"ú", "u", "ù", "u", "û", "u", "ü", "u",
		"ç", "c", "ñ", "n",
	).Replace(value)
}
