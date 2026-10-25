---
titulo: "O projeto elétrico de uma casa pequena"
resumo: "Um projeto completo, do levantamento de cargas ao quadro: pontos de luz e tomadas de cada cômodo, divisão em circuitos, fios, disjuntores, DR, circuito de distribuição e levantamento de material."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Instalações elétricas residenciais, parte 1 (manual baseado na NBR 5410)"
    autor: "ELEKTRO e Pirelli, com revisão técnica de Hilton Moreno"
    ano: "2003"
    url: "https://www.coe.ufrj.br/~kleber/INST_ELET_RES_PARTE_01.pdf"
  - titulo: "Instalações elétricas residenciais, parte 2 (manual baseado na NBR 5410)"
    autor: "ELEKTRO e Pirelli, com revisão técnica de Hilton Moreno"
    ano: "2003"
    url: "https://www.coe.ufrj.br/~kleber/INST_ELET_RES_PARTE_02.pdf"
  - titulo: "ABNT NBR 5410: Instalações elétricas de baixa tensão (edição de 2004, versão corrigida de 2008)"
    autor: "Associação Brasileira de Normas Técnicas"
    ano: "2004"
  - titulo: "Lei nº 11.888, de 24 de dezembro de 2008 (assistência técnica pública e gratuita para habitação de interesse social)"
    autor: "Brasil, Presidência da República"
    ano: "2008"
    url: "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11888.htm"
glossario:
  - termo: "levantamento de cargas"
    definicao: "A lista de toda a potência prevista na casa: iluminação, tomadas de uso geral e aparelhos fixos, cômodo por cômodo."
  - termo: "fator de demanda"
    definicao: "A fração da potência instalada que se espera usar ao mesmo tempo. Ninguém liga todas as lâmpadas e tomadas de uma vez."
  - termo: "fator de potência"
    definicao: "O número que converte a potência aparente (VA) em potência ativa (W). O manual usa 1,0 para iluminação e 0,8 para tomadas de uso geral."
quiz:
  - pergunta: "Um quarto tem 3 m × 4 m. Qual é a potência mínima de iluminação pela NBR 5410?"
    opcoes: ["100 VA", "160 VA", "220 VA"]
    resposta: 1
    explicacao: "A área é 12 m²: 100 VA pelos primeiros 6 m², mais 60 VA para os 4 m² inteiros seguintes. Os 2 m² que sobram não contam: 160 VA."
  - pergunta: "Por que o circuito de iluminação que passa pelo banheiro leva DR?"
    opcoes: ["Porque a norma exige DR em pontos de locais com chuveiro ou banheira", "Porque toda iluminação leva DR", "Porque o banheiro é pequeno"]
    resposta: 0
    explicacao: "A exigência de DR vale para os pontos situados em locais com chuveiro ou banheira, e o ponto de luz do banheiro é um deles."
  - pergunta: "Para que serve o fator de demanda no cálculo do circuito de distribuição?"
    opcoes: ["Para não superdimensionar os fios que vêm do medidor, já que nem tudo é ligado ao mesmo tempo", "Para aumentar a potência por segurança", "Para calcular a conta de luz"]
    resposta: 0
    explicacao: "Ele representa o quanto da potência prevista é usado ao mesmo tempo no momento de maior consumo."
  - pergunta: "Numa planta na escala 1:100, um eletroduto mede 3,5 cm no desenho. Qual é o comprimento real?"
    opcoes: ["35 cm", "3,5 m", "35 m"]
    resposta: 1
    explicacao: "Na escala 1:100, cada 1 cm do desenho são 100 cm reais: 3,5 × 100 = 350 cm, ou 3,5 m."
---

```provocacao
Antes de abrir o primeiro rasgo na parede, dá para saber quantos metros de fio, quantos disjuntores e quantas tomadas a casa vai precisar?
```

## O que você vai aprender

Ao fim desta aula você vai fazer o projeto elétrico de uma casa pequena seguindo a NBR 5410: prever as cargas de cada cômodo, dividir os circuitos, escolher fios, disjuntores e DR, calcular o circuito de distribuição e levantar o material. É a aula que junta toda a trilha.

## A casa do exemplo

| Cômodo | Medidas | Área | Perímetro |
| --- | --- | --- | --- |
| Sala | 3,0 × 3,5 m | 10,5 m² | 13 m |
| Quarto | 3,0 × 3,0 m | 9 m² | 12 m |
| Cozinha | 2,5 × 3,0 m | 7,5 m² | 11 m |
| Banheiro | 1,5 × 2,0 m | 3 m² | — |
| Área de serviço | 1,5 × 2,0 m | 3 m² | — |

