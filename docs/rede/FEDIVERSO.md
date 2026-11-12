# Alumia no Fediverso (ActivityPub)

**Situação em 5/11/2026:** a federação está **implementada e testada no banco local**, mas **não está ligada**: falta o domínio
próprio (`docs/rede/ALUMIA-DOMINIO.md`), o segredo e a linha de configuração no banco (abaixo). Antes disto, a Alumia **não** era
conectada ao Fediverso (o item estava em "Para depois"). Ainda não foi provada contra um Mastodon de verdade: é o passo 6 abaixo.

## O que funciona

Compatível com o que o Mastodon (e Misskey, Pleroma, GoToSocial…) espera, no endereço da Alumia:

| Peça | Endereço | O que faz |
|---|---|---|
| WebFinger | `/.well-known/webfinger?resource=acct:nome@alumia.institutolucia.org` | acha a pessoa; só responde por quem **ligou** a federação |
| NodeInfo | `/.well-known/nodeinfo` → `/api/fediverso/nodeinfo` | NodeInfo 2.1: nome, software, inscrições fechadas, só números agregados |
| host-meta | `/.well-known/host-meta` | o modelo do WebFinger para programas antigos |
| Ator (pessoa) | `/api/fediverso/u/<nome>` (e `/@nome` com `Accept: application/activity+json`) | `Person` com codinome, @nome, bio pública e a **chave pública**; fora de diretórios e da busca de texto (`discoverable`/`indexable` falsos). Desligou: 410 |
| Caixa de saída | `/api/fediverso/u/<nome>/outbox` | os posts **públicos** escritos depois de ligar, 20 por página |
| Seguidores | `/api/fediverso/u/<nome>/seguidores` | só o total (a lista não é pública) |
| Post | `/api/fediverso/p/<id>` | `Note` com o texto escapado, hashtags, aviso de conteúdo (`summary` + `sensitive`); retirado: 410 |
| Caixa de entrada | `/api/fediverso/u/<nome>/inbox` e `/api/fediverso/inbox` (compartilhada) | aceita `Follow`, `Undo(Follow)`, `Accept`/`Reject`, `Create`/`Update`/`Delete` de `Note` de quem alguém daqui segue, `Delete`/`Update` do próprio ator; o resto: 202 e nada |
| Ator da instância | `/api/fediverso/ator` | `Application` que assina as buscas (instâncias em "modo seguro" pedem assinatura até para ler) |
| Entrega | `/api/fediverso/entregar` | entrega a fila assinada; chamada pela rotina do banco a cada minuto |
| Buscar | `/api/fediverso/buscar?conta=@nome@instancia` | (só membro, com a sessão) acha alguém de fora pelo WebFinger e mostra o perfil e os últimos posts públicos, **só texto** |
| Seguir | `/api/fediverso/seguir` | (só quem ligou) segue ou deixa de seguir alguém de fora |

**Tela:** `/comunidade/fediverso` (menu "Fediverso" da casca): ligar ou desligar, o endereço `@nome@alumia.institutolucia.org`,
buscar e seguir gente de fora, quem a pessoa segue e a linha "Do Fediverso" (posts públicos de quem ela segue lá, só texto,
guardados 30 dias). Quem tem papel de cuidado (`situacao.cuida`) vê também "Mediação: bloquear uma instância".

### Assinatura HTTP

`lib/rede/fediverso/assinatura.ts` (draft-cavage-http-signatures, RSA-SHA256, como o Mastodon):

- **Saída:** cada entrega é assinada com a chave do ator (`(request-target) host date digest content-type`, Digest SHA-256).
- **Entrada:** nada é gravado antes de conferir. A chave pública vem da **instância do ator** (buscada com a trava de SSRF, guardada
  1 dia; se não confere, busca de novo, porque a chave pode ter mudado), nunca do corpo do pedido. Exige `(request-target)`, `host`,
  `date` e, num POST, `digest` igual ao corpo; a data só vale de 12 horas atrás até 1 hora à frente; o `keyId` tem de ser do mesmo
  domínio do ator e ser a chave dele. A nota recebida tem de ser do mesmo domínio e do mesmo autor da atividade.

### O que sai, e o que nunca sai (LGPD)

