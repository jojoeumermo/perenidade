# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# A imagem do site para o servidor próprio (Oracle, processador ARM), publicada pelo Coolify.
# Quem monta é a rotina "Publicar no servidor" (.github/workflows/producao.yml), numa máquina ARM do GitHub: o servidor
# só baixa a imagem pronta e troca a versão no ar. Passo a passo e manutenção em docs/HOSPEDAGEM.md.
#
# Nenhum segredo entra aqui. As variáveis públicas (NEXT_PUBLIC_*), que o Next grava no código na montagem, chegam no
# arquivo .env.production.local que a rotina escreve antes de montar; as chaves secretas ficam só no Coolify e são
# lidas na hora em que o site roda.

# ---- 1. Montagem -----------------------------------------------------------------------------------------------------
# A imagem de base vai fixada pelo resumo (@sha256), não só pela etiqueta: a etiqueta pode passar a apontar para outra imagem.
# O dependabot (ecossistema docker) propõe a troca do resumo quando sai uma imagem nova.
FROM node:26-bookworm-slim@sha256:5df79989ed685e09f0a98019db4cebfb22fb9df1a53c0161664a011f7ff6b0f1 AS montagem
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT_STANDALONE=1 \
    NODE_OPTIONS=--max-old-space-size=8192
# git: o histórico do acervo é lido do Git durante a montagem (lib/history.ts).
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Os pacotes primeiro (a camada é reaproveitada quando só o conteúdo muda). O postinstall copia os interpretadores
# do navegador (Python, PHP, Ruby, Lua, C) para public/.
COPY package.json package-lock.json ./
COPY scripts/preparar.mjs ./scripts/preparar.mjs
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
# O que a imagem leva da montagem, sem repetir nada (a imagem passava de 11 GB, e o servidor levava mais de 15 minutos só
# para desempacotar a versão nova):
# - as pastas que o estágio de baixo copia inteiras (public/, content/, historico/, docs/) saem do standalone, onde o
#   rastreio do Next punha só uma parte delas: sem isso, cada arquivo dessas partes ia duas vezes, uma em cada camada;
# - os arquivos idênticos das páginas prontas (a página.rsc e a cópia inteira dela em .segments/_full.segment.rsc, os
#   pedaços iguais entre idiomas) viram um arquivo só com vários nomes (scripts/imagem-juntar-iguais.mjs). O site lê os
#   mesmos bytes nos mesmos caminhos.
RUN rm -rf .next/standalone/public .next/standalone/content .next/standalone/historico .next/standalone/docs  && node scripts/imagem-juntar-iguais.mjs .next/standalone/.next/server/app

# ---- 2. O site no ar -------------------------------------------------------------------------------------------------
FROM node:26-bookworm-slim@sha256:5df79989ed685e09f0a98019db4cebfb22fb9df1a53c0161664a011f7ff6b0f1 AS site
LABEL org.opencontainers.image.source="https://github.com/jojoeumermo/perenidade" \
      org.opencontainers.image.description="Instituto Lúcia: escola livre e gratuita" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later"
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# curl: a checagem de saúde roda de dentro do contêiner.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# O servidor do Next com só os pacotes que ele usa, os arquivos estáticos e as pastas que as páginas leem na hora
# (aulas e acervo em content/, histórico, questões e capas em public/, modelo de aula e checklist em docs/).
COPY --from=montagem --chown=node:node /app/.next/standalone ./
COPY --from=montagem --chown=node:node /app/.next/static ./.next/static
COPY --from=montagem --chown=node:node /app/public ./public
COPY --from=montagem --chown=node:node /app/content ./content
COPY --from=montagem --chown=node:node /app/historico ./historico
COPY --from=montagem --chown=node:node /app/docs ./docs
# O site roda sem poder de administrador dentro do contêiner.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD curl -fsS -o /dev/null http://127.0.0.1:3000/robots.txt || exit 1
CMD ["node", "server.js"]
