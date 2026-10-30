# Revisão independente da Onda 1 do curso ENEM (30/10/2026)

Revisão feita por IA, sem ter escrito nenhum destes conteúdos. **Não vale como revisão do site**: nenhum arquivo ganhou
`revisoes`, `revisada` ou `status: revisada`, e nenhum `a-confirmar` virou confirmado. O que está aqui é um parecer para a
revisão humana. "Verificado" quer dizer conferido numa fonte aberta nesta sessão; o que não foi aberto está marcado como
"não verificado".

## 1. O que foi conferido e como

| Item | Escopo | Como |
| --- | --- | --- |
| `content/enem/edicao.yml` | 100% (56 fatos) | Script que procura cada `trecho` no texto da fonte baixada (edital64.txt, ret64.html, cartilha2026.txt e as notícias do Inep/MEC salvas em `scratchpad/fontes`) e imprime o item do edital citado, para comparar valor, item e trecho à mão. |
| Aulas `enem-reta-final` | 100% (18) | Leitura integral. Contas refeitas; quiz e questão comentada resolvidos (gabarito e cada engano); números de incidência comparados com `content/enem/incidencia.yml`; resumos de habilidade comparados com a Matriz; datas e leis conferidas; fontes de dado abertas na web quando havia número. |
| Aulas `enem-estrategia-de-prova` | 100% (8) | Mesmo método. Artigos científicos e páginas do MEC/Ministério da Saúde abertos para conferir números e frases atribuídas. |
| Exercícios `content/exercicios/enem-reta-final` | 100% (110 questões em 16 arquivos) | Script que lista enunciado, alternativas, certa, `erro` de cada engano, `conferir` avaliado; cada conta de engano refeita; etiquetas (área, habilidade, objeto) lidas contra a Matriz. Posição da certa: A 22, B 23, C 21, D 23, E 21 (equilibrada). |
| Questões oficiais | Amostra de 40 (10 por área) | Amostra sistemática: em cada arquivo área × ano, 5 questões **sem imagem** (para poder ler o enunciado inteiro em `public/questoes/enem-<ano>.json`), espaçadas por igual na lista. Resolução refeita, gabarito da camada comparado com o importado, enganos e habilidade lidos. |
| `content/enem/redacao/propostas.yml` e `repertorio.yml` | 100% (10 propostas, 30 itens) | Fontes com número abertas na web (Secom/Censo 2022, Cetic.br, MTE, Secretaria-Geral, MDH, Fiocruz, Planalto); temas comparados com a lista de temas já aplicados. |

Amostra de questões oficiais: Matemática 2022-140, 147, 163, 167, 175 e 2023-143, 150, 159, 167, 175; Natureza 2022-97, 102,
113, 123, 130 e 2023-93, 101, 106, 117, 130; Humanas 2022-50, 59, 67, 77, 87 e 2023-51, 60, 68, 78, 86; Linguagens 2022-6,
16, 23, 31, 41 e 2023-5-espanhol, 13, 21, 30, 40. Limite da amostra: questões com imagem ficaram de fora por método (não
dá para ler a figura no JSON), e elas são mais da metade em Matemática.

## 2. Resultado por item

**edicao.yml.** Os 56 fatos batem com a fonte citada, no valor e no item. Quatro trechos (`duracao-dia-1`, `duracao-dia-2`,
`provas-dia-1`, `provas-dia-2`) são transcrições do quadro do item 3.3, que no edital está em células; o conteúdo bate, mas
o texto não é cópia literal de uma frase. `redacao-nota` junta os itens 14.5 e 14.5.1 numa frase; também bate.
`sisu-2027-cronograma` não tem trecho conferível (está, corretamente, como `confirmar-no-edital`). A página "sisu" não estava
baixada: não verificado.

