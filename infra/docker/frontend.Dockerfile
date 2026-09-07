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

ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_GOOGLE_MAPS_MAP_ID
ARG VITE_BUILD_CHANNEL
ARG VITE_GIT_BRANCH
ARG VITE_GIT_SHA
ARG VITE_GIT_REPOSITORY_URL
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY \
    VITE_GOOGLE_MAPS_MAP_ID=$VITE_GOOGLE_MAPS_MAP_ID \
    VITE_BUILD_CHANNEL=$VITE_BUILD_CHANNEL \
    VITE_GIT_BRANCH=$VITE_GIT_BRANCH \
    VITE_GIT_SHA=$VITE_GIT_SHA \
    VITE_GIT_REPOSITORY_URL=$VITE_GIT_REPOSITORY_URL

RUN npm run build -w @trasolve/shared \
    && npm run build -w @trasolve/frontend

FROM caddy:2.10-alpine

COPY infra/docker/frontend.Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/frontend/dist /srv

EXPOSE 3000
