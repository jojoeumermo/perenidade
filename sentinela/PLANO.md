# Sentinela Lúcia — plano de trabalho (auditoria do site + painel de monitoramento)

Data: 15/10/2026. Escrito antes de executar, a partir da leitura completa do código do Instituto Lúcia
(`app/`, `components/`, `lib/`, `proxy.ts`, `next.config.ts`, `supabase/install.sql` com 5.522 linhas e 226 funções
públicas, as duas Edge Functions, os 4 workflows do GitHub, `docs/MANUTENCAO.md` e a branch `auditoria-seguranca`).

Legenda de situação, atualizada durante a execução: **feito** · **proposto** (escrito, mas não aplicado, porque muda
comportamento visível ou depende de você) · **pendente** (não feito nesta rodada, com o motivo).

---

## 0. O que o Passo Zero mostrou

**Stack.** Next.js 16.3 (App Router, páginas estáticas em 5 idiomas, `dynamicParams = false`), React 19, Tailwind 4,
hospedado na Vercel atrás da Cloudflare (Turnstile, `cf-connecting-ip`). Conteúdo todo em arquivos (`content/`).
Banco de apoio em um projeto Supabase: tabelas no esquema `interno` (sem permissão para `anon`/`authenticated`, RLS
ligada sem regra), **toda** porta de entrada é função `security definer` em `public` com `set search_path`, que
confere papel, segundo fator (`aal2`) e limite de pedidos dentro do banco. Papéis: coordenação, vice, curadoria,
mediação, educação, revisão, tradução, jornalismo, mentoria, design, desenvolvimento. Segundo fator TOTP obrigatório
para os quatro papéis sensíveis (nasce ligado). Entrada por senha (mín. 12, conferida no HIBP pelo servidor do site),
chave de acesso (passkey) e convite. Uploads vão para buckets com política por pasta do próprio usuário e limpeza de
metadados no navegador. Edge Functions: `avaliar-comunidade` (moderação com falha segura: erro = fila humana) e
`transcrever-podcast`. GitHub Actions: CI (lint, tipos, i18n, 4 suítes de teste, build), publicação de hora em hora
com a `service_role` (só nos segredos), envio de e-mails via Resend. Dependabot ligado.

**Variáveis (só nomes).** Site: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_VIDEO_HOSTS`, `GOOGLE_FACTCHECK_KEY` (servidor). GitHub: `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, variáveis `PUBLICAR`, `EMAILS`, `EMAIL_REMETENTE`, `EMAIL_RESPOSTA`.
Edge Functions: `OPENAI_API_KEY`, `GOOGLE_SAFE_BROWSING_KEY`, `TRANSCRICAO_CHAVE|URL|MODELO`.

**Pontos fortes já existentes.** CSP restritiva (só o Turnstile de fora), HSTS 2 anos, COOP/CORP, `X-Frame-Options`,
Permissions-Policy, honeypots (`isca` no proxy, funções `armadilha` no banco), livro de auditoria imutável por gatilho,
limites por origem sem guardar IP em claro, e-mails com teto por tipo, histórico do git sem segredos (varri todas as
branches: nada).

**O que já estava auditado.** A branch `auditoria-seguranca` (15/10, sem push) traz um relatório com 19 achados de
segurança (0 críticos, 2 altos, 7 médios, 10 baixos) e 11 bugs, 10 correções e testes de fumaça (`testar-fumaca.mjs`).
Este plano **não repete** o que já está lá: aproveita, confere e cobre as lacunas.

**Linha de base desta rodada (master `827d49a`).** `typecheck` ✓ · `testar:banco` 667 ✓ · `testar:moderacao` 30 ✓ ·
`testar:emails` 19 ✓ · `testar:podcast` 106 ✓ · `lint` ✓ no código do projeto (as 824 falhas vêm de um worktree
aninhado em `.claude/`, que o ESLint não ignora) · `npm audit --omit=dev`: 4 baixos, todos na cadeia do KaTeX.

---

## 1. Auditoria defensiva (branch `correcoes-seguranca`, worktree `C:\Users\0177\perenidade-correcoes`)

Regra: só correções que não mudam o que o visitante vê; o resto vira proposta. Cada correção com teste.

