# ── Stage 1: build the Vue app ───────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Install deps from the lockfile first so this layer caches until deps change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Never bake a checked-in / local .env into the production bundle — the API
# URL is supplied at build time via the ARG below.
RUN rm -f .env .env.* || true

# Vite reads VITE_* from the build environment. Pass the real backend URL:
#   docker build --build-arg VITE_API_BASE_URL=https://api.example.com -t bb-fe .
# If omitted, src/api/client.ts falls back to http://localhost:3000 (dev only).
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# `npm run build` = type-check (vue-tsc) + vite build
RUN npm run build

# ── Stage 2: serve the static build with nginx ───────────────────────────────
FROM nginx:stable-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
