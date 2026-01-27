FROM node:18

WORKDIR /service

COPY . .


# Optional: Install CLI for debugging (optional)
RUN apt-get update && apt-get install -y sqlite3

RUN npm -y init

RUN npm install sqlite3 fastify \
                @fastify/cookie \
                speakeasy qrcode \
                npm \
                thirty-two \
                jsonwebtoken \
                dotenv \
                https \
                fs

RUN openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout service.key \
  -out service.crt \
  -subj "/CN=login_service"



CMD ["node", "index.js"]