Federação é **opcional e desligada por padrão**, ligada por cada pessoa no próprio perfil, com consentimento **específico e
destacado**, versão e data registradas (`interno.rede_fed_atores.consentimento_versao`, `ligado_em`), e **revogável a qualquer
momento**: Lei 13.709/2018, art. 7º, I (consentimento), art. 8º caput e § 5º (manifestação de vontade; revogação), art. 8º § 4º
(nada de autorização genérica: o texto lista o que sai), art. 11, I (dado sensível: opinião política e filiação sindical,
"de forma específica e destacada") e art. 33, VIII (transferência internacional com consentimento "específico e em destaque":
servidores do Fediverso estão no mundo todo). Textos conferidos em planalto.gov.br em 05/11/2026.

Só sai (`interno.rede_fed_federavel`, conferida de novo na hora de cada entrega e de cada leitura):

- posts que **qualquer pessoa já lê sem conta** (`interno.rede_ve(p, null)` e `rede2_publico(p) = 'internet'`). Pela regra da
  Rede v2, "Internet" só existe nas **comunidades das disciplinas**: o que se escreve nas comunidades de luta cai para "membros"
  e **não sai**;
- de quem ligou a federação, escritos **depois** de ligar; resposta só sai se o post respondido também pode sair;
- o codinome, o @nome e a bio (só se o codinome foi confirmado).

Nunca sai: nome civil, e-mail, posts para membros, seguidores, comunidade, núcleo ou equipe, comunidade fechada ou restrita, aviso
do instituto, compartilhamento (repost), quem a pessoa segue aqui, a lista de quem a segue de fora, imagem e áudio (o post leva o
texto e o link para a Alumia). A federação **se desliga sozinha** se a conta é suspensa, o perfil fica trancado ou invisível, o
@nome muda ou o consentimento da rede é revogado.

**Desligar** (ou ser desligado): cada post que saiu recebe `Delete` (Tombstone), quem seguia de fora recebe `Reject`, quem ela
seguia recebe `Undo`, e as listas são apagadas. O ator responde só com a chave até a fila esvaziar (as instâncias conferem a
assinatura dessas retiradas) e depois 410; a faxina apaga as chaves um dia depois. **Não há como obrigar** um servidor de fora a
apagar o que já recebeu: a tela diz isso antes de ligar.

**Apagar a conta** com a federação ligada (LGPD art. 18, VI) faz o mesmo que desligar, antes de o perfil sumir
(`interno.rede_fed_conta_apagada`, gatilho `before delete` em `interno.perfis`). Por isso `interno.rede_fed_atores` e
`interno.rede_fed_fila` não têm chave estrangeira para o perfil: as retiradas ainda saem assinadas depois que a conta sumiu, e a
faxina apaga a linha do ator, as chaves e a fila dessa pessoa assim que as entregas terminam (ou desistem, depois de 8 tentativas).
Sem nada na fila, a linha sai na hora.

**Entrada:** de fora só se guarda o endereço público do ator (chave, caixas, @nome, nome, resumo) e, **só de quem alguém daqui
segue**, o texto dos posts públicos (HTML vira texto puro: sem marcação, sem imagem, sem script, sem caracteres de direção), por
30 dias. Mensagem direta ou post "só para seguidores" de fora é ignorado.

### Chaves

Um par RSA de 2048 bits por ator, gerado no servidor do site na primeira vez. A **chave privada** é guardada **cifrada**
(AES-256-GCM, chave derivada por HKDF de `ALUMIA_FEDIVERSO_SEGREDO`, que só existe no servidor do site) em `interno.rede_fed_atores`: quem
lê o banco sozinho não assina nada. Nenhuma tabela da federação está em `public`; todas com RLS e sem permissão direta. O banco só
responde às ações do servidor (`public.rede_fed_servidor`) a quem traz o segredo (o banco guarda só o SHA-256 dele, em
`interno.configuracoes`, chave `fediverso`). Nenhuma chave de serviço do Supabase é usada.

### Limites

- Por endereço de rede (memória da instância do servidor, nada é guardado): 120 leituras por minuto por rota; 300 entregas por
  minuto na caixa de entrada; 30 buscas e 30 "seguir" por minuto; 6 chamadas por minuto à entrega.
- Por pessoa (no banco, `interno.limite`): 10 ligar/desligar por hora, 30 buscas e 20 "seguir" por hora; até 2.000 contas de fora
  seguidas.
- Corpo da caixa de entrada até 256 KB; documentos buscados até 512 KB; 8 a 10 s de tempo; 3 redirecionamentos (só GET).
- Pedidos para fora: só https, porta 443, todos os IPs públicos (a mesma trava de SSRF da prévia de link).
- Entrega: 8 tentativas com espera crescente (1 min, 2, 4… até 12 h); 4xx (menos 408 e 429) desiste na hora.
- A mediação bloqueia uma instância inteira (`rede_fed_bloquear`): nada entra dela, nada sai para ela, e o que havia dela some. A
  tela da mediação abre já com a lista das bloqueadas (`rede_fed_bloquear('', null)` só lê).
