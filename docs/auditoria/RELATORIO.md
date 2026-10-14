# Auditoria de segurança e de bugs — relatório parcial (14/10/2026)

Trabalho feito pelas Fases 0, 1 e 2 completas e parte da Fase 3. **Nenhuma correção foi aplicada ao site**: o único
código novo é o teste de fumaça (`scripts/testar-fumaca.mjs`). Nada foi publicado, nenhum push foi feito e o banco de
produção não foi tocado (só leituras anônimas de configuração pública).

- Pasta de trabalho: `C:\Users\0177\perenidade-auditoria` (git worktree), branch `auditoria-seguranca`.
- Base: `81252f3` (o que estava em produção em `origin/master`).
- Commits da auditoria: `db9a9c6` (testes de fumaça) e o commit deste relatório.

## 1. Resumo executivo

| Gravidade | Encontrados | Corrigidos |
| --- | --- | --- |
| Crítico | 0 | 0 |
| Alto | 2 | 0 |
| Médio | 5 de segurança + 1 bug que impede uso | 0 |
| Baixo | 7 de segurança + 6 bugs e ajustes | 0 |

O sistema está bem construído: todas as cerca de 200 funções do banco conferem o cargo de quem chama, as tabelas ficam
fora do alcance da API, o conteúdo de usuário é escapado, os envios de arquivos são conferidos pelos bytes e limpos, e
não há segredo real no código nem no histórico do git (nada a rotacionar por vazamento). Os dois problemas altos são:
uma conta pode receber a função de outra pessoa porque o cadastro não confirma e-mail (S1), e o histórico público
mostra dados internos (S2).

## 2. Tabela de achados

Status: **pendente** = ainda não corrigido; **decisão** = precisa da sua escolha antes; **manual** = só você pode fazer.

### Segurança

