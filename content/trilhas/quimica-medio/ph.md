---
titulo: "pH"
resumo: "Objetivo: entender o que a escala de pH mede, calcular o pH de soluções simples de ácidos e bases fortes e reconhecer a importância do pH no corpo, no solo e no ambiente."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Chemistry 2e, seção 14.2, pH and pOH"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh"
  - titulo: "Chemistry 2e, seção 14.3, Relative Strengths of Acids and Bases"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/14-3-relative-strengths-of-acids-and-bases"
  - titulo: "Chemistry 2e, seção 14.6, Buffers"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/14-6-buffers"
quiz:
  - pergunta: "O que o pH mede?"
    opcoes: ["A temperatura da solução", "A concentração de íons H⁺ na solução", "A quantidade de sal"]
    resposta: 1
    explicacao: "Quanto mais H⁺, menor o pH e mais ácida a solução."
  - pergunta: "Qual é o pH de uma solução com concentração de H⁺ igual a 10⁻³ mol/L?"
    opcoes: ["3", "−3", "11"]
    resposta: 0
    explicacao: "pH = −log [H⁺]. Se [H⁺] = 10⁻³, o pH é 3."
  - pergunta: "Uma solução de pH 2 é quantas vezes mais ácida que uma de pH 4?"
    opcoes: ["2 vezes", "100 vezes", "20 vezes"]
    resposta: 1
    explicacao: "Cada unidade de pH corresponde a um fator de 10: duas unidades, 10 × 10."
  - pergunta: "O que faz uma solução-tampão?"
    opcoes: ["Impede qualquer reação", "Resiste a variações de pH quando recebe pequenas quantidades de ácido ou de base", "Torna qualquer solução neutra"]
    resposta: 1
    explicacao: "O sangue é tamponado: o seu pH se mantém em uma faixa muito estreita."
---

## Um número para a acidez

Na aula [Ácidos e bases em casa](/trilhas/quimica-fundamental/acidos-e-bases-em-casa), a escala de pH apareceu como uma régua de 0 a 14. Agora vamos ver **o que ela mede** e **de onde vêm os números**. Convém ter visto [Funções inorgânicas](/trilhas/quimica-medio/funcoes-inorganicas).

## A água se ioniza

Mesmo a água mais pura não é feita só de moléculas H₂O. Uma parte minúscula delas se separa em íons:

**H₂O ⇌ H⁺ + OH⁻**

É um [equilíbrio](/trilhas/quimica-medio/cinetica-e-equilibrio-quimico), muito deslocado para a esquerda. Na água pura, a 25 °C, as concentrações são:

**[H⁺] = [OH⁻] = 10⁻⁷ mol/L**

(Os colchetes indicam concentração em mol por litro.)

O produto das duas concentrações é constante a 25 °C:

**[H⁺] · [OH⁻] = 10⁻¹⁴**

Isso vale para qualquer solução aquosa. Se uma concentração sobe, a outra desce.

| Solução | [H⁺] | [OH⁻] |
| --- | --- | --- |
| Ácida | maior que 10⁻⁷ | menor que 10⁻⁷ |
| Neutra | igual a 10⁻⁷ | igual a 10⁻⁷ |
| Básica | menor que 10⁻⁷ | maior que 10⁻⁷ |

## A definição de pH

Trabalhar com números como 0,0000001 é incômodo. Em 1909, o dinamarquês **Søren Sørensen**, que pesquisava em uma cervejaria, propôs usar apenas o **expoente**, com o sinal trocado:

**pH = −log [H⁺]**

Quando a concentração é uma potência exata de 10, o pH é o expoente sem o sinal de menos:

| [H⁺] em mol/L | pH | Caráter |
| --- | --- | --- |
| 10⁻¹ | 1 | muito ácido |
| 10⁻³ | 3 | ácido |
| 10⁻⁷ | 7 | neutro |
| 10⁻¹¹ | 11 | básico |
| 10⁻¹³ | 13 | muito básico |

Do mesmo jeito se define o **pOH = −log [OH⁻]**, e, a 25 °C:

**pH + pOH = 14**

## A escala é logarítmica

Cada unidade de pH corresponde a um fator de **dez** na concentração de H⁺.

- pH 3 é **10 vezes** mais ácido que pH 4.
- pH 3 é **100 vezes** mais ácido que pH 5.
- pH 3 é **1 000 vezes** mais ácido que pH 6.

