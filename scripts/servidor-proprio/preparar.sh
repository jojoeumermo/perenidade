#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Prepara uma VPS (Ubuntu 24.04, x86_64 ou ARM) para uma organização rodar a PRÓPRIA instância da Alumia, federada, sem depender
# do servidor do Instituto. Roda como root, uma vez; pode rodar de novo sem estragar nada. Passo a passo e o que vem antes (banco,
# domínio) em docs/rede/servidor-proprio/LEIA.md. Feito a partir dos scripts de infra/ do Instituto, sem nada dele: nenhum
# endereço, porta, domínio ou segredo do Instituto mora aqui. Tudo vem das variáveis abaixo.
#
# Uso (exemplo; troque pelos seus valores):
#   sudo DOMINIO=suaorg.org REPO=https://endereco-do-codigo.git bash preparar.sh
#
# Variáveis:
#   DOMINIO        obrigatória. O domínio da organização. O site fica em DOMINIO e a Alumia em alumia.DOMINIO (o código reconhece
#                  a Alumia pelo começo "alumia." do endereço). Os dois registros A do DNS apontam para esta máquina.
#   REPO           obrigatória. O endereço git do código (o repositório público da Alumia ou a sua cópia dele).
#   VERSAO         ramo ou etiqueta do código (padrão: master).
#   EMAIL_ACME     e-mail para o Let's Encrypt avisar de certificado vencendo (opcional, recomendado).
#   PORTA_SSH      porta do SSH (padrão: 22).
#   FUSO           fuso horário (padrão: America/Sao_Paulo).
#   RESERVA_GB     memória de reserva em disco, em GB (padrão: 4; 0 não cria).
#   ATUALIZAR_SOZINHO=sim  confere uma versão nova do código toda madrugada e põe no ar (padrão: só à mão, com alumia-atualizar).
#   ENTREGA_POR_TIMER=sim  chama a fila do Fediverso a cada minuto pelo próprio servidor (use quando o banco não tem pg_cron/pg_net).
#
# O que faz: fuso, memória de reserva, atualizações automáticas de segurança, SSH só com chave, Docker, Caddy (o HTTPS, com
# certificado do Let's Encrypt), o firewall (só SSH, 80 e 443), a cópia do código, o arquivo das chaves com os segredos GERADOS
# AQUI (cada organização tem os seus), o Caddyfile e os comandos alumia-atualizar e alumia-copia. Não mostra segredo nenhum na tela.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

: "${DOMINIO:?Defina DOMINIO (ex.: DOMINIO=suaorg.org)}"
: "${REPO:?Defina REPO (o endereço git do código)}"
VERSAO=${VERSAO:-master}
PORTA_SSH=${PORTA_SSH:-22}
FUSO=${FUSO:-America/Sao_Paulo}
RESERVA_GB=${RESERVA_GB:-4}
EMAIL_ACME=${EMAIL_ACME:-}
BASE=/opt/alumia
AQUI=$(cd "$(dirname "$0")" && pwd)

