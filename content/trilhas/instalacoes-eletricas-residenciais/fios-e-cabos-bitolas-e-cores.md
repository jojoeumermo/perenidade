---
titulo: "Fios e cabos: bitolas e cores"
resumo: "A diferença entre fio e cabo, o que é a bitola em milímetros quadrados, as seções mínimas da NBR 5410, as cores obrigatórias do neutro e do terra e por que fio fino esquenta mais."
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
  - titulo: "College Physics 2e, seção 20.3, Resistance and Resistivity"
    autor: "Paul Peter Urone e Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/20-3-resistance-and-resistivity"
  - titulo: "Condutor elétrico"
    autor: "Wikipédia"
    url: "https://pt.wikipedia.org/wiki/Fio_el%C3%A9trico"
glossario:
  - termo: "bitola"
    definicao: "O nome popular da seção nominal do condutor: a área do metal, medida em milímetros quadrados (mm²)."
  - termo: "retorno"
    definicao: "O fio que vai do interruptor até a lâmpada. Ele só tem tensão quando o interruptor está ligado."
  - termo: "eletroduto"
    definicao: "O tubo, embutido na parede, na laje ou no piso, por onde passam os fios."
quiz:
  - pergunta: "Qual é a cor obrigatória do fio neutro?"
    opcoes: ["Preto", "Azul-claro", "Vermelho"]
    resposta: 1
    explicacao: "Quando o neutro é identificado por cor, ela tem de ser azul-clara."
  - pergunta: "Qual é a cor do fio terra (condutor de proteção)?"
    opcoes: ["Verde-amarelo ou só verde", "Branco", "Azul-claro"]
    resposta: 0
    explicacao: "O condutor de proteção é verde-amarelo ou verde. Essas cores não podem ser usadas para mais nada."
  - pergunta: "Qual é a seção mínima dos fios de um circuito de tomadas?"
    opcoes: ["1 mm²", "1,5 mm²", "2,5 mm²"]
    resposta: 2
    explicacao: "A NBR 5410 fixa 1,5 mm² para iluminação e 2,5 mm² para circuitos de força, que incluem as tomadas."
  - pergunta: "Por que, para a mesma corrente, um fio mais fino esquenta mais?"
    opcoes: ["Porque tem mais resistência", "Porque o fio fino puxa mais corrente", "Porque a tensão nele é maior"]
    resposta: 0
    explicacao: "A resistência cresce quando a área diminui. Com a mesma corrente, mais resistência significa mais calor (P = R × I²)."
---

```provocacao
Na loja, o rolo de fio de 1,5 mm² é mais barato que o de 2,5 mm². Se os dois "passam energia", por que não usar o mais barato em tudo?
```

## O que você vai aprender

Ao fim desta aula você vai saber a diferença entre fio e cabo, o que significa a bitola, quais são as seções mínimas da norma, quais cores são obrigatórias e por que a espessura do fio tem a ver com segurança.

## Fio e cabo

**Condutor elétrico** é o nome geral do que transporta corrente. Nas casas, o metal quase sempre é o **cobre**.

- **Fio** é um condutor **sólido**, maciço, com isolação por fora.
- **Cabo** é um condutor formado por **vários fios finos** reunidos.

A norma NBR NM 280 separa os condutores em classes de flexibilidade: a classe 1 é a dos fios sólidos, e as classes 2, 4, 5 e 6 são as dos cabos, mais flexíveis quanto maior a classe. Dentro dos eletrodutos, os fios passam por curvas e caixas até chegar à tomada ou ao ponto de luz. Por isso os **cabos flexíveis** (classe 5 ou mais) facilitam muito a enfiação e a retirada.

## A bitola

A **bitola**, ou seção nominal, é a área do cobre do condutor, em **milímetros quadrados** (mm²). As seções padronizadas mais usadas em casa são **1,5; 2,5; 4; 6; 10 e 16 mm²**.

A NBR 5410, a norma de instalações de baixa tensão, fixa as **seções mínimas**:

| Tipo de circuito | Seção mínima |
| --- | --- |
| Iluminação | 1,5 mm² |
| Força (tomadas e aparelhos) | 2,5 mm² |

