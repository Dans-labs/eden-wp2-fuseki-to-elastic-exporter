.DEFAULT_GOAL := help

INFRA_SERVICES := fuseki elasticsearch postgres redis rdf-delta

.PHONY: help setup start stop start\:dev stop\:dev migrate

help: ## Show available commands
	@grep -E '^[a-zA-Z_\\:-]+:.*## ' $(MAKEFILE_LIST) | sed 's/\\//g' | awk -F '## ' '{n=$$1; sub(/: .*/, "", n); sub(/:$$/, "", n); printf "  \033[36m%-15s\033[0m %s\n", n, $$2}'

setup: .env ## First-time bootstrap: copy .env, install deps
	pnpm install

start: .env ## Start the entire stack (all containers)
	docker compose up -d
	@echo "Waiting for Postgres..."
	@docker compose exec postgres sh -c 'until pg_isready -U postgres; do sleep 1; done'
	pnpm exec prisma migrate deploy

stop: ## Stop the entire stack
	docker compose down

start\:dev: .env ## Start infrastructure + run migrations (for local dev)
	docker compose up -d $(INFRA_SERVICES)
	@echo "Waiting for Postgres..."
	@docker compose exec postgres sh -c 'until pg_isready -U postgres; do sleep 1; done'
	pnpm exec prisma migrate deploy

stop\:dev: ## Stop infrastructure services
	docker compose down

migrate: ## Run Prisma migrations
	pnpm exec prisma migrate deploy

.env:
	cp .env.example .env