| # | Item | Como | Situação |
| --- | --- | --- | --- |
| A1 | Linha de base: rodar lint, tipos, 4 suítes, audit | feito acima | **feito** |
| A2 | Testes de fumaça dos fluxos críticos (home, cadastro, login, senha, acervo, busca, aulas, comunidade/moderação, jornal, rádio, API, painel por cargo) | trazer `scripts/testar-fumaca.mjs` da branch `auditoria-seguranca` (commit `db9a9c6`) por cherry-pick; acrescentar casos das rotas `/api` e dos cabeçalhos | pendente |
| A3 | OWASP A01 Controle de acesso: autorização de cargo no servidor | já provado por `testar:banco` (667) e pelas 226 funções lidas; conferir as funções novas do master (`horas_*`, `certificado_*`, `chat_*`) | pendente |
| A4 | OWASP A02 Criptografia: segredos no código e no histórico | varrido: nada. Registrar o método no relatório | **feito** |
| A5 | OWASP A03 Injeção/XSS: campos que viram HTML | `react-markdown` sem `rehype-raw`; único `dangerouslySetInnerHTML` é o script fixo de preferências; SQL só por funções parametrizadas. Conferir `Editor.tsx`, `Forum.tsx`, `Mural.tsx` | pendente |
| A6 | OWASP A05 Configuração: cabeçalhos, CSP, CORS, CSRF, limite de taxa | adicionar `report-uri`/`Reporting-Endpoints` à CSP apontando para o coletor do Sentinela (sem mudar a política; só passa a relatar). CORS `*` nas Edge Functions → proposta. CSRF: não há cookies de sessão (JWT no `localStorage`), formulários chamam RPC com `Authorization` — ok | pendente |
| A7 | OWASP A06 Dependências | `npm audit`: 4 baixos (katex). Atualização exige katex 0.19 (major) → proposta, não aplicar | pendente |
| A8 | OWASP A08 Integridade da cadeia: ações do GitHub por hash | fixar `actions/checkout@v5` e `actions/setup-node@v5` pelo SHA (comportamento idêntico) | pendente |
| A9 | OWASP A10 SSRF: `lib/externo.ts` segue redirecionamentos para fora da lista | `redirect: "manual"` e seguir só se o destino estiver na lista (até 2 saltos). Teste de unidade novo | pendente |
| A10 | Uploads | políticas por pasta já conferidas; `perguntas/` do podcast aceita 50 MB de qualquer conta (achado N2 da auditoria anterior) → continua proposta | pendente |
| A11 | Moderação no servidor com falha segura | `avaliar-comunidade`: erro → fila humana, provado por `testar:moderacao`. Registrar | **feito** |
| A12 | Lint no ambiente local varre `.claude/worktrees` | adicionar `.claude/**` aos ignores do ESLint (não muda o site) | pendente |
| A13 | `security.txt` (RFC 9116) em `/.well-known/` | arquivo novo com contato do instituto; é público, logo fica **proposto** no relatório com o texto pronto | pendente |
| A14 | Supabase/Cloudflare: confirmação de e-mail, troca segura de senha, captcha, regra de limite em `/api/` | só você faz → "Preciso de você" | proposto |
| A15 | Relatório: tabela de achados com ID/gravidade/onde/problema/status, juntando os da auditoria anterior (S1–S15, N1–N4) e os novos | — | pendente |

## 2. Sentinela Lúcia — fundações (branch `sentinela`, pasta `sentinela/`, worktree `C:\Users\0177\perenidade-sentinela`)

Decisões de arquitetura (justificadas no relatório):

- **Pasta `sentinela/` dentro do repositório**, autossuficiente (próprio `package.json`), excluída do `tsconfig` e do
  ESLint do site. Pode virar repositório próprio com um `git subtree split` quando você quiser.
- **Backend: um projeto Supabase separado** (`sentinela`), com o mesmo desenho do site: esquema privado `vigia`, RLS
  ligada, funções `security definer` em `public`, segundo fator exigido por banco (`aal2`), registro de auditoria
  imutável. `sentinela/supabase/install.sql`, idempotente, para colar no SQL Editor (como o site faz).
- **Coletor: um Cloudflare Worker agendado** (`sentinela/worker/`), cron a cada 5 minutos, que lê as plataformas e grava
  o histórico no Supabase do Sentinela (os logs gratuitos da Cloudflare/Vercel expiram; o Worker preserva 90 dias de
  eventos e 400 dias de agregados). **Os tokens das plataformas ficam só nos segredos do Worker** (cifrados pela
  Cloudflare), nunca no PC de ninguém; o app nunca vê um token.
