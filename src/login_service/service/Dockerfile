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
                dotenv





CMD ["node", "index.js"]