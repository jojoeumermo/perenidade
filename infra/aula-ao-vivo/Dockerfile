# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Galène (https://galene.org, licença MIT, de Juliusz Chroboczek) compilado da fonte oficial, numa versão fixa. Serve para
# ARM (Ampere da Oracle) e x86 sem mudar nada: a compilação é nativa na máquina onde o "docker compose build" roda.
# Para subir de versão, troque GALENE_REF por outra tag de https://github.com/jech/galene/tags e rode
# "docker compose build --no-cache galene".
FROM golang:1-bookworm AS compilar
ARG GALENE_REF=galene-1.2.1
RUN git clone --depth 1 --branch "${GALENE_REF}" https://github.com/jech/galene /fonte
WORKDIR /fonte
RUN CGO_ENABLED=0 go build -ldflags='-s -w' -o /galene .

FROM alpine:3.20
RUN adduser -D -u 1000 galene && mkdir -p /srv/data /srv/groups /srv/recordings && chown -R galene:galene /srv
COPY --from=compilar /galene /srv/galene
COPY --from=compilar /fonte/static /srv/static
WORKDIR /srv
USER galene
# O Galène lê data/, groups/ e recordings/ da pasta onde roda (os padrões dele); o compose monta os três de fora.
ENTRYPOINT ["/srv/galene"]
