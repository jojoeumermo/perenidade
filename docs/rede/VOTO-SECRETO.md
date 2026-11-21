# Voto secreto no banco

O que o voto secreto da Alumia garante, contra quem, e o que ele não garante. Vale para a consulta à base das organizações (e
para as eleições internas, que são consultas ranqueadas) e para a votação secreta da equipe no painel.

- Banco: `supabase/migracoes/20261114-alumia-o8-voto.sql`.
- Teste: `scripts/testar-alumia-o8-voto.mjs` (ataca o banco e mostra que não casa) e as conferências de consulta de
  `scripts/testar-alumia-f4.mjs`.

## 1. O defeito que existia

"Quem votou" (para ninguém votar duas vezes) e "o que votou" (a cédula) já ficavam em tabelas separadas, sem coluna em comum.
Mas as duas linhas entravam **na mesma transação**:

- as duas tinham o mesmo `xmin` (o número da transação que grava a linha, que qualquer `select xmin` mostra);
- a cédula entrava no fim da tabela, na ordem de chegada (`ctid`, a posição no disco);
- na equipe, a "marca" de quem votou era `md5(sal, votação, pessoa)`, com o sal guardado no próprio banco: quem lê o banco
  calcula a marca de cada pessoa e acha quem é quem.

Quem tem acesso total ao banco (a chave de serviço, o dono do projeto, uma função com erro) casava cada cédula com a pessoa com
um `select`. O teste mostra isso com o código antigo antes de aplicar a migração.

## 2. Como ficou

**A cédula** tem só a consulta (ou a votação) e o voto. Não tem id, nem hora, nem sequência, nem valor padrão.

**A urna.** A cada voto, a função apaga as cédulas que já estavam na consulta (todas, enquanto houver até 2000; acima disso, 2000
sorteadas) e grava de novo essas e a nova **num comando só**, em ordem sorteada por `gen_random_uuid()` (aleatório forte do
próprio Postgres). Depois de cada voto:

- todas as cédulas regravadas têm o mesmo `xmin` e o mesmo `cmin`;
- a posição no disco é sorteio;
- o `xmin` da linha de quem acabou de votar é o mesmo de todas essas cédulas, e não aponta para nenhuma.

**A fila.** Dois votos na mesma consulta não acontecem ao mesmo tempo: a função espera numa trava (`pg_advisory_xact_lock`), que
não deixa marca em linha nenhuma.

**Quem votou na equipe** fica em `votacao_votantes` (votação e pessoa, às claras). A marca com sal saiu: ela só fingia anonimato,
porque o sal estava no banco. O que precisa ser secreto é o voto, e o voto está na urna.

**O resultado** só aparece com a consulta fechada, com 3 cédulas ou mais e com o quórum atingido. Antes disso não aparece nem o
número de quem votou. Na votação secreta da equipe, só depois do fim e com 3 votos ou mais.

**O que já existia** foi convertido sem perder voto: cada cédula e cada "votou" continuam lá. O id das cédulas e a tabela das
marcas saíram, e todas as cédulas foram regravadas de uma vez, em ordem sorteada.

## 3. Os ataques e o que acontece com cada um

| Quem tenta | Como | Resultado |
| --- | --- | --- |
| Quem lê as tabelas uma vez (chave de serviço, SQL Editor, `pg_dump`) | `xmin`, `cmin`, `ctid`, ordem de leitura, id, hora | **Não casa.** As cédulas de uma consulta dividem um `xmin` só e estão em ordem sorteada. O teste tenta cada caminho em 48 votos e só acerta no nível do acaso |
| O mesmo, na equipe | marca da presença | **Não há mais marca.** Quem votou está às claras; o que votou, não |
| Quem olha o resultado | contagem pequena | Com 1 ou 2 votos, ou sem quórum, o resultado não sai |
| Quem lê o banco **antes e depois de um voto** (duas leituras, uma cédula a mais) | compara as duas listas | **Casa.** Ver a seção 4 |
| Quem tem o disco, uma cópia física ou o WAL | versões antigas das linhas, registro de transações | **Pode casar.** Ver a seção 4 |
| Quem muda o código das funções | grava os votos de outro jeito daqui para a frente | **Pode**, para os votos seguintes. Os votos já dados continuam sem ligação |