Uma diferença que parece pequena no número é enorme na prática. Uma chuva de pH 4 é dez vezes mais ácida que uma de pH 5.

## Calculando

Para **ácidos e bases fortes**, que se separam totalmente em íons, a conta é direta.

```conta
Ácido clorídrico (HCl) a 0,01 mol/L:
[H⁺] = 0,01 = 10⁻² mol/L
pH = 2

Hidróxido de sódio (NaOH) a 0,01 mol/L:
[OH⁻] = 10⁻² mol/L
pOH = 2
pH = 14 − 2 = 12
```

E o que acontece ao **diluir**? Veja em [Soluções e concentração](/trilhas/quimica-medio/solucoes-e-concentracao).

```conta
O mesmo HCl diluído 10 vezes:
[H⁺] = 0,001 = 10⁻³ mol/L
pH = 3
```

Diluir dez vezes um ácido forte faz o pH subir **uma unidade**.

Para os **ácidos fracos**, como o acético do vinagre, só uma pequena parte das moléculas libera H⁺. O pH é mais alto do que seria para um ácido forte na mesma concentração, e o cálculo exige a constante de equilíbrio do ácido.

```verificar
Uma solução tem pH 9. Qual é o seu pOH e o seu caráter?
- pOH 9, ácida
+ pOH 5, básica
- pOH 5, ácida
> pH + pOH = 14. E pH acima de 7 indica o quê?
```

## Como se mede

- **Indicadores**: substâncias que mudam de cor conforme o pH. A fenolftaleína é incolor em meio ácido e rosa em meio básico. O extrato de repolho roxo passa por várias cores.
- **Papel indicador universal**: tira que muda de cor; compara-se com uma escala.
- **pHmetro**: aparelho eletrônico, de leitura precisa.

## Tampões: o pH sob controle

Uma **solução-tampão** resiste a mudanças de pH quando recebe pequenas quantidades de ácido ou de base. É formada, em geral, por um ácido fraco e um sal desse ácido: um neutraliza a base que entrar; o outro, o ácido.

O **sangue** é o exemplo mais importante. O seu pH fica perto de **7,4**, em uma faixa muito estreita, graças principalmente ao par formado pelo ácido carbônico e pelo bicarbonato. Um desvio de poucos décimos já é uma emergência médica. A respiração participa do controle: ao eliminar gás carbônico, o corpo regula a quantidade de ácido carbônico no sangue.

## O pH no dia a dia

### No corpo

| Local | pH aproximado |
| --- | --- |
| Estômago | 1 a 2 |
| Pele | levemente ácido |
| Sangue | 7,4 |
| Intestino delgado | levemente básico |

Cada enzima funciona em uma faixa de pH. As do estômago precisam do meio ácido; as do intestino, do básico.

### No solo

O pH do solo decide quais nutrientes as plantas conseguem absorver. Muitos solos brasileiros são naturalmente **ácidos**. A correção se faz com a **calagem**: a aplicação de calcário moído, que neutraliza a acidez.

Cada cultura tem a sua faixa preferida, e a análise do solo indica a quantidade certa de calcário. Para o pequeno agricultor, o acesso a essa análise e à assistência técnica pública faz diferença direta na colheita.

### Na água

A água de abastecimento tem o pH controlado no tratamento: água ácida demais corrói a tubulação. Nos rios e lagos, a maioria dos peixes vive em uma faixa estreita, próxima da neutralidade.

### Na chuva

A chuva normal já é levemente ácida, com pH em torno de 5,6, porque o gás carbônico do ar se dissolve nela e forma ácido carbônico. Quando o ar contém óxidos de enxofre e de nitrogênio, vindos da queima de combustíveis, formam-se ácidos fortes, e o pH cai abaixo de 5: é a **chuva ácida**, que danifica plantações, florestas, lagos e construções. Veja [Química ambiental](/trilhas/quimica-medio/quimica-ambiental).

## Para praticar

1. Calcule o pH de uma solução de HCl a 0,0001 mol/L.
2. Calcule o pH de uma solução de NaOH a 0,001 mol/L.
3. Quantas vezes um suco de limão (pH 2) é mais ácido que um café (pH 5)?
4. Prepare um indicador com repolho roxo fervido e teste vinagre, água com bicarbonato e água com sabão. Anote as cores e ordene as soluções da mais ácida para a mais básica.
