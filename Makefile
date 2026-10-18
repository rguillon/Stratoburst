# Every developer and CI command is a target here. Python goes through Astral uv only;
# the npm scripts in package.json stay in place and these targets wrap them.

.DEFAULT_GOAL := help

PYTEST_GATE := uv run pytest --cov --cov-branch --cov-fail-under=100
VITEST_FILES := $(wildcard web/test/*/*.test.js)

.PHONY: help install install-python install-web browsers browsers-ci lint format test \
	test-python test-web build perf perf-stage dev preview e2e e2e-live live-url wait-deploy check clean

# Inputs for the deploy-verification targets (override on the command line).
SHA ?= $(shell git rev-parse HEAD)
WORKFLOW ?= Deploy
TIMEOUT_MIN ?= 20

help: ## List the available targets
	@echo "Scorched developer targets:"
	@grep -E '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-14s %s\n", $$1, $$2}'

install: install-python install-web ## Install Python and Node dependencies from the lockfiles

install-python: ## uv sync --locked (Python dependencies from uv.lock)
	uv sync --locked

install-web: ## npm ci (Node dependencies from package-lock.json)
	npm ci

browsers: ## Download the Playwright Chromium used by e2e
	npx playwright install chromium

browsers-ci: ## Download Playwright Chromium plus its system libraries (CI runners)
	npx playwright install --with-deps chromium

lint: ## ruff check + ruff format --check
	uv run ruff check .
	uv run ruff format --check .

format: ## Apply ruff fixes and formatting
	uv run ruff check --fix .
	uv run ruff format .

test: ## pytest with 100% line+branch coverage, plus vitest when specs exist
	$(PYTEST_GATE)
ifneq ($(strip $(VITEST_FILES)),)
	npm test
endif

test-python: ## pytest with --cov-fail-under=100 only
	$(PYTEST_GATE)

test-web: ## vitest only
	npm test

build: ## Production build into dist/
	npm run build

perf: ## Python tick budget in Pyodide-on-Node: the gallery runs (500 stress bullets, every weapon at Lv5) then the stage runs, fails above 3 ms average
	npm run perf --if-present

perf-stage: ## Python tick budget over stage 1's boss fight (every weapon at Lv5, bombs) in Pyodide-on-Node, fails above 3 ms average
	npm run perf:stage

dev: ## Vite dev server
	npm run dev

preview: ## Serve the production build on http://localhost:4173/
	npm run preview

e2e: ## Playwright specs against the production build (run `make build` first)
	npx playwright test

e2e-live: ## Playwright smoke spec against the live GitHub Pages URL
	BASE_URL="$$(node tools/live_url.mjs)" npx playwright test tools/e2e/smoke.spec.js

live-url: ## Print the GitHub Pages URL derived from the origin remote
	@node tools/live_url.mjs

wait-deploy: ## Wait until the Deploy run for SHA succeeded and the live site serves it
	node tools/wait_for_deploy.mjs --sha "$(SHA)" --workflow "$(WORKFLOW)" --timeout-min "$(TIMEOUT_MIN)"

check: lint test build e2e ## Full local gate: lint + test + build + e2e

clean: ## Remove build output, caches and test artifacts
	rm -rf dist test-results playwright-report .coverage .pytest_cache .ruff_cache
	find src tests -type d -name __pycache__ -prune -exec rm -rf {} +
