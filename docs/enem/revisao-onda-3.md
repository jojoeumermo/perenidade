# Revisão independente da Onda 3 (Matemática) e da Onda 7 (redação) do curso ENEM (02/11/2026)

Revisão feita por IA, sem ter escrito nenhum destes conteúdos. **Não vale como revisão do site**: nenhum arquivo ganhou
`revisoes`, `revisada` ou `status: revisada`, e nenhum `a-confirmar` mudou. É um parecer para a revisão humana.
"Verificado" quer dizer conferido nesta sessão numa fonte aberta (página, PDF oficial, arquivo do repositório ou conta
refeita). O que não foi aberto está marcado como "não verificado".

## 1. Escopo (arquivos que existiam no começo da revisão)

Outras equipes escreviam aulas novas nas mesmas pastas durante a revisão. Só estes arquivos foram revisados:

- **Aulas (24):** `content/trilhas/enem-matematica-proporcionalidade/` (porcentagem, razao-e-proporcao,
  aumentos-e-descontos-sucessivos, contas-do-dia-a-dia, escalas, unidades-de-medida); `enem-matematica-geometria/`
  (areas-de-figuras-planas, circunferencia-e-circulo, esfera, piramides-e-cones, prismas-e-cilindros,
  vistas-e-projecoes); `enem-matematica-estatistica-e-probabilidade/` (graficos-de-barras-linhas-e-setores,
  leitura-de-tabelas, media-mediana-e-moda, media-ponderada, permutacoes-arranjos-e-combinacoes,
  uniao-complementar-e-probabilidade-condicional); `enem-matematica-funcoes-e-algebra/` (funcoes-e-graficos,
  funcao-afim, funcao-quadratica, funcao-exponencial, logaritmos, progressoes). Mais os quatro `_trilha.md`.
- **Exercícios (240, 10 por aula):** os 24 arquivos de mesmo nome em `content/exercicios/enem-matematica-*/`.
- **Redação:** `content/enem/redacao/grade.yml`, `modelos.yml` (10 redações), `temas-oficiais.yml` (27 temas) e as
  8 aulas de `content/trilhas/enem-redacao/` (mais o `_trilha.md`).

Fora do escopo, por já terem sido criados por outras equipes depois do início: plano-cartesiano, equacao-da-reta,
pitagoras-e-relacoes-metricas, juros-simples, juros-compostos, matrizes e as demais aulas novas que
`npm run pendencias` lista nessas trilhas.

## 2. O que foi conferido e como

