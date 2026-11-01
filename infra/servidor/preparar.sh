#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Prepara do zero o servidor do Instituto: Oracle Cloud, Ampere A1 (ARM), Ubuntu 24.04. Roda uma vez, como root, na
# criação da máquina (campo "cloud-init" da Oracle, que só baixa e chama este arquivo). Passo a passo em
# docs/HOSPEDAGEM.md. Pode rodar de novo sem estragar nada.
#
# O que faz: fuso, memória de reserva, atualizações automáticas de segurança, SSH só com chave, o programa do túnel
# do Cloudflare (cloudflared), o Coolify e a trava que impede conexões de fora direto nos contêineres.
# Não guarda segredo nenhum: o token do túnel e as chaves do site são colados depois, à mão.
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

timedatectl set-timezone America/Sao_Paulo || true
hostnamectl set-hostname lucia || true

# Memória de reserva de 4 GB em disco, para aperto (o site e o Coolify cabem folgados nos 12 GB).
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
apt-get install -y unattended-upgrades curl ca-certificates gnupg jq

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

# SSH só com chave, nunca com senha. O root entra só com chave: é assim que o Coolify fala com a própria máquina.
cat > /etc/ssh/sshd_config.d/90-lucia.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
systemctl reload ssh || systemctl reload sshd || true

# O programa do túnel do Cloudflare, pelo repositório oficial (atualiza junto com o sistema).
mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
  > /etc/apt/sources.list.d/cloudflared.list
apt-get update
apt-get install -y cloudflared

# Coolify: o painel que publica e mantém o site (instala também o Docker).
if [ ! -d /data/coolify/source ]; then
  curl -fsSL https://cdn.coollabs.io/coolify/install.sh -o /root/coolify-install.sh
  bash /root/coolify-install.sh
fi

# Trava: ninguém de fora abre conexão direto com os contêineres. O site e o painel só entram pelo túnel do Cloudflare
# (que sai daqui para fora). A Oracle já bloqueia essas portas na rede dela; esta é a segunda tranca, na própria máquina.
cat > /usr/local/sbin/lucia-trava <<'EOF'
#!/usr/bin/env bash
set -e
placa=$(ip route get 1.1.1.1 | awk '{for (i = 1; i <= NF; i++) if ($i == "dev") { print $(i + 1); exit }}')
iptables -N DOCKER-USER 2>/dev/null || true
iptables -C DOCKER-USER -i "$placa" -m conntrack --ctstate NEW -j DROP 2>/dev/null \
  || iptables -I DOCKER-USER -i "$placa" -m conntrack --ctstate NEW -j DROP
EOF
chmod 755 /usr/local/sbin/lucia-trava
cat > /etc/systemd/system/lucia-trava.service <<'EOF'
[Unit]
Description=Instituto Lucia: nada de fora entra direto nos conteineres
After=docker.service
Wants=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/lucia-trava
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now lucia-trava.service

date -Is > /root/lucia-preparado
echo "Servidor do Instituto Lúcia preparado."
