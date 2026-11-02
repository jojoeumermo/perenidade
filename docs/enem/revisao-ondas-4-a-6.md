# Revisão independente das Ondas 4, 5 e 6 do curso ENEM (02/11/2026)

Revisão feita por IA, sem ter escrito nenhum destes conteúdos. **Não vale como revisão do site**: nenhum arquivo ganhou
`revisoes`, `revisada` ou `status: revisada`, e nenhum `a-confirmar` mudou. É um parecer para a revisão humana.
"Verificado" quer dizer conferido nesta sessão numa fonte aberta (página, arquivo do repositório ou conta refeita).
O que não foi aberto está marcado como "não verificado".

## 1. Escopo e amostra

Trilhas: `enem-linguagens-*` (5), `enem-ingles`, `enem-espanhol`, `enem-fisica`, `enem-quimica`, `enem-biologia`,
`enem-historia-do-brasil`, `enem-historia-geral`, `enem-geografia`, `enem-filosofia`, `enem-sociologia`: 131 aulas.

**Amostra lida inteira (31 aulas, 310 exercícios, 100% dos exercícios de cada aula amostrada).** Critério: em cada
trilha, a aula do tópico que mais caiu na base (`incidencia.yml`) e uma aula com risco alto de erro (contas, datas,
leis, regra gramatical). Linguagens e Humanas primeiro (1º dia da prova).

| Trilha | Aulas lidas | Por quê |
| --- | --- | --- |
| linguagens-artes-e-corpo | praticas-corporais-cultura-e-sociedade; esporte-midia-e-mercado | tópico mais frequente (6); lei de 1941 e fatos do COI/Fifa |
| linguagens-leitura-e-generos | estrategias-de-leitura-e-inferencia; funcoes-da-linguagem | tópico com 4; base de todas as questões |
| linguagens-lingua-em-uso | variacao-linguistica; norma-padrao-em-uso | tópico com 4; regras de norma (risco alto) |
| linguagens-literatura | romantismo; geracao-de-30; literatura-afro-brasileira | objeto que mais cai (19); datas e obras |
| linguagens-tecnologias | internet-hipertexto-e-redes-sociais; desinformacao-e-checagem | tópicos com 4 e 2; dados TIC e estudos citados |
| ingles | estrategias-de-leitura-cognatos-e-falsos-cognatos; questoes-resolvidas-no-formato-da-prova | 5 questões abrem a prova |
| espanhol | generos-e-vocabulario-em-contexto; estrategias-de-leitura-e-falsos-cognatos | tópico com 8 (o maior de Linguagens) e 2 |
| fisica | leis-de-newton; consumo | tópico mais frequente (4); contas |
| quimica | estequiometria; ph | contas |
| biologia | corpo-humano; vacinacao | tópico mais frequente (4); saúde |
| historia-do-brasil | era-vargas; ditadura | datas e leis |
| historia-geral | revolucoes-burguesas; guerra-fria | datas |
| geografia | espaco-agrario; clima | tópico mais frequente (4); dados do Censo Agro e IPCC |
| filosofia | filosofia-antiga; existencialismo-arendt-e-foucault | tópicos com 4 |
| sociologia | genero; trabalho | tópico mais frequente de Humanas (6) e 3 |

## 2. Como foi conferido

