# Static UI — VITE_BUFFER_URL is the URL the *browser* uses to reach the buffer (host-accessible).
FROM node:22-alpine AS build
WORKDIR /app
# Domyślnie ten sam host co UI — wymaga bloku `location /api/` w nginx (patrz nginx.default.conf).
ARG VITE_BUFFER_URL=/api
ARG VITE_BUFFER_TOKEN=dev-token-local
ENV VITE_BUFFER_URL=$VITE_BUFFER_URL
ENV VITE_BUFFER_TOKEN=$VITE_BUFFER_TOKEN
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
