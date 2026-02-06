# Variablen
DOCKER_COMPOSE = docker compose
COMPOSE_FILE = docker-compose.yaml


USER_NAME := $(USER)


all: set_up_certs up


set_up_certs:
	@echo "Erstelle Zertifikikate..."
	@mkdir -p ./src/nginx/certs
	@openssl req -x509 -nodes -days 365 \
		-newkey rsa:2048 \
		-keyout ./src/nginx/certs/privkey.pem \
		-out ./src/nginx/certs/fullchain.pem \
		-subj "/CN=localhost"
	@echo "Zertifikikate erstellt!"


# Standardbefehl: Container starten
up:
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) up --build



# Container stoppen
down:
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) down

# Logs anzeigen
logs:
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) logs -f

# Container bauen (z. B. nach Änderungen am Dockerfile)
build:
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) build

# Alle Container, Netzwerke und Volumes entfernen (vorsichtig verwenden!)
clean:
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) down -v

# Hilfe anzeigen
help:
	@echo "Verfügbare Befehle:"
	@echo "  make up        - Starte Docker Compose"
	@echo "  make down      - Stoppe und entferne Container"
	@echo "  make logs      - Zeige Logs an"
	@echo "  make restart   - Starte einen Dienst neu"
	@echo "  make build     - Baue die Container neu"
	@echo "  make clean     - Entferne Container, Netzwerke und Volumes"