- `/api/fediverso/entregar` não pede segredo de propósito (a rotina do banco chama sem ele, para o segredo não morar no banco):
  quem a chama à toa só adianta a entrega do que já está na fila, montado e conferido na hora; com a fila vazia, custa uma
  consulta. O teto é de 6 chamadas por minuto por endereço de rede.

## O que não funciona (ainda)

No modo básico (sem `fediverso-total`), responder, curtir ou impulsionar posts de fora e ver aqui as respostas, curtidas e
impulsos de lá não existem (chegam e são ignorados). Com `fediverso-total` isso existe: veja "Gente de fora na tela" e
"Tela (F4)", mais abaixo. O que falta mesmo com o modo total:

- **Vídeo e áudio de fora** não tocam na Alumia (a rota-proxy só serve imagem): o cartão oferece "Abrir no original".
- **Menção `@nome@servidor`** no texto de um post daqui não vira menção federada nem link (pedido P6 em `PEDIDOS-ENTRE-FAIXAS.md`).
- **Gente de fora dentro das telas comuns** (linha do Início, cartão, conversa, avisos, busca): as peças existem, mas só aparecem
  quando os encaixes P1 a P5 forem atendidos. Até lá, gente de fora aparece em `/alumia/fediverso?conta=…` e `?nota=…`.
- **Post de perfil não federa** (só os de comunidade aberta de disciplina e as respostas a notas de fora): decisão pendente, P9.
- **Imagem, áudio e enquete** não saem (a enquete sai como texto; a mídia fica só na Alumia, com o link no fim do post longo).
- Mensagens diretas: não existem na Alumia (decisão de segurança) e não entram de fora.
- **Mover a conta** (`Move`/`alsoKnownAs`), importar e exportar seguidores, perfil de comunidade como `Group`.
- **Pedido de seguir com aprovação** (perfil trancado não federa; quem ligou aceita seguidores de fora automaticamente).
- Assinatura RFC 9421 (só a draft-cavage, que todo o Fediverso aceita hoje) e chaves Ed25519.
- Lista de bloqueio importada (ex.: listas comunitárias de instâncias abusivas): a mediação bloqueia uma por uma.
- A entrega roda no servidor do site, chamada pelo banco a cada minuto (`pg_cron` + `pg_net`); sem essas extensões, só sai
  quando alguém segue ou é seguido (a rota entrega na hora) ou quando alguém chama `/api/fediverso/entregar`.

## Como ligar (Jonathan)

Depois do endereço próprio no ar (`docs/rede/ALUMIA-DOMINIO.md`, passos 1 a 6):

1. **Banco:** rodar `supabase/migracoes/2026-11-alumia.sql` no SQL Editor (ou o `install.sql` inteiro; é idempotente). Conferir
   em Database → Extensions que `pg_cron` e `pg_net` estão ligadas (a migração agenda `lucia-fediverso-entregar` e
   `lucia-fediverso-limpar` só se estiverem; ligou depois, rode a migração de novo).
2. **Segredo:** gerar um valor aleatório de 64 caracteres (por exemplo `openssl rand -hex 32`, ou um gerador de senha) e guardar
   no Bitwarden. O site roda numa VPS (`docs/HOSPEDAGEM.md`): rodar `infra/contabo/segredos.ps1`, que pergunta
   `ALUMIA_FEDIVERSO_SEGREDO` e grava em `/opt/lucia/site.env` sem mostrar na tela (o site reinicia com a chave em até 2 minutos).
3. **Banco, configuração** (SQL Editor; troque o valor pelo mesmo segredo):
   ```sql
   insert into interno.configuracoes (chave, valor) values ('fediverso', jsonb_build_object(
     'segredo_hash', encode(sha256(convert_to('<o mesmo valor de ALUMIA_FEDIVERSO_SEGREDO>', 'UTF8')), 'hex'),
     'url_entrega', 'https://alumia.institutolucia.org/api/fediverso/entregar'))
   on conflict (chave) do update set valor = excluded.valor;
   ```
4. **Publicar de novo** (push no master; a rotina "Publicar no servidor" monta a imagem e a VPS a busca). O recurso `rede-v2`
   precisa estar em `NEXT_PUBLIC_RECURSOS`, que é variável de montagem (GitHub → Settings → Secrets and variables → Actions → Variables).
