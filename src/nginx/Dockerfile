FROM debian:latest

RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx

COPY default /etc/nginx/sites-available/.

COPY certs/. /etc/nginx/certs/.

CMD ["nginx", "-g", "daemon off;"]