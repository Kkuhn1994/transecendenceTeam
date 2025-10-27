FROM node:18

WORKDIR /service

COPY . .


# Optional: Install CLI for debugging (optional)
RUN apt-get update && apt-get install -y sqlite3

RUN npm -y init
RUN npm install
RUN npm install fastify


CMD ["node", "index.js"]