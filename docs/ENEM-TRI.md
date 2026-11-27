# Laboratório da TRI do Enem (Etapa 6, B12)

Página: `/[lang]/enem/laboratorio-tri` (recurso `enem-curso`). A pessoa escolhe uma prova (2009 a 2025) e uma área,
marca o que acertou (ou cola as letras das respostas, corrigidas pelo gabarito oficial) e vê a **nota estimada** pelo
método do Inep, com os parâmetros **reais** dos itens. Não há item inventado.

## O método do Inep (o que foi conferido nas fontes)

- Modelo logístico de 3 parâmetros (Birnbaum, 1968): a (discriminação), b (dificuldade), c (acerto ao acaso).
- Proficiência pelo **EAP** (esperança a posteriori), priori normal, **40 pontos de quadratura**.
- Calculada na escala (0, 1) e levada à escala EFETIVA da área: `nota = slope·θ + intercept`, com constantes por
  área (ESCALA_POR_AREA em `lib/enem-tri.ts`). A régua nominal divulgada pelo Inep é `500 + 100·θ` (referência dos
  concluintes regulares de 2009), mas a régua publicada das notas oficiais tem inclinação própria por área (108 a 130).
  Os parâmetros dos microdados estão na escala (0, 1).
- Itens abandonados pelo Inep (`IN_ITEM_ABAN = 1`) ficam fora da conta; o laboratório faz o mesmo.
- Fontes: Inep, "Enem: procedimentos de análise"; nota técnica "Procedimento de cálculo das notas do Enem" (2011);
  "Entenda a sua nota no Enem" (2013); microdados do Enem (arquivo `ITENS_PROVA_AAAA.csv`).

## A escala por área (medida em nov/2026)

A documentação pública do Inep dá a escala como (500, 100) para toda área, mas as notas oficiais publicadas seguem
uma régua efetiva ligeiramente diferente em cada área. As constantes (slope, intercept) vêm do catálogo do
analise-enem, estimadas por eles em dezenas de milhares de notas por área: LC (108,086; 499,978), CH (112,310;
501,489), CN (113,102; 501,143), MT (129,646; 500,019). Conferência própria, em população COMPLETA: os 12.330.462
participantes presentes do Enem 2024 (microdados, RESULTADOS_2024.csv; LC 3.164.703, CH 3.161.605, CN 3.001.536, MT
3.002.618), cada padrão de respostas corrigido pelo gabarito do próprio caderno (em LC, o gabarito traz 50 itens —
5 inglês + 5 espanhol + 40 comuns — e usa-se o idioma marcado pelo participante), passados pelo `estimarEap` de
`lib/enem-tri.ts`. Resultado, combinando a escala com a exceção da nota de gabarito (seção seguinte): erro absoluto
médio de 0,025 ponto e 99,9994% dos casos dentro de ±0,05 em todas as áreas (com a escala SOZINHA, LC ainda teria os
18 desvios de 8 pontos dos gabaritantes de inglês; CH, CN e MT já ficam inteiras em ±0,05 só com a escala). Com a régua nominal (500 + 100·θ) o erro médio era de 4,46 (LC), 8,43 (CH), 7,53 (CN) e 21,40 (MT) pontos,
sempre encolhendo as notas em direção a 500 (notas altas subestimadas; em MT, o pior caso chegou a 105,6 pontos).

## A nota de gabarito (quem acerta tudo)

Observação dos microdados, não regra geral comprovada do Inep: em LC 2024, os 18 participantes que gabaritaram em
inglês (TP_LINGUA 0) receberam 795,8, enquanto os parâmetros dos itens de inglês produzem 787,8; os 2 que
gabaritaram em espanhol receberam os mesmos 795,8, que o modelo da prova de espanhol já reproduz. O analise-enem
observa o mesmo desvio em algumas provas de 2009 a 2025 e o descreve como o Inep atribuindo ao padrão perfeito a
nota de gabarito de outro caderno da edição; não encontramos documento do Inep que confirme a regra geral. O
laboratório reproduz apenas o VALOR OBSERVADO, edição por edição: o campo `notaGabarito` de uma prova (em
`public/tri/enem-AAAA.json`) guarda a nota que os microdados DAQUELA edição registram para o padrão perfeito, e o
`estimarEap` a devolve quando todas as respostas válidas são acertos. Nenhum valor é extrapolado para outra prova
ou ano. Valores atuais: 2024 LC inglês 795,8, conferido por nós na população completa de 2024 (3,16 milhões de
notas de LC); e 2025 — LC 794,5 (inglês n=84; espanhol n=1), CN 858,7 (n=67) e MT 980,3 (n=88) — conferidos por
nós nos microdados oficiais de 2025 (RESULTADOS_2025.csv, 4.810.772 inscritos) em 22/11/2026. CH 2025 não precisa
de valor: o modelo já reproduz a nota oficial dos 16 gabaritantes. Nas provas sem `notaGabarito`, a nota do modelo
coincide com a oficial — é o caso de CH e MT 2024, onde os 617 gabaritantes receberam exatamente a nota que os
parâmetros produzem.

