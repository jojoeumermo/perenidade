---
titulo: "Termoquímica"
resumo: "Objetivo: distinguir reações exotérmicas e endotérmicas, interpretar a variação de entalpia, comparar combustíveis e entender as calorias dos alimentos."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Chemistry 2e, seção 5.1, Energy Basics"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/5-1-energy-basics"
  - titulo: "Chemistry 2e, seção 5.2, Calorimetry"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/5-2-calorimetry"
  - titulo: "Chemistry 2e, seção 5.3, Enthalpy"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/5-3-enthalpy"
quiz:
  - pergunta: "O que é uma reação exotérmica?"
    opcoes: ["A que absorve calor do ambiente", "A que libera calor para o ambiente", "A que não envolve energia"]
    resposta: 1
    explicacao: "Toda combustão é exotérmica."
  - pergunta: "Qual é o sinal da variação de entalpia (ΔH) em uma reação exotérmica?"
    opcoes: ["Positivo", "Negativo", "Zero"]
    resposta: 1
    explicacao: "Os produtos ficam com menos energia que os reagentes; a diferença saiu como calor."
  - pergunta: "Quantas quilocalorias fornece, aproximadamente, 1 grama de gordura?"
    opcoes: ["4 kcal", "9 kcal", "1 kcal"]
    resposta: 1
    explicacao: "Carboidratos e proteínas fornecem cerca de 4 kcal por grama; gorduras, cerca de 9."
  - pergunta: "Por que o suor refresca o corpo?"
    opcoes: ["Porque a evaporação da água absorve calor da pele", "Porque o suor é gelado", "Porque a evaporação libera calor"]
    resposta: 0
    explicacao: "A evaporação é um processo endotérmico: precisa de calor, e o retira do corpo."
---

## Energia nas transformações

Toda reação química envolve **energia**. Romper ligações entre átomos **consome** energia; formar ligações novas **libera**. O saldo decide se a reação esquenta ou esfria o ambiente.

A **termoquímica** estuda essas trocas de calor. Ela se apoia em ideias da física, vistas em [Calor e temperatura](/trilhas/fisica-fundamental/calor-e-temperatura).

## Exotérmicas e endotérmicas

| | Exotérmica | Endotérmica |
| --- | --- | --- |
| O que faz | **libera** calor | **absorve** calor |
| O ambiente | esquenta | esfria |
| Exemplos | combustão, respiração, neutralização, cal virgem com água | fotossíntese, cozimento dos alimentos, bolsa de gelo instantâneo |

O mesmo vale para as mudanças de estado: a **evaporação** absorve calor (por isso o suor refresca e o álcool na pele dá sensação de frio); a **condensação** libera.

## Entalpia

A energia que uma substância guarda, medida a pressão constante, é a sua **entalpia** (H). O que interessa é a **variação** durante a reação:

**ΔH = H dos produtos − H dos reagentes**

- **ΔH negativo**: os produtos têm menos energia; a diferença foi **liberada**. Reação **exotérmica**.
- **ΔH positivo**: os produtos têm mais energia; a diferença foi **absorvida**. Reação **endotérmica**.

A unidade é o **quilojoule** (kJ), em geral por mol.

```conta
Combustão do metano (gás natural):
CH₄ + 2 O₂  →  CO₂ + 2 H₂O        ΔH = −890 kJ/mol

A queima de 1 mol de metano (16 g) libera 890 kJ.
```

A equação escrita com o valor de ΔH chama-se **equação termoquímica**. O valor vale para as quantidades da equação: queimar 2 mols libera o dobro.

## Calor e temperatura da água

Para saber quanto calor uma massa de água recebeu, usa-se:

**Q = m · c · Δt**

em que c é o **calor específico**. O da água é **1 cal/g·°C**, ou 4,18 J/g·°C: é preciso 1 caloria para aquecer 1 grama de água em 1 °C.

```conta
Aquecer 1 litro de água (1 000 g) de 25 °C até 100 °C:
Q = 1 000 × 1 × 75 = 75 000 cal = 75 kcal
em joules: 75 × 4,18 ≈ 314 kJ
```