| Item | Cobertura | Como |
| --- | --- | --- |
| Aulas amostradas | 31 | Leitura integral: texto, `verificar`, quiz (resposta e posição), questão comentada (gabarito e cada engano), fontes. Toda conta refeita à mão. |
| Exercícios | 310 | Script temporário que imprime cada questão com texto-base, alternativas, certa, `erro`, explicação e `conferir`. Gabarito e o engano de cada errada conferidos; nas contas, refeita também a conta que leva a cada alternativa errada. Posição da certa: 2 A, 2 B, 2 C, 2 D, 2 E em 30 dos 31 arquivos; `enem-sociologia/trabalho.yml` tem D 3 vezes e E 1 (não mexi: trocar gabarito não é correção mínima). |
| Incidência | **131 aulas (100%)** | Script que, para cada aula, pega o `objeto` dos exercícios, busca o tópico e o objeto em `incidencia.yml` e mostra lado a lado as frases com "2022 e 2023"; outro script lista, por tópico, as questões de `questoes-oficiais/` com a habilidade de cada uma. Conferidos todos os números, as habilidades por tópico e os rankings ("o que mais caiu", "segundo", "terceiro"). |
| Data da prova escrita à mão | 131 aulas | `grep` por "8 de novembro", "15 de novembro", "8/11", "15/11", "novembro de 2026", "13h30", "19h", "18h30". Nenhuma ocorrência: todas usam `{{enem:...}}`. As únicas datas de 15 de novembro são a de 1889. |
| Link direto para PDF | 131 aulas | `grep` por `.pdf`: nenhum. |
| Poema ou letra protegida | 131 aulas + exercícios de Linguagens | Lista de todas as citações em bloco (`> `) e busca por nomes de autores protegidos (Drummond, Bandeira, Cecília, Vinicius, João Cabral, Clarice, Guimarães Rosa, Carolina, Conceição Evaristo, Chico Buarque, Caetano etc.) e por versos conhecidos. Todos os blocos são de domínio público com crédito (Gonçalves Dias, Castro Alves, Casimiro de Abreu, Gregório de Matos, Gonzaga, Bilac, Cruz e Sousa, Alphonsus de Guimaraens, Augusto dos Anjos, Euclides, Lima Barreto, Machado, Aluísio Azevedo, Caminha) ou textos originais do Instituto marcados como tal. Protegidos aparecem só por nome, título ou citação de poucas palavras (Beauvoir, "Ninguém nasce mulher: torna-se mulher"; a canção "Cálice" é citada, não reproduzida; "No meio do caminho tinha um buraco" é paródia original). Nada a corrigir. |
| Fatos externos | por amostra | Páginas abertas: Câmara (voto feminino 1932, facultativo em 1934, obrigatório em 1965); Cetic.br TIC Domicílios 2024 C16A (60%, 18% classe A, 86% classe DE); MCTI 28/10/2026 (El Niño e calor); Wikipédia "Capitães da Areia" (808 exemplares queimados). Para Lei Maria da Penha (inciso VI, Lei nº 15.384/2026) valeu a conferência no Planalto registrada na revisão da Onda 1. Os demais fatos de datas e leis (AI-2, AI-5, Lei da Anistia, ADPF 153, CNV, CLT, salário mínimo, DIP, Censo Agro 2017, IPCC AR6, Bastilha, Bill of Rights etc.) bateram com o que conheço e com as fontes citadas, mas **não foram reabertos** nesta sessão. |
| Testes | — | `npm run testar:enem`: 9.708 conferências, 0 falhas. `npm run testar:exercicios`: 2.069 exercícios, 4.675 conferências, 0 falhas. |

## 3. Resultado

- **Gabaritos:** nenhum gabarito errado nas 31 aulas (quiz e questão comentada) nem nos 310 exercícios.
- **Contas:** todas certas no texto, no quiz e nas certas. Duas explicações de engano descreviam uma conta que não
  leva ao número da alternativa (correções 9 e 10).
- **Incidência:** todos os números batem com `incidencia.yml` e com as classificações. Dois rankings estavam
  arredondados para cima (empates tratados como posição única) e uma aula listava habilidades que não eram as das
  questões do tópico (correções 1 a 3).
- **Norma-padrão:** um erro de crase justamente na aula de norma ("a aquilo") e um exemplo de cidade que a gramática
  tradicional usa com artigo (correções 4 e 5).
