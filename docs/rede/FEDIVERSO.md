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
(AES-256-GCM, chave derivada por HKDF de `ALUMIA_FEDIVERSO_SEGREDO`, que só existe na Vercel) em `interno.rede_fed_atores`: quem
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

- **Responder, curtir ou impulsionar** posts de fora pela Alumia, e ver aqui as respostas, curtidas e impulsos que os posts daqui
  recebem lá fora (chegam e são ignorados). Menção `@nome@instancia` no texto não vira menção federada.
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
   no Bitwarden. Na Vercel (equipe lucia-b323, projeto perenidade) → Settings → Environment Variables → `ALUMIA_FEDIVERSO_SEGREDO`
   = esse valor (Production, marcado como Sensitive).
3. **Banco, configuração** (SQL Editor; troque o valor pelo mesmo segredo):
   ```sql
   insert into interno.configuracoes (chave, valor) values ('fediverso', jsonb_build_object(
     'segredo_hash', encode(sha256(convert_to('<o mesmo valor de ALUMIA_FEDIVERSO_SEGREDO>', 'UTF8')), 'hex'),
     'url_entrega', 'https://alumia.institutolucia.org/api/fediverso/entregar'))
   on conflict (chave) do update set valor = excluded.valor;
   ```
4. **Publicar de novo** na Vercel (o recurso `rede-v2` precisa estar em `NEXT_PUBLIC_RECURSOS`).
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
