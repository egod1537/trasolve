FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json
RUN npm ci

COPY tsconfig.json ./
COPY backend ./backend
COPY shared ./shared
RUN npm run build -w @trasolve/shared \
    && npm run build -w @trasolve/backend \
    && npm prune --omit=dev

FROM node:24-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend ./backend
COPY --from=build /app/shared ./shared

USER node
EXPOSE 3000
WORKDIR /app/backend
CMD ["node", "dist/index.js"]