5. **Cloudflare:** o "Bot Fight Mode" e o "Labirinto para IA" podem barrar os servidores do Fediverso (eles não são navegador).
   Depois do passo 6, se o Mastodon não achar a conta ou as entregas voltarem 403 com página de desafio, crie em Security → WAF →
   Custom rules uma regra "Skip" para `(http.host eq "alumia.institutolucia.org" and (starts_with(http.request.uri.path, "/api/fediverso/") or starts_with(http.request.uri.path, "/.well-known/")))`.
   No plano grátis o Bot Fight Mode não aceita exceção: nesse caso, desligue-o ou deixe o registro `alumia` com a nuvem cinza
   (só DNS: a Alumia passa a não ter o cache do Cloudflare).
6. **Provar com um Mastodon de verdade** (uma conta pessoal qualquer): ligar a federação no próprio perfil da Alumia; no Mastodon,
   buscar `@seunome@alumia.institutolucia.org` e seguir; publicar na Alumia um post "Internet" numa comunidade de disciplina e ver
   chegar lá; na Alumia, buscar a conta do Mastodon e seguir; publicar lá e ver chegar em "Do Fediverso"; desligar e ver o post
   sumir lá. Ferramentas úteis: `https://webfinger.net`, `https://verify.funfedi.dev`.

**Para desligar tudo:** apagar `ALUMIA_FEDIVERSO_SEGREDO` e publicar de novo (toda rota da federação passa a responder 404), ou
apagar a linha `fediverso` de `interno.configuracoes` (o banco para de responder ao servidor).

## Arquivos

- `supabase/migracoes/2026-11-alumia.sql` (também no fim do `install.sql`): tabelas `interno.rede_fed_*`, regras, gatilhos, funções.
- `lib/rede/fediverso/`: `assinatura.ts`, `cifra.ts`, `documentos.ts`, `enderecos.ts`, `texto.ts`, `http.ts` (pedidos com trava de
  SSRF), `servidor.ts`, `caixa.ts` (caixa de entrada), `entrega.ts` (fila), `rotas.ts`.
- `app/.well-known/{webfinger,nodeinfo,host-meta}/route.ts`, `app/api/fediverso/**/route.ts`.
- `components/rede/alumia/Fediverso.tsx`, `lib/rede/cliente-alumia.ts`, `i18n/rede/alumia/*.json`.
- Teste: `npm run testar:fediverso` (WebFinger, ator, assinatura, cifra, opt-in, nada privado sai, caixa de entrada, fila,
  desligar, Salvos, roteamento por host, o nome nos seis idiomas e o bloco do `install.sql`).

## Gente de fora na tela (modo `fediverso-total`)

O que as rotas da tela devolvem (sempre com o token da sessão; `Cache-Control: private, no-store`):

- **Um formato só de post de fora: o cartão** de `interno.rede_fed_cartao` (as chaves de um post daqui, mais `origem: "fediverso"`,
  `html`, `visibilidade`, `sensivel`, `ator_remoto`, `handle_remoto`, `nome_remoto`, `avatar`, `servidor`, `url`, `curti`,
  `impulsionei`, `post_local`, `impulsionado_por`). A nota que o banco não guarda é lida na origem e sai no mesmo formato, com os
  campos que não se sabe neutros e `ao_vivo: true` (curtir, impulsionar, responder e denunciar precisam da nota no banco).
- `GET /api/fediverso/remoto?linha=1[&cursor=…&limite=…]` → `{ itens: [cartão], proximo }`. O `cursor` é o `proximo` da página
  anterior, como o banco o escreve: `<data e hora>|<chave>`, com espaço na data (`2026-11-10 12:34:56.789+00|https://…`).
- `GET /api/fediverso/remoto?respostas=<id do post daqui>[&cursor=…]` → `{ itens: [cartão], proximo, total }`: as respostas de
  fora a um post daqui (`rede_fed_respostas_de`, como a pessoa). Só lê o banco: não gasta o teto de `remoto` nem toca a rede.
- `GET /api/fediverso/remoto?post=<url>[&buscar=1]` → `{ post, acima, respostas }`. Com a nota no banco, tudo vem de
  `rede_fed_fio_remoto` (inclusive as respostas). Sem ela, a rota responde 404 `{ erro: "so_na_origem", servidor }` e **não busca
  nada lá fora**; só com `buscar=1` (o toque da pessoa em "Buscar este post em <servidor>") `post` e `acima` são lidos na origem,
  e `respostas` vem vazia. Um post daqui no meio do fio sai como `{ local: <id>, post?: <cartão daqui> }`.