A seção mínima é só o ponto de partida. Circuitos com corrente maior, como o do chuveiro, pedem fios mais grossos, e o cálculo aparece na aula de dimensionamento.

## Por que fio fino esquenta mais

A resistência de um fio depende do material, do comprimento e da área:

```formula
R = ρ × L ÷ A
ρ é a resistividade do material, L o comprimento e A a área do fio.
```

Quanto **menor a área**, **maior a resistência**. E o calor produzido num fio é P = R × I²: com a mesma corrente, o fio mais fino aquece mais. Fio fino demais para a corrente não "deixa de funcionar": ele esquenta, a isolação envelhece e pode derreter, e isso pode terminar em curto-circuito ou incêndio.

## As cores

A cor serve para que qualquer pessoa, anos depois, saiba o que é cada fio.

| Fio | Cor |
| --- | --- |
| **Neutro** | **azul-claro**, obrigatoriamente |
| **Proteção (terra)** | **verde-amarelo** ou **verde**, obrigatoriamente |
| Fase | outra cor, que não seja as do neutro e do terra |
| Retorno | outra cor, que não seja as do neutro e do terra |

O verde-amarelo é exclusivo do terra: um fio dessa cor nunca pode ser usado como fase ou neutro. Para fase e retorno a norma não fixa uma cor, e cada eletricista tem seu costume. Por isso vale anotar no quadro quais cores foram usadas.

## O fio terra pode ser mais fino?

Normalmente todos os fios de um circuito têm a mesma seção. A NBR 5410 permite um condutor de proteção menor só a partir de fases de 25 mm²:

| Fase (mm²) | Terra (mm²) |
| --- | --- |
| 1,5 a 16 | igual à fase |
| 25 e 35 | 16 |
| 50 | 25 |

Nas casas, quase sempre o terra tem a mesma bitola da fase.

```verificar
Ao abrir uma caixa de tomada antiga, você encontra três fios: um azul-claro, um verde-amarelo e um preto. Qual é a fase?
- O azul-claro
- O verde-amarelo
+ O preto
> Azul-claro é reservado ao neutro e verde-amarelo ao terra. Mesmo assim, antes de mexer, confira com o multímetro: em instalação antiga, nem sempre a regra foi seguida.
```

## Exemplo resolvido

**Um circuito tem 20 m de fio de cobre. Compare a resistência e o calor produzido com 15 A passando, se o fio for de 1,5 mm² ou de 2,5 mm².** A resistividade do cobre é 1,72 × 10⁻⁸ Ω·m, e 1 mm² = 1 × 10⁻⁶ m².

```conta
Fio de 1,5 mm²:
R = 1,72 × 10⁻⁸ × 20 ÷ (1,5 × 10⁻⁶) ≈ 0,23 Ω
P = R × I² = 0,23 × 15 × 15 ≈ 52 W

Fio de 2,5 mm²:
R = 1,72 × 10⁻⁸ × 20 ÷ (2,5 × 10⁻⁶) ≈ 0,14 Ω
P = 0,14 × 15 × 15 ≈ 31 W
```

Com a mesma corrente, o fio de 1,5 mm² gera cerca de 52 W de calor espalhado dentro da parede, contra uns 31 W do de 2,5 mm². É energia perdida, paga na conta, e calor que a isolação precisa aguentar.

## Resumo

- **Fio** é sólido; **cabo** é feito de vários fios e é mais flexível. Cabos flexíveis facilitam a enfiação.
- A **bitola** é a área do cobre em mm².
- Seções mínimas da NBR 5410: **1,5 mm²** para iluminação e **2,5 mm²** para tomadas e aparelhos.
- **Neutro azul-claro**; **terra verde-amarelo ou verde**; fase e retorno com outras cores.
- Fio mais fino tem mais resistência e esquenta mais com a mesma corrente.

```leve
- Na próxima vez que passar por uma loja de material elétrico, leia a etiqueta de um rolo: seção em mm², tensão de isolação e se é fio ou cabo.
- Ao trocar uma tomada em casa (com o disjuntor desligado), observe as cores dos fios e veja se seguem a norma.
```