[ "$(id -u)" -eq 0 ] || { echo "Rode como root (sudo)."; exit 1; }
[[ "$DOMINIO" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || { echo "DOMINIO inválido: use só o domínio, sem https:// e sem barra."; exit 1; }
[[ "$PORTA_SSH" =~ ^[0-9]+$ ]] || { echo "PORTA_SSH inválida."; exit 1; }

# Antes de desligar a senha do SSH: precisa existir uma chave autorizada, senão a máquina fica sem entrada.
if ! compgen -G "/root/.ssh/authorized_keys" > /dev/null && ! compgen -G "/home/*/.ssh/authorized_keys" > /dev/null; then
  echo "Nenhuma chave SSH autorizada nesta máquina. Ponha a sua chave pública em ~/.ssh/authorized_keys antes (veja LEIA.md, passo 2)."
  exit 1
fi

set -x
timedatectl set-timezone "$FUSO" || true

if [ "$RESERVA_GB" -gt 0 ] && [ ! -f /swapfile ]; then
  fallocate -l "${RESERVA_GB}G" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
printf 'vm.swappiness=10\n' > /etc/sysctl.d/90-alumia.conf
sysctl --system > /dev/null

apt-get update
apt-get -y -o Dpkg::Options::=--force-confold upgrade
apt-get install -y unattended-upgrades curl ca-certificates gnupg jq git ufw age docker.io docker-compose-v2 \
  debian-keyring debian-archive-keyring apt-transport-https
# Caddy do repositório oficial dele.
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

# Atualizações de segurança todo dia, com reinício às 4h30 quando o sistema pedir (o site volta sozinho).
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat > /etc/apt/apt.conf.d/52alumia-upgrades <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF

# SSH só com chave, na porta escolhida.
cat > /etc/ssh/sshd_config.d/00-alumia.conf <<EOF
Port $PORTA_SSH
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
sshd -t
systemctl restart ssh || systemctl restart sshd

systemctl enable --now docker

# Firewall: SSH, 80 e 443. O site só escuta em 127.0.0.1 (o contêiner publica só ali), então o Docker não fura isto.
ufw --force reset > /dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow "$PORTA_SSH"/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# O código.
mkdir -p "$BASE"
if [ -d "$BASE/codigo/.git" ]; then
  git -C "$BASE/codigo" remote set-url origin "$REPO"
else
  git clone --depth 1 --branch "$VERSAO" "$REPO" "$BASE/codigo"
fi
printf 'VERSAO=%s\nDOMINIO=%s\n' "$VERSAO" "$DOMINIO" > "$BASE/instancia.env"

# As chaves do site. Criado UMA vez, com os segredos gerados aqui (openssl rand, 32 bytes em hexadecimal). Rodar de novo não troca
# nada: trocar um segredo é decisão da organização (veja LEIA.md, "Segredos"). O arquivo só o root lê, e nada dele vai para a tela.
set +x
if [ ! -f "$BASE/site.env" ]; then
  umask 077
  gerar() { openssl rand -hex 32; }
  cat > "$BASE/site.env" <<EOF
# Chaves da instância da Alumia de $DOMINIO. Só o root lê (permissão 600). Nunca vá para o git, o chat ou um print.
# Os NEXT_PUBLIC_* são públicos (vão para o navegador) e entram na montagem: mudou um, rode alumia-atualizar.

# Endereços
NEXT_PUBLIC_SITE_URL=https://$DOMINIO
NEXT_PUBLIC_ALUMIA_URL=https://alumia.$DOMINIO

# O banco (Supabase): a "Project URL" e a chave "anon public" (passo 1 do LEIA.md)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# A chave service_role: só o servidor usa (exportar dados, faxina). Nunca com o prefixo NEXT_PUBLIC_.
SUPABASE_SERVICE_ROLE_KEY=

# O que fica ligado (docs/RECURSOS.md). Para a Alumia: rede-v2 e alumia-2; o Fediverso: fediverso-total (e fediverso-grupos).
NEXT_PUBLIC_RECURSOS=rede-v2,alumia-2,alumia-org,alumia-stories

# Segredos gerados nesta máquina, só desta instância
ALUMIA_IMPRESSAO_SEGREDO=$(gerar)
ALUMIA_FEDIVERSO_SEGREDO=$(gerar)
REDE_PREVIA_SEGREDO=$(gerar)
OG_SEGREDO=$(gerar)
ALUMIA_FAXINA_SEGREDO=$(gerar)
ALUMIA_VOTO_SEGREDO=$(gerar)
EOF
  chmod 600 "$BASE/site.env"
  echo "Arquivo de chaves criado em $BASE/site.env (os segredos foram gerados e não aparecem aqui)."
fi
# O segredo do voto chegou depois (onda 9): a máquina preparada antes ganha o dela, uma vez, sem mostrar na tela. Nunca troque um
# que já existe com consulta aberta ou enquete em andamento.
if ! grep -q '^ALUMIA_VOTO_SEGREDO=' "$BASE/site.env"; then
  echo "ALUMIA_VOTO_SEGREDO=$(gerar)" >> "$BASE/site.env"
  echo "ALUMIA_VOTO_SEGREDO acrescentado a $BASE/site.env."
fi
set -x

# O HTTPS: o Caddy pede e renova sozinho o certificado do Let's Encrypt para os dois endereços. Registro mínimo, sem endereço de
# rede (IP), sem cabeçalhos e sem o que vem depois do "?", guardado no máximo 7 dias.
mkdir -p /var/log/caddy && chown caddy:caddy /var/log/caddy
{
  echo "{"
  [ -n "$EMAIL_ACME" ] && echo "	email $EMAIL_ACME"
  echo "}"
  cat <<EOF

$DOMINIO, alumia.$DOMINIO {
	encode zstd gzip
	@estatico {
		path /_next/static/*
		file {
			root $BASE/estatico
		}
	}
	handle @estatico {
		root * $BASE/estatico
		header Cache-Control "public, max-age=31536000, immutable"
		file_server
	}
	reverse_proxy 127.0.0.1:3001 127.0.0.1:3002 {
		lb_policy first
		lb_try_duration 10s
		fail_duration 10s
		health_uri /robots.txt
		health_interval 5s
		health_timeout 3s
	}
	log {
		output file /var/log/caddy/site.log {
			roll_size 20MiB
			roll_keep 7
			roll_keep_for 168h
		}
		format filter {
			wrap json
			fields {
				request>headers delete
				request>remote_ip delete
				request>remote_port delete
				request>client_ip delete
				request>tls delete
				resp_headers delete
				request>uri regexp \?.*$ ""
			}
		}
	}
}
EOF
} > /etc/caddy/Caddyfile
mkdir -p "$BASE/estatico"
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable caddy
systemctl reload caddy || systemctl restart caddy

# Os comandos: alumia-atualizar (monta e põe no ar a versão do código) e alumia-copia (cópia cifrada do banco).
install -m 755 "$AQUI/atualizar.sh" /usr/local/sbin/alumia-atualizar
install -m 755 "$AQUI/copia.sh" /usr/local/sbin/alumia-copia

cat > /etc/systemd/system/alumia-atualizar.service <<'EOF'
[Unit]
Description=Alumia: monta e poe no ar a versao do codigo
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
TimeoutStartSec=90min
ExecStart=/usr/local/sbin/alumia-atualizar
EOF
cat > /etc/systemd/system/alumia-atualizar.timer <<'EOF'
[Unit]
Description=Alumia: confere toda madrugada se ha versao nova do codigo

[Timer]
OnCalendar=*-*-* 03:30
RandomizedDelaySec=20min
Persistent=true

[Install]
WantedBy=timers.target
EOF

cat > /etc/systemd/system/alumia-copia.service <<'EOF'
[Unit]
Description=Alumia: copia cifrada do banco
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/alumia-copia
EOF
cat > /etc/systemd/system/alumia-copia.timer <<'EOF'
[Unit]
Description=Alumia: copia cifrada do banco toda madrugada

[Timer]
OnCalendar=*-*-* 02:15
Persistent=true

[Install]
WantedBy=timers.target
EOF

# A fila do Fediverso pelo próprio servidor, a cada minuto (só quando o banco não tem pg_cron e pg_net para chamar a rota).
cat > /etc/systemd/system/alumia-fediverso.service <<EOF
[Unit]
Description=Alumia: entrega a fila do Fediverso

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -fsS -o /dev/null --max-time 55 -X POST https://alumia.$DOMINIO/api/fediverso/entregar
EOF
cat > /etc/systemd/system/alumia-fediverso.timer <<'EOF'
[Unit]
Description=Alumia: chama a fila do Fediverso a cada minuto

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
[ "${ATUALIZAR_SOZINHO:-}" = "sim" ] && systemctl enable --now alumia-atualizar.timer
[ "${ENTREGA_POR_TIMER:-}" = "sim" ] && systemctl enable --now alumia-fediverso.timer
# A cópia só liga depois de configurada (LEIA.md, "Cópia do banco"): sem $BASE/copia.env, o comando avisa e sai.
[ -f "$BASE/copia.env" ] && systemctl enable --now alumia-copia.timer

set +x
date -Is > "$BASE/preparado"
echo
echo "Máquina preparada para $DOMINIO e alumia.$DOMINIO."
echo "Agora: preencha o banco em $BASE/site.env (nano $BASE/site.env) e rode: alumia-atualizar"
