FROM debian:latest

RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx openssl

COPY default /etc/nginx/sites-available/.

RUN mkdir -p /etc/nginx/certs && \
    openssl req -x509 -nodes -days 365 \
      -newkey rsa:2048 \
      -keyout /etc/nginx/certs/privkey.pem \
      -out /etc/nginx/certs/fullchain.pem \
      -subj "/CN=localhost"

CMD ["nginx", "-g", "daemon off;"]