- **Afirmações de frequência sem fonte:** quatro ("o caso mais cobrado", "a dupla mais cobrada", "forma fixa que cai
  muito", "a maior parte das alternativas erradas"), trocadas por formulações sem número (correções 6 a 8).
- **Direitos autorais, PDF e data da prova:** nada encontrado.

## 4. Correções feitas (mudança mínima)

| # | Arquivo | Antes → depois | Motivo | Evidência |
| --- | --- | --- | --- | --- |
| 1 | `trilhas/enem-linguagens-literatura/literatura-afro-brasileira.md` | "foi o segundo tópico de literatura que mais caiu" → "empatou em segundo lugar entre os tópicos de literatura que mais caíram" | Empate em 2 com geração de 30 e realismo/naturalismo | `incidencia.yml`: contemporânea 3; afro-brasileira, geração de 30 e realismo-naturalismo 2 cada |
| 2 | `trilhas/enem-geografia/relevo.md` | "É o terceiro tópico de geografia que mais caiu" → "Empatado com a geopolítica, só fica atrás do espaço agrário e das questões ambientais (4 cada)" | Empate com geopolítica (3) | `incidencia.yml`: espaço agrário 4, questões ambientais 4, relevo 3, geopolítica 3 |
| 3 | `trilhas/enem-linguagens-leitura-e-generos/estrategias-de-leitura-e-inferencia.md` (Como cai) | "…sozinho, teve 4 questões." → "…teve 4 questões, e as 4 foram classificadas na H22 (relacionar opiniões, temas, assuntos e recursos linguísticos em textos diferentes)." | A aula citava só H18 e H23; as 4 questões do tópico são H22 | `questoes-oficiais`: 2022-7, 2022-22, 2023-18, 2023-23, todas H22 |
| 4 | `trilhas/enem-linguagens-lingua-em-uso/norma-padrao-em-uso.md` (quiz 3) | "use “prefiro isto a aquilo”" → "use “prefiro isto àquilo”" | Preposição *a* + *aquilo* = *àquilo* | Regra de crase com pronome demonstrativo *aquilo* |
| 5 | idem (crase de lugar) e `exercicios/enem-linguagens-lingua-em-uso/norma-padrao-em-uso.yml` (enem-lin-norma-07: enunciado, erros B e C, explicação) | "vou a Recife, volto de Recife" / "“Recife” não leva artigo" → "vou a Curitiba, volto de Curitiba" / "“Curitiba” não leva artigo" | A gramática tradicional usa "o Recife" (do Recife, ao Recife); a questão afirmava o contrário como regra. Gabarito (à / a) mantido | Cunha e Cintra listam Recife entre as cidades com artigo; uso oficial "Prefeitura do Recife" (lembrado, não reaberto) |
| 6 | `trilhas/enem-linguagens-artes-e-corpo/esporte-midia-e-mercado.md` | "O caso mais cobrado é o das mulheres." → "Um caso exemplar é o das mulheres." | Afirmação de frequência sem fonte: o tópico teve 1 questão, sobre esportes eletrônicos | `questoes-oficiais`: 2023-35 |
| 7 | `trilhas/enem-espanhol/conectivos-e-marcadores.md` (título de seção) | "Pero e sino: a dupla mais cobrada" → "Pero e sino: uma dupla que confunde" | Sem fonte: o tópico de conectivos teve 0 questões | `incidencia.yml`: `lin-lem-espanhol-conectivos` 0 |
| 8 | `trilhas/enem-linguagens-literatura/o-texto-literario.md` e `trilhas/enem-linguagens-leitura-e-generos/estrategias-de-leitura-e-inferencia.md` | "forma fixa que cai muito é o soneto" → "muito comum"; "A maior parte das alternativas erradas … cai" → "Muitas … caem"; "evita a maior parte dos erros" → "evita muitos erros" | Frequência sem fonte | Nenhuma contagem na base |
| 9 | `exercicios/enem-quimica/estequiometria.yml` (enem-qui-estequiometria-09, erro E) | "multiplicou pela massa molar e dividiu pela pureza" → "usou 112 (2 × 56), como se cada CaCO₃ formasse 2 CaO: 450 × 112 ÷ 100 = 504" | A conta descrita não dá 504 (dá cerca de 311) | Conta refeita |
| 10 | `trilhas/enem-quimica/ph.md` (questão comentada, E) | "dividiu 5 por 3 e multiplicou por 10" → "multiplicou os dois valores de pH (5 × 3 = 15)" | A conta descrita dá 16,7, não 15 | Conta refeita |
| 11 | `exercicios/enem-historia-geral/guerra-fria.yml` (enem-hum-guerra-fria-04, erro B) | "são membros permanentes" → "eram membros permanentes" | A URSS não existe mais | — |
| 12 | `exercicios/enem-ingles/estrategias-de-leitura-cognatos-e-falsos-cognatos.yml` (04, erro D) | "keep the peace, manter a calma" → "manter a paz" | Tradução | Sentido da expressão |
| 13 | `exercicios/enem-filosofia/filosofia-antiga.yml` (07, erro B) | "a crítica era a outra coisa" → "a crítica era outra" | Gramática | Leitura |
| 14 | `exercicios/enem-linguagens-literatura/literatura-afro-brasileira.yml` (10, erro C) | "Corpo e identidade caem com frequência." → "Corpo e identidade são temas da prova, como na questão de 2023." | Frequência sem fonte | `questoes-oficiais`: 2023-7 |

## 5. Dúvidas e o que não foi verificado

1. **A Moreninha em folhetim.** `romantismo.md` e o exercício `enem-lin-romantismo-03` dizem que *A Moreninha* (1844)
   foi sucesso "nesse formato" (folhetim). As fontes abertas não confirmam se a primeira publicação foi em jornal ou
   direto em livro (a Wikipédia diz só que o romance "segue a tendência do romance-folhetim"). Não mudei. Sugestão:
   conferir na edição crítica ou na Biblioteca Nacional; se saiu em livro, trocar por "um dos primeiros romances
   brasileiros de grande sucesso".
2. **Os 808 exemplares de 1937.** `geracao-de-30.md` diz "808 exemplares de livros de Jorge Amado"; o exercício
   `enem-lit-geracao30-05` diz "808 exemplares de Jorge Amado e de outros autores". A Wikipédia (fonte da aula) dá
   808 como total, citando Tucci Carneiro (1999). Pela ata de incineração que eu lembro, 808 seriam só de *Capitães da
   Areia*. Não verificado na fonte primária; as duas formulações não batem entre si.
3. **Plano Marshall, "cerca de 12 bilhões aprovados em 1948"** (`guerra-fria`). O valor costuma ser o total de 1948 a
   1952; a lei de 1948 autorizou a primeira parcela. Não verificado na OpenStax.
4. **Lina Bo Bardi e o MASP de 1947** (`genero.md`). Bate com a questão oficial 2023 classificada no repositório, mas a
   sede famosa da Avenida Paulista é de 1968. A frase "projetou o MASP" junto de "inauguração em 1947" pode confundir.
5. **Espanhol, fontes das 10 questões** (`generos-e-vocabulario-em-contexto.md`): "uma banda de Cuba, uma poeta da
   Costa Rica e um escritor uruguaio". As resoluções em `questoes-oficiais/` não trazem esses dados; não verificado.
6. **"Nas provas guardadas no site, desde 2017 as cinco primeiras questões… são de língua estrangeira"** (inglês e
   espanhol). Não conferi os cadernos.
7. **Exercício `enem-lin-ing-prova-04`** chama de "versos" um texto que aparece em linha corrida no script; pode estar
   em versos no arquivo. Não é erro de conteúdo.
8. **Sociologia/trabalho.yml:** posição da certa D 3 vezes e E 1 vez.
9. Fontes externas não foram requisitadas em massa (só as quatro páginas citadas na seção 2).

## 6. Arquivos

Mudados (14): os listados na seção 4. Nenhum arquivo de `questoes-oficiais/`, `incidencia.yml`, `edicao.yml`,
`public/` ou `lib/` foi tocado. Scripts temporários (`scripts/tmp-revisor46*.mjs`) apagados.