| Item | Cobertura | Como |
| --- | --- | --- |
| Aulas de Matemática | 100% (24) | Leitura integral. Toda conta do texto, do `verificar`, do `quiz` e da questão comentada refeita à mão, inclusive a conta que leva a cada alternativa errada. Números de incidência comparados com `content/enem/incidencia.yml` (tópicos, objetos e habilidades) e, para a H2, com as classificações em `questoes-oficiais/2022-matematica.yml` e `2023-matematica.yml`. Resumos das habilidades comparados com `matriz.yml`. Posição da certa no quiz lida. |
| Exercícios | 100% (240) | Script temporário que imprime, por questão, enunciado, alternativas, certa, `erro` de cada engano, explicação e `conferir`. Gabarito e cada engano refeitos à mão; etiquetas (área, habilidade, competência, objeto, dificuldade, estilo) lidas contra a matriz. Posição da certa: equilibrada em todos os 24 arquivos (2 A, 2 B, 2 C, 2 D, 2 E por arquivo). `npm run testar:exercicios` cobre os `conferir`. |
| Links internos | 100% | Script que confere se cada `/trilhas/<trilha>/<aula>` existe em `content/trilhas` (com o prefixo `NN-` aceito por `lib/content.ts`). Nenhum link quebrado no escopo. |
| Fontes externas | 87 endereços | Requisição a cada URL citada nas aulas e nos arquivos de redação. 70 abriram (200). 3 recusaram robô (403: BNCC, IBGE Explica, IBGE Educa), 1 deu tempo esgotado (Fiocruz) e 14 do Planalto falharam por conexão: **não verificados** pela web. Para leis, usei a cópia local em `leis-do-brasil` (Lei nº 11.445, art. 11-B; Lei nº 14.572/2023). |
| Fatos históricos e citações | todos os blocos `historia` e os casos com número | Páginas abertas: MacTutor (Arquimedes: 287–212 a.C., π entre 3 10/71 e 3 1/7 com polígonos de 96 lados, túmulo com esfera e cilindro, Cícero na Sicília em 75 a.C.; Nightingale: Scutari em 4/11/1854 com 38 enfermeiras, janeiro de 1855 com 2.761 mortes por doenças contagiosas e 83 por ferimentos, gráfico de área proporcional, Royal Statistical Society em 1858); ASA/P1MC (cisterna cilíndrica, semienterrada, 16 mil litros); Boletim Goiano de Geografia (título, autores, 2021). Mega-Sena: C(60, 6) = 50.063.860 refeito; a página da Caixa é montada por script e não pôde ser lida (não verificado na fonte). |
| `grade.yml` | 100% (5 competências × 6 níveis) | Cada nível comparado com os quadros da Cartilha 2026 (`scratchpad/fontes/cartilha2026.txt`), mais os trechos sobre estrutura sintática (C1), repertório e experiência vivida (C2), tangenciamento limitando C3 e C5 a 40, elementos da proposta e direitos humanos (C5). |
| `modelos.yml` | 100% (10 redações, 50 comentários) | Leitura de cada texto procurando desvios; conferido que cada desvio citado no comentário está no texto e que cada estimativa usa o nível certo da Cartilha 2026 (por exemplo, "desorganizados ou contraditórios" em 80 na C3, cópia em 80 na C2, tangenciamento em 40). Fatos das fortes conferidos com `propostas.yml` e fontes (CF arts. 3º, 6º, 196, 205, 216; EC 90/2015; Estatuto da Cidade; Lei nº 14.026/2020 e meta de 90% até 2033; Lei nº 13.185/2015; Marco Civil, art. 7º). Tom dos comentários: respeitoso, com "Para subir" em todos. |
| `temas-oficiais.yml` | amostra de 8 anos + 2025 | Para 2024, 2023, 2022, 2019, 2016, 2012, 2011 e 2004: aberta a página do ano em "Provas e gabaritos" do Inep, baixado o caderno impresso da aplicação regular que traz a redação (1º dia desde 2017; 2º dia em 2016, 2012 e 2011; prova única em 2004) e extraído o texto com `pdftotext`. Os 8 temas batem letra por letra, inclusive as maiúsculas de 2012 e o "viver" minúsculo de 2011. O de 2025 bate com a Cartilha 2026. 2009 foi tentado, mas a proposta está em imagem no PDF (não lida). |
| Aulas de redação | 100% (8) | Leitura integral; cada afirmação sobre regra conferida com a Cartilha 2026 e com o edital (`edital64.txt`: itens 14.6.2 a 14.6.2.4 sobre terceiro corretor e banca); fatos da edição só por `{{enem:…}}` (todos existem em `edicao.yml`). |

## 3. Resultado

- **Exercícios:** nenhum gabarito errado e nenhuma conta de engano errada nos 240. Nenhuma correção.
- **Aulas de Matemática:** contas todas certas. Correções de enquadramento de incidência, de um número sem fonte e
  de dois deslizes de texto (tabela abaixo).
- **`grade.yml`:** fiel à Cartilha 2026 em todos os níveis. Nenhuma correção.
- **`modelos.yml`:** desvios apontados existem no texto, estimativas coerentes com a grade, fatos certos, sem
  humilhação. Nenhuma correção.
- **`temas-oficiais.yml`:** os 9 conferidos batem. Nenhuma correção.
- **Aulas de redação:** sete correções pequenas (afirmação sem fonte, gramática, enquadramento na Cartilha).

## 4. Correções feitas (mudança mínima)

