# Rotação de chaves

Nenhuma chave fica no código nem no histórico do git (a rotina "Segurança" confere com o gitleaks a cada envio).
Cada chave mora num lugar só e tem um prazo. Troque também, na hora, qualquer chave que tenha aparecido em tela
compartilhada, print, conversa ou registro.

| Chave | Onde fica | Quem usa | Prazo | Como trocar |
| --- | --- | --- | --- | --- |
| Segredo JWT / `service_role` do Supabase | Supabase (gera), GitHub Actions (`SUPABASE_SERVICE_ROLE_KEY`), Edge Functions (automático) | publicação, e-mails, Edge Functions | 12 meses ou suspeita | Supabase → Project Settings → API → rotacionar; atualizar o segredo no GitHub. A chave anon muda junto: atualizar `NEXT_PUBLIC_SUPABASE_ANON_KEY` na Vercel e publicar. Encerra todas as sessões. |
| `RESEND_API_KEY` | GitHub Actions, Edge Functions, SMTP do Supabase | e-mails | 12 meses | Resend → API Keys → criar nova com permissão só de envio → trocar nos três lugares → apagar a antiga |
| `GITHUB_PUBLICAR_TOKEN` | Vercel | "Publicar agora" | 90 dias (o token vence) | GitHub → token fine-grained só deste repositório, só "Actions: write" |
| `SUPABASE_ACCESS_TOKEN` | GitHub Actions | publicar Edge Functions | 90 dias | Supabase → Account → Access Tokens |
| `INSTAGRAM_TOKEN` | Vercel | estúdio | 60 dias (o token de longa duração vence) | ver `docs/ESTUDIO-INSTAGRAM.md` |
| `YOUTUBE_CLIENT_SECRET` e `YOUTUBE_REFRESH_TOKEN` | Edge Functions | canal | 12 meses ou suspeita | ver `docs/YOUTUBE.md` |
| `CRON_SECRET` / `ESTUDIO_CRON_SECRET` | Vercel, GitHub, banco (`interno.segredos`) | agenda do Instagram | 12 meses | sortear 32+ caracteres e trocar nos três lugares ao mesmo tempo |
| Chaves de IA (Anthropic, Groq, Cerebras, Gemini, OpenRouter, OpenAI) | Edge Functions | assistente, moderação, transcrição | 12 meses | painel de cada provedor; pôr limite de gasto mensal |
| `CLOUDFLARE_TURN_TOKEN` (e `CLOUDFLARE_TURN_KEY_ID`) | Vercel | aulas ao vivo (retransmissão) | 12 meses | Cloudflare → Realtime → Servidor TURN → criar chave nova, trocar na Vercel, apagar a antiga |
| `BACKUP_DB_URL`, `BACKUP_SENHA` | GitHub Actions | cópia do banco | 12 meses (a senha do banco) | trocar a senha do banco no Supabase e o segredo; a `BACKUP_SENHA` antiga continua abrindo as cópias antigas |
| `GOOGLE_FACTCHECK_KEY`, `GOOGLE_SAFE_BROWSING_KEY` | Vercel / Edge Functions | checagens, moderação | 12 meses | Google Cloud → restringir a chave à API usada |

Depois de trocar: conferir que a rotina correspondente roda verde e anotar a data aqui.

| Chave | Última troca |
| --- | --- |
| (preencher) | |
