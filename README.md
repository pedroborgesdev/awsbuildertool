# Universal Post Studio

Go + React + TypeScript application for generating complete posts with the local AWS Builder Center design system.

## Workflow

1. Fill in the brief and click **Generate posts**.
2. The AI produces only structured editorial content.
3. The renderer calculates three valid compositions for each page and selects one.
4. Open finished pages at full size or download the PDF and overview.

The form includes an `About you` section with an optional name, subtitle, and photo. The photo is cropped in the browser with drag and zoom, exported at `1080x1080`, and reduced only during footer composition. The brief accepts color direction and light, dark, or mixed pages.

The AI returns only editorial JSON. Rendering uses a fixed Python/Pillow engine embedded in the Go binary and makes no additional AI call. The interface runs content and design directly, with no manual editing step.

## Architecture

```text
React -> POST /api/generate -> AI (content only) -> validated CampaignDraft
                                                      |
                              modular planner: 3 valid options
                                                      | seeded selection
                              fixed renderer -> validation -> PNG/PDF/preview

Any failure -> full retry (including AI), up to 5 attempts
```

- `internal/domain/content.go`: editorial contract, normalization, roles, and format limits.
- `internal/prompt/builder.go`: short content prompt, with no code or coordinate catalog.
- `internal/hf/content.go`: inference, strict JSON parsing, and simulated content.
- `internal/render/python/engine.py`: algorithmic planning, typography, geometry, and export.
- `internal/render/campaign.go`: renderer embedding and independent file verification.
- `web/src/App.tsx`: brief and direct generation of final files.

The `POST /api/content` and `POST /api/render` endpoints remain available for integrations, while the interface uses `POST /api/generate` and completes everything in one step.

## Rendering

Editorial roles include cover, list, flow, comparison, manifesto, diagram, donut chart, timeline, metrics, and closing, but they do not select templates. They classify content. The renderer uses a nine-column modular grid on the main 1080 px canvases, converts `title`, `body`, and each item into semantic blocks, measures text with the final font, and enumerates cell-based dimensions while accounting for padding and wrapping. A rectangle packer searches available positions, scores compositions by centrality, occupancy, breadth, and quadrant distribution, keeps the three best, and selects one deterministically from the seed.

Lists preserve internal rhythm: three items prefer one column; four prefer `2x2`; five may use one column or `2x2` with the last item below in the left column. Right- and left-stepped layouts are also allowed, always offset by exactly one cell per row. Items in each group share the same width and a common height of one or two cells. The complete group is indivisible so other elements cannot break its structure.

The grid uses square cells: 120 px for 1080 and 1200 px formats, and 100 px at 1600x900. The main 1080 px canvases have nine columns. Remaining canvas space is reserved for the margin/footer; cells are not stretched to fill the height.

`cta` pages use their own typographic scale. Icons are read directly from Pixelarticons SVGs, rasterized in memory by CairoSVG, and enlarged using their actual opaque area.

Decorative accents may originate from up to four independent points and grow into connected branches, distributed only where free space exists. Solid branches have no cell dividers. In gradient branches, one composition covers the whole tree and each cell reveals its corresponding section without restarting the gradient. Generation is reproducible and never overlaps content.

Headers, text planes, information rows, icon cells, CTAs, and footers begin and end on grid axes. Structural blocks never have fractional margins: adjacent panels share the same edge. The main icon is connected to the title in a `1x1` or `2x2` cell. Icons may use colored ink on neutral surfaces or neutral ink on colored surfaces. Every list row keeps its number and icon together with its own semantic intent; there are no loose decorative icons.

The library uses a curated catalog of roughly 200 relevant SVGs directly from `design_system/icon_sources/pixelarticons`. All shapes are discovered from that folder; ten compatibility names are aliases to SVGs in that folder. There are no icon PNGs or color variants: CairoSVG generates the alpha channel in memory and the renderer applies color during composition.

Color is selected at campaign level. In `mono` mode, every page uses one accent and its gradient to white. In `spectrum` mode, the five official accents are shuffled through lists and combined only with official multicolor gradients.

Word limits are an editorial filter; a long sentence may still not fit because of actual measurements. The application never silently cuts or alters content. Content, CTA, icon, calculation, script, rendering, or artifact errors trigger a complete retry, including a new AI call, up to five attempts.

A campaign with N pages produces exactly N PNGs, one PDF, and one preview. Each file is classified as `page`, `document`, or `preview`. Content/rendering failures return HTTP 422 and are never presented as success.

Each job keeps the reproducible script in `generated/<id>/` and the visual files, `campaign.json`, and `validation.json` in `output/`. The downloaded script contains the fixed renderer and editorial data encoded as JSON.

## Run

Requirements: Go 1.24+, Node.js 22+, npm, Python 3.11+, and IBM Plex Mono or DejaVu Sans Mono fonts. The executor enforces timeouts, resource limits, audit hooks, and bubblewrap when available.

```bash
cp .env.example .env
# Configure HF_TOKEN and TYPESAFE_API_KEY in .env
make run
```

`make run` creates `.venv` when needed, installs or updates Python dependencies when `requirements.txt` changes, runs `npm ci` when the lockfile changes, builds the frontend and backend, and starts the server with the correct Python. Later runs reuse installed dependencies.

Open http://localhost:8080. For development, also run `npm run dev` in `web/`.

To test the complete flow without a token or API usage:

```bash
make mock
```

Mock mode returns demonstration content and uses the same production planner and renderer.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| APP_ADDR | :8080 | HTTP address |
| HF_TOKEN | empty | Server-only token |
| HF_BASE_URL | https://router.huggingface.co/v1 | Compatible inference endpoint |
| HF_MODEL | openai/gpt-oss-120b:fastest | Model/provider |
| HF_MAX_TOKENS | 12000 | Editorial response limit |
| HF_TIMEOUT_SECONDS | 180 | Inference timeout |
| DESIGN_SYSTEM_DIR | design_system | Local assets |
| WEB_DIST | web/dist | Compiled interface |
| MOCK_HF | false | Local demonstration content |
| TYPESAFE_API_KEY | empty | TypeSafe key for semantic icon selection with Jev |
| TYPESAFE_BASE_URL | https://api.typesafe.ai/v1/systemone | TypeSafe System One endpoint |
| TYPESAFE_MODEL | jev-latest | Model used to select icons |
| ICON_SELECTOR | jev | Icon selector: `jev` or `hf` |
| GENERATED_OUTPUT_DIR | generated | Jobs and results |
| PYTHON_BIN | python3 | Renderer Python |
| RENDER_TIMEOUT_SECONDS | 90 | Renderer timeout |

## Verification

```bash
make test
make build
```

The suite checks the direct content -> planning -> rendering flow, invalid JSON, normalization, page counts, three candidates, modular alignment, icon presence, dimensions, incomplete PDFs, squares, collisions, glyphs, overflow, and seed reproduction. The matrix covers all eight formats and editorial roles.

To run the renderer directly with a saved campaign:

```bash
AWS_DESIGN_SYSTEM_DIR=design_system python3 internal/render/python/engine.py campaign.json output
```

The real integration depends on the provider returning the requested JSON. Truncated responses, code, extra fields, or content over budget are rejected for that attempt and trigger a new inference. After five failures, the API returns HTTP 422 with a summary of each attempt.
