# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Grava na VPS as credenciais do balde do Cloudflare R2 da cópia de fora (/etc/lucia/copia-externa.env, só do root), sem que
# elas apareçam na tela nem fiquem neste computador. Roda no Windows (PowerShell), com o apelido "lucia-vps" do ~/.ssh/config
# (ou LUCIA_VPS). Depois de gravar, manda uma cópia de fora na hora, para conferir.
#
# Antes, no painel da Cloudflare (R2):
#   1. Crie o balde (ex.: lucia-copias), com uma regra de trava (Bucket lock) e uma de ciclo de vida (apagar depois de N dias).
#   2. Em "Manage API tokens", crie um token "Object Read & Write" que vale SÓ para esse balde. Ele mostra o Access Key ID e o
#      Secret Access Key uma vez: cole aqui.
$vps = if ($env:LUCIA_VPS) { $env:LUCIA_VPS } else { "lucia-vps" }
$nomes = @(
  @{ n = "R2_CONTA"; d = "ID da conta da Cloudflare (o que aparece no endereco <id>.r2.cloudflarestorage.com)" },
  @{ n = "R2_BALDE"; d = "Nome do balde (ex.: lucia-copias)" },
  @{ n = "R2_CHAVE_ID"; d = "Access Key ID do token do R2" },
  @{ n = "R2_CHAVE_SECRETA"; d = "Secret Access Key do token do R2" }
)
$linhas = @()
Write-Host ""
Write-Host "Cole cada valor e aperte Enter. Ele NAO aparece na tela." -ForegroundColor Yellow
Write-Host ""
foreach ($item in $nomes) {
  $seguro = Read-Host -AsSecureString "$($item.n)  ($($item.d))"
  $texto = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)).Trim()
  if (-not $texto) { Write-Host "Faltou $($item.n). Nada foi gravado." -ForegroundColor Red; exit 1 }
  if ($texto -notmatch '^[A-Za-z0-9._-]+$') { Write-Host "$($item.n) tem caracteres que nao esperava. Nada foi gravado." -ForegroundColor Red; exit 1 }
  $linhas += "$($item.n)=$texto"
  $texto = $null
}
$remoto = @'
set -e
f=/etc/lucia/copia-externa.env
novo=$(mktemp); trap 'rm -f "$novo"' EXIT
while IFS= read -r l || [ -n "$l" ]; do printf '%s\n' "${l%$'\r'}" >> "$novo"; done
install -m 600 -o root -g root "$novo" "$f"
echo "Credenciais gravadas na VPS."
systemctl start lucia-copia-externa.service && echo "Cópia de fora enviada e conferida." || { echo "A cópia de fora FALHOU:"; journalctl -u lucia-copia-externa -n 15 --no-pager -o cat; exit 1; }
'@
($linhas -join "`n") | ssh -o BatchMode=yes $vps $remoto.Replace("`r", "")
$linhas = $null
Write-Host ""
Write-Host "Pronto. Pode voltar para a conversa." -ForegroundColor Green
