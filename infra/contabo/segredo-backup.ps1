# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Grava na VPS o endereço do banco (com a senha) que a cópia diária usa (/opt/lucia/backup.env, só para o root). Fica SEPARADO
# de /opt/lucia/site.env: o site nunca recebe a senha do banco. O endereço não aparece na tela nem fica neste computador.
# Roda no Windows (PowerShell), com a chave SSH do Instituto (~/.ssh/contabo_lucia). Passo a passo: docs/rede/BACKUP-DO-BANCO.md.
#
# De onde vem o endereço: painel do Supabase > botão "Connect" (no alto) > "Session pooler" > copie o "URI" e troque
# [YOUR-PASSWORD] pela senha do banco (Project Settings > Database > Database password; se não souber, "Reset database password").
# Use o "Session pooler" (porta 5432 do pooler): a conexão direta do plano gratuito é só IPv6.
param([string]$Vps = "")
if (-not $Vps) {
  # O endereço da VPS que este computador já conhece (o mesmo que o ssh usa).
  $Vps = (Get-Content "$env:USERPROFILE\.ssh\known_hosts" | ForEach-Object { ($_ -split ' ')[0] } | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' } | Select-Object -First 1)
}
if (-not $Vps) { Write-Host "Não achei o endereço da VPS. Rode assim: .\segredo-backup.ps1 -Vps <IP da VPS>" -ForegroundColor Red; exit 1 }
$chave = "$env:USERPROFILE\.ssh\contabo_lucia"

Write-Host ""
Write-Host "Cole o endereço do banco (postgresql://...) e aperte Enter. Ele NAO aparece na tela." -ForegroundColor Yellow
$seguro = Read-Host -AsSecureString "BANCO_URL"
$texto = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)).Trim()
if ($texto -notmatch '^postgres(ql)?://') { Write-Host "Isso não parece um endereço postgresql://. Nada foi gravado." -ForegroundColor Red; $texto = $null; exit 1 }
if ($texto -match '\[YOUR-PASSWORD\]') { Write-Host "Falta trocar [YOUR-PASSWORD] pela senha. Nada foi gravado." -ForegroundColor Red; $texto = $null; exit 1 }

$remoto = @'
set -e
umask 077
f=/opt/lucia/backup.env
IFS= read -r l
l=${l%$'\r'}
printf 'BANCO_URL=%s\n' "$l" > "$f.novo"
chmod 600 "$f.novo"
mv "$f.novo" "$f"
echo "Endereço gravado em $f. Fazendo a primeira cópia agora (pode levar alguns minutos)..."
systemctl start lucia-backup-banco.service && journalctl -u lucia-backup-banco -n 5 --no-pager -o cat
'@
$texto | ssh -p 22222 -i $chave -o BatchMode=yes "root@$Vps" $remoto.Replace("`r", "")
$texto = $null
Write-Host ""
Write-Host "Pronto. Pode voltar para a conversa." -ForegroundColor Green