| ID | Gravidade | Onde | O problema | Como poderia ser explorado | Status |
| --- | --- | --- | --- | --- | --- |
| S1 | ALTO | `supabase/install.sql`, função `inscricao_decidir` (por volta da linha 3389) + configuração do Supabase | Em produção o cadastro não confirma o e-mail (`mailer_autoconfirm: true`, conferido em `/auth/v1/settings`). Quando a coordenação aceita uma candidatura do formulário público, a função vai direto para a conta que já existe com aquele e-mail. | Alguém cria conta com o e-mail de outra pessoa e manda uma candidatura em nome dela (ou espera a candidatura verdadeira). Ao aceitar, a coordenação dá curadoria, mediação etc. ao invasor. | decisão + manual |
| S2 | ALTO | `lib/history.ts`, `app/[lang]/historico/page.tsx`, `app/[lang]/page.tsx` (três últimas mudanças) | A página pública de histórico mostra a mensagem de cada commit que tocou `content/`: nomes de branches internas ("Merge branch 'master' into moderacao"), descrições internas ("segunda avaliação por serviço de moderação, desligada de nascença", no ar agora) e o hash do commit no código da página. | Quem estuda o site para atacar aprende como ele funciona por dentro. | pendente (correção já autorizada por você) |
| S3 | MÉDIO | `voluntariar` e `reforco_pedir` em `install.sql` | O site manda e-mail, sem conta e sem verificação, para qualquer endereço digitado, repetindo um texto do visitante (o nome, até 120 letras; o assunto do reforço, até 140; `https://` é barrado, mas `site.com/x` passa). Não há teto diário geral. | Phishing com o nome e o domínio do instituto; prejudicar a reputação do domínio; gastar a cota do Resend e travar os convites. | decisão |
| S4 | MÉDIO | `.github/workflows/publicar.yml` | A chave `service_role` (acesso total ao banco) está no `env` do job inteiro, inclusive em `npm ci` (scripts de instalação de 475 pacotes) e `npm run build`. | Um pacote comprometido, atualizado pelo Dependabot, leria a chave. | pendente (correção simples: pôr o `env` só nos dois passos `npm run sincronizar`) |
| S5 | MÉDIO | `components/painel/Painel.tsx:530`, `components/SignIn.tsx:203` | Trocar a senha não pede a senha atual. | Quem pega um aparelho com o painel aberto troca a senha e fica com a conta. | manual (ligar "Secure password change" no Supabase) |
| S7 | MÉDIO | `interno.origem()` em `install.sql` (linha 824) | A "origem de rede" guardada é `md5('lucia:' + IP)`, que se reverte em minutos (espaço do IPv4). A página de privacidade diz que o endereço de rede não é guardado. | Quem tiver acesso ao banco descobre o IP de cada conta (LGPD). | decisão |
| S8 | MÉDIO (a confirmar) | `interno.origem()` | Os limites para visitante sem conta e o banimento por origem usam `cf-connecting-ip`; se esse cabeçalho não chegar ao banco, vale o primeiro `X-Forwarded-For`, que o visitante pode forjar. | Contornar limites de envio e banimento por origem. | pendente (confirmar exige um teste que grava contadores em produção; não foi feito) |
| S6 | BAIXO | dependências | `npm audit`: 5 alertas "high", todos na cadeia do ESLint (`braces`, `micromatch`, `fast-glob` via `eslint-config-next`). Só desenvolvimento, não vai para o site. O npm só sugere rebaixar para o Next 14. | Nenhum efeito no site. | pendente (só acompanhar) |
| S9 | BAIXO | `next.config.ts` | A CSP aceita script embutido (`'unsafe-inline'`), exigido pelas páginas estáticas do Next. | Só teria efeito junto com uma falha de XSS (nenhuma encontrada). | recomendação |
| S10 | BAIXO | `supabase/functions/avaliar-comunidade` | A ação "recuperar" pode ser disparada por qualquer pessoa (limitada a 3 tentativas por mensagem). A função nem está publicada. | Chamadas extras ao serviço de moderação. | pendente |
| S11 | BAIXO | várias funções | Não entram no registro de atividades: `apoiador_salvar/remover`, `radio_canal_*`, `radio_faixa_*`, `denuncia_resolver`, `anotacao_decidir`, `mural_remover` feito pela coordenação. | Falta rastro de quem fez. | pendente |
| S12 | BAIXO | `papel_conceder` | A vice dá "curadoria" diretamente, mas não pode fazer isso por convite nem por candidatura. | Regra inconsistente. | decisão |
| S13 | BAIXO | `perfil_salvar` | Qualquer conta pode se chamar "Coordenação" ou usar o nome de alguém da equipe. | Imitação na Comunidade (as respostas da equipe têm selo, o que ajuda). | decisão |
| S14 | BAIXO | respostas do banco | O texto cru de alguns erros do banco (nome de tabela e de restrição) volta na resposta HTTP. A tela mostra "Algo deu errado". | Ajuda quem estuda o sistema por fora. | pendente |
| S15 | BAIXO | `.github/workflows/*.yml` | Ações fixadas por versão (`@v5`), não por hash do commit. | Ataque à cadeia de fornecimento. | recomendação |

### Bugs funcionais

| ID | Gravidade | Onde | O problema | Status |
| --- | --- | --- | --- | --- |
| F1 | MÉDIO | `install.sql`, tabela `interno.equipe_mensagens` e função `equipe_escrever` | O canal "mediação" do Mural da equipe aparece para quem pode vê-lo, mas toda mensagem nele dá erro (a restrição `equipe_mensagens_canal_check` não inclui `mediacao`). No canal "pedidos" não dá para pedir ajuda à mediação. Reproduzido no banco de teste. | pendente |
| F2 | BAIXO | `radio_faixa_salvar` | Aceita faixa com endereço `http://`, mas o navegador bloqueia (página em https e CSP `media-src https:`). A faixa não toca. | pendente |
| F3 | BAIXO | `/pt/jornal` | Única página do site sem título principal (`<h1>`). | pendente |
| F4 | BAIXO | `components/SignIn.tsx` | Os campos de e-mail e senha não estão ligados ao rótulo: o leitor de tela não diz o que é cada campo. | pendente |
| F5 | BAIXO | tela Entrar | Enquanto carrega, aparece por um instante "as contas são criadas por convite", embora o cadastro esteja aberto. | pendente |
| F6 | decisão | navegação pública | O Mural dos Trabalhadores só tem link no rodapé e na página "Mais" (`/explorar`), nada no cabeçalho nem na barra do celular. É a causa do "escondido demais". Mudar a navegação é mudança visível. | decisão |
| F7 | BAIXO | `docs/MANUTENCAO.md` | O guia se contradiz: a seção 6, item 6, manda **desligar** "Confirm email", e a seção "Cadastro aberto" manda **manter ligada**. A seção 15 diz que só a coordenação aprova o mural, mas a mediação também aprova. | pendente |
| F8 | informação | Supabase de produção | A função `avaliar-comunidade` não está publicada (responde 404). Como a segunda avaliação nasce desligada, nada quebra, mas o botão "Testar agora" do painel vai falhar. | informação |
| F9 | pendente | aplicativo | "Giro de notícias ausente no app": o código do aplicativo Android não está neste repositório, então não foi investigado. | pendente |