**Aulas.** Todas seguem o modelo (`npm run pendencias`). Fórmulas em bloco têm leitura em palavras; não há imagem nas aulas
(nenhum texto alternativo a cobrar); títulos em ordem; nenhum poema ou letra protegidos (os poemas e trechos literários
são originais do instituto e dizem isso); sem gamificação e sem tom de humilhação. Os números de incidência das oito aulas
"o essencial" batem com `incidencia.yml`, com uma exceção de enquadramento (correção 5). Os resumos das habilidades citadas
batem com a Matriz.

**Exercícios.** Nenhum gabarito errado. Uma explicação de engano e uma alternativa certa ajustadas (correções 12 e 13).

**Questões oficiais.** 40 de 40 com gabarito da camada igual ao importado e resolução que chega a ele; enganos plausíveis e
coerentes com a conta ou a leitura de cada alternativa; habilidades plausíveis. Uma resolução atualizada por mudança de lei
(correção 9). 19 das 347 questões não têm `topico` (o campo é opcional; registro para quem quiser completar).

**Redação.** As 10 propostas não coincidem com nenhum tema da aplicação regular (1998–2025) nem das reaplicações/PPL de
2010–2025, pela lista conferida (ver dúvida 6). Os 30 itens do repertório têm fonte aberta; os números conferidos batem,
com uma ressalva de unidade (correção 8).

## 3. Correções feitas (mudança mínima)

