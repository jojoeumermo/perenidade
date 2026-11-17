# Decisão e números da comunidade

A aba **Decisões** da comunidade: votações internas com quórum e prazo, e os números da semana para quem
modera.

- Banco: `supabase/migracoes/20261116-alumia-o10-decisao.sql`.
- Servidor: `app/api/alumia/decisao/{chave,abrir}` (usam `lib/rede/voto/servidor.ts`, o mesmo da consulta à base).
- Aparelho: `lib/rede/decisao/cliente.ts` (usa `lib/rede/voto/cedula.ts`) e `components/rede/comunidades/decisao/`.
- Textos: `i18n/rede/decisao/`.
- Teste: `scripts/testar-alumia-o10-decisao.mjs`.

## 1. A votação

- **Quem abre:** a moderação da comunidade. Pergunta, contexto, de 2 a 8 opções, quórum (3 ou mais pessoas), prazo (de 1 hora a
  60 dias) e o modo. Depois de aberta, nada muda; dá para cancelar (as cédulas, os nomes e quem votou somem, e o resultado nunca
  sai). Ninguém fecha antes do prazo. Até 5 votações abertas por comunidade.
- **Quem vota:** quem é da comunidade e já era quando a votação abriu (ninguém entra de última hora para virar o resultado). Um
  voto por pessoa, que não muda.
- **O resultado** só sai com o prazo vencido, com 3 votos ou mais, com o quórum atingido e com todas as cédulas cifradas já
  abertas. Antes disso, nem o número de quem votou. Opção com menos de 3 votos diz "menos de 3".

### Secreta (o padrão)

O mesmo esquema da consulta à base (`docs/rede/VOTO-SECRETO.md` §2 e §7), sem cripto nova:

- "quem votou" fica em `alumia_decisao_votantes`; "o que votou", em `alumia_decisao_cifradas` (cifrada) ou
  `alumia_decisao_cedulas` (aberta), sem id, sem hora, sem coluna em comum;
- a cédula sai cifrada do aparelho com a chave pública da votação (ECDH P-256 + HKDF-SHA-256 + AES-256-GCM da Web Crypto, pela
  `cifrarCedula` da onda 9). A chave é derivada de `ALUMIA_VOTO_SEGREDO` pelo id da votação, pela mesma função da consulta: os ids
  são sorteados, e o id entra na derivação, no HKDF e como dado autenticado, então a cédula de uma votação não abre em outra;
- cada voto regrava todas as cédulas da votação num comando só, em ordem sorteada (um xmin para todas), em fila por trava;
- fechada a votação, o servidor abre todas de uma vez, embaralha e devolve só as escolhas; o banco as põe na urna, regravadas com
  as outras, e apaga as cifradas;
- sem o segredo no servidor ("sem_servico"), a cédula vai pela urna do banco, sem cifra. Freio, rede ou cifra que falhou viram erro.

O que vale para a consulta vale aqui (VOTO-SECRETO.md §4 e §7): quem lê o banco antes e depois de um voto vê uma cédula nova, mas
cifrada; quem tiver o segredo do servidor e uma cópia do banco feita com a votação aberta pode abrir as cédulas daquela cópia.

### Aberta

O nome vai junto do voto (`alumia_decisao_abertos`). A tela mostra o carimbo "Voto aberto · nome junto" e o aviso antes de
votar, e pede a confirmação ("Votar com meu nome"). Os nomes aparecem só no fechamento, junto do resultado.

## 2. Os números para a moderação

`public.alumia_decisao_numeros`, só para quem modera a comunidade: por semana (segunda a domingo, horário de São Paulo), as
últimas 8, posts e respostas novos, pessoas que entraram (e continuam), denúncias recebidas e decididas, e a mediana do tempo até
a primeira decisão registrada (com 3 decisões ou mais). E agora: denúncias esperando decisão e votações abertas. Cada número só a
partir de 3. Nenhuma pessoa, nenhum "quem mais posta".

## 3. Para quem mexer depois

- Nunca pôr id, hora ou valor padrão na cédula, nem gravar a cédula fora de `interno.alumia_dec_urna` /
  `interno.alumia_dec_urna_cifrada` / `public.alumia_decisao_apurar`.
- Nenhum freio por conta nas funções de voto.
- `scripts/testar-alumia-o10-decisao.mjs` precisa passar.
- Depois de rodar em produção, com votação já usada: `vacuum (full) interno.alumia_decisao_cedulas;` e
  `vacuum (full) interno.alumia_decisao_cifradas;`, fora de transação.
