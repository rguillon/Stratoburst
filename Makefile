# Every developer and CI command is a target here. Python goes through Astral uv only;
# the npm scripts in package.json stay in place and these targets wrap them.

.DEFAULT_GOAL := help

PYTEST_GATE := uv run pytest --cov --cov-branch --cov-fail-under=100
VITEST_FILES := $(wildcard web/test/*/*.test.js)

.PHONY: help install browsers lint format test build dev preview e2e check clean

help: ## List the available targets
	@echo "Scorched developer targets:"
	@grep -E '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

install: ## Install Python (uv sync) and Node (npm ci) dependencies from the lockfiles
	uv sync --locked
	npm ci

browsers: ## Download the Playwright Chromium used by e2e
	npx playwright install chromium

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

build: ## Production build into dist/
	npm run build

dev: ## Vite dev server
	npm run dev

preview: ## Serve the production build on http://localhost:4173/
	npm run preview

e2e: ## Playwright specs against the production build (run `make build` first)
	npx playwright test

check: lint test build e2e ## Full local gate: lint + test + build + e2e

clean: ## Remove build output, caches and test artifacts
	rm -rf dist test-results playwright-report .coverage .pytest_cache .ruff_cache
	find src tests -type d -name __pycache__ -prune -exec rm -rf {} +