| # | Arquivo | Antes → depois | Motivo | Evidência |
| --- | --- | --- | --- | --- |
| 1 | `trilhas/enem-estrategia-de-prova/tempo-por-questao-e-ordem-de-resolucao.md` (fontes) | "Lucas Barichello, Rodrigo Schneider Guimarães e Dalson Britto Figueiredo Filho" → "Leonardo Barichello, Rita Santos Guimarães e Dalson Britto Figueiredo Filho" | Nomes dos autores errados | Página do artigo na SciELO (DOI 10.1590/S1678-4634202248241713por): autores como impressos no topo. O resto (Educação e Pesquisa v. 48, 2022; Matemática, Enem 2016; até 18 pontos percentuais; fadiga) confere. |
| 2 | `trilhas/enem-reta-final/formulario-de-matematica.md` | "Metade dos erros de prova vem de misturar…" → "Muitos erros de prova vêm de misturar…" | Número sem fonte | Nenhuma fonte para "metade". |
| 3 | idem, questão comentada, engano B | "a conversão de metro para quilômetro foi feita duas vezes, ou se dividiu por 1.000.000" → "os centímetros foram divididos por 1.000.000 em vez de 100.000" | Conta errada: converter m→km duas vezes dá 0,002 km, não 0,2 km | 200.000 cm ÷ 1.000.000 = 0,2. |
| 4 | `trilhas/enem-reta-final/formulario-de-quimica.md` | bloco `formula` do número de Avogadro fechava com "unidades```" na mesma linha → cerca de fechamento em linha própria | A cerca não fechava e engolia o resto da aula na montagem | Leitura do arquivo. |
| 5 | `trilhas/enem-reta-final/matematica-o-essencial-numeros-e-proporcao.md` | "Dentro dos números… Depois vêm escalas, unidades de medida e progressões, com 3 cada" → "Depois vêm as progressões, com 3. Escalas e unidades de medida, que a Matriz põe na geometria, também tiveram 3 cada" | Escalas e unidades são tópicos de `mat-geometria`, não de `mat-numeros` | `incidencia.yml`: `mat-geometria-escalas`, `mat-geometria-unidades-de-medida`. |
| 6 | `trilhas/enem-reta-final/matematica-o-essencial-geometria-dados-e-funcoes.md` (quiz do táxi) | retirada a frase "quem marca 54 multiplicou a bandeirada também" | 54 não sai desse engano ((6 + 3) × 8 = 72) | Conta refeita. |
| 7 | `trilhas/enem-reta-final/humanas-o-essencial-geografia.md` (provocação) | "A resposta está em quase metade da prova de geografia" → "A resposta passa por vários dos temas de geografia que a prova cobra" | Proporção sem base em `incidencia.yml` | hidrografia + questões ambientais + urbanização somam bem menos que metade. |
| 8 | `trilhas/enem-reta-final/redacao-expressa-repertorios-coringa.md` (quiz e exemplo), `redacao/repertorio.yml` (`dado-coleta-de-esgoto-censo-2022`), `redacao/propostas.yml` (`desigualdade-no-saneamento`, Texto I) | "86,2% dos domicílios do Sudeste… 22,8% dos do Norte" (e 28,6%/83,4% por porte de município) → parcela **da população** que mora em domicílios com coleta | A Secom dá os números regionais e por porte em população, não em domicílios (só 62,5%, 44,4% e 52,8% são de domicílios) | Página da Secom de 23/02/2024: "A região Sudeste (86,2%) foi a que apresentou a maior parcela da população morando em domicílios com coleta de esgoto". |
| 9 | `trilhas/enem-reta-final/humanas-o-essencial-filosofia-e-sociologia.md` (quiz, seção Gênero, armadilhas, questão comentada, resumo, fontes) e `enem/questoes-oficiais/2023-humanas.yml` (enem-2023-60, resolução) | "cinco formas" de violência → as cinco de antes **e, desde a Lei nº 15.384, de 2026, a vicária**; fonte da Lei nº 15.384 acrescentada | Fato desatualizado: o art. 7º ganhou o inciso VI | Planalto, Lei nº 11.340 compilada (inciso VI, incluído pela Lei nº 15.384, de 9/4/2026). Gabaritos não mudam (a questão oficial é de 2023 e trata de violência patrimonial). `npm run incidencia:enem` rodado: classificação não mudou. |
| 10 | `trilhas/enem-reta-final/humanas-o-essencial-filosofia-e-sociologia.md` | "Jean-Paul Sartre (*O ser e o nada*, 1943): 'a existência precede a essência'" → "(*O existencialismo é um humanismo*, 1946)" | A fórmula célebre é da conferência de 1945, publicada em 1946 | Conhecimento bibliográfico corrente (SEP, verbete Sartre, citado na aula); ver dúvida 9. |
| 11 | `trilhas/enem-reta-final/natureza-o-essencial-biologia.md` | "Vêm em seguida de ecologia (5)" → "Vêm em seguida ecologia (5)" | Erro de digitação que mudava a leitura | Leitura. |
| 12 | `exercicios/enem-reta-final/formulario-de-matematica.yml` (enem-mat-form-02, engano D) | "A taxa foi lida como 1% ao mês." → "A taxa foi lida como 1% ao mês (1.000 + 10 + 10)." | A 1% composto daria R$ 1.020,10; o R$ 1.020,00 só sai somando 1% duas vezes | Conta refeita. |
| 13 | `exercicios/enem-reta-final/humanas-o-essencial-geografia.yml` (enem-rf-hum-clima-01, alternativa certa) | "cada décimo de grau a mais no aquecimento global amplia…" → "quanto maior o aquecimento global, maiores ficam as regiões…" | A certa extrapolava o texto-base (que só mostra os cenários 1,5, 2 e 4 °C), justo o engano que a aula ensina a evitar | Leitura do texto-base. Gabarito continua C. |

## 4. Dúvidas para a revisão humana

1. **Outras trilhas com a Lei Maria da Penha desatualizada (fora do escopo, não mexi):**
   `content/trilhas/violencia-domestica-sinais-e-ajuda/sinais-para-pedir-ajuda.md` (linha 88) e o título em `plano.json`
   ("Os cinco tipos…"), `content/trilhas/feminismo-fundamental/a-lei-maria-da-penha.md` (linhas 40 e 56). O
   `repertorio.yml` já trazia a vicária.
2. **Fontes sem URL ou da Wikipédia.** `linguagens-o-essencial-leitura-e-lingua.md` cita Bagno (1999) e Bortoni-Ricardo
   (2004) sem URL e "Falso cognato" da Wikipédia; `linguagens-o-essencial-literatura-artes-e-corpo.md` usa nove verbetes da
   Wikipédia. O brief pede fonte confiável com URL de página; os fatos que conferi (datas de obras, registros do Iphan e da
   Unesco, Semana de 22, Noigandres) estão certos, mas a equipe pode querer trocar as fontes.
