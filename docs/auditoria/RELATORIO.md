# Auditoria de segurança e de bugs — relatório final (15/10/2026)

- Pasta de trabalho: `C:\Users\0177\perenidade-auditoria` (git worktree), branch `auditoria-seguranca`, **sem push**.
- A branch parte de `81252f3` (produção no início) e já tem o `master` de 15/10 juntado (merges `992c49c` e
  `3cc7935`, até `df7926c`). Por isso a auditoria cobre também o que chegou depois: podcasts, rotas `/api`, painel
  novo, horas contadas pela plataforma.
- Nada foi publicado, nenhum segredo foi trocado e o banco de produção não foi tocado. Em produção só foram feitas
  leituras anônimas de configuração pública.

## 1. Resumo executivo

| Gravidade | Segurança: achados | corrigidos no código | Bugs: achados | corrigidos |
| --- | --- | --- | --- | --- |
| Crítico | 0 | 0 | 0 | 0 |
| Alto | 2 | 1 | 0 | 0 |
| Médio | 7 | 1 | 3 | 3 |
| Baixo | 10 | 2 | 4 | 4 |

**Corrigido na branch:**
- histórico público vazando dados internos;
- chave do banco e token do GitHub expostos à instalação de pacotes;
- canal da mediação quebrado;
- coordenação sem como tirar do ar um anúncio aprovado;
- curadoria e mediação vendo abas do Podcast que só davam "sem permissão";
- rádio aceitando endereço que não toca;
- ações sem registro de atividades;
- título e texto da tela Entrar;
- guia de manutenção contraditório;
- teste do podcast fora da verificação do GitHub.

**Fica com você:**
- configurações no Supabase e na Cloudflare (seção 3);
- decisões que mudam o que as pessoas veem (seção 4).

**O ponto mais urgente é o S1:** com o cadastro sem confirmação de e-mail, alguém pode receber a função de outra pessoa
quando a coordenação aceita uma candidatura. A correção é uma chave no Supabase. O código já recusa o caso quando a
chave está ligada, e isso está provado por um teste novo.

## 2. Tabela de achados

Status:
- **corrigido** = na branch, com teste;
- **manual** = configuração que só você faz;
- **decisão** = precisa da sua escolha;
- **pendente** = não feito;
- **recomendação** = melhoria sem urgência.

### Segurança

