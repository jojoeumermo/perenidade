# Sentinela Lúcia — relatório da rodada de 15/10/2026

Duas entregas: (1) auditoria defensiva do site com correções pequenas; (2) a primeira versão completa do painel
Sentinela Lúcia. Tudo em branches novas, nada publicado em produção, nenhum comando no banco de produção.

- Branch das correções do site: `correcoes-seguranca` (worktree `C:\Users\0177\perenidade-correcoes`).
- Branch do painel: `sentinela` (worktree `C:\Users\0177\perenidade-sentinela`, pasta `sentinela/`).
- A auditoria anterior de hoje (branch `auditoria-seguranca`, sem push) continua valendo: este relatório não repete o
  que ela já fez; junta os achados dela na tabela, com a mesma numeração (S1–S15, N1–N4), e acrescenta os novos (N5+).

---

## 1. Preciso de você (em ordem; o resto já está pronto)

> **Atualização (15/10, à noite), depois de eu tentar fazer pelo seu Chrome:**
> - **Feito:** o instalador Windows foi gerado pelo GitHub Actions (etiqueta `sentinela-v0.1.2`, rodada 38811385776, 7 MB): baixe o artefato `sentinela-lucia-windows` em *Actions → Sentinela — instalador Windows* (https://github.com/jojoeumermo/perenidade/actions/runs/38811385776). Dentro do zip vêm o `.exe` (NSIS) e o `.msi`. Os identificadores públicos (Zone ID da Cloudflare, ID do projeto na Vercel, repositório, URL e ref do Supabase do site) já vêm preenchidos no `install.sql`.
> - **Bloqueado pela sua conta Supabase:** o plano gratuito permite 2 projetos ativos e você já tem 2 (o do site e `Bandmatch EARJ`). Para criar o projeto do Sentinela, pause o Bandmatch (Project Settings → General → Pause project) ou pague o Pro. Depois, os passos 5 a 11 abaixo.
> - **Bloqueado pela Cloudflare:** o plano gratuito já usou todas as regras de segurança ("Você usou todas as regras disponíveis para seu plano free"). A regra de limite em `/api/*` (N1) exige apagar uma regra existente ou subir de plano.
> - **Não pude fazer por política de segurança:** mexer nas configurações de produção do Supabase do site e da Cloudflare, o `wrangler login` (consentimento OAuth) e qualquer token, chave ou senha. Esses passos continuam com você; estão prontos abaixo.
> - **Vercel (PWA):** a pasta `sentinela/` ainda não existe no `master`, então o importador não deixa escolher o *Root Directory*. Junte a branch `sentinela` ao `master` (ou crie o projeto depois) e aí o passo 21 leva um minuto.


### A. Supabase e Cloudflare do site (da auditoria anterior, ainda abertos)

1. **Supabase do site → Authentication → Sign In / Providers → Email:** ligue **Confirm email** (antes, SMTP do Resend,
   como no guia) e **Secure password change**. Fecha S1 (para contas novas) e S5.
2. **Supabase do site → Authentication → Attack Protection:** confira que o captcha (Turnstile) está ligado.
3. **Cloudflare → Security → WAF → Rate limiting rules:** regra para `/api/*` (60 pedidos/min por IP, Block 10 min). Fecha N1.
4. **Teste do S8** (origem forjável): 25 chamadas a `certificado_conferir` com `X-Forwarded-For` diferente; se a 21.ª não
   vier `muitos_pedidos`, me avise. (Comando na seção 3 do relatório da auditoria anterior.)

### B. O banco do Sentinela (projeto Supabase novo, separado do site)

5. **supabase.com → New project** (nome `sentinela`, região `sa-east-1`, senha forte guardada no gerenciador).
   Anote: *Project URL*, chave **anon** (pública), chave **service_role** (secreta) e o *ref* (20 letras na URL).
6. **Database → Extensions:** ligue `pg_cron` (a faxina diária). Opcional: sem ele, o Worker limpa.
7. **SQL Editor:** cole e rode `sentinela/supabase/install.sql` inteiro. Pode rodar de novo sempre que atualizar.
8. **Authentication → Sign In / Providers → Email:** deixe *Enable email provider* ligado; ligue **Confirm email** só se
   tiver SMTP (seção D). **Authentication → Multi-factor:** confira que **TOTP** está ligado (é o padrão).
9. **Authentication → URL Configuration:** *Site URL* = endereço do PWA quando publicar (seção F); por enquanto pode
   ficar `http://localhost:1420`.
10. Abra o app (seção E), escolha **Criar conta com convite** → não: a **primeira** conta se cria pela tela **Entrar** →
    *Trocar o serviço* → cole URL e anon → **Criar conta com convite** não serve ainda; use **Authentication → Users → Add
    user** no Supabase (e-mail + senha) ou crie pelo app na tela de entrada quando ela oferecer. Depois, no SQL Editor:
    `select public.promover_dono('seu-email@exemplo.org');`
11. No app, entre, **cadastre o aplicativo autenticador** (obrigatório) e preencha **Configuração → As plataformas**:
    *Zone ID* da Cloudflare, *Project ID* da Vercel (`prj_…`, em Settings → General), repositório (`dono/repo`),
    URL do Supabase **do site**, *ref* do site e a chave anon **do site** (pública; serve só para medir a saúde).

### C. Tokens das plataformas (só nos segredos do Worker; nunca no app, nunca no banco)

12. **Cloudflare → My Profile → API Tokens → Create Token → Custom:** permissões *Zone → Analytics → Read* e
    *Zone → Firewall Services → Edit*, *Zone Resources* = só a zona `institutolucia.org`. Guarde como `CLOUDFLARE_API_TOKEN`.
13. **Vercel → Settings → Tokens:** token com escopo só do projeto do site (ou da conta, *Read-only* se houver), validade
    de 1 ano. `VERCEL_TOKEN`. Se o projeto estiver em um time, anote o `team_…` para a Configuração.
14. **GitHub → Settings → Developer settings → Fine-grained tokens:** só o repositório do site, permissões *Dependabot
    alerts: Read*, *Secret scanning alerts: Read*, *Code scanning alerts: Read*, *Actions: Read*, *Metadata: Read*. `GITHUB_TOKEN`.
15. **Supabase (opcional, para as entradas erradas do site):** supabase.com → Account → Access Tokens → token pessoal.
    `SUPABASE_SITE_PAT`. Sem ele, a aba *Entradas erradas* fica vazia; o resto funciona.
16. **AbuseIPDB (opcional, reputação de IP):** conta gratuita → API key. `ABUSEIPDB_KEY`.

### D. E-mails do Sentinela (convites e avisos)

17. **Resend:** no mesmo domínio já verificado, crie uma chave *Sending access* só para o Sentinela. `RESEND_API_KEY`.
    O remetente padrão é `Sentinela Lúcia <sentinela@institutolucia.org>` (muda em `worker/wrangler.toml`).

### E. Publicar o coletor e cadastrar os segredos

18. Na pasta `sentinela/`: `npx wrangler login` (abre o navegador), edite `worker/wrangler.toml` →
    `SENTINELA_SUPABASE_URL` = URL do passo 5 (e `APP_URL` depois do passo 23). Depois:

```bash
cd sentinela && npm run worker:deploy
```

```bash
cd sentinela && for s in SENTINELA_SERVICE_KEY CLOUDFLARE_API_TOKEN VERCEL_TOKEN GITHUB_TOKEN RESEND_API_KEY; do npx wrangler secret put $s --config worker/wrangler.toml; done
```

    (`SUPABASE_SITE_PAT` e `ABUSEIPDB_KEY` são opcionais, mesmo comando.) Anote o endereço
    `https://sentinela-lucia.<sua-conta>.workers.dev`. Confira `https://…workers.dev/saude`: diz o que está configurado.
    A primeira coleta acontece em até 5 minutos; a lenta (DNS, certificados, GitHub) em até 6 h, ou clique **Coletar agora**.

### F. O app

19. **Instalador Windows:** esta máquina não tem Rust nem o compilador da Microsoft (sem eles o Tauri não compila). Duas
    saídas: (a) **GitHub → Actions → "Sentinela — instalador Windows" → Run workflow**: em uns 15 minutos o artefato
    `sentinela-lucia-windows` traz o `.exe` (NSIS) e o `.msi`; (b) instalar localmente `rustup` + *Visual Studio Build
    Tools* (C++ e Windows SDK) e rodar `npx tauri build` em `sentinela/`.
    Antes de rodar o workflow, crie as variáveis (Settings → Secrets and variables → Actions → **Variables**):
    `SENTINELA_SUPABASE_URL`, `SENTINELA_ANON_KEY`, `SENTINELA_WORKER_URL`. Sem elas o instalador sai igual e cada pessoa
    cola os três endereços na primeira abertura.
20. **Windows SmartScreen:** o instalador não é assinado (certificado custa). Na primeira abertura: *Mais informações →
    Executar assim mesmo*. Se quiser assinar: certificado OV/EV + `signingIdentity` no `tauri.conf.json`.
21. **PWA (celular e qualquer navegador):** Vercel → *Add New Project* → mesmo repositório, **Root Directory = `sentinela`**,
    *Production Branch* = `sentinela` (ou `master` depois de juntar). Variáveis: `VITE_SENTINELA_SUPABASE_URL`,
    `VITE_SENTINELA_ANON_KEY`, `VITE_SENTINELA_WORKER_URL`. No S24: abra o endereço no Chrome → menu → *Instalar app*.
22. Depois de publicar: `APP_URL` no `wrangler.toml` (links dos e-mails) e **Configuração → O site → Endereço do app**.
23. **CSP do site relatando ao Sentinela:** Vercel → projeto do site → Settings → Environment Variables →
    `CSP_REPORT_URL` = `https://…workers.dev/csp` (Production). Entra no próximo deploy; a política não muda, só relata.

### G. Juntar as branches (quando quiser)

24. `correcoes-seguranca` → pull request → juntar ao `master` (publica o site). Nada de banco nesta branch.
25. `sentinela` → pull request → juntar. Nada muda no site publicado (a pasta é ignorada pelo Next, pelo lint e pelo
    tsconfig); só entra o workflow do instalador.

---

## 2. Resumo do projeto e dos achados

**O site.** Next.js 16 estático em cinco idiomas, na Vercel atrás da Cloudflare; conteúdo em arquivos; um banco Supabase
de apoio onde **nenhuma tabela é exposta**: toda porta é função `security definer` que confere papel, segundo fator e
limite dentro do banco. CSP restrita, HSTS de 2 anos, honeypots, auditoria imutável, moderação com falha segura,
e-mails com teto. Segredos só nos segredos do GitHub/Edge Functions; **nenhum segredo no código nem no histórico**
(varri todas as branches e commits por padrões de chave: nada).

**O que já estava feito.** A branch `auditoria-seguranca` (hoje, mais cedo) fechou 10 achados e deixou 712 testes de
banco + 68 de fumaça. Os achados que dependem de você (S1, S5, N1, S8) continuam na seção 1.

**O que esta rodada acrescentou ao site** (branch `correcoes-seguranca`, 5 commits, todos sem mudança visível):

- **N5 — SSRF por redirecionamento (corrigido).** A porta de saída do servidor para serviços abertos seguia qualquer
  redirecionamento, inclusive para fora da lista (um serviço comprometido poderia apontar para endereços internos).
  Agora cada salto precisa ser https e estar na lista; no máximo dois. Teste novo `testar:externo` (19 conferências),
  na verificação do GitHub.
- **N6 — Ações do GitHub fixadas por SHA (corrigido; era S15).** `checkout` e `setup-node` agora pelo código do commit da
  v5: uma etiqueta movida não troca o código que roda com a chave `service_role`.
- **N7 — CSP passa a relatar (corrigido, desligado por padrão).** Com `CSP_REPORT_URL`, a política ganha
  `report-uri`/`report-to` e o cabeçalho `Reporting-Endpoints`. A política em si não muda.
- **N8 — Lint local varria `.claude/worktrees` (corrigido).** 824 "erros" eram arquivos montados de outro worktree.
- **A2 — Testes de fumaça** trazidos da auditoria anterior (cherry-pick, 68 conferências) e ligados ao CI.

**Linha de base, antes e depois** (ambas 0 falhas): `typecheck` ✓ · `testar:banco` 667 ✓ · `testar:moderacao` 30 ✓ ·
`testar:emails` 19 ✓ · `testar:podcast` 106 ✓ · `testar:fumaca` 68 ✓ · `testar:externo` 19 ✓ (novo) · `lint` ✓ ·
`npm audit --omit=dev`: 4 baixos (cadeia do KaTeX, sem correção compatível).

**O Sentinela** (branch `sentinela`): banco próprio (92 conferências), coletor (31 conferências, bundle de 61 KB),
app (tipos ✓, build ✓, percorrido no navegador em tema claro e escuro, 375 px sem rolagem lateral). Detalhes na seção 4.

---

## 3. Tabela de achados

Status: **corrigido** (nesta branch, com teste) · **corrigido (auditoria anterior)** · **manual** (só você) ·
**proposto** (escrito, não aplicado: muda comportamento visível) · **recomendação**.

| ID | Grav. | Onde | Problema | Status |
| --- | --- | --- | --- | --- |
| S1 | ALTO | Supabase do site (confirmação de e-mail) + `inscricao_decidir` | Sem confirmar e-mail, aceitar candidatura de "quem já tem conta" entrega função a quem criou a conta com o e-mail alheio | **manual** (seção 1-A) |
| S2 | ALTO | `/historico` | Expunha mensagens de commit | corrigido (auditoria anterior) |
| S3 | MÉDIO | `voluntariar`, `reforco_pedir` | E-mail com texto do visitante para endereço não verificado | decisão (seção 6) |
| S4 | MÉDIO | `publicar.yml` | `service_role` ao alcance do `npm ci` | corrigido (auditoria anterior) |
| S5 | MÉDIO | troca de senha | Não pede a senha atual | **manual** (Secure password change) |
| S7 | MÉDIO | `interno.origem()` | `md5(IP)` reversível (LGPD) | decisão (seção 6) |
| S8 | MÉDIO | `interno.origem()` | Sem `cf-connecting-ip`, usa `X-Forwarded-For` forjável | **manual** (teste, seção 1-A) |
| N1 | MÉDIO | `app/api/*` | Sem limite de taxa nas rotas que consultam serviços de fora | **manual** (regra na Cloudflare) |
| N2 | MÉDIO | bucket `podcast-producao/perguntas` | 50 MB por arquivo, qualquer conta, sem teto | decisão (seção 6) |
| **N5** | MÉDIO | `lib/externo.ts` | Redirecionamento seguido para fora da lista (SSRF) | **corrigido** (`95da88c`, 19 testes) |
| S6 | BAIXO | dependências | 4 baixos em `katex` (prototype pollution) via `rehype-katex`/`remark-math`; correção exige KaTeX 0.19 (major) | **proposto** (seção 6) |
| S9 | BAIXO | `next.config.ts` | CSP aceita `'unsafe-inline'` em scripts (exigência do Next estático) | recomendação |
| S10 | BAIXO | `avaliar-comunidade` | Qualquer um dispara a reavaliação | recomendação |
| S11 | BAIXO | funções do banco | Ações sem registro | corrigido (auditoria anterior) |
| S12 | BAIXO | `papel_conceder` | Regra da vice divergente | decisão |
| S13 | BAIXO | `perfil_salvar` | Nome "Coordenação" não reservado | decisão |
| S14 | BAIXO | erros do banco | Texto cru de erro na resposta | recomendação |
| **N6** | BAIXO | workflows | Ações por etiqueta, não por SHA (era S15) | **corrigido** (`5b020c3`) |
| N3 | BAIXO | `lib/externo.ts` | (mesmo que N5) | **corrigido** |
| N4 | BAIXO | `ci.yml` | `testar:podcast` fora do CI | corrigido (auditoria anterior) |
| **N7** | BAIXO | `next.config.ts` | A CSP bloqueava sem avisar ninguém | **corrigido** (`35c6e6a`, relato opcional ao Sentinela) |
| **N8** | INFO | `eslint.config.mjs` | Lint local lia worktrees aninhados | **corrigido** (`a5c8c38`) |
| **N9** | BAIXO | Edge Functions | `Access-Control-Allow-Origin: *` (são protegidas por JWT, então o risco é só de origem; restringir ao domínio do site exige republicar as funções) | **proposto** |
| **N10** | INFO | `/.well-known/security.txt` | Não existe um canal declarado para reportar vulnerabilidades (RFC 9116) | **proposto** (texto na seção 6) |
| **N11** | INFO | `proxy.ts` → `isca` | Todas as iscas chegam ao banco com a origem da borda da Vercel: o limite de 20/h vale para o mundo inteiro, logo o registro mostra no máximo 20 iscas por hora. Não é falha de segurança; o Sentinela lê as iscas direto da Cloudflare, sem esse teto | informativo |
| **N12** | a conferir | DNS do domínio | CAA, SPF `-all` e DMARC `p=reject` protegem contra certificado indevido e e-mail falso. Não dá para conferir sem rede; o Sentinela mostra em **Integridade → DNS** e desconta na postura | **manual** (ver no painel) |
| **N13** | INFO | repositório privado + AGPL | A licença pede que quem usa o site possa obter o código (já apontado antes) | decisão |

---

## 4. O software: Sentinela Lúcia

### Tecnologia e porquê

| Peça | Escolha | Porquê |
| --- | --- | --- |
| Banco e contas | **Supabase separado** (`vigia`) | Isola o painel do site; mesmo desenho que o site já usa e você já sabe operar; plano gratuito (500 MB) sobra para 90 dias de eventos e 400 de agregados. |
| Coletor | **Cloudflare Worker** com dois crons | Grátis (100 mil pedidos/dia), roda perto da Cloudflare, guarda o histórico que os logs gratuitos descartam, e é onde os tokens moram (segredos cifrados pela Cloudflare). |
| App | **Tauri 2 + React 19 + Vite + Tailwind 4** | Instalador leve para Windows (~10 MB, usa o WebView2 do sistema), o mesmo código vira PWA e, se quiser, app Android. Fontes embutidas: o app não pede nada a servidores de fora. |
| Gráficos | **Recharts**, paleta validada | Um eixo só, linhas de 2 px, barras de 24 px com vão; as três cores de série (ouro, azul, bordô) passaram no validador de daltonismo sobre o pergaminho e sobre o escuro. |
| Visual | Tokens do site (`--parchment`, `--ink`, `--gold`, `--oxblood`, EB Garamond/Inter/Plex Mono, tarja vermelha, botões com sombra dura) | Para ser reconhecido como coisa do instituto. Tema claro e escuro seguindo o sistema, com botão. |

### Como instalar

Seção 1 (passos 5 a 23). Resumo: SQL no Supabase novo → `wrangler deploy` + segredos → instalador do GitHub Actions
(ou `npm run dev`) → ligar o app → segundo fator → Configuração → convites.

### Estado do mobile (Samsung S24)

- **PWA: funciona hoje.** O mesmo app publicado na Vercel (passo 21) instala-se pelo Chrome/Samsung Internet, abre em
  tela cheia, tem barra de abas embaixo, notificação do navegador para alertas novos (com o app aberto) e layout testado
  em 375 px sem rolagem lateral. É o caminho recomendado.
- **App nativo Android (Tauri Mobile): viável, não gerado.** O código web é 100 % reaproveitado; `npx tauri android init`
  cria o projeto. Exige na máquina de quem compila: Rust + alvos Android, Android Studio com SDK/NDK, Java 17; o APK sai
  assinado com a sua chave e se instala fora da loja (ou na Play com conta de desenvolvedor, US$ 25). Custo: uma tarde
  de configuração; ganho sobre o PWA: notificações com o app fechado e ícone "de verdade". Minha sugestão: PWA agora;
  nativo quando sentir falta das notificações em segundo plano.

### Como conecta em cada plataforma

| Plataforma | Como | O que lê | O que faz |
| --- | --- | --- | --- |
| Site | GET como visitante, a cada 5 min, nas páginas vigiadas | no ar, código, tempo, cabeçalhos (nota), impressão do conteúdo (ignora o que muda a cada deploy), domínios de terceiros no HTML | nada |
| Cloudflare | GraphQL Analytics (token Analytics:Read) | requisições, bytes, países, códigos por 5 min; eventos do WAF (ação, regra, IP, país, ASN, caminho, agente, ray) | regras de acesso de IP/ASN/país (token Firewall:Edit), só depois de duas pessoas confirmarem; desfaz quando vence |
| Vercel | REST `v6/deployments` | estado, ramo, commit, autor | nada |
| GitHub | REST (token fino) | Dependabot, secret scanning, code scanning, rotinas falhando | nada |
| Supabase do site | `/auth/v1/health`, `/rest/v1/`, `/storage/v1/bucket` com a anon; opcional: Management API (logs de entrada) | saúde e latência; entradas recusadas | nada |
| DNS | DNS over HTTPS (1.1.1.1) | A, AAAA, NS, MX, TXT, CAA, www, `_dmarc` | nada |
| CT logs | crt.sh | certificados emitidos para o domínio | nada |
| Domínios parecidos | DoH, em rodízio, 60 por passada | quais resolvem / recebem e-mail | nada |
| AbuseIPDB (opcional) | REST | reputação de IPs que o WAF já bloqueou ≥ 5 vezes | nada |
| Resend | REST | — | convites e avisos (sem detalhe nenhum no e-mail) |
| Navegadores dos visitantes | `POST /csp` no Worker | violações da CSP do site (quando `CSP_REPORT_URL` está definida) | nada |

### Manual curto

- **Entrar:** e-mail + senha; depois o código do aplicativo autenticador (obrigatório, toda vez). Sem o código, nenhuma
  tela abre: o banco recusa.
- **Visão geral:** site no ar, tempo de resposta, requisições vs. bloqueios, índice de postura (0–100, com o que falta),
  alertas e incidentes abertos. "Coletar agora" pede uma passada ao Worker.
- **Ameaças:** origens mais insistentes (IP, país, rede, reputação), países, rotas visadas, regras do WAF, eventos com
  filtro, entradas erradas. Botão **sugerir bloqueio**.
- **Integridade:** impressão das páginas, DNS e mudanças, certificados (CT), terceiros, domínios parecidos, cabeçalhos.
- **Plataforma:** deploys, alertas do GitHub, saúde do Supabase do site, relatos de CSP, fila de e-mails.
- **Alertas:** ver, silenciar 24 h, resolver, abrir incidente; aba **Regras** (o dono liga/desliga).
- **Incidentes:** abrir (com modelo de resposta e checklist), atribuir, anotar, vincular eventos e alertas, resolver.
  **Ações:** quem propõe não confirma; outra pessoa (dono ou analista) confirma; o Worker aplica em até 5 min e desfaz
  quando a duração vence. Tudo fica na linha do tempo e no registro.
- **Histórico:** escolha o período, gere o relatório, salve `.md`, `.json` ou `.csv` (no app de mesa, caixa de diálogo
  "Salvar como"; no PWA, download). Cada exportação fica no registro.
- **Equipe:** pessoas e papéis (dono/analista/leitor, até 5 ativas), convites (7 dias, 1 uso, só o e-mail convidado),
  minha conta (nome, avisos por e-mail/desktop e gravidade mínima, senha), registro de atividades (só o dono).
- **Configuração:** o que o coletor vigia. O banco recusa qualquer valor com cara de token.
- **Avisos:** e-mail diz só "alerta de gravidade X, às tal hora, pela regra Y"; o desktop diz "N alertas novos". O
  detalhe só aparece dentro do app, depois do segundo fator.

### Extras defensivos que acrescentei

Reputação de IP (opcional), nota dos cabeçalhos (0–100) e aviso quando um some, receptor de relatos de CSP, vigilância
de CT logs com lista de emissores conhecidos, domínios parecidos (terminação, hífen, letra trocada), scripts de
terceiros fora da lista, postura do DNS (CAA/SPF/DMARC), `assetlinks.json` do app Android (sumiu ou mudou), deploy de
produção fora do ramo principal, rotinas do GitHub falhando, fila de e-mails do próprio Sentinela, modo de demonstração.

---

## 5. Mudanças no banco e como reverter

**Banco do site:** nenhuma. As duas branches não tocam em `supabase/install.sql` do site.

**Banco do Sentinela (projeto novo):** `sentinela/supabase/install.sql` cria o esquema `vigia` (22 tabelas), funções
públicas, o gatilho `sentinela_conta_nova` em `auth.users` e a rotina `sentinela-faxina` no `pg_cron`. Idempotente e
aditivo: rodar de novo não apaga nada.

Para reverter tudo (só no projeto do Sentinela):

```sql
drop trigger if exists sentinela_conta_nova on auth.users;
drop function if exists public.sentinela_conta_nova();
select cron.unschedule('sentinela-faxina');
drop schema vigia cascade;
```

(As funções em `public` que dependem de `vigia` caem com o `cascade`; o que sobrar aparece em `\df public.*` e sai com
`drop function`.) Ou simplesmente apague o projeto Supabase do Sentinela: o site não depende dele em nada.

---

## 6. Decisões pendentes

| Decisão | Opções | O que muda |
| --- | --- | --- |
| S3 e-mails para endereço não verificado | tirar o texto do visitante dos e-mails; teto diário por tipo | muda o texto dos e-mails; fecha phishing com o domínio |
| S7 origem de rede | `md5` → resumo com chave secreta | zera contadores e banimentos por origem; LGPD melhor |
| N2 perguntas gravadas do podcast | só áudio, N por conta, só com pergunta aberta | testar no Supabase real (o banco local não simula o depósito) |
| S6 KaTeX | subir `katex` para 0.19 e `rehype-katex`/`remark-math` compatíveis | major: conferir todas as fórmulas das aulas no build antes de juntar |
| N9 CORS das Edge Functions | `*` → `https://institutolucia.org` (e o app Android) | republicar as duas funções; testar no celular |
| N10 `security.txt` | criar `public/.well-known/security.txt` | público; texto pronto abaixo |
| S10, S12, S13, F6 | (como no relatório anterior) | pequenas, mudam o que alguém pode fazer/ver |
| Sentinela: pasta no repositório ou repositório próprio | fica em `sentinela/` (feito) ou `git subtree split -P sentinela` | repositório próprio simplifica Vercel/Actions; monorepo mantém tudo junto |
| Sentinela: parâmetros das regras pelo app | hoje só liga/desliga; limites pelo SQL Editor (`vigia.regras`) | tela a mais numa próxima versão |
| Sentinela: Android nativo | ver seção 4 | uma tarde de configuração |
| N13 AGPL em repositório privado | publicar o repositório, ou oferecer o código a quem pedir | decisão sua |

Texto proposto para `public/.well-known/security.txt` (ajuste o contato e a data):

```
Contact: mailto:institutolucia@tutamail.com
Expires: 2027-10-15T00:00:00.000Z
Preferred-Languages: pt-BR, en
Canonical: https://institutolucia.org/.well-known/security.txt
Policy: https://institutolucia.org/pt/privacidade
```

---

## 7. Como publicar as correções com segurança

**Branch `correcoes-seguranca` (site).**

1. Traga o `master` mais novo: `git merge master` (ou `sync_with_base_branch` no app). Sem conflitos esperados: ela
   só toca `lib/externo.ts`, `next.config.ts`, workflows, `eslint.config.mjs`, `.env.example` e scripts de teste.
2. Rode: `npm run lint && npm run typecheck && npm run testar:banco && npm run testar:fumaca && npm run testar:externo`.
3. `git push -u origin correcoes-seguranca` → pull request. A verificação do GitHub roda tudo, inclusive o build
   (30 min). A Vercel monta uma prévia.
4. Juntar ao `master` publica o site. Conferir em produção: a página inicial; `/pt/busca`; a página **Dados**
   (`/pt/dados`, usa `lib/externo.ts`: Banco Central/IBGE); **Checagens** com uma busca; o dicionário em **Ferramentas**;
   e `curl -sI https://institutolucia.org/pt | grep -i -E "content-security|reporting"` (só muda se `CSP_REPORT_URL`
   estiver definida).
5. **Desfazer:** Vercel → Deployments → versão anterior → *Promote to Production*; ou `git revert` do merge. Para só o
   redirecionamento: reverter `95da88c`. Nenhuma mudança de banco.

**Branch `sentinela`.** Não muda o site publicado. Juntar só acrescenta a pasta `sentinela/` e o workflow do
instalador. Pode juntar a qualquer hora; o banco e o Worker do Sentinela vivem fora do deploy do site.

**Ordem sugerida:** seção 1-A (configurações do site) hoje; `correcoes-seguranca` quando o CI estiver verde; o
Sentinela aos poucos (banco → Worker → app), um dia inteiro de observação antes de confiar nos alertas.
