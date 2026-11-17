# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Grava as chaves secretas do site na VPS da Contabo (/opt/lucia/site.env), sem que elas apareçam na tela nem fiquem
# neste computador. Roda no Windows (PowerShell), com a chave SSH do Instituto (~/.ssh/contabo_lucia).
# Para cada chave: cole o valor (botão direito ou Ctrl+V) e aperte Enter. Enter vazio mantém o valor que já estiver lá.
# Depois de gravar, a VPS reinicia o site com as chaves novas em até 2 minutos, sem tirar o site do ar.
# O endereço da VPS não fica no repositório (público). Use o apelido "lucia-vps" do ~/.ssh/config (com IP, porta e chave)
# ou defina LUCIA_VPS antes de rodar.
$vps = if ($env:LUCIA_VPS) { $env:LUCIA_VPS } else { "lucia-vps" }
$nomes = @(
  @{ n = "SUPABASE_SERVICE_ROLE_KEY"; d = "Supabase: chave de servico (service_role), obrigatoria para a Alumia (entrada, video, encerrar sessoes)" },
  @{ n = "CLOUDFLARE_ACCOUNT_ID"; d = "Cloudflare: ID da conta (Enter mantém o que já está na VPS)" },
  @{ n = "CF_ZONE_ID"; d = "Cloudflare: ID da zona institutolucia.org (Enter mantém)" },
  @{ n = "GOOGLE_FACTCHECK_KEY"; d = "Google Fact Check (checagens de fatos)" },
  @{ n = "CLOUDFLARE_ANALYTICS_TOKEN"; d = "Cloudflare: token de leitura do Analytics (aula ao vivo)" },
  @{ n = "CLOUDFLARE_TURN_KEY_ID"; d = "Cloudflare TURN: Key ID (aula ao vivo)" },
  @{ n = "CLOUDFLARE_TURN_TOKEN"; d = "Cloudflare TURN: token (aula ao vivo)" },
  @{ n = "TURNSTILE_SECRET_KEY"; d = "Cloudflare Turnstile: chave secreta do desafio da entrada (conferida no servidor; opcional)" },
  @{ n = "GOOGLE_SAFE_BROWSING_KEY"; d = "Alumia: Google Safe Browsing, conferência dos links dos posts pelo servidor (opcional; a mesma da avaliação)" },
  @{ n = "REDE_PREVIA_SEGREDO"; d = "Alumia: segredo da prévia de link (opcional, invente um texto longo)" },
  @{ n = "ALUMIA_FEDIVERSO_SEGREDO"; d = "Alumia: segredo do Fediverso (opcional)" },
  @{ n = "OG_SEGREDO"; d = "Imagens de compartilhamento (opcional)" },
  @{ n = "CRON_SECRET"; d = "Rotinas agendadas do Instagram (opcional)" },
  @{ n = "INSTAGRAM_TOKEN"; d = "Instagram: token (opcional)" },
  @{ n = "INSTAGRAM_USER_ID"; d = "Instagram: ID da conta (opcional)" },
  @{ n = "GITHUB_PUBLICAR_TOKEN"; d = "Painel: publicar agora (opcional)" },
  @{ n = "GITHUB_LEITURA_TOKEN"; d = "Painel: operação do site (opcional)" },
  @{ n = "CF_TOKEN_CACHE"; d = "Painel: limpar o cache do Cloudflare (opcional)" },
  # T03: o assistente em todo o site (app/api/assistente) usa IAs gratuitas em rodizio. Basta uma; as mesmas do robo do Vale.
  @{ n = "GROQ_API_KEY"; d = "Assistente do site: Groq, plano gratuito (console.groq.com)" },
  @{ n = "GEMINI_API_KEY"; d = "Assistente do site: Google Gemini, plano gratuito (aistudio.google.com/apikey); le fotos" },
  @{ n = "CEREBRAS_API_KEY"; d = "Assistente do site: Cerebras, plano gratuito (cloud.cerebras.ai)" },
  @{ n = "OPENROUTER_API_KEY"; d = "Assistente do site: OpenRouter, modelos :free (openrouter.ai/keys)" }
)
$linhas = @("GITHUB_PUBLICAR_REPO=jojoeumermo/perenidade")
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
# Junta com o que já está na VPS: parte do arquivo de lá inteiro (as chaves que não estão nesta lista, como os segredos
# gerados na própria VPS, ficam); "#manter X" não muda X; "X=valor" troca só X.
$remoto = @'
set -e
f=/opt/lucia/site.env; touch "$f"; chmod 600 "$f"
novo=$(mktemp); trap 'rm -f "$novo" "$novo.t"' EXIT
cp -a "$f" "$novo"
while IFS= read -r l; do
  l=${l%$'\r'}
  case "$l" in
    "#manter "*) ;;
    *=*) n=${l%%=*}; grep -v "^$n=" "$novo" > "$novo.t" || true; mv "$novo.t" "$novo"; printf '%s\n' "$l" >> "$novo" ;;
  esac
done
install -m 600 "$novo" "$f"
echo "Chaves gravadas na VPS: $(grep -c '=' "$f") linhas."
systemctl start lucia-atualizar.service || true
'@
($linhas -join "`n") | ssh -o BatchMode=yes $vps $remoto.Replace("`r", "")
$linhas = $null
Write-Host ""
Write-Host "Pronto. Pode voltar para a conversa." -ForegroundColor Green