| ID | Grav. | Onde | O problema | Como seria explorado | Status |
| --- | --- | --- | --- | --- | --- |
| S1 | ALTO | Supabase (`mailer_autoconfirm: true`, conferido) + `inscricao_decidir` | O cadastro não confirma e-mail. Aceitar a candidatura de quem "já tem conta" dá a função a essa conta. | Criar conta com o e-mail de alguém que se candidatou (ou candidatar-se em nome de uma pessoa conhecida) e receber curadoria ou mediação. | manual (seção 3) + teste novo provando que o banco recusa com a confirmação ligada |
| S2 | ALTO | `lib/history.ts`, `/historico`, página inicial | O histórico mostrava mensagens de commit (nomes de branches, descrições internas de moderação e segundo fator) e o código do commit. | Mapa do funcionamento interno para quem prepara um ataque. | **corrigido** (`fe13e63`): só "Aulas: 12 · Obras: 73" por dia; o site nem lê mais mensagem, autor ou código |
| S3 | MÉDIO | `voluntariar`, `reforco_pedir` | O site manda e-mail para qualquer endereço com o texto do visitante (nome; assunto do reforço). Não há teto diário geral. | Phishing com o domínio do instituto; gastar a cota do Resend e travar os convites. | decisão |
| S4 | MÉDIO | `.github/workflows/publicar.yml` | A chave `service_role` e o token de escrita do GitHub ficavam ao alcance do `npm ci` e do build. | Um pacote comprometido leria a chave do banco ou faria push no `master` (que publica). | **corrigido** (`f9646e8`); conferir na primeira rodada (seção 5) |
| S5 | MÉDIO | troca de senha no painel | Não pede a senha atual. | Um aparelho com o painel aberto vira conta tomada. | manual ("Secure password change") |
| S7 | MÉDIO | `interno.origem()` | A origem de rede é guardada como `md5('lucia:'+IP)`, reversível em minutos. A página de privacidade diz que o IP não é guardado. | Quem acessar o banco descobre o IP de cada conta (LGPD). | decisão |
| S8 | MÉDIO (a confirmar) | `interno.origem()` | Sem o cabeçalho `cf-connecting-ip`, o banco usa o 1º `X-Forwarded-For`, que o visitante forja. | Contornar o limite de envios e o banimento por origem. | manual (teste na seção 3) |
| N1 | MÉDIO | `app/api/*` (do master) | As rotas de servidor que consultam serviços de fora não têm limite de pedidos. Basta variar a busca para furar o cache. | Gastar a cota do Google Fact Check e as execuções da Vercel. | manual (regra de limite na Cloudflare) |
| N2 | MÉDIO | depósito `podcast-producao`, pasta `perguntas/` (do master) | Qualquer conta (o cadastro é aberto) envia arquivos de até 50 MB na própria pasta, sem limite de quantidade, inclusive zip, PDF e vídeo. | Encher o armazenamento do Supabase e parar os envios da equipe. | decisão |
| S6 | BAIXO | dependências | `npm audit`: 5 alertas "high", todos na cadeia do ESLint (só desenvolvimento). Não há correção compatível. | Nenhum efeito no site. | PGlite atualizado (`5d7c4b7`); o resto só acompanhar |
| S9 | BAIXO | `next.config.ts` | A CSP aceita script embutido (`unsafe-inline`), exigido pelas páginas estáticas do Next. | Só pesaria junto com um XSS (nenhum encontrado). | recomendação |
| S10 | BAIXO | `avaliar-comunidade` (**agora publicada em produção**) | Qualquer um, até sem conta, dispara a reavaliação das mensagens pendentes. | Chamadas extras à OpenAI e ao Safe Browsing (no máximo 3 por mensagem). | recomendação |
| S11 | BAIXO | várias funções | Apoiadores, rádio, denúncias, anotações e o apagamento de anúncio alheio não deixavam rastro. | Sem rastro de quem mudou o que o público vê. | **corrigido** (`d45b903`) |
| S12 | BAIXO | `papel_conceder` | A vice dá curadoria diretamente, mas não por convite nem por candidatura. | Regras divergentes. | decisão |
| S13 | BAIXO | `perfil_salvar` | Qualquer conta pode usar o nome "Coordenação" ou o de alguém da equipe. | Imitar a equipe na Comunidade. | decisão |
| S14 | BAIXO | erros do banco | Texto cru de erro (nome de restrição e de tabela) volta na resposta HTTP. | Ajuda quem estuda o sistema. | recomendação |
| S15 | BAIXO | workflows | Ações fixadas por versão, não por hash. | Ataque à cadeia de fornecimento. | recomendação |
| N3 | BAIXO | `lib/externo.ts` (do master) | A lista de destinos permitidos vale para o 1º endereço, mas os redirecionamentos são seguidos. | SSRF por redirecionamento (pouco provável com os serviços da lista). | recomendação |
| N4 | BAIXO | `ci.yml` | `testar:podcast` não rodava na verificação do GitHub. | Erro no podcast passaria sem aviso. | **corrigido** (`4eab3ec`) |

### Bugs funcionais