Suponha que a distribuidora fornece **127 V** entre fase e neutro e **220 V** entre duas fases, como no exemplo do manual. Para ter os 220 V do chuveiro, a casa precisa de fornecimento com duas fases. O tipo de fornecimento e os limites de carga mudam de uma distribuidora para outra: consulte a norma da sua.

## Etapa 1: a iluminação

Regra da NBR 5410: pelo menos um ponto de luz no teto por cômodo, com interruptor de parede; **100 VA** para os primeiros 6 m² e mais **60 VA** a cada 4 m² **inteiros** a mais.

| Cômodo | Conta | Iluminação |
| --- | --- | --- |
| Sala | 10,5 = 6 + 4 + 0,5 | 100 + 60 = 160 VA |
| Quarto | 9 = 6 + 3 | 100 VA |
| Cozinha | 7,5 = 6 + 1,5 | 100 VA |
| Banheiro | até 6 m² | 100 VA |
| Área de serviço | até 6 m² | 100 VA |
| **Total** | | **560 VA** |

## Etapa 2: as tomadas

| Cômodo | Regra | Tomadas | Potência |
| --- | --- | --- | --- |
| Sala | 1 a cada 5 m: 13 = 5 + 5 + 3 | 3 | 3 × 100 = 300 VA |
| Quarto | 1 a cada 5 m: 12 = 5 + 5 + 2 | 3 | 3 × 100 = 300 VA |
| Cozinha | 1 a cada 3,5 m: 11 = 3,5 + 3,5 + 3,5 + 0,5 | 4 | 3 × 600 + 100 = 1.900 VA |
| Banheiro | 1 junto ao lavatório | 1 | 600 VA |
| Área de serviço | mínimo 1; prevemos 2 | 2 | 2 × 600 = 1.200 VA |
| **Total** | | **13** | **4.300 VA** |

Aparelho fixo (tomada de uso específico): **chuveiro de 5.500 W em 220 V**.

## Etapa 3: a potência total

O manual converte VA em W com fator de potência **1,0** para iluminação e **0,8** para tomadas de uso geral:

```conta
Iluminação: 560 × 1,0 = 560 W
Tomadas de uso geral: 4.300 × 0,8 = 3.440 W
Chuveiro: 5.500 W
Potência ativa total: 560 + 3.440 + 5.500 = 9.500 W
```

É com esse número que a distribuidora define o tipo de fornecimento e o disjuntor do padrão de entrada, pela norma dela.

## Etapa 4: dividir e dimensionar os circuitos

Iluminação separada das tomadas, chuveiro em circuito próprio e circuitos de uso geral até 10 A. Supondo até 3 circuitos juntos nos eletrodutos e o chuveiro sozinho no dele:

| Nº | Circuito | Potência | Corrente | Fio | Proteção |
| --- | --- | --- | --- | --- | --- |
| 1 | Iluminação (todos os cômodos) | 560 VA | 4,4 A | 1,5 mm² | disjuntor 10 A + DR 25 A |
| 2 | Tomadas: sala, quarto e banheiro | 1.200 VA | 9,4 A | 2,5 mm² | disjuntor 10 A + DR 25 A |
| 3 | Tomadas da cozinha (2 × 600) | 1.200 VA | 9,4 A | 2,5 mm² | disjuntor 10 A + DR 25 A |
| 4 | Tomadas da cozinha (600 + 100) | 700 VA | 5,5 A | 2,5 mm² | disjuntor 10 A + DR 25 A |
| 5 | Tomadas da área de serviço | 1.200 VA | 9,4 A | 2,5 mm² | disjuntor 10 A + DR 25 A |
| 6 | Chuveiro (220 V) | 5.500 W | 25 A | 4 mm² | disjuntor bipolar 30 A + DR 40 A |

Todos os circuitos levam **fio terra**. Os circuitos 1 e 2 levam DR porque passam pelo **banheiro**, um local com chuveiro; os 3, 4 e 5, por serem cozinha e área de serviço; o 6, por ser o chuveiro.

## Etapa 5: o circuito de distribuição

Nem tudo é ligado ao mesmo tempo. Por isso, para os fios que vêm do medidor, o manual aplica **fatores de demanda**. Para iluminação e tomadas de uso geral somadas entre 3.001 e 4.000 W, o fator é **0,59**; para um só circuito de uso específico, é **1,00**. No fim, divide-se pelo fator de potência médio de **0,95**.