- **App: Tauri 2 + React 19 + Vite + Tailwind 4**, identidade do site (pergaminho/tinta/ouro/bordô, EB Garamond, Inter,
  IBM Plex Mono, cantos retos, fios finos), tema claro e escuro. O mesmo código roda como **PWA** na Vercel (caminho
  imediato para o Android/S24) e como app nativo Android pelo Tauri Mobile (viabilidade relatada).
- **Instalador Windows** (NSIS `.exe` e `.msi`) gerado pelo GitHub Actions (`tauri-action`), porque esta máquina não
  tem Rust nem o compilador da Microsoft (relatado em "Preciso de você").

| # | Item | Situação |
| --- | --- | --- |
| B1 | `install.sql` do Sentinela: tabelas `vigia.*` (perfis, papéis, convites, auditoria, verificacoes, eventos, alertas, incidentes, acoes, integridade, dns, certificados, csp, configuracoes), RLS, funções públicas, limites, limpeza por `pg_cron` | pendente |
| B2 | Teste do banco em PGlite (`sentinela/supabase/testar-banco.mjs`): instalar duas vezes, quem pode o quê por papel, 2FA exigido, auditoria imutável | pendente |
| B3 | Worker: `wrangler.toml`, cron, coletores (uptime+cabeçalhos+hash, Cloudflare GraphQL, Vercel, GitHub, Supabase do site, DNS via DoH, CT via crt.sh, domínios parecidos, reputação de IP), receptor de CSP, executor de ações, envio de e-mails (Resend) | pendente |
| B4 | Worker: `wrangler deploy --dry-run` e testes de unidade dos coletores com respostas gravadas | pendente |
| B5 | App: esqueleto Vite+React+Tauri, tokens visuais do site, roteamento, sessão Supabase, modo demonstração (dados fictícios para avaliar as telas sem backend) | pendente |
| B6 | Tauri: `src-tauri/` (Cargo.toml, tauri.conf.json, capacidades mínimas, ícones a partir de `public/emblema.png`), notificações nativas, salvar relatório | pendente |
| B7 | Workflow `sentinela-instalador.yml` que monta o instalador Windows e publica como artefato/Release | pendente |

## 3. Multiusuário (até 5 pessoas)

| # | Item | Situação |
| --- | --- | --- |
| C1 | Papéis **dono / analista / leitor** conferidos no banco (`vigia.tem()`); dono: convida, muda papéis, configura; analista: abre/atribui incidentes, pede bloqueio; leitor: só lê | pendente |
| C2 | **2FA obrigatório**: toda função sensível exige `aal2`; tela de cadastro do TOTP no app (igual à do site) | pendente |
| C3 | **Convite por e-mail**: `convite_criar` (dono) gera código com selo SHA-256 no banco, validade 7 dias, 1 uso, e-mail com o link enviado pelo Worker (Resend); criação de conta só com convite (gatilho em `auth.users`) | pendente |
| C4 | **Log de auditoria de quem viu e fez o quê**: `vigia.auditoria` imutável; toda leitura de tela sensível (ameaças, incidentes, exportações) e toda ação gravam; tela "Registro" para o dono | pendente |
| C5 | **Tokens cifrados no backend**: tokens das plataformas nos segredos do Worker; configurações não secretas (zona, projeto, repositório) na tabela `configuracoes`; o app nunca recebe tokens | pendente |
| C6 | Teto de 5 contas ativas (regra no banco) | pendente |

## 4. Telas do painel (tempo real, com gráficos)

Atualização em tempo real pelo Supabase Realtime (canal `vigia`) + recarga a cada 60 s como reserva.