| ID | Grav. | Onde | O problema | Status |
| --- | --- | --- | --- | --- |
| F1 | MÉDIO | Mural da equipe | O canal "mediação" aparecia, mas toda mensagem dava erro. Pedir ajuda à mediação também falhava. | **corrigido** (`a98aabd`) |
| F11 | MÉDIO | Painel → Podcast (do master) | Curadoria e mediação, que só revisam episódios, viam as 12 abas da produção; 8 davam "Você não tem permissão para isso". | **corrigido** (`278812d`): para quem só revisa, a seção mostra Episódios e Guia |
| F10 | MÉDIO | Painel → Mural dos Trabalhadores | O guia diz que a coordenação retira do ar um anúncio aprovado, mas o painel só listava pendentes. Só saía pelo SQL. | **corrigido** (`552734e`): aba "No ar" e botão "Retirar do ar" com motivo, sem apagar nada |
| F2 | BAIXO | Rádio | Faixa `http://` era aceita e nunca tocava (a página é https). | **corrigido** (`8b0b33e`) |
| F3 | BAIXO | `/pt/jornal` | Única página sem título principal. | **corrigido** (`af5a136`), escondido na tela |
| F5 | BAIXO | Entrar | Por um instante dizia "contas só por convite", embora o cadastro esteja aberto. | **corrigido** (`4e5d423`) |
| F7 | BAIXO | `docs/MANUTENCAO.md` | Contradições (desligar ou ligar "Confirm email"; quem aprova o mural). | **corrigido** (`c714f2b`) |
| F6 | decisão | navegação | O Mural dos Trabalhadores só tem link no rodapé e em "Mais". É o "escondido demais". | decisão |
| F9 | pendente | aplicativo | "Giro de notícias ausente no app": o código do app Android não está neste repositório. | pendente |
| F4 | — | Entrar | Rótulos dos campos: falso alarme da ferramenta de leitura; os campos têm rótulo. | descartado |
| F8 | — | produção | A segunda avaliação da Comunidade não estava publicada; foi publicada pelo master. | resolvido |

## 3. O que você precisa fazer à mão (em ordem de urgência)

1. **Até ligar a confirmação de e-mail:** antes de aceitar uma candidatura em *Voluntários e convites → Candidaturas*
   que mostre "já tem conta", confirme com a pessoa, pelo e-mail informado, que a conta é dela. Para conferir as que já
   foram aceitas por esse caminho, rode no SQL Editor (só leitura):
   `select criado_em, alvo, detalhes from interno.auditoria where acao = 'inscricao_aceita' and detalhes ->> 'convite' = 'false' order by criado_em desc;`
2. **Supabase → Authentication → Sign In / Providers → Email:**
   - ligue **"Confirm email"** (antes, configure o SMTP do Resend, como no guia, seção "E-mails automáticos");
   - ligue **"Secure password change"**.

   Isso fecha S1 para contas novas e S5.
3. **Supabase → Authentication → Attack Protection:** confira que o captcha (Turnstile) está ligado. De fora não dá
   para ver.
4. **Cloudflare → Security → WAF → Rate limiting rules:** crie uma regra para o caminho `/api/` (por exemplo, 60
   pedidos por minuto por IP, ação "Block" por 10 minutos). Fecha N1.
5. **Depois de juntar a branch ao `master`:**
   - rode `supabase/install.sql` inteiro no SQL Editor. Vale para F1, F2 e S11; não apaga nada e pode ser rodado de novo;
   - em *Actions → Publicar contribuições aprovadas → Run workflow*, rode uma vez para confirmar que o push continua
     funcionando com a mudança do S4.
6. **S8 (opcional), conferir se a origem pode ser forjada:** em um terminal, rode 25 vezes a conferência pública de
   certificado com um `X-Forwarded-For` diferente a cada vez:
   `for i in $(seq 1 25); do curl -s -X POST https://yuciphgaejrkamvwllcb.supabase.co/rest/v1/rpc/certificado_conferir -H "apikey: <chave anon>" -H "Content-Type: application/json" -H "X-Forwarded-For: 10.0.0.$i" -d '{"p_codigo":"X"}'; echo; done`
   - se a 21ª resposta for `muitos_pedidos`, a origem não é forjável e o S8 está fechado;
   - se nunca for, me avise: a correção é trocar a origem para só `cf-connecting-ip`.
