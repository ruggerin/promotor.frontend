# syntax=docker/dockerfile:1
#
# Container único do admin (SPA React/Vite, servido como estático por Nginx) — pensado pra
# rodar sozinho numa VPS, ao lado de outras aplicações já existentes (por isso a porta do host
# é configurável, ver docker-compose.yml). Ver docs/03-ADMIN-WEB.md pro resto do contrato do
# admin; este arquivo só cuida de empacotar o que já existe, não muda nenhuma regra de negócio.
#
# VITE_API_URL é embutida no bundle JS em TEMPO DE BUILD (padrão do Vite — `import.meta.env`
# vira literal no JS gerado, não existe "trocar em runtime" sem reescrever os arquivos) — por
# isso entra como build ARG, não variável de ambiente do container. Mudou a URL da API? precisa
# rebuildar: `docker compose up -d --build` de novo (ver docker-compose.yml, que já lê
# VITE_API_URL do admin/.env pra isso).

# ---- Stage 1: build do bundle estático (Vite) -------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ---- Stage 2: imagem final (só Nginx servindo o estático) -------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
