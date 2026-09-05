FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json
RUN npm ci

COPY tsconfig.json ./
COPY frontend ./frontend
COPY shared ./shared
RUN npm run build -w @trasolve/shared \
    && npm run build -w @trasolve/frontend

FROM caddy:2.10-alpine

COPY infra/docker/frontend.Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/frontend/dist /srv

EXPOSE 3000
