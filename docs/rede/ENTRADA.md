# A entrada da Alumia

Triagem de quem cria conta, segundo fator obrigatório e login único entre o site, a Alumia e a Escola.
Este documento diz o que cada peça defende, o que não defende, e em que ordem ligar.

- Banco: `supabase/migracoes/20261110-alumia-entrada.sql` (triagem e trava) e `supabase/migracoes/20261112-alumia-portas.sql` (a porta em toda função da rede).
- Site: `components/rede/entrada/` (o Portão), `lib/sessao/ponte.ts`, `lib/sessao/cliente-ponte.ts`, `app/api/sessao/ponte/` (o login único).
- Teste: `npm run testar:alumia-entrada`.

## 1. O que a trava faz

Com a trava **desligada** (como nasce), nada muda para ninguém: as funções têm a porta, mas a porta não faz nada.

Com a trava **ligada**, só usa a Alumia quem tem, ao mesmo tempo:

1. conta **aprovada**: pela triagem, ou direto (coordenação, vice-coordenação e militante da Escola de Formação);
2. sessão com o **segundo fator** (o código do aplicativo autenticador, `aal2`).

Isso vale para **toda** função `public.rede_*` e `public.alumia_*` que visitante ou conta comum podem chamar. A regra é uma só
(`interno.alumia_trancar()`), não uma lista escrita à mão: ela lê as funções do banco e põe `interno.alumia_porta()` na primeira
linha de cada uma. Ficam de fora, de propósito, só as que a pessoa precisa **antes** de ser aprovada:

| Função | Por que fica aberta |
| --- | --- |
| `alumia_entrada_eu`, `alumia_entrada_pedir` | ver a própria situação e pedir a entrada |
| `rede_situacao`, `rede_eu`, `rede_aderir`, `rede_codinome_definir`, `rede_confirmar_idade`, `rede_fed_situacao` | codinome, idade e consentimento do pedido (`rede_aderir` só grava para quem tem ficha ou já é aprovada) |
| `alumia_triagem_contagem`, `alumia_triagem_fila`, `alumia_triagem_decidir` | têm a própria regra: papel de triagem e segundo fator |
| `rede_linha(p_aba…)`, `rede_novos(p_aba…)` | passam por `interno.rede_aba`: só a aba `geral` (as dúvidas das aulas, que o site aberto mostra) responde sem aprovação |
| `rede_alumia_versao`, `rede_antigo` | número da versão e redirecionamento de endereço antigo; não mostram ninguém |

Passam pela porta sem sessão de pessoa: a **chave de serviço** (federação, rotas do servidor) e o **próprio banco** (agendador e SQL
Editor, que não escolhem papel de API nem trazem token).

### Decisão que fica com a coordenação

Com a trava ligada, o **diretório de organizações com selo** (`rede_org_*`) e a **lista de comunidades** (`rede_com_lista`,
`rede_alumia_ativas`) também deixam de responder a visitante. É a leitura mais estreita de "sem conta aprovada ninguém vê a
Alumia". Se a coordenação quiser que continuem públicas, acrescente o nome da função em `interno.alumia_porta_aberta` (na migração
das portas e na cópia do `install.sql`) e na lista `ABERTAS` do teste. O teste falha se as duas listas não baterem.

### Função nova

Função criada depois nasce **sem** a porta. Três redes seguram isso:

- `interno.alumia_entrada_ligar(true)` roda a regra antes de ligar, e **se recusa a ligar** se alguma função não pôde ser trancada;
- o teste lê o `pg_proc`, liga a trava e chama cada função como conta não aprovada, como conta aprovada sem o segundo fator e como
  visitante: fora da lista de exceções, todas têm de responder `alumia_entrada`;
- depois de rodar sozinha uma migração **antiga** (ela recria as funções dela sem a porta), rode `select interno.alumia_trancar();`.
  A resposta traz `abertas`, que tem de ser uma lista vazia.

## 2. A ordem de ligar

1. **SQL da onda** no SQL Editor (as migrações, na ordem do fim do `install.sql`). Nada muda para quem usa.
2. **Publicar o site** novo (o Portão da Alumia, a tela do segundo fator, a fila da triagem no painel).
3. **Avisar os membros** (veja a seção 4): no dia em que a trava ligar, quem ainda não cadastrou o aplicativo autenticador vai ter
   de cadastrar para entrar.
