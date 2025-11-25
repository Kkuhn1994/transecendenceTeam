FROM node:18

WORKDIR /service

# package.json kopieren
COPY json/package.json package.json

COPY json/tsconfig.json tsconfig.json

# Install dependencies (including devDependencies for build)
RUN npm install

# Quellcode kopieren
COPY . .

# Build frontend
RUN npm run build

# Startbefehl
CMD ["node", "index.js"]