Detalhe observado em 2025: nas duas provas com item anulado que MANTEVE a letra do gabarito original (MT 1471,
item 97593, letra "A"; CN 1483, item 96748, letra "B"), a nota fixa só foi registrada para quem acertou esse item
também; quem gabaritou os itens ativos e errou (ou não respondeu) o anulado recebeu a nota EAP normal (MT 967,7;
CN 852,4). Itens anulados com gabarito "X" não entram na regra. O laboratório reproduz isso com a opção
`anuladosComLetra` do `estimarEap` e a função `cenarioDeGabarito`, e a página pergunta à pessoa sobre esses itens
(sem resposta, mostra os dois cenários). Com a regra aplicada, a varredura dos 13.122.402 resultados de 2025
(microdados, população completa) ficou com erro absoluto médio de 0,025 ponto por área e nenhum desvio acima de
1 ponto; sem ela, os padrões perfeitos de LC, CN e MT erravam em média de 1,8 a 7,5 pontos (máximo 12,6).

## A constante D (dúvida resolvida em nov/2026)

O texto público do Inep traz a fórmula numa figura e não diz, em texto, se usa D = 1,7 ou D = 1. A literatura
brasileira costuma usar 1,7 (costume do BILOG-MG), mas a evidência empírica diz 1: o projeto analise-enem
(HenriqueLindemann, AGPL-3.0, github.com/HenriqueLindemann/analise-enem) reproduziu 262 milhões de notas oficiais
(2009–2025) com D = 1 e erro médio de 0,03 ponto; com D = 1,7 o erro dispara. Conferência própria: nos 136 padrões de
resposta dos golden files deles, o EAP de `lib/enem-tri.ts` com D = 1 ficou mais perto da nota oficial do que com
D = 1,7 (erro médio absoluto 9,5 × 16,4 pontos nos 16 padrões de 2024/2025; 27,8 × 33,4 no conjunto todo, que inclui
registros inconsistentes documentados por eles). Por isso `D_PADRAO = 1` em `lib/enem-tri.ts`. O laboratório deixa
trocar em "Detalhes do cálculo", para a pessoa ver quanto isso mexe na nota.

## Parâmetros reais: `public/tri/`

`scripts/enem/gerar-parametros-tri.mjs` gera `public/tri/enem-AAAA.json` (17 arquivos, ~16 KB cada) e `indice.json`.
O zip dos microdados tem 0,5 a 1,5 GB, então o script lê só a central de diretório e o CSV de itens por requisições HTTP
`Range` (`scripts/enem/zip-remoto.mjs`); nada de zip inteiro. Rodar: `node scripts/enem/gerar-parametros-tri.mjs [anos]`
(ou `--csv-dir pasta` com `itens-AAAA.csv` já baixados). Já foi rodado para 2009 a 2025 (2024 e 2025 em nov/2026: como ainda não há questões desses anos em
`public/questoes/`, nenhuma questão foi ligada e o caderno usado é o da `PREFERENCIA_CADERNO` no script — em 2024 o
menor CO_PROVA é a REAPLICAÇÃO, então o caderno da 1ª aplicação regular foi fixado à mão: LC 1395, CH 1383, CN 1419,
MT 1407, conferido com o tipo_aplicacao do catálogo do analise-enem; 2025 não precisou). Atenção a duas mudanças de
formato nos microdados novos: `TP_LINGUA` vem como "0.0"/"1.0" (não "0"/"1") e `CO_POSICAO` segue a numeração global
da prova (CH 46–90, CN 91–135, MT 136–180).

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
número de itens. Não inclui: a recalibração dos itens pelo Inep, a cor do caderno feito (mesmos itens,
outra ordem) nem os itens que a pessoa não contou. O aviso fixo do topo diz que é estimativa e que não serve para
decidir inscrição ou curso.

## Arquivos

- `lib/enem-tri.ts`: `estimarEap`, `estimarMl`, `probabilidadeD`, `notaDeTheta`, `faixaPorAcertos`, `corrigirLetras`,
  `itensDaArea` (e as funções do laboratório antigo, mantidas: usadas por `testar:enem`).
- `components/enem/LaboratorioTri.tsx`, `app/[lang]/enem/laboratorio-tri/page.tsx`.
- Textos: `i18n/estudo/pt.json` (`enem.tri`). Em en, es, fr, ru e zh ficou só o título; o resto aparece em português
  com o aviso de "ainda não traduzido" (as traduções antigas descreviam o laboratório de itens inventados).
- Teste: `npm run testar:tri` (`scripts/testar-tri.mjs`, 539 conferências): contas feitas à mão, EAP contra integral por
  outro caminho, escala, quadratura, propriedades (coerência, monotonia), integridade dos 17 arquivos, 5 valores lidos do
  `ITENS_PROVA_2022.csv` e gabarito de cada questão ligada contra o do Inep.

## Privacidade

Tudo roda no aparelho. O único pedido de rede é o arquivo estático da prova (`/tri/enem-AAAA.json`), do próprio site.
As respostas coladas e marcadas não saem do navegador e não são guardadas.
