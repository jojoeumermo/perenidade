# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Grava as chaves secretas do site na VPS da Contabo (/opt/lucia/site.env), sem que elas apareçam na tela nem fiquem
# neste computador. Roda no Windows (PowerShell), com a chave SSH do Instituto (~/.ssh/contabo_lucia).
# Para cada chave: cole o valor (botão direito ou Ctrl+V) e aperte Enter. Enter vazio mantém o valor que já estiver lá.
# Depois de gravar, a VPS reinicia o site com as chaves novas em até 2 minutos, sem tirar o site do ar.
$vps = "root@<IP da VPS>"
$chave = "$env:USERPROFILE\.ssh\contabo_lucia"
$nomes = @(
  @{ n = "GOOGLE_FACTCHECK_KEY"; d = "Google Fact Check (checagens de fatos)" },
  @{ n = "CLOUDFLARE_ANALYTICS_TOKEN"; d = "Cloudflare: token de leitura do Analytics (aula ao vivo)" },
  @{ n = "CLOUDFLARE_TURN_KEY_ID"; d = "Cloudflare TURN: Key ID (aula ao vivo)" },
  @{ n = "CLOUDFLARE_TURN_TOKEN"; d = "Cloudflare TURN: token (aula ao vivo)" },
  @{ n = "REDE_PREVIA_SEGREDO"; d = "Alumia: segredo da prévia de link (opcional, invente um texto longo)" },
  @{ n = "ALUMIA_FEDIVERSO_SEGREDO"; d = "Alumia: segredo do Fediverso (opcional)" },
  @{ n = "OG_SEGREDO"; d = "Imagens de compartilhamento (opcional)" },
  @{ n = "CRON_SECRET"; d = "Rotinas agendadas do Instagram (opcional)" },
  @{ n = "INSTAGRAM_TOKEN"; d = "Instagram: token (opcional)" },
  @{ n = "INSTAGRAM_USER_ID"; d = "Instagram: ID da conta (opcional)" },
  @{ n = "GITHUB_PUBLICAR_TOKEN"; d = "Painel: publicar agora (opcional)" },
  @{ n = "GITHUB_LEITURA_TOKEN"; d = "Painel: operação do site (opcional)" },
  @{ n = "CF_TOKEN_CACHE"; d = "Painel: limpar o cache do Cloudflare (opcional)" }
)
$linhas = @("CLOUDFLARE_ACCOUNT_ID=<id da conta Cloudflare>", "CF_ZONE_ID=<id da zona Cloudflare>", "GITHUB_PUBLICAR_REPO=jojoeumermo/perenidade")
Write-Host ""
Write-Host "Cole cada chave e aperte Enter. Ela NAO aparece na tela. Enter vazio = manter a que ja esta na VPS." -ForegroundColor Yellow
Write-Host ""
foreach ($item in $nomes) {
  $seguro = Read-Host -AsSecureString "$($item.n)  ($($item.d))"
  $texto = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro))
  $texto = $texto.Trim()
  if ($texto) { $linhas += "$($item.n)=$texto" } else { $linhas += "#manter $($item.n)" }
  $texto = $null
}
# Junta com o que já está na VPS: linha "#manter X" mantém o valor antigo de X; as outras substituem.
$remoto = @'
set -e
f=/opt/lucia/site.env; touch "$f"; chmod 600 "$f"
novo=$(mktemp); trap 'rm -f "$novo"' EXIT
while IFS= read -r l; do
  l=${l%$'\r'}
  case "$l" in
    "#manter "*) n=${l#\#manter }; grep -E "^$n=" "$f" >> "$novo" || true ;;
    *=*) printf '%s\n' "$l" >> "$novo" ;;
  esac
done
install -m 600 "$novo" "$f"
echo "Chaves gravadas na VPS: $(grep -c '=' "$f") linhas."
systemctl start lucia-atualizar.service || true
'@
($linhas -join "`n") | ssh -p 22222 -i $chave -o BatchMode=yes $vps $remoto.Replace("`r", "")
$linhas = $null
Write-Host ""
Write-Host "Pronto. Pode voltar para a conversa." -ForegroundColor Green