| # | Arquivo | Antes → depois | Motivo | Evidência |
| --- | --- | --- | --- | --- |
| 1 | `trilhas/enem-matematica-proporcionalidade/porcentagem.md` (Como cai) | "um dos dois tópicos de Matemática que mais apareceram … empatada com operações" → "um dos tópicos … empatada com operações e atrás só de média, mediana e moda (6)" | Porcentagem não está entre os dois primeiros | `incidencia.yml`: `mat-estatistica-media-mediana-moda` 6; operações e porcentagem 5 cada. |
| 2 | `trilhas/enem-matematica-geometria/prismas-e-cilindros.md` | "Volta à pilha de folhas." → "Volte à pilha de folhas." | Imperativo, como no resto do curso | Leitura. |
| 3 | idem (Como cai) | "empatado com circunferência entre os de geometria que mais apareceram" → "empatado com circunferência, escalas e unidades de medida …" | Escalas e unidades também são tópicos de `mat-geometria` com 3 | `incidencia.yml`: `mat-geometria-escalas` 3, `mat-geometria-unidades-de-medida` 3. |
| 4 | `trilhas/enem-matematica-estatistica-e-probabilidade/graficos-de-barras-linhas-e-setores.md` | "metade dos erros em gráfico vem de pular esses passos" → "muitos erros em gráfico vêm de …" | Número sem fonte (mesmo caso da correção 2 da Onda 1) | Nenhuma fonte para "metade". |
| 5 | `trilhas/enem-matematica-estatistica-e-probabilidade/permutacoes-arranjos-e-combinacoes.md` e `trilhas/enem-matematica-funcoes-e-algebra/progressoes.md` (Como cai) | H2 "somando contagem e progressões" → "somando contagem, progressões e múltiplos e divisores" | Uma das 6 questões H2 é de múltiplos e divisores | `questoes-oficiais`: H2 = 2022-142 (contagem), 2022-155 e 2023-160 (arranjos), 2022-159 (múltiplos e divisores), 2023-169 e 2023-176 (progressões). |
| 6 | `trilhas/enem-matematica-geometria/areas-de-figuras-planas.md` | losango "como uma pipa simétrica" → "como uma pipa com os quatro lados do mesmo tamanho" | Pipa simétrica (deltoide) não tem, em geral, os quatro lados iguais; a frase induzia a confundir as figuras | Definição de losango e de deltoide. |
| 7 | `trilhas/enem-redacao/a-estrutura-da-redacao-do-enem.md` (abertura) | "A redação entra na nota de todos os programas que usam o ENEM. É também a parte da prova em que o treino aparece mais rápido na nota." → "Pelo edital, o ENEM é formado por {{enem:estrutura}}. A redação é, portanto, uma das cinco notas do exame, e se treina em casa, texto a texto." | Fato sobre programas fora de `edicao.yml` (o brief proíbe) e afirmação sem fonte | `edicao.yml`, fato `estrutura` (edital, item 3.2). |
| 8 | idem (correção) | "Nesse caso, e a nota final é a média …" → "Nesse caso, a nota final é a média …" | Erro de digitação | Edital, item 14.6.2.1 confirma a média das duas notas mais próximas. |
| 9 | `trilhas/enem-redacao/competencia-1-a-norma-padrao.md` (Frases claras) | acrescentado: "Isso não quer dizer escrever só frases curtas. Para a nota máxima, a Cartilha 2026 espera períodos com construção complexa, com orações subordinadas e intercaladas, desde que bem estruturados e completos." | A aula só recomendava frases curtas, o que contradiz a Cartilha, a `grade.yml` (200: orações encaixadas) e o modelo `fraca-calor-tangente` (C1 160 por frases curtas) | Cartilha 2026, seção da Competência I: "espera-se que os períodos apresentem complexidade em sua construção, com orações subordinadas e intercaladas". |
| 10 | `trilhas/enem-redacao/competencia-5-a-proposta-de-intervencao.md` (abertura) | "É a competência em que mais gente perde pontos por descuido, e também a mais fácil de dominar …" → "É uma competência em que se perdem pontos por descuido, e que tem uma receita clara, o que ajuda no treino." | Superlativos sem fonte | Nenhuma fonte para "mais gente" e "mais fácil". |
| 11 | idem (níveis) | "Na prática, a correção conta os elementos presentes e válidos: uma proposta com os cinco … chega ao nível máximo." → "Na prática, a cartilha diz que o texto é avaliado pela composição da proposta: a proposta 'muito bem elaborada' do nível máximo é a que traz os cinco elementos, bem articulada ao texto." | A regra de contagem não está na Cartilha 2026; a frase nova diz só o que ela diz | Cartilha 2026: "seu texto será avaliado com base na composição da proposta" e o parágrafo sobre a proposta "muito bem elaborada". |
| 12 | `trilhas/enem-redacao/o-que-zera-a-redacao.md` | "uma carta, um poema ou uma lista de opiniões soltas recebe zero" → "uma carta, um poema ou uma descrição recebe zero" | Lista de opiniões soltas não é outro tipo textual (pesa na C3, não zera) | Cartilha 2026: "predominância de características de outro tipo textual, como o narrativo ou o descritivo". |
| 13 | idem (língua estrangeira) | "o texto inteiro em outra língua, sim" → "o texto todo, ou quase todo, em outra língua, sim" | A regra vale também para o texto predominantemente estrangeiro | Cartilha 2026: "texto escrito predominantemente ou integralmente em língua estrangeira". |
| 14 | `trilhas/enem-redacao/como-treinar-escrever-reler-e-reescrever.md` (quiz e "Ler bons textos") e `competencia-4-coesao.md` (Para praticar, item 4) | "redações nota 1 000" / "redações nota máxima comentadas" → "redações bem avaliadas" / "redações comentadas que receberam boas notas na edição anterior" / "uma das redações comentadas da cartilha" | A Cartilha 2026 não diz que as redações da amostra tiraram nota máxima | Cartilha 2026, "Amostra de redações do Enem 2025": "redações … que receberam boas notas". |

