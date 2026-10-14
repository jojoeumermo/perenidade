---
titulo: "Termodinâmica química"
resumo: "Objetivo: usar entalpia, entropia e energia livre de Gibbs para prever se uma reação é espontânea, relacionar a energia livre com a constante de equilíbrio e distinguir espontaneidade de velocidade."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Chemistry 2e, seção 16.1, Spontaneity"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/16-1-spontaneity"
  - titulo: "Chemistry 2e, seção 16.2, Entropy"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/16-2-entropy"
  - titulo: "Chemistry 2e, seção 16.4, Free Energy"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/16-4-free-energy"
  - titulo: "Chemistry 2e, seção 13.3, Shifting Equilibria: Le Châtelier's Principle"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/13-3-shifting-equilibria-le-chateliers-principle"
quiz:
  - pergunta: "Qual é o critério de espontaneidade a temperatura e pressão constantes?"
    opcoes: ["ΔH negativo", "ΔG negativo", "ΔS negativo"]
    resposta: 1
    explicacao: "ΔG = ΔH − T·ΔS. Só o sinal de ΔG decide."
  - pergunta: "Uma reação com ΔH positivo e ΔS positivo é espontânea:"
    opcoes: ["Em qualquer temperatura", "Em temperaturas altas", "Em nenhuma temperatura"]
    resposta: 1
    explicacao: "Em temperatura alta, o termo −T·ΔS vence o ΔH positivo. É o caso da fusão do gelo."
  - pergunta: "Se ΔG° de uma reação é muito negativo, o que se pode dizer da constante de equilíbrio K?"
    opcoes: ["K é muito menor que 1", "K é muito maior que 1: no equilíbrio, predominam os produtos", "K é igual a zero"]
    resposta: 1
    explicacao: "ΔG° = −R·T·ln K."
  - pergunta: "O diamante se transforma espontaneamente em grafite (ΔG < 0). Por que os diamantes duram?"
    opcoes: ["Porque a reação é extremamente lenta à temperatura ambiente", "Porque ΔG é positivo", "Porque o diamante não tem entropia"]
    resposta: 0
    explicacao: "Espontaneidade não diz nada sobre velocidade: isso é assunto da cinética."
---

## A pergunta central

Por que algumas reações acontecem sozinhas e outras não? O ferro enferruja, mas a ferrugem não volta a ser ferro. O sal se dissolve na água, mas não se separa sozinho. A **termodinâmica química** responde com três grandezas: **entalpia**, **entropia** e **energia livre**.

Esta aula supõe [Termoquímica](/trilhas/quimica-medio/termoquimica) e [Termodinâmica e física estatística](/trilhas/fisica-superior/termodinamica-e-fisica-estatistica).

## Processo espontâneo

Um processo **espontâneo** ocorre sem intervenção externa contínua, uma vez iniciado. **Espontâneo não quer dizer rápido**: a transformação do diamante em grafite é espontânea, mas leva um tempo incomensurável à temperatura ambiente.

Liberar calor ajuda, mas não basta: o gelo derrete espontaneamente a 10 °C **absorvendo** calor. Falta considerar a entropia.

## Entropia

A **entropia** (S) mede a dispersão da energia e da matéria, ou, na leitura de Boltzmann, o número de microestados de um sistema.

Em geral, a entropia **aumenta** quando:

- um sólido funde ou um líquido evapora (S gás > S líquido > S sólido);
- um sólido se dissolve;
- uma reação produz **mais mols de gás** do que consome;
- a temperatura sobe.

A **segunda lei**: em um processo espontâneo, a entropia do **universo** (sistema mais vizinhança) aumenta. A **terceira lei**: a entropia de um cristal perfeito no zero absoluto é zero, o que permite tabelar entropias absolutas (S°) para cada substância.

## A energia livre de Gibbs

Acompanhar a entropia da vizinhança é incômodo. O estadunidense **Josiah Willard Gibbs**, no século XIX, mostrou que, a temperatura e pressão constantes, basta olhar para o sistema com uma única grandeza, a **energia livre**:

