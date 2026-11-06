#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Prepara a VPS da Contabo (Cloud VPS 4, x86_64, Ubuntu 24.04) para o site. Roda como root, uma vez; pode rodar de novo
# sem estragar nada. Passo a passo em docs/HOSPEDAGEM.md, seção "Contabo".
#
# O que faz: fuso, nome, memória de reserva, atualizações automáticas de segurança, SSH só com chave (portas 22 e 22222:
# a rede de alguns lugares intercepta a 22), Docker, Caddy (o HTTPS na frente do site) e o firewall: as portas 80 e 443
# só aceitam conexões vindas do Cloudflare; o site em si só escuta em 127.0.0.1:3000.
# Não guarda segredo nenhum: as chaves do site ficam em /opt/lucia/site.env, preenchido à mão (infra/contabo/segredos.sh).
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

timedatectl set-timezone America/Sao_Paulo || true
hostnamectl set-hostname lucia || true

# Memória de reserva de 4 GB em disco (a máquina tem 8 GB; o site usa menos de 2).
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
printf 'vm.swappiness=10\n' > /etc/sysctl.d/90-lucia.conf
sysctl --system > /dev/null

apt-get update
apt-get -y -o Dpkg::Options::=--force-confold upgrade
apt-get install -y unattended-upgrades curl ca-certificates gnupg jq ufw docker.io docker-compose-v2 debian-keyring debian-archive-keyring apt-transport-https
# Caddy do repositório oficial (o do Ubuntu 24.04 é o 2.6, sem trusted_proxies).
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
cat > /etc/apt/apt.conf.d/52lucia-upgrades <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF

# SSH só com chave. O 50-cloud-init.conf da Contabo liga a senha; este arquivo vem antes (00-) e vale primeiro.
cat > /etc/ssh/sshd_config.d/00-lucia.conf <<'EOF'
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
rm -f /etc/ssh/sshd_config.d/00-lucia-chave.conf /etc/ssh/sshd_config.d/10-chave.conf
sshd -t
systemctl restart ssh

systemctl enable --now docker

# Firewall: SSH aberto (só chave); 80 e 443 só para os endereços do Cloudflare (lista oficial, atualizada toda semana
# por /etc/cron.weekly/lucia-cloudflare-ips). O contêiner do site publica só em 127.0.0.1, então o Docker não fura isto.
ufw --force reset > /dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 22222/tcp
cat > /usr/local/sbin/lucia-cloudflare-ips <<'EOF'
#!/usr/bin/env bash
# Libera 80 e 443 só para o Cloudflare. Tira as regras antigas marcadas "cloudflare" e põe as da lista atual.
set -euo pipefail
v4=$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v4)
v6=$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v6)
[ -n "$v4" ] && [ -n "$v6" ] || exit 1
while ufw status numbered | grep -q 'cloudflare'; do
  n=$(ufw status numbered | grep 'cloudflare' | head -1 | sed -E 's/^\[ *([0-9]+)\].*/\1/')
  ufw --force delete "$n" > /dev/null
done
for ip in $v4 $v6; do
  ufw allow proto tcp from "$ip" to any port 80,443 comment cloudflare > /dev/null
done
EOF
chmod 755 /usr/local/sbin/lucia-cloudflare-ips
/usr/local/sbin/lucia-cloudflare-ips
printf '#!/bin/sh\n/usr/local/sbin/lucia-cloudflare-ips\n' > /etc/cron.weekly/lucia-cloudflare-ips
chmod 755 /etc/cron.weekly/lucia-cloudflare-ips
ufw --force enable

mkdir -p /opt/lucia
date -Is > /root/lucia-preparado
echo "VPS do Instituto Lúcia preparada."
