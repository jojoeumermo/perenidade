# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Grava na VPS o endereço do banco (com a senha) que a cópia diária usa (/opt/lucia/backup.env, só para o root). Fica SEPARADO
# de /opt/lucia/site.env: o site nunca recebe a senha do banco. O endereço não aparece na tela nem fica neste computador.
# Roda no Windows (PowerShell), com a chave SSH do Instituto (~/.ssh/contabo_lucia). Passo a passo: docs/rede/BACKUP-DO-BANCO.md.
#
# De onde vem o endereço: painel do Supabase > botão "Connect" (no alto) > "Session pooler" > copie o "URI" e troque
# [YOUR-PASSWORD] pela senha do banco (Project Settings > Database > Database password; se não souber, "Reset database password").
# Use o "Session pooler" (porta 5432 do pooler): a conexão direta do plano gratuito é só IPv6.
# O destino é o apelido "lucia-vps" do ~/.ssh/config da coordenação (com o IP, a porta e a chave: docs/HOSPEDAGEM.md, "Entrar na
# VPS"). Nada de IP nem porta neste arquivo, que é público.
# Atalho: -Modelo 'postgresql://...[YOUR-PASSWORD]@...' (o URI do painel como está) faz o script pedir só a senha.
param([string]$Vps = "lucia-vps", [string]$Modelo = "")

Write-Host ""
if ($Modelo -match '\[YOUR-PASSWORD\]') {
  Write-Host "Digite (ou cole) a SENHA do banco e aperte Enter. Ela NAO aparece na tela." -ForegroundColor Yellow
  $seguro = Read-Host -AsSecureString "Senha"
  $senha = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)).Trim()
  $texto = $Modelo.Replace('[YOUR-PASSWORD]', [Uri]::EscapeDataString($senha))
  $senha = $null
} else {
  Write-Host "Cole o endereço do banco (postgresql://...) e aperte Enter. Ele NAO aparece na tela." -ForegroundColor Yellow
  $seguro = Read-Host -AsSecureString "BANCO_URL"
  $texto = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)).Trim()
}
if ($texto -notmatch '^postgres(ql)?://') { Write-Host "Isso não parece um endereço postgresql://. Nada foi gravado." -ForegroundColor Red; $texto = $null; exit 1 }
if ($texto -match '\[YOUR-PASSWORD\]') { Write-Host "Falta trocar [YOUR-PASSWORD] pela senha. Nada foi gravado." -ForegroundColor Red; $texto = $null; exit 1 }

$remoto = @'
set -e
umask 077
f=/opt/lucia/backup.env
IFS= read -r l
l=${l%$'\r'}
l=${l#$'\xef\xbb\xbf'}
printf 'BANCO_URL=%s\n' "$l" > "$f.novo"
chmod 600 "$f.novo"
mv "$f.novo" "$f"
echo "Endereço gravado em $f. Fazendo a primeira cópia agora (pode levar alguns minutos)..."
systemctl start lucia-backup-banco.service && journalctl -u lucia-backup-banco -n 5 --no-pager -o cat
'@
# O roteiro vai em base64: o Windows PowerShell 5.1 come as aspas dos argumentos de programas externos (como o ssh).
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remoto.Replace("`r", "")))
$texto | ssh -o BatchMode=yes $Vps "echo $b64 | base64 -d > /root/.lucia-segredo.sh && bash /root/.lucia-segredo.sh; s=`$?; rm -f /root/.lucia-segredo.sh; exit `$s"
$ok = ($LASTEXITCODE -eq 0)
$texto = $null
Write-Host ""
if ($ok) { Write-Host "Pronto. Pode voltar para a conversa." -ForegroundColor Green }
else { Write-Host "Deu erro (veja acima). Pode voltar para a conversa." -ForegroundColor Red; exit 1 }