4. **No mesmo minuto**: `select interno.alumia_entrada_ligar(true);` no SQL Editor **e** ligar o recurso `alumia-entrada` no painel.

Os dois do passo 4 andam juntos porque são chaves diferentes:

- recurso ligado e trava desligada: quem aderiu pelo caminho antigo depois de o SQL rodar aparece como "sem pedido" e vê o formulário;
- trava ligada e recurso desligado: todo mundo recebe o erro `alumia_entrada` sem ter tela para resolver.

A ponte de sessão da **Escola** no endereço próprio (`escola.`) não depende do recurso nem da trava: entra no ar junto com o site
novo (passo 2) e tenta o login único para todo visitante sem sessão.

## 3. Como desligar, e ligar de novo, sem aprovar quem furou a fila

- Desligar: `select interno.alumia_entrada_ligar(false);`. Tudo volta a abrir como antes.
- Ligar de novo: `select interno.alumia_entrada_ligar(true);`.

Na **primeira** vez que a trava liga, quem já era membro fica aprovado (`ja_membro`) e o instante fica gravado (`ligada_em`, em
`interno.configuracoes`). Esse instante **nunca mais muda**. Dali em diante:

- ligar com a trava já ligada não aprova ninguém (`aprovados_agora` = 0);
- desligar e ligar de novo só aprova quem consentiu **antes** de `ligada_em`. Quem aderiu depois, mesmo num intervalo com a trava
  desligada, continua "sem pedido" e passa pela triagem;
- com a trava ligada, chamar `rede_aderir` direto (sem ter pedido a entrada) é recusado.

Para aprovar alguém de propósito, use a fila da triagem no painel.

## 4. O segundo fator: o que ele garante e o que não garante

"Sem o código do aplicativo, senha roubada não abre nada" só vale para quem **já cadastrou** o autenticador.

No dia em que a trava liga, todo membro antigo está aprovado e ainda sem fator. Quem tiver a senha de uma dessas contas entra,
cadastra o **próprio** autenticador e passa a ter o segundo fator. O mesmo vale para toda conta recém-aprovada até o primeiro
cadastro. O que existe contra isso:

