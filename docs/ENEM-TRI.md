# Laboratório da TRI do Enem (Etapa 6, B12)

Página: `/[lang]/enem/laboratorio-tri` (recurso `enem-curso`). A pessoa escolhe uma prova (2009 a 2023) e uma área,
marca o que acertou (ou cola as letras das respostas, corrigidas pelo gabarito oficial) e vê a **nota estimada** pelo
método do Inep, com os parâmetros **reais** dos itens. Não há item inventado.

## O método do Inep (o que foi conferido nas fontes)

- Modelo logístico de 3 parâmetros (Birnbaum, 1968): a (discriminação), b (dificuldade), c (acerto ao acaso).
- Proficiência pelo **EAP** (esperança a posteriori), priori normal, **40 pontos de quadratura**.
- Calculada na escala (0, 1) e levada à escala do Enem: `nota = 500 + 100·θ`. A referência é a dos concluintes
  regulares de 2009 (média 500, desvio-padrão 100). Os parâmetros dos microdados estão na escala (0, 1).
- Itens abandonados pelo Inep (`IN_ITEM_ABAN = 1`) ficam fora da conta; o laboratório faz o mesmo.
- Fontes: Inep, "Enem: procedimentos de análise"; nota técnica "Procedimento de cálculo das notas do Enem" (2011);
  "Entenda a sua nota no Enem" (2013); microdados do Enem (arquivo `ITENS_PROVA_AAAA.csv`).

## Dúvida declarada: a constante D

O texto público do Inep traz a fórmula numa figura e não diz, em texto, se usa D = 1,7 ou D = 1. O padrão é 1,7 (costume do
BILOG-MG e da literatura brasileira), e o laboratório deixa trocar em "Detalhes do cálculo", avisando que isso soma à
margem de erro. Sem acesso à calibração do Inep não dá para provar qual vale; se alguém tiver o valor, mude `D_PADRAO`
em `lib/enem-tri.ts`.

## Parâmetros reais: `public/tri/`

`scripts/enem/gerar-parametros-tri.mjs` gera `public/tri/enem-AAAA.json` (15 arquivos, ~16 KB cada) e `indice.json`.
O zip dos microdados tem 0,5 a 1,5 GB, então o script lê só a central de diretório e o CSV de itens por requisições HTTP
`Range` (`scripts/enem/zip-remoto.mjs`); nada de zip inteiro. Rodar: `node scripts/enem/gerar-parametros-tri.mjs [anos]`
(ou `--csv-dir pasta` com `itens-AAAA.csv` já baixados). Já foi rodado para 2009 a 2023.

Por item: `co` (CO_ITEM), `p` (CO_POSICAO), `g` (TX_GABARITO), `a`, `b`, `c`, `h` (habilidade), `aban` (fora da conta) e
`q` (id da questão correspondente em `public/questoes/enem-AAAA.json`).

Como o caderno é escolhido: para cada área, entre os cadernos regulares (azul, amarela, branca, rosa, cinza, sem versões
adaptadas), vale o que mais casa com a numeração do banco do site. Uma questão só é ligada a um item se a posição bate
**e** o gabarito da questão é igual ao do Inep; com menos de 20 ligações o caderno é o primeiro regular e nenhuma questão
é ligada (2010 linguagens, o banco do site só tem 13). Linguagens tem 40 itens comuns + 5 de cada idioma (o inglês não
está no banco do site, só o espanhol). Os 45 itens de cada caderno aparecem sempre, mesmo sem questão no site.

Há itens publicados com parâmetros extremos (por exemplo b = 17 com a = 0,1 em 2013, ou a ≈ 6 a 8 em alguns itens).
São os valores do Inep e ficam como estão; o teste só exige que sejam finitos e dentro de limites largos.

## Margem de erro (aviso honesto)

A página mostra o intervalo de 95% pela posteriori (±1,96 desvio-padrão, tipicamente 30 a 60 pontos). Ele vem só do
número de itens. Não inclui: a constante D, a recalibração dos itens pelo Inep, a cor do caderno feito (mesmos itens,
outra ordem) nem os itens que a pessoa não contou. O aviso fixo do topo diz que é estimativa e que não serve para
decidir inscrição ou curso.

## Arquivos

- `lib/enem-tri.ts`: `estimarEap`, `estimarMl`, `probabilidadeD`, `notaDeTheta`, `faixaPorAcertos`, `corrigirLetras`,
  `itensDaArea` (e as funções do laboratório antigo, mantidas: usadas por `testar:enem`).
- `components/enem/LaboratorioTri.tsx`, `app/[lang]/enem/laboratorio-tri/page.tsx`.
- Textos: `i18n/estudo/pt.json` (`enem.tri`). Em en, es, fr, ru e zh ficou só o título; o resto aparece em português
  com o aviso de "ainda não traduzido" (as traduções antigas descreviam o laboratório de itens inventados).
- Teste: `npm run testar:tri` (`scripts/testar-tri.mjs`, 457 conferências): contas feitas à mão, EAP contra integral por
  outro caminho, escala, quadratura, propriedades (coerência, monotonia), integridade dos 15 arquivos, 5 valores lidos do
  `ITENS_PROVA_2022.csv` e gabarito de cada questão ligada contra o do Inep.

## Privacidade

Tudo roda no aparelho. O único pedido de rede é o arquivo estático da prova (`/tri/enem-AAAA.json`), do próprio site.
As respostas coladas e marcadas não saem do navegador e não são guardadas.