## 4. O que não é garantido

- **Duas leituras em volta de um voto.** Quem lê a tabela, espera um voto entrar e lê de novo vê a cédula nova. Na urna só do
  banco, isso não tem conserto: a cédula precisa estar em algum lugar para ser contada. Com a cédula cifrada no aparelho (onda 9,
  §7), quem faz as duas leituras vê um texto cifrado que só abre no fechamento, em lote, misturado aos outros.
- **Versões antigas das linhas.** O Postgres não apaga a linha na hora: a versão velha fica no disco até a faxina (autovacuum).
  As tabelas das cédulas estão com a faxina no menor limiar (roda no ciclo seguinte), mas, até lá, quem tem acesso ao disco
  (superusuário com `pageinspect`, cópia física) vê as versões velhas. A faxina libera o espaço, mas não zera os bytes.
- **WAL e cópias com recuperação a um ponto no tempo.** O registro de transações guarda cada gravação na ordem. Quem tem esse
  registro reconstrói tudo.
- **Registros do servidor.** Se o servidor do banco ou da API gravar o corpo das chamadas, o voto aparece lá junto de quem chamou.
  Não devem gravar.
- **Quem votou** não é segredo: o banco precisa saber para ninguém votar duas vezes e para dizer "você já votou". As funções
  nunca devolvem essa lista.

## 5. Depois de rodar em produção

Rodar, fora de transação e um por vez, para as versões antigas das linhas saírem do disco:

```sql
vacuum (full) interno.rede_consulta_cedulas;
vacuum (full) interno.votacao_votos;
```

## 6. Para quem mexer depois

- Nunca pôr id, hora, sequência ou valor padrão na cédula, e nunca gravar a cédula fora de `interno.alumia_urna` /
  `interno.votacao_urna`.
- Nunca gravar "quem votou" e a cédula num jeito que dê para separar a cédula das outras: a cédula nova entra sempre no mesmo
  comando das regravadas.
- Nunca mostrar resultado com menos de 3 votos ou sem quórum.
- `scripts/testar-alumia-o8-voto.mjs` precisa passar. Ele monta o banco como era antes da migração e prova que o ataque
  funcionava; se ele parar de achar o defeito antigo, o teste perdeu o sentido.

## 7. A cédula cifrada e o voto pelo servidor

Banco: `supabase/migracoes/20261115-alumia-o9-resto8.sql` e `supabase/migracoes/20261124-r2-voto.sql`. Servidor: `lib/rede/voto/servidor.ts`
e `app/api/alumia/voto/marca`. Aparelho: `lib/rede/voto/limiar.ts`, `urna.ts`, `guarda.ts`, `cliente.ts` e a tela
`components/rede/voto/UrnaSecreta.tsx`. Testes: `scripts/testar-r2-voto.mjs` (o banco inteiro), `scripts/testar-r2-voto-cifra.mjs` (a
cifra) e `scripts/testar-alumia-o9-resto8.mjs` (as marcas).

O segredo do servidor, `ALUMIA_VOTO_SEGREDO` (32 letras ou mais, só no servidor do site), nunca vai ao banco nem ao navegador e
serve **só** às marcas de "já votou" e ao termômetro. Ele **não abre cédula nenhuma**.

### O voto secreto em limiar (consulta à base, eleições, votação da comunidade, votação secreta da equipe)

Antes (onda 9), a chave de cada consulta saía do segredo do servidor: quem tivesse o segredo e o banco abria as cédulas. Agora:

- **Guardiãs.** Cada pessoa da coordenação (da gestão da organização, da mediação da comunidade, da coordenação da equipe) pode
  criar no aparelho a sua **chave de voto** (X-Wing da libsodium: X25519 + ML-KEM-768, pós-quântica). A privada fica só no
  aparelho; o diretório recebe a pública, assinada pela identidade da conta.
- **A chave da votação.** Quem abre a votação escolhe N guardiãs (3 a 7) e quantas abrem juntas (K, de 2 a N). No aparelho dela:
  uma semente de 32 bytes sorteada, o par X-Wing tirado da semente, a semente dividida em N partes por Shamir K de N
  (`shamir-secret-sharing`, auditada), cada parte cifrada para a chave de voto de uma guardiã. O registro (chave pública, N, K,
  guardiãs, partes cifradas) vai assinado pela identidade de quem criou. A semente e as partes somem da memória. Sem chave das
  guardiãs, não se vota (não há caminho às claras).