- `GET /api/fediverso/remoto?conta=@x@y` (ou `?ator=<url>`) → `{ ator, handle, nome, resumo, url, avatar, tipo, servidor, posts,
  local }`. `posts` é uma lista só (os do banco e os lidos agora; o do banco ganha); `local` é o que o banco sabe da relação
  (`seguindo`, `segue_voce`, `bloqueado`, `silenciado`). O que é lido lá fora (o documento do ator, a caixa de saída, o WebFinger)
  fica 5 minutos na memória do servidor. Se `rede_fed_perfil_remoto` recusa (a pessoa de fora bloqueou quem pede), a rota recusa
  junto: 404, sem posts e sem "seguir". Conta daqui: `{ local: true, handle }`.
- Todo erro sai como `{ erro: <código> }`, e só código da casa (`nao_encontrado`, `invalido:pedido`…): a mensagem crua do banco
  vira `falha` (`codigoParaATela`).
- `POST /api/fediverso/interagir` → `{ ok, tipo, sim, curti, impulsionei }` (o estado de verdade depois da ação).
- `POST /api/fediverso/denunciar` → `{ ok, protocolo, encaminhada, ja }` (`encaminhada` é o que o banco fez, não o que a tela
  pediu; `ja` = a pessoa já tinha denunciado aquilo).

Privacidade na tela: **nenhum endereço de imagem de fora chega ao navegador**. `assinarCartao` (`lib/rede/fediverso/servidor.ts`)
é a única função que troca `avatar`, `midia[]`, `impulsionado_por`, `autor`, `citado` e `posts[]` pela rota-proxy assinada
(`/api/fediverso/midia?…`); o que não é `https://` some, `midia[]` é refeita só com as chaves conhecidas (`url`, `tipo`, `alt`,
`largura`, `altura`, `blurhash`) e um avatar só passa se for `https://` (vira proxy) ou já for a rota-proxy. Por isso `rede_fed_linha_mista`, `rede_fed_perfil_remoto`,
`rede_fed_fio_remoto` e `rede_fed_respostas_de` nunca são chamadas direto pelo navegador: só pelas rotas. Na tela, `midiaSegura`
recusa qualquer endereço que não seja o da rota-proxy, e o HTML de fora vira elementos por lista permitida (`htmlParaArvore` +
`HtmlDeFora`), nunca HTML cru. Na mesma conversão: o `href` é lido atributo por atributo (um `href=` dentro de outro atributo
não conta), os caracteres de direção de texto somem, e o link cujo texto mostra um endereço diferente do destino ganha o
servidor de verdade escrito ao lado, entre parênteses (`destinoQueEngana`). "Abrir no original" e "Abrir em {servidor}" só levam
ao servidor do `id` da nota ou do ator, sem usuário e senha no endereço (`linkDaOrigem`).

### Privacidade no banco (migração `20261110-fediverso-privacidade.sql`)

As três regras da casa valem também no que o banco devolve: nenhuma lista de pessoas, contagem só a partir de 3, nada de IP.
A migração roda **depois** de `20261109-fediverso-total.sql` e de `20261110-fediverso-bloqueio-padrao.sql`, pode rodar mais de
uma vez e não mexe na função de bloquear instância (a trava do bloqueio fixo continua a mesma).

- **Avisos de curtida e de impulso não dizem quem foi** na tela de avisos: `rede_aviso_listar` devolve `ator_remoto` nulo e
  `atores_remotos` vazio nesses dois tipos. O total só sai a partir de 3; abaixo disso sai 1, que a tela escreve como "alguém".
  Seguidor, resposta e menção continuam dizendo quem foi (é a conversa com a própria pessoa). O endereço cru do avatar não sai em
  tipo nenhum. **Ainda não vale em três lugares da Faixa 1**, pedidos em `docs/rede/PEDIDOS-ENTRE-FAIXAS.md`: o "baixar meus
  dados" (`conta_meus_dados`) leva o endereço de quem curtiu (P18), e as RPCs antigas `rede_avisos` e `avisos_meus` e o resumo
  semanal dão o número exato abaixo de 3 (P19).
- **Bloquear alguém de fora não apaga o aviso de curtida nem o de impulso** (`rede_fed_bloquear_pessoa`, e o Block recebido de
  lá): sumir o aviso revelaria, bloqueando um candidato por vez, quem curtiu. Somem só os avisos que já dizem quem foi
  (seguidor, resposta, menção).
