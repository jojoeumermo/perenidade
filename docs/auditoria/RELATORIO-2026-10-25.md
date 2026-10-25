# Varredura de segurança e de bugs — 25/10/2026

Pasta de trabalho: `C:\Users\0177\perenidade-varredura` (git worktree), branch `varredura-seguranca`, a partir do
`master` de 25/10 (`249222f`). As outras sessões abertas não foram tocadas.

Referências usadas: OWASP Top 10:2025, OWASP API Security Top 10 (2023) e OWASP ASVS (sessão, controle de acesso,
arquivos e configuração). A auditoria anterior (15/10, `docs/auditoria/RELATORIO.md`) foi conferida item por item.

## 1. Resumo

| Gravidade | Achados | Corrigidos no código | Ficam com você |
| --- | --- | --- | --- |
| Crítico | 1 | 1 | 0 |
| Alto | 3 | 2 | 1 (configuração no Supabase) |
| Médio | 5 | 5 | 0 |
| Baixo | 9 | 7 | 2 (recomendações) |

Os três pontos mais graves:

1. **Next.js com falhas críticas publicadas** (execução remota de código no otimizador de imagens e em `use cache`,
   negação de serviço em Server Actions). Atualizado para 16.4.3, e o otimizador agora só serve o que o próprio build
   importou.
2. **Um link de projeto da IDE podia tomar a conta de quem clicasse em "Rodar"**. O código roda num Worker do mesmo
   endereço do site, e de lá escutava o canal por onde o serviço de contas repassa a sessão (com o token de renovação)
   a cada renovação; também alcançava o chaveiro das conversas cifradas (IndexedDB). Agora uma trava roda antes de
   qualquer código e fecha o canal, o IndexedDB, os caches e a criação de outro Worker.
3. **Aulas ao vivo: qualquer pessoa, sem conta, podia transmitir vídeo para os alunos** e descobrir o endereço de rede
   deles. O canal da sala é aberto e o navegador do aluno aceitava ligação de qualquer um. Agora quem conduz registra uma
   chave no banco e assina a presença e cada sinal; o navegador de quem assiste só aceita vídeo assinado.

## 2. Achados

Status: **corrigido** (no código, com teste) · **manual** (configuração sua) · **recomendação**.

| ID | Grav. | Onde | O problema | Status |
| --- | --- | --- | --- | --- |
| V1 | CRÍTICO | `package.json` (next 16.3.8) | Avisos GHSA-2464-fhr4-w9xw e GHSA-673q-mjm6-r5xr (execução remota de código) e GHSA-p3m5-59mp-jv5r (negação de serviço). O `/_next/image` estava ativo em produção. | **corrigido**: next e eslint-config-next 16.4.3; `images.localPatterns` só para `/_next/static/media/**`, sem endereço de fora nem SVG |
| V2 | ALTO | `public/workers/*`, IDE, blocos "Programar" | Código de quem estuda (inclusive de um link `#projeto=`) rodava no mesmo endereço do site: ouvia o `BroadcastChannel` da sessão (o supabase-js repassa `access_token` e `refresh_token` a cada renovação) e lia o IndexedDB do chaveiro. Provado no navegador real. | **corrigido**: `public/workers/isolar.js` e `lib/isolamento.ts` carregados antes de tudo em cada executor; `npm run testar:isolamento` |
| V3 | ALTO | `lib/aovivo.ts`, `lib/tempo-real.ts` | Sala das aulas ao vivo: canal aberto, papel "educador" declarado pelo próprio navegador e oferta de vídeo aceita de qualquer um. Um estranho mostrava o que quisesse aos alunos e via o IP deles. | **corrigido**: chave por aba registrada em `aula_ao_vivo_sala_chave`, presença e sinais assinados (ECDSA), conferência em `lib/aovivo-conferencia.ts`; `npm run testar:aovivo` e testes no banco |
| S1 | ALTO | Supabase (`mailer_autoconfirm: true`, conferido hoje) | Cadastro sem confirmação de e-mail (vindo da auditoria anterior): alguém cria a conta com o e-mail de quem se candidatou e recebe a função. O banco já recusa quando a confirmação está ligada. | **manual** (seção 3, item 2) |
| V4 | MÉDIO | `interno.decide`, `ensina`, `educador`, `revisa_caderno`, `leciona`, `saude_gere`, `podcast_pode`, `supervisiona`, `aviso_para_mim` | Checagens que olham a linha do papel direto pulavam a regra "quem cadastrou o aplicativo autenticador só usa a função depois do código". Senha roubada sozinha abria exercícios, aulas, cadernos, a Saúde (documentos com dados pessoais) e a supervisão do podcast. | **corrigido**: `interno.sessao_confiavel()`; testes no banco |
| V5 | MÉDIO | depósito `podcast-producao`, pasta `perguntas/` (N2 de 15/10) | Qualquer conta enviava arquivos de 50 MB, de qualquer tipo, sem limite. | **corrigido**: só áudio com o nome do site, 5 por dia, 20 por conta; `npm run testar:depositos` |
| V6 | MÉDIO | depósito `gaveta` | Qualquer conta enviava PDFs de 10 MB sem limite, direto no depósito (o limite valia só para a ficha). | **corrigido**: nome do site, 6 por dia, 60 por conta |
| V7 | MÉDIO | `voluntariar`, `reforco_pedir` (S3 de 15/10) | Os e-mails "recebemos o seu pedido" iam para qualquer endereço com o nome e o assunto digitados pelo visitante: dava para mandar golpe com o domínio do instituto. | **corrigido**: só o primeiro nome, sem ponto, barra, arroba nem dois-pontos; teto de 300 por dia em cada tipo |
| V8 | MÉDIO | canal "painel" (`lib/tempo-real.ts`) | Canal aberto: quem repetisse avisos fazia todos os painéis abertos reler as listas sem parar. | **corrigido**: um aviso por tipo a cada 2 s (o último sai no fim), 60 por minuto |
| V9 | BAIXO | `/api/og` | Cada título diferente guardava fontes na memória para sempre. | **corrigido**: teto de 200 |
| V10 | BAIXO | `/api/estudio/instagram/agendados` | Chave da tarefa comparada com `!==` (tempo variável) e lista do banco sem conferência de formato. | **corrigido**: `timingSafeEqual`, `Array.isArray` |
| V11 | BAIXO | `lib/instagram.ts` | O endereço da imagem aceitava `..` depois da pasta do depósito. | **corrigido** |
| V12 | BAIXO | `/api/gramatica` | O limite por pessoa usava o endereço da borda da Cloudflare (o mesmo para muita gente). | **corrigido**: `cf-connecting-ip` |
| V13 | BAIXO | `/api/radios` | Resposta torta do serviço derrubava a rota. | **corrigido** |
| V14 | BAIXO | `rascunho_salvar` | 8 MB de rascunhos por conta (cadastro aberto). | **corrigido**: 4 MB somando tudo |
| V15 | BAIXO | dependências | `zod` (só desenvolvimento) com aviso alto. | **corrigido** (4.6.7). Restam 5 avisos baixos da cadeia do KaTeX: dependem de outra falha antes; o PR #16 do Dependabot (KaTeX 0.19) precisa de conferência visual das fórmulas |
| V16 | BAIXO | GitHub | Alertas do Dependabot desligados (por isso o V1 não avisou ninguém); `master` sem proteção. | **recomendação** (seção 3) |

