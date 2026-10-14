---
titulo: "Química analítica"
resumo: "Objetivo: entender como a química descobre o que há em uma amostra e em que quantidade: titulação, gravimetria, espectrofotometria e cromatografia, com atenção a erros, precisão e controle de qualidade."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Chemistry 2e, seção 1.5, Measurement Uncertainty, Accuracy, and Precision"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/1-5-measurement-uncertainty-accuracy-and-precision"
  - titulo: "Chemistry 2e, seção 4.5, Quantitative Chemical Analysis"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/4-5-quantitative-chemical-analysis"
  - titulo: "Chemistry 2e, seção 14.7, Acid-Base Titrations"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/14-7-acid-base-titrations"
quiz:
  - pergunta: "Qual é a diferença entre exatidão e precisão?"
    opcoes: ["São a mesma coisa", "Exatidão é a proximidade do valor verdadeiro; precisão é a concordância entre medidas repetidas", "Precisão é a proximidade do valor verdadeiro"]
    resposta: 1
    explicacao: "Uma balança mal calibrada pode dar resultados muito precisos e pouco exatos."
  - pergunta: "Em uma titulação, 20,0 mL de NaOH 0,100 mol/L neutralizam 25,0 mL de HCl. Qual é a concentração do HCl?"
    opcoes: ["0,125 mol/L", "0,0800 mol/L", "0,100 mol/L"]
    resposta: 1
    explicacao: "n(NaOH) = 0,0200 × 0,100 = 0,00200 mol = n(HCl); c = 0,00200 ÷ 0,0250 = 0,0800 mol/L."
  - pergunta: "O que diz a lei de Beer-Lambert?"
    opcoes: ["A absorbância de uma solução é proporcional à concentração da espécie que absorve a luz", "Toda solução é transparente", "A cor não depende da concentração"]
    resposta: 0
    explicacao: "A = ε·b·c. É a base da espectrofotometria."
  - pergunta: "Para que serve a cromatografia?"
    opcoes: ["Para separar os componentes de uma mistura", "Para medir a temperatura", "Para produzir cores"]
    resposta: 0
    explicacao: "Os componentes andam com velocidades diferentes através de uma fase estacionária."
---

## As duas perguntas

A **química analítica** responde a duas perguntas sobre uma amostra:

- **o que** há nela? (análise **qualitativa**)
- **quanto** há? (análise **quantitativa**)

Ela está por trás do laudo da água da torneira, do exame de sangue, do teste antidoping, da fiscalização de alimentos e combustíveis, da perícia criminal e do monitoramento de rios contaminados.

## Medir bem

Nenhuma medida é perfeita. Dois conceitos são essenciais:

- **exatidão**: o quanto o resultado se aproxima do valor verdadeiro;
- **precisão**: o quanto medidas repetidas concordam entre si.

Pense em quatro dardos no alvo: todos juntos no centro (preciso e exato), todos juntos fora do centro (preciso, mas inexato: há um erro sistemático, como uma balança descalibrada), espalhados em volta do centro (exato na média, pouco preciso).

| Tipo de erro | Causa | Como reduzir |
| --- | --- | --- |
| **Sistemático** | instrumento descalibrado, método falho | calibrar, usar padrões, comparar métodos |
| **Aleatório** | flutuações imprevisíveis | repetir a medida e usar a média |

Os **algarismos significativos** indicam a confiança de uma medida. Escrever 25,0 mL diz que o volume foi medido até o décimo de mililitro; escrever 25 mL, não.

## Titulação

Na **titulação** (ou volumetria), mede-se o volume de uma solução de concentração **conhecida** (o titulante) necessário para reagir completamente com a substância que se quer dosar.

O ponto em que as quantidades se equivalem, segundo a equação química, é o **ponto de equivalência**. Ele é percebido por um **indicador**, que muda de cor, ou por um medidor de pH.