| # | Tela | Conteúdo | Situação |
| --- | --- | --- | --- |
| D1 | **Visão geral** | site no ar (últimas 24 h), tempo de resposta (linha), requisições vs. bloqueios (barras), **índice de postura** (0–100: cabeçalhos, HSTS, CSP, DNS/CAA, certificado, dependências, 2FA, alertas abertos), alertas recentes | pendente |
| D2 | **Ameaças** | eventos do WAF/Cloudflare (ação, regra, caminho, país, ASN, IP), picos de requisições (DDoS), logins falhos (Supabase Auth logs), rotas visadas (iscas + 404 em massa), reputação de IP; botão "sugerir bloqueio" | pendente |
| D3 | **Integridade** | hash das páginas-chave e diferença, registros DNS e mudanças, certificados vistos nos CT logs (emissor, validade, novos), scripts/iframes de terceiros encontrados no HTML, domínios parecidos que passaram a resolver | pendente |
| D4 | **Plataforma** | deploys da Vercel (estado, autor, commit), alertas do GitHub (Dependabot, secret scanning, code scanning, falhas de Actions), saúde do Supabase do site (auth/rest/storage respondendo, latência) | pendente |
| D5 | **Incidentes** | abrir, atribuir, acompanhar (linha do tempo de notas), gravidade, estado; vincular eventos; sugerir bloqueio na Cloudflare com confirmação em duas etapas; tudo no log | pendente |
| D6 | **Alertas** | lista, silenciar por tempo, regras ligadas/desligadas, preferências por pessoa (e-mail, desktop) | pendente |
| D7 | **Histórico e relatório** | períodos, exportar CSV/JSON e relatório mensal em Markdown/HTML (salvo pelo Tauri ou baixado no PWA) | pendente |
| D8 | **Equipe e segurança** | convites, papéis, 2FA, aparelhos, registro de auditoria (dono) | pendente |
| D9 | **Configuração** | o que o Worker lê (zona, projeto, repositório, URLs vigiadas, páginas para hash, lista de domínios de terceiros permitidos) | pendente |

## 5. Resposta a incidentes

| # | Item | Situação |
| --- | --- | --- |
| E1 | Tabelas `incidentes`, `incidente_notas`, `incidente_eventos`; estados aberto → investigando → contido → resolvido; gravidade baixa/média/alta/crítica | pendente |
| E2 | Fluxo "sugerir bloqueio": analista propõe (IP/ASN/país + motivo + duração), dono ou segundo analista confirma, Worker aplica via API da Cloudflare (regra de acesso ou lista), resultado e desfazer ficam no incidente e na auditoria | pendente |
| E3 | Modelos de resposta (DDoS, credential stuffing, defacement, certificado estranho, deploy não reconhecido) com checklist em português | pendente |
| E4 | Nada de rastreamento ativo: só o que os logs já trazem (IP, país, ASN); nenhuma consulta a serviços que identifiquem pessoas | **feito** (decisão de desenho) |

## 6. Alertas

| # | Item | Situação |
| --- | --- | --- |
| F1 | Regras no Worker, avaliadas após cada coleta: site fora 2 coletas seguidas, tempo de resposta > 3 s, bloqueios 5× acima da mediana da semana, > N logins falhos/10 min, hash de página mudou sem deploy, DNS mudou, certificado novo de emissor desconhecido, script de terceiro novo, domínio parecido ativo, deploy falhou, alerta novo no GitHub, Supabase fora, CSP com violações novas, cota de e-mails do site com falhas | pendente |
| F2 | E-mail (Resend, pelo Worker) para quem optou; **sem dado sensível na prévia**: assunto e corpo dizem só tipo, gravidade e hora; o detalhe fica no app | pendente |
| F3 | Notificação no desktop (plugin de notificação do Tauri) com o mesmo texto resumido; no PWA, Notification API quando permitida | pendente |
| F4 | Agrupamento (não repete o mesmo alerta por 1 h) e silêncio por incidente | pendente |

## 7. Mobile (Samsung S24)

| # | Item | Situação |
| --- | --- | --- |
| G1 | **PWA instalável** (manifest, service worker, ícones) publicado na Vercel a partir da mesma pasta `sentinela/app` — funciona hoje no S24 pelo Chrome/Samsung Internet | pendente |
| G2 | **Tauri Mobile (Android)**: viabilidade. O código web é 100 % reaproveitado; exige Android Studio/SDK/NDK + Rust na máquina de quem compila, assinatura e distribuição por APK (fora da loja) — relatar passos e custo; não gerar nesta rodada | pendente (relato) |
| G3 | Layout responsivo (375 px) e toque: barra inferior de abas no celular como no site | pendente |

## 8. Extras defensivos gratuitos (liberdade dada no prompt)

Reputação de IP (AbuseIPDB, opcional), checagem de cabeçalhos com nota, uptime multi-ponto (Worker roda em várias regiões),
receptor de relatórios de CSP, vigilância de CT logs e de domínios parecidos, lista de scripts de terceiros, `security.txt`,
e verificação do `assetlinks.json` do app Android (não pode sumir nem mudar sem aviso). Listados no relatório final.

## 9. Entrega

Relatório em `sentinela/RELATORIO.md` com as 7 seções pedidas ("Preciso de você" no topo). Commits pequenos nas duas
branches, push das branches (sem juntar ao `master`: juntar publica o site na Vercel).
