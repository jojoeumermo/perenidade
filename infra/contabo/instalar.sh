#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Instala na VPS (depois de preparar.sh) o Caddy configurado e a atualização automática do site.
# Espera os arquivos desta pasta em /root/lucia-infra/. Pode rodar de novo.
set -euxo pipefail
cd /root/lucia-infra

install -m 644 Caddyfile /etc/caddy/Caddyfile
mkdir -p /var/log/caddy && chown caddy:caddy /var/log/caddy
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable caddy
systemctl reload caddy || systemctl restart caddy

install -m 755 atualizar.sh /usr/local/sbin/lucia-atualizar
mkdir -p /opt/lucia
[ -f /opt/lucia/site.env ] || { install -m 600 /dev/null /opt/lucia/site.env; }

cat > /etc/systemd/system/lucia-atualizar.service <<'EOF'
[Unit]
Description=Instituto Lucia: poe no ar a versao nova do site
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/lucia-atualizar
EOF
cat > /etc/systemd/system/lucia-atualizar.timer <<'EOF'
[Unit]
Description=Instituto Lucia: confere a cada 2 minutos se ha versao nova do site

[Timer]
OnBootSec=30s
OnUnitActiveSec=2min
Persistent=true

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now lucia-atualizar.timer

# Fediverso da Alumia: a cada 30 segundos, cutuca a fila de entrega no próprio site (docs/rede/FEDIVERSO-OPERACAO.md).
# Com a federação desligada o site responde 404 e nada acontece: pode ficar instalado desde já.
install -m 755 fediverso-entregar.sh /usr/local/sbin/lucia-fediverso
install -m 644 lucia-fediverso.service lucia-fediverso.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now lucia-fediverso.timer

# Cópia diária do banco (o plano gratuito do Supabase não faz backup): docs/rede/BACKUP-DO-BANCO.md. Sem o endereço do banco
# (/opt/lucia/backup.env, gravado por segredo-backup.ps1), a rodada só avisa e não faz nada.
install -m 700 backup-banco.sh /usr/local/sbin/lucia-backup-banco
install -m 644 lucia-backup-banco.service lucia-backup-banco.timer /etc/systemd/system/
docker pull -q postgres:17-alpine
systemctl daemon-reload
systemctl enable --now lucia-backup-banco.timer
echo "Instalado."
