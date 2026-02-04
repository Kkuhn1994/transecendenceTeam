FROM node:18

WORKDIR /service
COPY . .

RUN npm -y init
RUN npm install sqlite3 fastify \
                        https \
                        fs \
                        undici

RUN openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout service.key \
  -out service.crt \
  -subj "/CN=tournament_service"

CMD ["node", "index.js"]