## 3. O que você precisa fazer à mão (em ordem de urgência)

1. **Até S1 ser corrigido no código**, ao aceitar uma candidatura em *Voluntários e convites → Candidaturas*: se a
   linha mostrar que a pessoa "já tem conta", confirme com ela pelo e-mail informado, antes de aceitar, que foi ela
   quem criou a conta.
2. **Ligar a confirmação de e-mail** (S1): Supabase → Authentication → Sign In / Providers → Email → ligar
   "Confirm email". Antes, configure o SMTP do Resend (Authentication → SMTP Settings, como em `docs/MANUTENCAO.md`,
   "E-mails automáticos"), senão as confirmações não chegam. Contas antigas continuam valendo.
3. **Pedir a senha atual na troca de senha** (S5): Supabase → Authentication → Sign In / Providers → Email → ligar
   "Secure password change" (o nome do menu pode variar).
4. **Conferir o captcha** (proteção contra força bruta): Supabase → Authentication → Attack Protection → captcha com
   Turnstile ligado. Só dá para ver no painel; de fora não consegui confirmar.
5. **Nenhuma chave precisa ser rotacionada**: não houve vazamento de segredo. A chave `anon` e a site key do Turnstile
   que aparecem no navegador são públicas por natureza.

## 4. Decisões pendentes

| Decisão | Opções | Prós e contras |
| --- | --- | --- |
| S1: aceitar candidatura de quem já tem conta | (a) Não dar a função direto: mandar ao e-mail um link de confirmação que a pessoa abre já logada. (b) Recusar o aceite automático e pedir que a coordenação dê a função à mão em *Confiar função*, depois de confirmar. (c) Só a configuração do item 2 da seção 3. | (a) fecha de vez, mas é um fluxo novo de tela e de e-mail. (b) é uma mudança pequena no banco e na mensagem, com um passo a mais para a coordenação. (c) não protege contas criadas antes da mudança. Recomendação: (c) agora e (b) no código. |
| S3: e-mails para endereço não verificado | Tirar dos e-mails de confirmação o texto escrito pelo visitante ("Olá." no lugar de "Olá, <nome>"; "seu pedido de reforço de Matemática" no lugar do assunto) e criar um teto diário por tipo de e-mail. | Muda um pouco o texto dos e-mails. Corta o uso do site como disparador de phishing. |
| S7: origem de rede | Trocar o `md5` por um resumo com uma chave secreta sorteada na instalação. | Os banimentos por origem que já existem deixam de valer (seria preciso banir de novo) e os contadores recomeçam. Em troca, o banco deixa de guardar algo equivalente ao IP. |
| F6: Mural dos Trabalhadores | Pôr o link no cabeçalho ou na barra do celular, ou dar destaque na página inicial. | É mudança de navegação e de layout. A regra da casa evita mexer no cabeçalho. |
| S12 e S13 | Alinhar a regra da vice. Proibir nomes como "Coordenação" e o nome de alguém da equipe. | Pequenas; mudam o que uma pessoa pode fazer. |

## 5. Como publicar com segurança

1. Cada correção vai num commit separado na branch `auditoria-seguranca`, com `npm run testar:banco`,
   `npm run testar:fumaca`, `npm run lint` e `npm run typecheck` passando. Antes de juntar, rode `npm run build`
   (cerca de 15 a 30 minutos) e `npm run testar:fumaca -- http://localhost:<porta>` com `npm start`.
2. **Push no `master` publica em produção na hora (Vercel).** Abra um pull request da branch: a verificação do
   GitHub (`ci.yml`) roda tudo, inclusive a fumaça. A rotina "Publicar contribuições aprovadas" também faz push no
   `master` de hora em hora, então traga o `master` atualizado para a branch antes de juntar.