3. **Respiração lenta (ansiedade-e-sono).** Zaccaro e outros (2018) incluem 15 estudos, com corte de menos de 10
   respirações por minuto e evidência limitada: confere. "Os efeitos mais fortes apareceram perto de 6 respirações por
   minuto" é uma leitura generosa: o artigo fala de uma tendência nos estudos perto de 6/min e de resultados mistos para a
   ansiedade. Sugiro suavizar.
4. **Frases atribuídas a páginas do MEC.** Conferidas: "o sistema observa a coerência do conjunto de respostas", "Uma
   resposta errada não gera punição adicional", o exemplo dos seis acertos, garantir fáceis e médias primeiro (página "Como
   funciona o Enem"); duração, intensidade e prejuízo, e respiração que não substitui cuidado especializado; reservar tempo
   para o Cartão-Resposta (página "o que você precisa saber"). A página do Ministério da Saúde sobre o CAPS, a do CVV e as
   orientações sobre dengue e leishmaniose: **não verificadas** nesta sessão.
5. **Funcionalidades do site citadas nas aulas** (caderno de erros que tira a questão após dois acertos seguidos, revisão
   com intervalos de um dia a dois meses, "Meu estudo" como casa do caderno de erros): **não verificadas** no código.
   `como-usar-a-reta-final.md` diz que o caderno de erros "mora em Meu estudo"; `estudar-do-jeito-que-funciona.md` aponta
   para `/caderno?ferramenta=erros`. Conferir qual é o caminho certo.
6. **Temas que já caíram.** A lista de reaplicação/PPL veio de imprensa (busca na web), não de página do Inep; não havia
   `content/enem/redacao/temas-oficiais.yml` para comparar. Nenhuma das 10 propostas coincide com a lista, mas a
   conferência final deve ser no Inep.
7. **Fusos (véspera e dia da prova).** A tabela não cita Fernando de Noronha (UTC−2, uma hora à frente de Brasília). Não é
   erro, é lacuna; decidir se vale uma linha.
8. **Lei dos Sexagenários (história).** "Libertou os escravizados com mais de 60 anos" simplifica: a lei exigia mais três
   anos de trabalho (ou até os 65) a título de indenização. Não mudei por ser simplificação, não erro de fato.
9. **Sartre (correção 10).** Mudei a obra citada para a origem da fórmula célebre; o *O ser e o nada* trata da mesma ideia
   sem a frase nesses termos. Um revisor de filosofia deve confirmar.
10. **Referências a questões de 2022/2023 nas aulas** (tacho de doce, fogão de indução, discos ópticos, rádio do avião,
    mangueira, lanterna, interseccionalidade com gráfico do IBGE): as que procurei existem nos JSON. A "questão sobre
    aviões" (enem-2023-128) está com `area: matematica` no importado, embora seja de física; conferir a área no caderno.
11. **Não verificados (sem abrir a fonte):** os artigos da SciELO sobre *Vidas secas* (Alea) e *O cortiço* (Manguinhos) e
    sobre Paulo Freire (Pro-Posições) no `repertorio.yml`; a página da ONU sobre o Relatório Brundtland; a página da
    prefeitura de São Paulo sobre *Quarto de despejo*; as páginas do Ministério da Saúde sobre dengue, leishmaniose e
    vacinação; a Fiocruz bate (Revolta da Vacina: 945 presos, 461 deportados, 110 feridos, 30 mortos).

## 5. Conferências finais

- `npm run incidencia:enem`: gravado, sem mudança de classificação.
- `npm run testar:enem`: 1552 conferências certas, 0 falhas.
- `npm run testar:exercicios`: 219 exercícios conferidos, 585 conferências certas, 0 falhas.
- `npm run pendencias -- enem-reta-final enem-estrategia-de-prova`: as 26 aulas seguem o modelo, todas "em revisão".
