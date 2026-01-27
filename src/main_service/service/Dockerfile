FROM node:18

WORKDIR /service

RUN apt-get update && apt-get install -y sqlite3
# package.json kopieren
COPY package.json package.json

COPY tsconfig.json tsconfig.json

# Install dependencies (including devDependencies for build)
RUN npm install sqlite3 fastify @fastify/cookie https fs undici

RUN openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout service.key \
  -out service.crt \
  -subj "/CN=main_service"



# Quellcode kopieren
COPY . .

# Build frontend
RUN npm run build

# Startbefehl
CMD ["node", "index.js"]
