FROM node:18

WORKDIR /service



# Kopiere die package.json (lokal vorbereitet, keine npm init nötig)
COPY package.json .

RUN cat package.json

# Installiere alle Dependencies (prod + dev)
RUN npm install

RUN npm install fastify && npm install @fastify/static


# TypeScript installieren (falls devDependency)
RUN npm install -D typescript @types/node

# Quellcode kopieren
COPY . .

# TypeScript kompilieren
RUN npx tsc login.ts




CMD ["node", "index.js"]