3. **Mudanças no banco** (`supabase/install.sql`): o arquivo pode ser rodado de novo sem apagar dados. Ordem segura:
   se a função nova continua compatível com o site atual, rode o SQL no SQL Editor primeiro e publique o site depois.
   Se o site novo depende do SQL novo, publique os dois juntos: o SQL logo antes do merge.
4. **Depois de publicar**, confira: página inicial, acervo, uma aula, `/pt/historico`, entrar e sair, a Comunidade
   (ler e escrever) e o painel com a sua conta (Mesa, Fila, Voluntários).
5. **Para voltar atrás**: o site volta na Vercel, em Deployments → versão anterior → "Promote to Production", ou com
   `git revert` do merge. O SQL não se desfaz sozinho: rode no SQL Editor a versão anterior das funções alteradas,
   tirada do histórico do git (`git show <commit>~1:supabase/install.sql`).

## 6. Recomendações para depois

- Teste automatizado da navegação do painel por cargo (hoje feito à mão, com `docs/auditoria/percorrer-painel.js`).
- CSP sem `'unsafe-inline'` (hashes ou nonces), primeiro em modo `Report-Only`.
- Fixar as ações do GitHub por hash e rodar `npm ci --ignore-scripts` onde a instalação não precisa de scripts.
- Teto diário geral para cada tipo de e-mail automático e alerta para a coordenação quando ele for atingido.
- Repositório privado com código sob AGPL: a licença pede que quem usa o site possa obter o código. Vale publicar o
  repositório (depois de corrigir S1 a S4) ou indicar no site onde o código pode ser pedido.
- `/pt/acervo` entrega 552 KB de HTML de uma vez (as 881 obras). Ainda é aceitável, mas paginar ou carregar por
  partes ajuda em celular fraco.

## 7. Onde continuar (para a próxima sessão)

**Já feito**

- Fase 0: mapa do projeto.
- Fase 1: linha de base, tudo passando:

  | Conferência | Resultado |
  | --- | --- |
  | `testar:banco` | 665 |
  | `testar:moderacao` | 20 |
  | `testar:emails` | 13 |
  | `testar:fumaca` | 106, com páginas |
  | `lint` e `typecheck` | passam |
  | `build` | passa |

- Fase 2 completa.
- Fase 3, parte já feita:
  - Rastreio das 2.193 páginas em português do site montado: nenhum link quebrado; todas as imagens com `alt`; só
    `/pt/jornal` sem `<h1>`; nenhuma página acima de 600 KB.
  - Percurso do painel com a **coordenação**: as 22 seções e todas as abas abrem sem erro na tela e sem nenhuma
    chamada falhando.
  - Os únicos erros de console vêm de `/auth/v1/passkeys`, que o banco de teste local não simula.

**Falta da Fase 3**

1. Percorrer o painel com os outros 9 cargos: vice, curadora, prof, mentora, designer, jornal, revisor, mediador e
   leitora. Como fazer:
   - `npm run dev:local 3201` (ou a configuração `auditoria-painel` em `.claude/launch.json` da pasta principal);
   - `node docs/auditoria/semear.mjs` para criar dados de teste;
   - no navegador, colar `docs/auditoria/percorrer-painel.js` e seguir as instruções do topo do arquivo.
2. Testar no navegador os formulários públicos: contribuir, mural, reforço, denunciar, boletim, voluntariado, criar
   conta.
3. Conferir celular (rolagem lateral em 375 px) e navegação por teclado.
4. Itens já conhecidos: as "funções do painel que não funcionam" e os "cargos que não funcionam como deveriam" precisam
   do percurso do item 1. O giro de notícias no app precisa do código do aplicativo.

**Depois**: Fase 4 (prioridade, já adiantada nas tabelas acima), Fase 5 (corrigir na ordem S2, S4, F1, S1-código, S3,
S11, F2-F5; sempre teste primeiro, correção mínima e um commit por item) e Fase 6 (verificação final).

**Cuidados**

- Há outras sessões do Claude editando `C:\Users\0177\perenidade` ao mesmo tempo. Trabalhe só no worktree.
- O build local leva de 15 a 30 minutos: rode em segundo plano.
- Mudanças no Supabase de produção ficam com você. As sessões só entregam o passo a passo.
- `docs/auditoria/` é material da auditoria: pode ser apagado antes de juntar a branch ao `master`.