Depois das correções: `npm run testar:enem` (3.724 conferências, 0 falhas), `npm run testar:exercicios` (719
conferidos, 1.690 conferências, 0 falhas) e `npm run pendencias` nas cinco trilhas: todas as aulas do escopo "segue o
modelo".

## 5. Dúvidas para a revisão humana

1. **Fonte "Matriz de Referência do Enem" sem URL** nas seis aulas de `enem-matematica-funcoes-e-algebra`. O brief pede
   URL de página. O mapa curricular usa o link direto para PDF (proibido nas aulas). Não achei, nesta sessão, uma
   página do Inep que eu pudesse confirmar como a da Matriz; não inventei o endereço.
2. **Quiz com a certa sempre na primeira opção** (`resposta: 0` em todas as perguntas) em `competencia-1`, `-2`, `-3`,
   `-4` e `como-treinar` da trilha de redação. Esses quizzes vêm de 14/10 (antes da regra de posição equilibrada) e a
   tela embaralha; não mexi por não ser erro de conteúdo. Vale reordenar quando alguém revisar as aulas.
3. **"Apótema" no feminino** (`piramides-e-cones.md` e exercício `enem-mat-piramides-07`). O VOLP, salvo engano,
   registra o substantivo como masculino ("o apótema"); não conferi o VOLP nesta sessão. Se confirmado, trocar o
   artigo nas poucas ocorrências.
4. **Distratores fracos** (contas certas, mas o engano é pouco provável): `enem-mat-esfera-05` C ("inverteu o fator
   4/3" não leva a 3/4), `enem-mat-logaritmos-09` D (5,98), questão comentada da aula de esfera, alternativa E (36).
   Não são erros; a equipe pode trocar por enganos mais reais.
5. **`competencia-5`, "Erros comuns":** "proposta impossível ou que fere direitos: proibir, punir com violência,
   retirar direitos". "Proibir" sozinho não fere direitos humanos pela Cartilha 2026; talvez caiba "proibir direitos"
   ou tirar a palavra.
6. **Não verificados pela web:** BNCC EF09MA17 (página recusou o robô); página do IPCA no IBGE Explica (403); a frase
   "a própria Caixa informa 1 em 50.063.860" (página montada por script; a conta foi refeita); as leis no Planalto
   (conexão falhou; as que importavam foram lidas na cópia local).
7. **URL com redirecionamento:** `https://www.asabrasil.org.br/acoes/p1mc` abre em
   `https://asabrasil.org.br/projeto/p1mc/`. Funciona; pode ser trocada pelo endereço final.
8. **Fato do estrutura na aula de redação:** a correção 7 usa `{{enem:estrutura}}` ("quatro provas objetivas, de 45
   questões de múltipla escolha cada, e uma redação em língua portuguesa"). Se a equipe preferir manter uma frase sobre
   o peso da redação no Sisu, Prouni ou Fies, é preciso primeiro criar o fato em `edicao.yml` com fonte oficial.