**ΔG = ΔH − T·ΔS**

| ΔG | A reação, nas condições dadas |
| --- | --- |
| negativo | é espontânea |
| zero | está em equilíbrio |
| positivo | não é espontânea (a inversa é) |

### Os quatro casos

| ΔH | ΔS | Espontânea? | Exemplo |
| --- | --- | --- | --- |
| − | + | em qualquer temperatura | combustões |
| + | − | em nenhuma temperatura | — |
| − | − | em temperaturas baixas | congelamento da água; síntese da amônia |
| + | + | em temperaturas altas | fusão do gelo; decomposição do calcário |

```conta
Fusão do gelo: ΔH = +6,01 kJ/mol; ΔS = +22,0 J/(mol·K)
a 10 °C (283 K): ΔG = 6 010 − 283 × 22,0 = 6 010 − 6 226 = −216 J/mol   (espontânea)
a −10 °C (263 K): ΔG = 6 010 − 263 × 22,0 = 6 010 − 5 786 = +224 J/mol   (não espontânea)
equilíbrio: T = ΔH ÷ ΔS = 6 010 ÷ 22,0 ≈ 273 K   (0 °C)
```

A conta reencontra o ponto de fusão da água.

```verificar
A decomposição do calcário, CaCO₃ → CaO + CO₂, tem ΔH positivo e ΔS positivo (forma-se um gás). O que se conclui?
- É espontânea em qualquer temperatura
+ Só é espontânea acima de certa temperatura, por isso os fornos de cal trabalham muito quentes
- Nunca é espontânea
> Com ΔH > 0 e ΔS > 0, o termo −T·ΔS precisa ser grande o bastante para vencer o ΔH.
```

## Energia livre e equilíbrio

A energia livre padrão (ΔG°, com todas as substâncias em condições padrão) se liga à [constante de equilíbrio](/trilhas/quimica-medio/cinetica-e-equilibrio-quimico):

**ΔG° = −R·T·ln K**

- ΔG° muito negativo → K muito grande: no equilíbrio, quase só produtos;
- ΔG° muito positivo → K muito pequeno: quase só reagentes;
- ΔG° próximo de zero → reagentes e produtos em quantidades comparáveis.

### O caso da amônia

```conta
N₂ + 3 H₂ ⇌ 2 NH₃     ΔH° = −92,2 kJ     ΔS° ≈ −199 J/K
a 298 K: ΔG° = −92,2 − 298 × (−0,199) = −92,2 + 59,3 ≈ −32,9 kJ
K = e^(32 900 ÷ (8,314 × 298)) ≈ e^13,3, da ordem de 10⁵
```

À temperatura ambiente, a reação é espontânea e muito favorável. Mas é **lentíssima**. Para acelerá-la, a indústria trabalha a centenas de graus e usa catalisador, mesmo sabendo que, com ΔS negativo, o aumento de temperatura **reduz** K. Compensa-se com pressão alta. É o compromisso entre termodinâmica e cinética que estrutura o processo Haber-Bosch.

## Energia livre na vida

As células fazem reações não espontâneas (construir proteínas, bombear íons) **acoplando-as** a reações muito espontâneas, sobretudo a quebra do **ATP**. Se a soma dos ΔG for negativa, o conjunto anda. Veja em [Metabolismo](/trilhas/biologia-medio/metabolismo-respiracao-e-fotossintese).

## Para praticar

1. Classifique quanto à espontaneidade: ΔH = −100 kJ e ΔS = −200 J/K, a 300 K e a 700 K.
2. Uma reação tem ΔH = +50 kJ e ΔS = +100 J/K. Acima de que temperatura ela é espontânea?
3. Preveja o sinal de ΔS para: 2 H₂(g) + O₂(g) → 2 H₂O(l).
4. Se K = 1 a certa temperatura, quanto vale ΔG°?