- **A prova do consentimento** (`interno.fediverso_consentimentos`, coluna `usuario`: entra sozinha no "baixar meus dados") ganha
  na migração a linha do "liga" de quem já estava com a federação ligada, com a data em que ligou. LIGAR tem teto de 6 por hora,
  com chave própria (`rede_fed_ligar_sim`, longe da "descoberta"); DESLIGAR não tem teto: é a retirada do consentimento e passa
  sempre.
- **O endereço da conta** (`rede_fed_situacao.endereco`) só sai para quem ligou a federação, e sem o ponto final do domínio. O
  `url_entrega` precisa ter o mesmo host do site: a porta não entra no endereço da conta.
- **Quem foi bloqueado lá fora não lê o post de quem o bloqueou** nem pelo "buscar este post em <servidor>": a rota
  (`app/api/fediverso/remoto`, `bloqueouQuemPede`) pergunta a `public.rede_fed_me_bloqueou(p_ator)` antes de mostrar o que leu
  na origem. A função lê direto o bloqueio recebido (vale mesmo depois de a faxina tirar o ator de `rede_fed_remotos`), não monta
  cartão e tem limite próprio (600 por hora). Na dúvida, não mostra; limite estourado sai como 429, não como "não encontrado".
- **Piso de 3** nas contagens de pessoas: seguidores e "seguindo" do ator, seguidores da comunidade (Group), pessoas e ativos do
  NodeInfo, respostas no cartão e o total das respostas de fora. Abaixo de 3 sai 0 (as coleções do ActivityPub pedem
  `totalItems` inteiro, maior ou igual a zero). As rotas repetem a conta (`pisoDePessoas`, em `lib/rede/fediverso/rotas.ts`),
  para o site não soltar número pequeno mesmo com o banco numa versão anterior. O número de posts não conta pessoas e sai como é.
  Os números da própria pessoa em `rede_fed_situacao` (quantos a seguem, quantos ela segue) não têm piso: só ela os vê.
- **Quem modera uma comunidade não sai para fora.** A coleção `moderators` do Group existe (o Lemmy a procura) e vem vazia;
  `attributedTo` aponta para essa mesma coleção, nunca para pessoas.
- **O nome do ator** só sai quando o codinome passou pela conferência (`rede_codinome_ok`), como a bio; senão sai o @nome.
- **A relação no cartão.** Cada cartão de fora traz `silenciado`, `bloqueado` e `bloqueou_voce`, sempre do ponto de vista de
  quem lê (ninguém recebe a relação dos outros). O perfil de fora devolve `bloqueou_voce`: quem foi bloqueado lá fora vê só o
  cabeçalho, sem posts e sem "seguir", e o pedido de seguir é recusado no banco.
- **Impulso de nota de quem ninguém segue.** Quando quem impulsiona é seguido por alguém daqui, a nota impulsionada fica guardada
  (antes era recusada e o impulso sumia na faxina). Só nota pública ou não listada; a guarda é a de sempre (30 dias).
- **Prova do consentimento.** `interno.fediverso_consentimentos` guarda cada vez que a federação de alguém liga, desliga ou muda
  de versão: perfil, versão do texto, ligado ou não, e quando. Nada de IP nem de navegador. Um gatilho em
  `interno.rede_fed_atores` grava, então vale para todos os caminhos (perfil, consentimento de entrada, suspensão). Ligar ou
  desligar no perfil passa a marcar ou desmarcar também o item do consentimento de entrada (`rede_consentimentos.fediverso`).
  LGPD art. 8º, § 2º (cabe a quem trata provar o consentimento) e § 5º (revogar a qualquer momento). A linha some com a conta.
- **Endereço completo.** `rede_fed_situacao` devolve `endereco` ("@nome@dominio") e `dominio`: o domínio curto no modo total,
  o da Alumia sem ele (a mesma regra de `enderecos.ts`; sai de `url_entrega` na configuração).
- **Perfil de fora em páginas.** `rede_fed_perfil_remoto(ator, cursor, limite)` devolve `proximo`; a tela tem "Mais posts".
- **Adesão e flag.** Perfil, fio, bloquear e silenciar gente de fora só respondem a quem aderiu à rede e com o modo total ligado.

Teste: `npm run testar:fediverso-banco` (seção "Privacidade").

### Limites conhecidos de privacidade