7. **Nenhuma chave precisa ser trocada:** não houve vazamento de segredo no código nem no histórico.

## 4. Decisões pendentes

| Decisão | Opções | Prós e contras |
| --- | --- | --- |
| S1, além da configuração | (a) Aceitar candidatura de quem já tem conta passa a pedir que a pessoa confirme, logada, por um link enviado ao e-mail. (b) Recusar o aceite automático e a coordenação dá a função à mão, depois de confirmar. | (a) fecha de vez, mas é fluxo novo de tela e de e-mail. (b) é pequena e acrescenta um passo à coordenação. Com a confirmação ligada (seção 3), o risco cai bastante; (b) protege as contas antigas. |
| S3, e-mails para endereço não verificado | Tirar o texto do visitante desses e-mails ("Olá." no lugar de "Olá, <nome>"; "seu pedido de reforço de Matemática" no lugar do assunto) e criar um teto diário por tipo. | O texto dos e-mails muda um pouco, e o site deixa de servir como disparador de phishing. O teto precisa caber no seu plano do Resend. |
| S7, origem de rede | Trocar `md5` por resumo com chave secreta sorteada. | Os banimentos por origem já existentes deixam de valer e os contadores zeram. Em troca, o banco deixa de guardar algo equivalente ao IP (LGPD). |
| N2, perguntas gravadas do podcast | Só áudio e no máximo N arquivos por conta na pasta `perguntas/`, ou só para quem tem pergunta aberta. | Fecha o abuso de armazenamento. É preciso testar no Supabase de verdade (o banco local não simula esse depósito). |
| F6, Mural dos Trabalhadores | Link no cabeçalho ou na barra do celular, ou destaque na página inicial. | Mudança de navegação e de layout (a regra da casa protege o cabeçalho). |
| S10 | A reavaliação passa a exigir conta logada. | Quem tem direito de pedir já está logado. Exige publicar a função de novo. |
| S12, S13 | Alinhar a regra da vice. Reservar nomes da equipe e "Coordenação". | Pequenas; mudam o que uma pessoa pode fazer. |

## 5. Como publicar com segurança

1. **Antes:** traga o `master` mais novo para a branch (ele anda rápido) e rode `npm run lint`, `typecheck`,
   `conferir:i18n`, `testar:banco`, `testar:moderacao`, `testar:emails`, `testar:podcast` e `testar:fumaca`.
2. **Enviar:** `git push -u origin auditoria-seguranca` e abra um pull request. A verificação do GitHub roda tudo,
   inclusive o build. A Vercel pode criar uma prévia da branch.
3. **Juntar:** juntar no `master` publica o site na hora (Vercel).
4. **Banco:** logo depois, rode `supabase/install.sql` no SQL Editor. As mudanças funcionam com o site novo e com o
   antigo (alargam uma regra, acrescentam registros, recusam rádio http), então a ordem não quebra nada.
5. **Conferir em produção:**
   - página inicial;
   - `/pt/historico` ("Aulas: … · Obras do acervo: …", sem nomes de branch);
   - uma aula, o acervo e a busca;
   - entrar e sair;
   - Comunidade (ler e escrever);
   - Painel → Mural dos Trabalhadores (abas "Esperando decisão" e "No ar");
   - Mural da equipe → canal "mediação" (com uma conta de mediação);
   - *Actions → Publicar contribuições aprovadas → Run workflow* (deve terminar verde).
6. **Desfazer:**
   - site: Vercel → Deployments → versão anterior → "Promote to Production", ou `git revert` do merge;
   - rotina de publicação: se falhar, reverta só o commit `f9646e8`;
   - banco: rode no SQL Editor a versão anterior das funções alteradas (`git show 81252f3:supabase/install.sql`).
     Nada foi apagado.

## 6. Recomendações para depois