### Bugs funcionais encontrados no caminho

| ID | Onde | O problema | Status |
| --- | --- | --- | --- |
| B1 | Painel → Minhas contribuições | "Comprovante" abria a janela com `noopener`; aí o navegador devolve `null` e o comprovante nunca aparecia. | **corrigido** |
| B2 | Minha conta → códigos de recuperação | O "Imprimir" tinha o mesmo defeito. | **corrigido** |

### Conferido e sem problema

- Rotas de servidor (`app/api/*`): só `https` e lista fechada de destinos, redirecionamentos conferidos, nada de quem pediu
  vai para fora.
- 502 funções públicas do banco: todas `security definer` com `search_path` fixo; nenhum SQL montado com texto de fora;
  as funções novas desde 15/10 (conversas cifradas, plataforma, design, apoio, tarefas, saúde) conferem dono e papel.
- Publicação automática (`scripts/sincronizar.mjs`, `scripts/curriculo.mjs`): caminhos travados dentro de `content/`,
  cabeçalho gerado por biblioteca, arquivos conferidos pelos bytes; nada de fora vira código.
- Anexos das conversas: tipo pelos bytes, prévia de DOCX em quadro isolado.
- Limite de pedidos do banco: forjar `X-Forwarded-For` **não** burla (testado hoje em produção: a 21ª consulta foi
  barrada). O S8 de 15/10 está fechado.
- Nenhum segredo no código nem no histórico recente.
- Cabeçalhos em produção: CSP, HSTS (com preload), `nosniff`, `frame-ancestors 'self'`, COOP/CORP.

## 3. O que fica com você

1. **Rodar o `supabase/install.sql` inteiro** no SQL Editor depois que este trabalho estiver no `master`. Leva V4 a V7 e
   V14 para o banco e cria as chaves das aulas ao vivo. Pode ser rodado de novo; não apaga nada.
   - Ordem: tanto faz. O site novo funciona com o banco antigo (a sala das aulas segue como antes até o banco ter as
     chaves) e o banco novo funciona com o site antigo.
2. **Ligar a confirmação de e-mail (S1)**:
   1. Supabase → Authentication → Emails → SMTP Settings: `smtp.resend.com`, porta 465, usuário `resend`, senha = a chave
      do Resend, remetente `noreply@institutolucia.org`. Sem isso, o serviço padrão manda só 2 e-mails por hora.
   2. Supabase → Authentication → Sign In / Providers → Email: ligar **Confirm email** e **Secure password change**.
3. **GitHub → Settings → Code security**: ligar **Dependabot alerts** (grátis em repositório privado).
4. Recomendação antiga ainda valendo: regra de limite na Cloudflare para `/api/` (60 por minuto por IP, bloqueio de
   10 minutos).
5. Os PRs #17 e #18 do Dependabot (Next 16.4.2) ficam obsoletos: este trabalho já leva a 16.4.3. O Dependabot fecha os
   dois sozinho.

## 4. Como conferir em produção

- Uma aula ao vivo com duas abas (uma de quem conduz, outra anônima): o vídeo chega na aba anônima. Numa terceira aba,
  quem tentar se passar por educador aparece na lista como quem assiste e não manda vídeo.
- IDE (`/pt/laboratorios`, perfil JavaScript): `console.log(typeof indexedDB, typeof BroadcastChannel)` mostra
  `undefined undefined`.
- Painel → Minhas contribuições → Comprovante abre a janela de impressão.
- `https://institutolucia.org/_next/image?url=/marca-96.png&w=64&q=75` responde 400 (o otimizador não serve mais
  arquivos da pasta pública; só o busto da dedicatória, importado pelo build).

## 5. Como desfazer

- Site: Vercel → Deployments → versão anterior → "Promote to Production", ou `git revert` do merge.
- Banco: rodar no SQL Editor a versão anterior das funções alteradas (`git show 249222f:supabase/install.sql`). Nada foi
  apagado; a tabela nova (`interno.aulas_sala_chaves`) pode ficar.