- **Votar.** O aparelho confere o registro (assinaturas; as identidades de quem criou e de cada guardiã contra o registro público
  das chaves, pelo chat novo ligado neste aparelho; impressão da chave para comparar de viva voz). Sem o chat novo ligado, ou com uma
  identidade que o registro público não confirma, a cédula não sai: só a coerência interna do registro não segura um servidor ativo,
  que montaria um registro inteiro com chaves dele. Depois disso, o aparelho
  cifra o ranking completado a tamanho fixo para a chave pública da votação (X-Wing + XChaCha20-Poly1305 da libsodium, com a
  votação como dado autenticado) e manda a cédula `v2.` pela urna de sempre (sem id, sem hora, regravada em ordem sorteada; "quem
  votou" à parte). Cédula repetida é recusada (resumo único por votação).
- **Abrir.** Depois do prazo, cada guardiã decifra a parte dela e a cifra para a **abridora** que está no registro assinado (não a
  que o servidor disser na hora). Com K partes, a abridora refaz a semente, confere que ela dá a chave pública publicada (se não
  der, nada abre), decifra as cédulas, embaralha e manda só os rankings, num lote; o banco põe na urna e apaga cédulas e partes.
  Cédula que não abre é nula. A eleição de uma função espera a urna aberta para apurar.

**Aceite (provado em teste):** o servidor sozinho, com o banco inteiro e todos os segredos dele, não tem a semente, nenhuma parte
em claro nem chave privada: não abre cédula. K−1 partes não abrem; parte de outra votação não serve; chave pública trocada pelo
servidor é recusada pelo aparelho (assinatura); urna inchada e ranking a mais são recusados.

**Limites, sem rodeio:** a semente existe por um instante no aparelho de quem cria e no da abridora (não é geração distribuída de
chave; não há biblioteca auditada em JS para isso). K guardiãs juntas abrem as cédulas, mas as cédulas continuam sem ligação com
quem votou. Quem perde a chave de voto (dados do site apagados, "Sair rápido", senha de pânico) não ajuda a abrir: por isso N > K.
O X-Wing da libsodium entrou depois da auditoria de 2017 da biblioteca.

**A urna anônima (onda R3).** A cédula não entra mais com a sessão de quem vota. São dois momentos separados:

1. **Com a sessão, cedo** (ao abrir a votação): o aparelho pega UM passe cego da urna daquela votação (Privacy Pass, RFC 9578, RSA
   cego, com o contexto da votação: um passe de uma votação não vale em outra, nem como passe geral). A emissão é uma por conta por
   votação e marca a conta como "já pegou a cédula" (na consulta e na votação da comunidade, a linha de "já votou" de sempre; na
   equipe, só um contador da votação, sem a pessoa).
2. **Sem a sessão, depois**: a cédula cifrada vai por `POST /api/alumia/urna/depositar` com o passe no cabeçalho. A rota recusa
   pedido com cookie de sessão ou com outro `Authorization`, confere o passe só com a chave pública da urna e chama o banco com o
   serviço (`public.rede_urna_depositar_anonimo`). O passe é gasto ali (repetido: recusado) e a cédula entra no mesmo `INSERT` que
   regrava até 2000 cédulas de antes, em ordem sorteada. Quando o passe acabou de ser pego, o aparelho espera um tempo sorteado antes de
   depositar.

O que muda para quem tem o banco (ou vê a ordem das transações): a transação da cédula não tem nada de conta (o `xmin` da cédula
não aparece em linha nenhuma com uma pessoa), e a transação da emissão não tem cédula. As funções com sessão que recebiam a cédula
respondem `voto_anonimo`. Limites: o servidor do site emite os passes (tem a chave privada da urna) e pode criar passes para encher
a urna; a abridora confere que não há mais cédulas que contas que pegaram a cédula, mas esse número também vem do servidor. Quem vê
o tráfego de rede (o endereço de quem pega e de quem deposita) sem Tor ou mixnet ainda pode cruzar os horários; a espera sorteada
diminui, não elimina.

**Quem vota na consulta à base, hoje:** a consulta à base exigia ser de um núcleo da organização, e a filiação aos núcleos saiu do
banco na onda R2 (ela mora só nos aparelhos dos membros). Até a organização decidir a regra nova (membro declarado da
organização, ou credencial anônima entregue pelos núcleos), a consulta à base não recebe voto, e a tela diz isso. O caminho para
decidir agora é a **enquete dentro do grupo cifrado do núcleo** (`lib/rede/voto/enquete-do-grupo.ts`): a pergunta e cada voto vão
como mensagens do grupo MLS, cifradas na caixa anônima da época; o servidor não vê nada, mas ela **não é secreta entre os membros**
(cada voto vai com quem votou, e os membros veem). Os números só aparecem com 3 votos ou mais e nenhuma opção com 1 ou 2. Ela aparece
quando a tela do grupo do núcleo for ligada. A votação da comunidade e a votação secreta da equipe não dependem disso.

### A votação secreta da equipe: quem votou vira marca

- Até a onda R3, o voto secreto (a cédula cifrada para as guardiãs, acima) ia pelo servidor (`/api/alumia/voto/marca`, tipo `equipe`); agora vai pela urna anônima (acima). Como era: o servidor conferia a sessão e mandava ao banco a pessoa
  (só para conferir se ela vota naquela votação) e a marca dela: HMAC-SHA-256(segredo, votação + pessoa). O banco grava a marca em
  `votacao_marcas` e a cédula na urna; a pessoa não é gravada em linha nenhuma. `votar` direto no banco recusa voto secreto.
- "Você já votou": a tela pergunta ao servidor, que recalcula as marcas. Quem votou ANTES desta migração continua em
  `votacao_votantes` (o banco não tem o segredo para refazer a marca).

### Enquete de post e enquete de story: a pessoa sai da linha do voto

- `rede_votos` e `rede_story_votos` ficam sem a pessoa (a coluna fica vazia, a chave dela saiu). Para não votar duas vezes, a marca
  do servidor (`rede_voto_marcas`, `rede_story_voto_marcas`); o voto entra pela urna (regravado junto, em ordem sorteada).
- Os votos de antes: a linha perdeu a pessoa e quem votou ficou em `rede_voto_antigos` / `rede_story_voto_antigos`, só "votou", sem
  a opção.
- O que a pessoa escolheu não volta do banco: o aparelho lembra (com o prefixo das chaves da Alumia, que o "Sair rápido" apaga). Em
  outro aparelho, a tela sabe que ela votou (na enquete de post, pelos votos de antes; nos novos, ao tentar de novo), não em quê.
- Troca: a parcial da enquete (para quem votou, antes do prazo) aparece na hora do voto, e depois só no fim do prazo ou para quem
  fez a enquete: o banco não sabe mais quem votou.

### O termômetro da equipe

A marca deixa de usar o sal guardado no banco (`cuidado_sal`): vem do servidor, HMAC-SHA-256(segredo, semana + pessoa), em 32
letras. E a marca e o nível não ficam mais na mesma linha: `bem_estar_respostas` guarda só "esta marca respondeu nesta semana" e
`bem_estar_urna` só a semana e o nível, sem marca, regravados juntos em ordem sorteada a cada resposta (como a urna das enquetes).
Quem tem o banco e o segredo do servidor refaz a marca de alguém e sabe que ela respondeu, nunca o que respondeu. A migração passa o
que estava em `bem_estar` para as duas tabelas e esvazia a antiga. Uma resposta por semana: mudar exigiria ligar a marca ao nível.
As respostas da semana em que a migração rodar foram gravadas com a marca antiga: quem respondeu antes pode responder de novo
naquela semana (uma resposta a mais, uma vez só).

### O que ainda usa o sal do banco

A caixa de críticas anônimas (`critica_enviar`, `criticas_cotas`) ainda conta as três por dia com a marca do sal do banco. Isso ainda não
mudou.

### Nenhum freio por conta na mesma transação do voto

As funções de voto pelo servidor não gravam `interno.limite` (o freio do banco guarda o id da pessoa): uma linha de freio com a
pessoa, gravada na mesma transação do voto, teria o mesmo `xmin` da linha do voto e ligaria um ao outro. O freio é do servidor, na
memória.