- **A rota-proxy de mídia esconde quem lê, não quando.** A imagem só é buscada na origem quando o primeiro leitor a pede (depois
  fica 1 dia no cache da borda). Uma nota mandada a uma pessoa só, com um endereço de imagem único, deixa o servidor de fora saber
  a hora em que ela abriu. `loading="lazy"` nas imagens é só economia de dados, não proteção. O conserto é buscar e guardar a
  mídia quando a nota chega (pede SQL e depósito: P12 em `PEDIDOS-ENTRE-FAIXAS.md`).
- **Perfil de conta que a Alumia nunca viu.** `?conta=` e `?ator=` leem o perfil na origem na primeira visita (depois, 5 minutos
  de memória). Um link armado para um servidor do atacante ainda revela a hora do primeiro clique (nunca o IP nem quem foi). O
  fio (`?nota=`) não tem esse limite: sem a nota no banco, nada é buscado até a pessoa tocar em "buscar".
- **Quem bloqueou a pessoa lá fora fica visível para ela** (`bloqueou_voce`), e só para ela: o Block chegou endereçado a ela, e
  sem isso a tela mostraria "seguir" num perfil que vai recusar.
- **Sotaques por software** (Lemmy, Misskey, Pleroma) ainda não são tratados à parte: o que sai segue o formato do Mastodon.

Arquivos: `lib/rede/fediverso/tela/{tipos,cliente,exemplos,textos,html,linha}.ts`, `components/rede/fediverso/`, `i18n/rede/fediverso/*.json`.
Teste: `npm run testar:fediverso-tela` (bateria de XSS, `href` escondido em outro atributo, caracteres de direção, link que
engana, "abrir no original", mídia só pelo proxy, o que `assinarCartao` deixa passar, código de erro, memória curta, endereços,
exemplos da prévia, a linha mista, paridade dos seis idiomas); os formatos das rotas estão em `npm run testar:fediverso-entrada`.

## Tela (F4)

Gente de fora aparece no MESMO visual da Alumia nova, sem aba à parte. O que existe:

| Peça | Onde mora | O que faz |
|---|---|---|
| `CartaoRemoto` | `components/rede/fediverso/CartaoRemoto.tsx` | O cartão de um post de fora (selo do servidor, curtir, impulsionar, responder, abrir no original, denunciar, bloquear, silenciar). |
| `PerfilRemoto`, `FioRemoto` | `components/rede/fediverso/` | O perfil e o fio de fora, em `/alumia/fediverso?conta=@nome@servidor` e `?nota=<endereço da nota>`. |
| `HtmlDeFora`, `MidiaDeFora`, `SeloDoServidor`, `ResponderDeFora`, `DenunciarDeFora` | `components/rede/fediverso/` | As partes do cartão. |
| `misturarDeFora`, `maisDeFora` | `lib/rede/fediverso/tela/linha.ts` | A linha mista: junta por data os posts daqui e os cartões de fora; guarda o cursor de fora e só pede página quando precisa. |
| `BuscaDeFora` | `components/rede/fediverso/BuscaDeFora.tsx` | Na busca, a conta de fora quando o texto é `@nome@servidor`. |
| `RespostasDeFora` | `components/rede/fediverso/RespostasDeFora.tsx` | Na conversa de um post daqui, as respostas que vieram de outros servidores. |
| `AvisoDeFora` | `components/rede/fediverso/AvisoDeFora.tsx` | A linha de aviso dos tipos `fed_seguidor`, `fed_resposta`, `fed_mencao`, `fed_curtida`, `fed_impulso`. |
| `encaixe.tsx` | `components/rede/fediverso/encaixe.tsx` | A porta para as telas comuns: `fediversoNaTela`, `eDeForaNaTela`, `CartaoDeForaNaLinha`, `RespostasDeForaNaConversa`, `BuscaDeForaNaBusca`, `eAvisoDeFora`, `destinoDoAvisoDeFora`, `AvisoDeForaNaLista`. |

As telas comuns (linha, cartão, conversa, avisos, busca) são de outra frente: o que falta ligar nelas está em
`docs/rede/PEDIDOS-ENTRE-FAIXAS.md` (P0 a P10). Enquanto um pedido não é atendido, a peça fica sem uso e nada muda na tela.

Regras (valem para qualquer peça nova):

- **Flag.** Tudo só aparece dentro da casca nova (`rede-v2` + `alumia-2`), com `fediverso-total` ligado ou na prévia. Fora disso
  as peças devolvem nulo, não baixam o código delas (`next/dynamic`, `ssr: false`) e não pedem nada. Na prévia
  (`NEXT_PUBLIC_ALUMIA_PREVIA=sim`) valem os dados de `lib/rede/fediverso/tela/exemplos.ts`, sem rota e sem banco.