É assim que se medem os calores de reação no laboratório: faz-se a reação dentro de um recipiente isolado, o **calorímetro**, e mede-se quanto a água em volta esquenta.

## Comparando combustíveis

| Combustível | Reação de combustão | ΔH (kJ/mol) | Energia por grama (kJ/g) |
| --- | --- | --- | --- |
| Hidrogênio, H₂ | H₂ + ½ O₂ → H₂O | −286 | 143 |
| Metano, CH₄ | CH₄ + 2 O₂ → CO₂ + 2 H₂O | −890 | 56 |
| Octano, C₈H₁₈ (gasolina) | 2 C₈H₁₈ + 25 O₂ → 16 CO₂ + 18 H₂O | −5 471 | 48 |
| Etanol, C₂H₆O | C₂H₆O + 3 O₂ → 2 CO₂ + 3 H₂O | −1 367 | 30 |

Duas leituras da tabela:

- **por grama**, o etanol libera menos energia que a gasolina. É por isso que o carro a álcool roda menos quilômetros por litro;
- o **hidrogênio** libera muita energia por grama e o único produto é água. A dificuldade está em produzi-lo e armazená-lo.

Mas a conta ambiental não termina na energia. O carbono do etanol foi retirado do ar pela cana, ao crescer; o da gasolina estava enterrado havia milhões de anos e é carbono novo na atmosfera. Veja em [Química ambiental](/trilhas/quimica-medio/quimica-ambiental).

```verificar
A dissolução de certo sal em água deixa o copo gelado. O que se pode afirmar?
- O processo é exotérmico e ΔH é negativo
+ O processo é endotérmico e ΔH é positivo
- Não há troca de energia
> Se o copo esfria, de onde saiu o calor, e para onde foi?
```

## As calorias dos alimentos

O corpo "queima" os alimentos na **respiração celular**, uma combustão lenta e controlada:

```conta
C₆H₁₂O₆ + 6 O₂  →  6 CO₂ + 6 H₂O        ΔH ≈ −2 800 kJ/mol

1 mol de glicose = 180 g
2 800 ÷ 180 ≈ 15,6 kJ por grama ≈ 3,7 kcal por grama
```

É daí que vem o valor arredondado dos rótulos.

| Nutriente | Energia por grama |
| --- | --- |
| Carboidratos | cerca de 4 kcal |
| Proteínas | cerca de 4 kcal |
| Gorduras | cerca de 9 kcal |

A "caloria" dos rótulos é, na verdade, a **quilocaloria** (kcal): 1 kcal = 1 000 cal = 4,18 kJ.

```conta
Um alimento com 20 g de carboidratos, 5 g de proteínas e 10 g de gorduras:
20 × 4 + 5 × 4 + 10 × 9 = 80 + 20 + 90 = 190 kcal
```

Caloria não é tudo: dois alimentos com a mesma energia podem ter valor nutritivo muito diferente. Veja [Alimentação e nutrição](/trilhas/biologia-fundamental/alimentacao-e-nutricao).

## A lei de Hess

Em 1840, o químico **Germain Hess** mostrou que a variação de entalpia de uma reação depende **só do estado inicial e do final**, e não do caminho. Se uma reação pode ser feita em etapas, o ΔH total é a **soma** dos ΔH das etapas.

É uma consequência da conservação da energia, e permite calcular o calor de reações difíceis de medir diretamente.

```conta
C + ½ O₂  →  CO           ΔH = −110,5 kJ
CO + ½ O₂  →  CO₂         ΔH = −283,0 kJ
somando:
C + O₂  →  CO₂            ΔH = −393,5 kJ
```

## Para praticar

1. Classifique em exotérmico ou endotérmico: queima de uma vela; derretimento do gelo; fotossíntese; condensação do vapor no vidro frio.
2. Quanta energia é liberada na queima de 64 g de metano?
3. Quantas quilocalorias são necessárias para aquecer 2 litros de água de 20 °C a 100 °C?
4. Calcule a energia de um alimento com 30 g de carboidratos, 10 g de proteínas e 5 g de gorduras.