- CSP sem `unsafe-inline` (hashes), primeiro como `Report-Only`.
- `redirect: "manual"` em `lib/externo.ts`, tratando o redirecionamento como falha (N3).
- Ações do GitHub fixadas por hash. `npm ci --ignore-scripts` onde a instalação não precisa de scripts.
- Teto diário geral por tipo de e-mail e aviso à coordenação quando ele for atingido (S3).
- Teste automático de navegador do painel por cargo (hoje feito com `docs/auditoria/percorrer-painel.js`).
- Monitoramento:
  - alerta para `armadilha` e `isca` no registro de atividades;
  - alerta para e-mails falhando;
  - alerta para cota da transcrição.
- O código é AGPL e o repositório é privado: a licença pede que quem usa o site possa obter o código.
- Auditar o aplicativo Android quando o código estiver acessível (F9).
- `/pt/acervo` entrega 552 KB de HTML de uma vez; paginar ajuda em celular fraco.

## 7. Linha de base e verificação final

| Conferência | Antes (81252f3) | Depois (branch com master juntado) |
| --- | --- | --- |
| `lint`, `typecheck`, `conferir:i18n` | passam | passam |
| `testar:banco` | 665 | 712 |
| `testar:moderacao` | 20 | 30 |
| `testar:emails` | 13 | 19 |
| `testar:podcast` | não existia | 98 |
| `testar:fumaca` (só banco) | 68 | 68 |
| `testar:fumaca` com as páginas do site montado | 106 | 108 |
| `build` | passa | passa |

Em cada lado, todas as conferências passam (0 falhas). O "depois" tem mais conferências porque inclui testes novos do
master e da auditoria.

**O que foi percorrido no navegador** (banco de teste local, contas falsas):

- **Painel, com os 10 cargos:** coordenação, vice, curadoria, educador, mentoria, design, jornalismo, revisão, mediação
  e comunidade, duas vezes: antes da junção e no painel redesenhado do master. No painel novo apareceu um defeito, o
  F11 (abas do Podcast para quem só revisa), que foi corrigido. Depois disso, cada seção e cada aba abriu sem erro na
  tela e sem chamada recusada, com os 10 cargos. As ações que o banco nega a um cargo também não aparecem na tela
  desse cargo.
- **Formulários públicos, todos salvando:** anúncio no mural (e retirada pelo código), reforço, denúncia, contribuição,
  candidatura, boletim, criar conta e publicar na Comunidade.
- **Celular (375 px):** 15 páginas e o painel sem rolagem lateral.
- **Teclado:** existe o link "pular para o conteúdo" e a marcação de foco.
- **Links:** nenhum quebrado nas 2.199 páginas em português do build final. Nenhuma página ficou sem título principal
  e nenhuma imagem sem texto alternativo.

## 8. Fase 6: build final e páginas

- `npm run build` com o master juntado: **passou** (31 min, 10.940 páginas, nenhum erro).
- `testar:fumaca` contra o site montado: **108 conferências, 0 falhas**. Isso inclui o teste novo do histórico, que
  falhava antes da correção do S2.
- Rastreio de links no build final: 2.199 páginas, 0 links quebrados.
- **Depois do build** entrou mais uma junção do master (`3cc7935`: horas contadas pela plataforma, podcast sem
  entregas, Instagram no rodapé), sem conflito. Com ela, lint, tipos, idiomas e todos os testes passam (tabela da
  seção 7). O build dessa última versão fica a cargo da verificação do GitHub, que monta o site em todo pull request.
- As 8 funções de banco novas de horas e certificados (`horas_*`, `certificado_pedi*`) também foram revisadas: todas
  conferem a função de quem chama ou só mexem nos registros da própria pessoa.

## 9. Ferramentas da auditoria (`docs/auditoria/`)

- `semear.mjs`: dados de teste no banco local.
- `rastrear.mjs`: links quebrados, páginas sem `<h1>`, imagens sem `alt`.
- `percorrer-painel.js`: percorre o painel por cargo no navegador.

Podem sair antes de juntar ao `master`.
