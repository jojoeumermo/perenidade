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

Banco: `supabase/migracoes/20261115-alumia-o9-resto8.sql`. Servidor: `lib/rede/voto/servidor.ts` e `app/api/alumia/voto/{chave,abrir,marca}`.
Aparelho: `lib/rede/voto/cedula.ts` e `lib/rede/voto/cliente.ts`. Teste: `scripts/testar-alumia-o9-resto8.mjs` (tenta casar pessoa e voto
em cada caso abaixo e não consegue).

Tudo sai de UM segredo do servidor, `ALUMIA_VOTO_SEGREDO` (32 letras ou mais, só no servidor do site), que nunca vai ao banco nem
ao navegador. Cada uso tem uma chave própria, derivada dele com um rótulo (HMAC-SHA-256 da biblioteca do Node).

### A consulta à base: a cédula cifrada no aparelho

- O aparelho pede a chave pública da consulta (`/api/alumia/voto/chave`) e cifra o ranking com a **Web Crypto** do navegador:
  ECDH P-256 com um par de chaves só desta cédula, HKDF-SHA-256 e AES-256-GCM (o desenho do ECIES; nada feito à mão). A consulta
  entra como dado autenticado: a cédula de uma consulta não abre em outra, e cédula adulterada não abre.
- A chave privada da consulta não existe em lugar nenhum guardado: o servidor a deriva do segredo quando precisa (HMAC do id da
  consulta como escalar da curva, pelo `crypto.createECDH` do Node).
- O banco recebe só o texto cifrado (`rede_consulta_cifradas`, sem id, sem hora), pela mesma urna de sempre (regravado com os
  outros, em ordem sorteada). Quem votou continua em `rede_consulta_votantes` (para ninguém votar duas vezes).
- Com a consulta **fechada**, a tela pede ao servidor para abrir (`/api/alumia/voto/abrir`). O banco só entrega as cédulas fechada;
  o servidor abre todas, embaralha e devolve só os rankings, num lote; o banco descarta o ranking que não vale (nula), põe o resto
  na urna (num INSERT só, misturado às cédulas que já estavam) e apaga as cifradas. Enquanto houver cédula fechada, o resultado não
  sai.
- Sem o segredo no servidor, a chave não sai ("sem_servico") e só então o aparelho vota pelo caminho da 8F (a urna do banco, sem
  cifra). Freio, falta de rede ou cifra que falhou viram erro na tela: o voto nunca cai em silêncio para o caminho sem cifra.
- As duas rotas pedem a sessão e freiam por conta (chave: 30 a cada 10 minutos, e a tela guarda a chave na memória da aba;
  abrir: 6 a cada 10 minutos, com um teto alto por consulta). Um robô sem conta não esgota o balde nem segura a apuração.

O que isso NÃO resolve: quem tiver o segredo do servidor E as cópias do banco abre as cédulas guardadas nelas; quem pode
ESCREVER no banco pode montar uma consulta só com a cédula de alguém e pedir a apuração (o resultado só sai com 3 cédulas, mas ele
pode copiar a mesma 3 vezes). O segredo não pode ficar onde fica a cópia do banco.

### A votação secreta da equipe: quem votou vira marca

- O voto secreto vai pelo servidor (`/api/alumia/voto/marca`, tipo `equipe`). O servidor confere a sessão e manda ao banco a pessoa
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