- **Aviso à conta**: quando um autenticador passa a valer, a pessoa recebe um aviso de conta e um e-mail ("se não foi você, troque
  a senha agora"). É um gatilho em `auth.mfa_factors`; se o banco não deixar criar o gatilho, a migração avisa e segue.
- **Pedir aos membros que cadastrem antes de a trava ligar** (passo 3 da ordem). Texto sugerido para o aviso: "A partir de <data>
  a Alumia só abre com o código do aplicativo autenticador. Cadastre o seu hoje, na sua conta. Depois dessa data,
  quem souber a sua senha e chegar antes de você pode cadastrar o autenticador dele."

O que **ainda não existe**: exigir prova de posse do e-mail (um código enviado ao endereço da conta) antes de aceitar o cadastro
do autenticador. Uma trava só na tela não seguraria quem chama o serviço de contas direto; a regra precisa ser conferida no
servidor, e depende de como o envio de código por e-mail está configurado no projeto do Supabase. Fica para a coordenação decidir.

## 5. A triagem

- Vê a fila e decide: coordenação, vice-coordenação e mediação, sempre com o segundo fator.
- A fila mostra codinome, motivo do pedido, quando pediu, quantas vezes e há quantos dias a conta existe. Nunca e-mail, nome civil,
  IP ou o número da conta.
- Ninguém decide o próprio pedido.
- **Decisão tomada só muda pela coordenação ou vice-coordenação.** A mediação decide o que está em análise, uma vez.
- **Não se tira por aqui a aprovação de quem tem papel na casa** (tira-se o papel antes, no painel).
- A contagem do menu não conta conta suspensa (como a fila).
- O motivo do pedido e o motivo da decisão somem 30 dias depois da decisão, numa faxina diária do banco
  (`interno.alumia_entrada_faxina`), sem depender de alguém abrir a fila.

## 6. O login único (a ponte de sessão)

Quem já entrou em `institutolucia.org` entra na Alumia e na Escola sem digitar a senha de novo.

1. A Alumia (ou a Escola) sem sessão abre, num quadro escondido, `/api/sessao/ponte` do site.
2. O quadro lê a sessão do site, **renova** o token se ele tem mais de 5 minutos, e pede à rota um código de entrada de uma vez.
3. O código volta por `postMessage`, só para a origem que pediu, e vira uma sessão **nova** naquele endereço. O segundo fator é
   pedido de novo lá.

### O que a rota aceita e recusa

| Confere | Recusa |
| --- | --- |
| destino exatamente `alumia.` ou `escola.` do domínio do instituto, com `https` | qualquer outro destino, sub-subdomínio, outra porta |
| token só no cabeçalho `Authorization` (nunca em endereço) | pedido sem token ou com token que o serviço de contas não reconhece |
| e-mail da conta confirmado | conta sem e-mail confirmado |
| conta com autenticador: só com a sessão em `aal2` | sessão sem o código, quando a conta tem autenticador |
| token emitido há no máximo **10 minutos** | token de acesso antigo (`sessao_antiga`) |
| no máximo **6 códigos por conta a cada 10 minutos**, contados no banco | o sétimo (`muitos_pedidos`) |

Cada código gerado vai ao registro de atividades (`ponte`): só a conta e o destino, nunca o token nem o código. Nada é guardado em
cache, não há cookie, e a resposta traz só o código.

### O que a ponte não defende (risco aceito)

- **`Origin` e `Sec-Fetch-Site` não são defesa contra quem já tem o token.** Fora do navegador, quem chama escolhe esses cabeçalhos.
  Eles só impedem que uma página de outro site use a sessão de quem a visita.
- **Quem roubou o token de acesso nos últimos 10 minutos** (de uma conta sem autenticador) ainda consegue trocá-lo por uma sessão
  duradoura. A janela de 10 minutos e a renovação no quadro existem para que um token antigo, tirado de um log ou de uma extensão,
  não sirva. Conta com autenticador não tem esse risco: a sessão nova nasce sem o segundo fator.
- **O prazo do código é o prazo de OTP do projeto no Supabase** (o padrão é 1 hora), não 5 minutos. Baixe em Authentication ›
  Providers › Email › "Email OTP Expiration" para o mínimo que o painel aceitar. O código vale uma vez só.

### Cabeçalhos do quadro

`/api/sessao/ponte` e `/api/sessao/ponte/script` ficam **fora** da regra geral de cabeçalhos (`next.config.ts`): não levam
`X-Frame-Options`, `Cross-Origin-Opener-Policy` nem `Cross-Origin-Resource-Policy`. Quem pode embutir é a política própria
(`frame-ancestors` só com `alumia.` e `escola.`). O teste confere os cabeçalhos finais das duas rotas.

`frame-ancestors` e `frame-src` saem de `NEXT_PUBLIC_SITE_URL` na hora de montar o site. Valor errado = ponte morta, ou origem
errada autorizada. Confira a variável antes de publicar.

### Prova que falta antes de publicar

O quadro da ponte ainda **não foi aberto num navegador de verdade**. Antes de publicar, com `alumia.localhost` e o banco local:

1. entrar no site (`localhost`), abrir `alumia.localhost` e ver a sessão chegar sem digitar a senha;
2. repetir no **Chrome**, no **Firefox** e no **Safari** (o Safari bloqueia armazenamento de terceiros em quadros: é o que mais
   pode falhar);
3. conferir no console que não há erro de `frame-ancestors` nem de `X-Frame-Options`.

Se falhar, o login único cai calado em "sem sessão" depois de 6 segundos e a pessoa digita a senha. Sem essa prova, trate o login
único como **não entregue**.

## 7. As silhuetas da entrada

Fotos do Wikimedia Commons, em domínio público ou com licença livre, viradas em silhueta. Lista em
`lib/rede/entrada/silhuetas.json`, créditos em `lib/rede/entrada/creditos.json`, roteiro `npm run alumia:silhuetas`.

- Pessoa viva só entra com a autorização dela anotada.
- As silhuetas de **Paulo Freire** (CC BY-SA 3.0) e **Marielle Franco** (CC BY-SA 2.0) são obras derivadas e saem sob a mesma
  licença da foto, não sob a AGPL do código. Os créditos na tela dizem isso.
- A de **Frantz Fanon** está desligada até a coordenação decidir: a foto é da sobrecapa de um livro dos EUA de 1967, de autor
  desconhecido. É domínio público pela regra dos EUA, mas no Brasil obra anônima fica protegida por 70 anos a contar da publicação
  (Lei 9.610, arts. 43 e 44). Para voltar: outra foto com base clara, ou a decisão anotada no `silhuetas.json`, e `"ligada": true`.