```conta
Iluminação + tomadas: (560 + 3.440) × 0,59 = 4.000 × 0,59 = 2.360 W
Chuveiro: 5.500 × 1,00 = 5.500 W
Soma: 2.360 + 5.500 = 7.860 W
Potência do circuito de distribuição: 7.860 ÷ 0,95 ≈ 8.274 VA
Corrente (220 V, a maior tensão): 8.274 ÷ 220 ≈ 37,6 A
Tabela, 1 circuito no eletroduto: 6 mm² → 40 A
```

O circuito de distribuição fica com **fios de 6 mm²** (fases, neutro e terra) e **disjuntor bipolar de 40 A** no quadro.

## Etapa 6: a planta e o material

Com as quantidades definidas, desenha-se tudo na planta:

1. Marcar o **quadro**, em lugar de fácil acesso e perto do medidor.
2. Traçar os **eletrodutos** saindo do quadro pelo caminho mais curto até os pontos de luz, e de lá até interruptores e tomadas.
3. Representar os fios de cada eletroduto e o número do circuito. Ainda não há um acordo nacional sobre os símbolos: cada projeto usa os seus e explica numa **legenda**.
4. **Levantar o material**: medir os eletrodutos na planta, converter pela escala e somar as subidas e descidas até as caixas.

Para as descidas, o manual sugere estas alturas usuais de caixa, lembrando que a NBR 5410 não as fixa:

| Caixa | Altura do piso |
| --- | --- |
| Saída alta | 2,20 m |
| Interruptor e tomada média | 1,30 m |
| Quadro de distribuição | 1,20 m |
| Tomada baixa | 0,30 m |

Com pé-direito de 2,80 m e laje de 0,15 m, o eletroduto que desce da laje até uma tomada baixa mede 2,80 + 0,15 − 0,30 = **2,65 m**. Cada metro de eletroduto é também um metro de cada fio que passa por ele.

```escondido
Quem constrói a própria casa nem sempre sabe: a Lei nº 11.888, de 2008, garante às famílias com renda de até três salários mínimos, na cidade ou no campo, **assistência técnica pública e gratuita** para o projeto e a construção da própria moradia de interesse social. O direito inclui projeto, acompanhamento e execução da obra por profissionais de arquitetura e engenharia, na construção, reforma, ampliação ou regularização. Vale procurar a prefeitura e perguntar como ela cumpre essa lei.
```

```verificar
No projeto do exemplo, o circuito 1 tem só iluminação. Por que ele precisa de DR?
- Porque toda iluminação precisa de DR
+ Porque tem um ponto de luz no banheiro, local com chuveiro
- Porque a corrente dele passa de 10 A
> Olhe a lista de locais em que a norma exige DR.
```

## Exemplo resolvido

**A família quer acrescentar uma torneira elétrica de 4.500 W em 220 V na cozinha. O que muda no projeto?**

1. É um aparelho fixo acima de 10 A: precisa de **circuito próprio** (circuito 7).
2. Corrente: 4.500 ÷ 220 ≈ **20,5 A**.
3. Se passar com mais 2 circuitos no eletroduto (3 agrupados), a tabela dá: 4 mm² → 20 A (pouco); **6 mm² → 25 A**. Fio de **6 mm²**, disjuntor **bipolar de 25 A**.
4. Cozinha exige **DR**: com disjuntor de 25 A, interruptor DR de **25 A**.
5. O circuito de distribuição precisa ser **recalculado**, porque agora são dois circuitos de uso específico e a potência total subiu. Pode ser que os fios e o disjuntor do circuito de distribuição tenham de aumentar, e que a distribuidora precise rever o fornecimento.

## Resumo

- O projeto começa pelo **levantamento de cargas**: iluminação pela área, tomadas pelo perímetro e aparelhos fixos pela potência deles.
- Depois vem a **divisão em circuitos** e o **dimensionamento** de fios, disjuntores e DR, com a tabela e as seções mínimas.
- O **circuito de distribuição** usa fatores de demanda, porque nem tudo é ligado ao mesmo tempo.
- Tudo vai para a **planta** com legenda, e o material é levantado medindo pela escala.
- Famílias de baixa renda têm direito a **assistência técnica gratuita** para projetar e construir a própria casa (Lei 11.888/2008).

```leve
- Meça os cômodos da sua casa e faça o levantamento de iluminação e tomadas, como nas etapas 1 e 2. Compare com o que existe de verdade.
- Desenhe a planta da sua casa numa folha quadriculada, com cada quadrado valendo 50 cm, e marque onde estão o quadro, os pontos de luz e as tomadas.
```
