#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Prepara a VPS da Contabo (Cloud VPS 4, x86_64, Ubuntu 24.04) para o site. Roda como root, uma vez; pode rodar de novo
# sem estragar nada. Passo a passo em docs/HOSPEDAGEM.md, seção "Contabo".
#
# O que faz: fuso, memória de reserva, atualizações de segurança, SSH só com chave e com fail2ban, Docker, Caddy (HTTPS) e o
# firewall (80 e 443 só do Cloudflare). Os valores da operação vêm do ambiente e não ficam no repositório: SSH_PORTA_EXTRA,
# LUCIA_ADMIN e os limites do fail2ban (F2B_TENTATIVAS, F2B_JANELA, F2B_BLOQUEIO, F2B_BLOQUEIO_MAXIMO; sem eles, valores comuns).
# Não guarda segredo nenhum (infra/contabo/segredos.sh).
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
# IPv6 desligado (o site só usa IPv4).
printf 'vm.swappiness=10\nnet.ipv6.conf.all.disable_ipv6=1\nnet.ipv6.conf.default.disable_ipv6=1\n' > /etc/sysctl.d/90-lucia.conf
sysctl --system > /dev/null

apt-get update
apt-get -y -o Dpkg::Options::=--force-confold upgrade
apt-get install -y unattended-upgrades fail2ban curl ca-certificates gnupg jq ufw docker.io docker-compose-v2 debian-keyring debian-archive-keyring apt-transport-https
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
# Entrar como root: só com chave, enquanto não houver outra conta. Com LUCIA_ADMIN (o nome de uma conta comum, anotado fora do
# repositório), o script cria essa conta com sudo, copia para ela a chave que hoje entra como root e fecha o root no SSH. Só fecha
# o root se a conta nova tiver uma chave: assim ninguém se tranca fora. Teste a entrada pela conta nova ANTES de sair da sessão.
raiz_ssh=prohibit-password
if [ -n "${LUCIA_ADMIN:-}" ] && [[ "$LUCIA_ADMIN" =~ ^[a-z][a-z0-9_-]{1,30}$ ]]; then
  id "$LUCIA_ADMIN" > /dev/null 2>&1 || adduser --disabled-password --gecos "" "$LUCIA_ADMIN"
  usermod -aG sudo "$LUCIA_ADMIN"
  install -d -m 700 -o "$LUCIA_ADMIN" -g "$LUCIA_ADMIN" "/home/$LUCIA_ADMIN/.ssh"
  if [ ! -s "/home/$LUCIA_ADMIN/.ssh/authorized_keys" ] && [ -s /root/.ssh/authorized_keys ]; then
    install -m 600 -o "$LUCIA_ADMIN" -g "$LUCIA_ADMIN" /root/.ssh/authorized_keys "/home/$LUCIA_ADMIN/.ssh/authorized_keys"
  fi
  # A conta não tem senha: o sudo dela não pede nada além da chave do SSH.
  printf '%s ALL=(ALL) NOPASSWD:ALL\n' "$LUCIA_ADMIN" > /etc/sudoers.d/90-lucia-admin
  chmod 440 /etc/sudoers.d/90-lucia-admin
  visudo -cf /etc/sudoers.d/90-lucia-admin
  if [ -s "/home/$LUCIA_ADMIN/.ssh/authorized_keys" ]; then raiz_ssh=no; fi
fi
cat > /etc/ssh/sshd_config.d/00-lucia.conf <<EOF
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin $raiz_ssh
MaxAuthTries 3
X11Forwarding no
AllowAgentForwarding no
EOF
rm -f /etc/ssh/sshd_config.d/00-lucia-chave.conf /etc/ssh/sshd_config.d/10-chave.conf
sshd -t
systemctl restart ssh

# fail2ban no SSH, com os limites do ambiente (conferidos: número; duração como 10m, 1h, 1w). Vê só quem tenta entrar no SSH,
# nunca quem visita o site, e guarda o endereço só enquanto dura o bloqueio.
duracao() { [[ "$1" =~ ^[1-9][0-9]{0,4}[smhdw]$ ]] && printf '%s' "$1" || printf '%s' "$2"; }
f2b_tentativas=5
if [[ "${F2B_TENTATIVAS:-}" =~ ^[1-9][0-9]?$ ]]; then f2b_tentativas=$F2B_TENTATIVAS; fi
f2b_janela=$(duracao "${F2B_JANELA:-}" 10m)
f2b_bloqueio=$(duracao "${F2B_BLOQUEIO:-}" 1h)
f2b_maximo=$(duracao "${F2B_BLOQUEIO_MAXIMO:-}" 1w)
cat > /etc/fail2ban/jail.d/lucia.conf <<EOF
[DEFAULT]
backend = systemd
bantime = $f2b_bloqueio
findtime = $f2b_janela
maxretry = $f2b_tentativas
bantime.increment = true
bantime.maxtime = $f2b_maximo

[sshd]
enabled = true
port = 22${SSH_PORTA_EXTRA:+,${SSH_PORTA_EXTRA}}
EOF
systemctl enable fail2ban
systemctl restart fail2ban

systemctl enable --now docker

# Firewall: SSH aberto (só chave); 80 e 443 só para os endereços do Cloudflare (lista oficial, atualizada toda semana
# por /etc/cron.weekly/lucia-cloudflare-ips). O contêiner do site publica só em 127.0.0.1, então o Docker não fura isto.
ufw --force reset > /dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
# A porta extra do SSH vem do ambiente (anotada fora do repositório). Sem ela, só a 22.
if [ -n "${SSH_PORTA_EXTRA:-}" ]; then ufw allow "${SSH_PORTA_EXTRA}/tcp"; fi
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