- **Mídia só pela rota-proxy.** Imagem, vídeo e áudio de fora só com o endereço que a rota daqui devolve
  (`/api/fediverso/midia?…`, conferido por `midiaSegura`). O navegador de quem lê nunca busca nada em outro servidor.
- **Rosto em mosaico.** O avatar de gente de fora é o `Avatar16` pelo @ (`@nome@servidor`), nunca a foto remota, mesmo quando
  a rota devolve `avatar`.
- **HTML por lista permitida.** O `html` do cartão só entra por `HtmlDeFora` (`htmlParaArvore`): nunca `dangerouslySetInnerHTML`.
- **Sem lista de pessoas.** Não se mostra quem curtiu nem quem impulsionou. Nos avisos `fed_curtida` e `fed_impulso` a frase é
  "Alguém do Fediverso curtiu/impulsionou o seu post", sem nome, @, servidor nem rosto. Número só a partir de 3 (`contagemVisivel`).
- O Threads não entra e o Bridgy Fed fica desligado, os dois como bloqueio fixo e sem interruptor (o do Threads, que existia
  desde 10/11, foi retirado em 12/11/2026 pela migração da privacidade): nenhuma peça da tela nem função do banco os habilita.

A linha mista, em resumo: `maisDeFora(estado, { ate, logado })` recebe o `criado_em` do post mais antigo da página daqui
(`limiteDaPagina`), pede páginas de fora só enquanto a espera não alcança esse limite (no máximo 3 por chamada), solta o que é
mais novo que ele e guarda o resto para a página seguinte. Com a linha daqui no fim (`ate` nulo), solta uma página de fora por
vez. Não pede nada com a flag desligada, sem sessão ou na prévia (na prévia devolve uma vez o post de exemplo), e nunca lança
(em erro devolve `erro` e o estado de antes).
`misturarDeFora(locais, deFora)` ordena por `criado_em` decrescente, estável (os daqui antes no empate), e mostra uma vez só a
nota que veio como original e como impulso (fica a ocorrência mais recente). Os casos de borda estão em `npm run testar:fediverso-tela`.

Uma regra só para "aparece ou não" (`deForaVale` em `lib/rede/fediverso/tela/linha.ts`): dentro da casca nova, com
`fediverso-total` ligado ou na prévia. `CartaoRemoto`, `PerfilRemoto`, `FioRemoto`, `BuscaDeFora`, `RespostasDeFora`, a tela
`/alumia/fediverso` e `fediversoNaTela()` usam a mesma função. Na prévia nenhuma delas chama rota nem banco: `maisDeFora` devolve
uma vez o post do Tião, `deFora.respostasDe` a resposta do Entregador do Porto, e o resto vem de `exemplos.ts`.

Os textos de todas as peças vêm de `i18n/rede/fediverso/*.json` (pt é o final; os outros cinco são rascunho marcado). Além das
seções do começo (`cartao`, `perfil`, `fio`, `denuncia`, `ajuste`, `erros`, `busca`), há `avisos` (as frases dos cinco tipos de
aviso; curtida e impulso nunca levam `{nome}`) e `comum` (`carregando`, `tentarDeNovo`). O teste confere que não sobrou texto
fixo em português nas peças.

Pendências desta etapa:

- **Nada foi visto no navegador.** As peças passaram por `tsc`, `eslint` e pelos testes de regra; falta conferir em 375 px, no
  tema escuro e no teclado, contra as pranchas.
- **Encaixes da Faixa 1** (P0 a P10) e os registros P12 (mídia guardada na chegada, aberto) e P13 (mensagem crua do banco). O
  P11 (avisos sem quem curtiu) ficou resolvido do nosso lado em `20261110-fediverso-privacidade.sql`.
- **Vídeo e áudio de fora** não tocam aqui (só "Abrir no original").
- **Silenciar e bloquear fora do perfil: resolvido.** O cartão do banco traz `silenciado` e `bloqueado` (migração da
  privacidade) e o cartão na linha e no fio começa por eles. No perfil de fora o cartão recebe a relação e avisa o cabeçalho
  quando ela muda. Na prática quem está bloqueado nem chega à linha; o campo serve ao perfil e aos posts lidos na hora.
- **Bloqueio recebido: resolvido.** `rede_fed_perfil_remoto` devolve `bloqueou_voce`; a tela mostra o cabeçalho com "Esta conta
  bloqueou você", sem posts e sem "seguir". O fio de quem bloqueou continua respondendo "Não achamos isto".
