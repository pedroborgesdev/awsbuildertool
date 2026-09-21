VENV := .venv
PYTHON := $(VENV)/bin/python
PYTHON_STAMP := $(VENV)/.requirements-installed
NODE_STAMP := web/node_modules/.package-lock-installed
SERVER := bin/universal-post-studio

.PHONY: dev-api dev-web setup-python setup-web build test run mock fmt clean

$(PYTHON):
	python3 -m venv $(VENV)

$(PYTHON_STAMP): requirements.txt $(PYTHON)
	$(PYTHON) -m pip install --upgrade pip
	$(PYTHON) -m pip install -r requirements.txt
	touch $(PYTHON_STAMP)

$(NODE_STAMP): web/package.json web/package-lock.json
	npm ci --prefix web
	touch $(NODE_STAMP)

setup-python: $(PYTHON_STAMP)

setup-web: $(NODE_STAMP)

dev-api: setup-python
	PYTHON_BIN=$(CURDIR)/$(PYTHON) go run -buildvcs=false ./cmd/server

dev-web: setup-web
	npm run dev --prefix web

build: setup-web
	npm run build --prefix web
	mkdir -p bin
	go build -buildvcs=false -o $(SERVER) ./cmd/server

test: setup-python setup-web
	go test ./...
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m unittest discover -s internal/render/python -p '*_test.py' -v
	npm run build --prefix web

run: setup-python build
	PYTHON_BIN=$(CURDIR)/$(PYTHON) ./$(SERVER)

mock: setup-python build
	MOCK_HF=true PYTHON_BIN=$(CURDIR)/$(PYTHON) ./$(SERVER)

fmt:
	gofmt -w ./cmd ./internal

clean:
	rm -rf bin web/dist