```conta
25,0 mL de HCl de concentração desconhecida, titulados com NaOH 0,100 mol/L.
Gastaram-se 20,0 mL de NaOH.
HCl + NaOH → NaCl + H₂O   (proporção 1 : 1)
n(NaOH) = 0,0200 L × 0,100 mol/L = 0,00200 mol
n(HCl) = 0,00200 mol
c(HCl) = 0,00200 mol ÷ 0,0250 L = 0,0800 mol/L
```

A curva de titulação (pH × volume adicionado) mostra uma subida brusca perto do ponto de equivalência. A escolha do indicador depende do pH em que essa subida acontece. Veja as bases em [pH](/trilhas/quimica-medio/ph).

Também se titulam oxidantes e redutores, íons metálicos (como o cálcio e o magnésio que dão a "dureza" da água) e muitas outras espécies.

## Gravimetria

Na **gravimetria**, a substância de interesse é convertida em um sólido pouco solúvel e de composição conhecida, que é filtrado, seco e **pesado**. Pela massa do precipitado e pela [estequiometria](/trilhas/quimica-medio/mol-e-estequiometria), calcula-se quanto havia na amostra. É lenta, mas muito exata.

```verificar
Em uma gravimetria, parte do precipitado passou pelo filtro e se perdeu. O que acontece com o resultado?
+ Fica abaixo do valor verdadeiro: é um erro sistemático
- Fica acima do valor verdadeiro
- Não muda, porque a média corrige
> A perda acontece sempre no mesmo sentido. Repetir a análise do mesmo jeito resolve?
```

## Espectrofotometria

Muitas substâncias absorvem luz em certos comprimentos de onda. Um **espectrofotômetro** mede quanta luz uma solução absorve. Vale a **lei de Beer-Lambert**:

**A = ε · b · c**

- A: absorbância (medida pelo aparelho);
- ε: absortividade molar (característica da substância naquele comprimento de onda);
- b: caminho da luz na solução (em geral, 1 cm);
- c: concentração.

Na prática, prepara-se uma **curva de calibração** com padrões de concentração conhecida, mede-se a absorbância da amostra e lê-se a concentração na curva. É assim que muitos laboratórios dosam glicose, ferro, fosfato ou nitrato.

## Cromatografia

A **cromatografia** separa os componentes de uma mistura. A amostra é carregada por uma **fase móvel** (um líquido ou um gás) através de uma **fase estacionária** (papel, um pó em uma coluna, uma película dentro de um tubo). Cada componente interage de modo diferente com a fase estacionária e anda com velocidade diferente.

A versão mais simples se faz em casa: uma mancha de caneta em papel-filtro, com a ponta mergulhada em álcool, separa-se em várias cores. Nos laboratórios, a cromatografia gasosa e a líquida, acopladas a detectores, identificam e medem traços de agrotóxicos em alimentos, drogas no sangue ou poluentes na água.

## Controle de qualidade e interesse público

Um resultado analítico só vale se o método for **validado**, os padrões **rastreáveis** e o laboratório **auditado**. Laboratórios públicos de vigilância sanitária e ambiental são os que verificam se a água, os alimentos e os remédios cumprem as normas. Sem eles, as normas ficam no papel.

Comunidades atingidas por contaminação muitas vezes precisam de análises independentes para provar o que sofrem. Saber ler um laudo (o que foi medido, por qual método, com que limite de detecção, comparado a qual valor máximo permitido) é uma ferramenta de luta.

## Para praticar

1. 10,0 mL de vinagre são titulados com NaOH 0,500 mol/L e gastam 13,3 mL. Qual é a concentração de ácido acético em mol/L?
2. Dê um exemplo de erro sistemático e um de erro aleatório em uma pesagem.
3. Uma solução tem absorbância 0,40; outra, da mesma substância e na mesma cubeta, 0,20. Como se comparam as concentrações?
4. Faça a cromatografia de canetas em papel-filtro. Quais cores tinham mais de um pigmento?
