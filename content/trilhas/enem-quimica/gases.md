---
titulo: "Estudo dos gases"
resumo: "Pressão, volume e temperatura de um gás, por que a temperatura vai em kelvin, as leis de Boyle, Charles e Gay-Lussac, a equação dos gases ideais (PV = nRT) e o volume molar."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Chemistry 2e, seção 9.1, Gas Pressure"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/9-1-gas-pressure"
  - titulo: "Chemistry 2e, seção 9.2, Relating Pressure, Volume, Amount, and Temperature: The Ideal Gas Law"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/9-2-relating-pressure-volume-amount-and-temperature-the-ideal-gas-law"
  - titulo: "Chemistry 2e, seção 9.5, The Kinetic-Molecular Theory"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/9-5-the-kinetic-molecular-theory"
  - titulo: "Provas e gabaritos do Enem (as provas de 2022 e 2023, base da contagem do instituto)"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "25 °C correspondem a quantos kelvin?"
    opcoes: ["248 K", "25 K", "298 K", "273 K"]
    resposta: 2
    explicacao: "Kelvin = graus Celsius + 273. Então 25 + 273 = 298 K."
  - pergunta: "Mantendo a temperatura, a pressão de um gás dobra. O volume"
    opcoes: ["cai pela metade", "dobra", "fica igual", "quadruplica"]
    resposta: 0
    explicacao: "Lei de Boyle: com temperatura constante, pressão e volume são inversamente proporcionais. P · V fica constante."
  - pergunta: "Na equação P · V = n · R · T, com R = 0,082 atm·L/(mol·K), o volume vai em"
    opcoes: ["mililitros", "metros cúbicos", "centímetros cúbicos", "litros"]
    resposta: 3
    explicacao: "As unidades de R mandam: atm, L, mol e K. Volume em litros, pressão em atm e temperatura em kelvin."
  - pergunta: "Um balão cheio de ar é posto no congelador e murcha. Por quê?"
    opcoes: ["O ar escapa pela borracha", "Com o frio, as partículas se movem mais devagar e o gás ocupa menos volume", "O frio transforma o ar em água", "A borracha encolhe sozinha"]
    resposta: 1
    explicacao: "Lei de Charles: com pressão constante, o volume é proporcional à temperatura em kelvin. Menos temperatura, menos agitação das partículas, menos volume."
---

```provocacao
Antes de viajar, o borracheiro calibra o pneu "a frio". Depois de duas horas de estrada, se você medir de novo, a pressão está maior. Ninguém pôs ar. De onde veio a pressão a mais?
```

## O que você vai aprender

Ao fim desta aula você vai saber o que é a pressão de um gás, por que a temperatura vai em kelvin, usar as leis de Boyle, Charles e Gay-Lussac, resolver problemas com a equação dos gases ideais e usar o volume molar.

## O que é um gás, por dentro

Um gás é feito de partículas muito afastadas umas das outras, que andam em todas as direções, depressa, e batem nas paredes do recipiente. É o modelo da **teoria cinética**.

- A **pressão** é o efeito dessas batidas: força sobre a área da parede. Mais batidas, ou batidas mais fortes, dão mais pressão.
- A **temperatura** mede a agitação das partículas. Gás quente tem partículas mais rápidas.
- O **volume** é o espaço que o gás ocupa: o do recipiente inteiro, porque gás se espalha.
- A **quantidade** (n, em mols) é quantas partículas há.

Essas quatro grandezas estão ligadas. Mexeu numa, outra muda.

## Por que kelvin

A escala Kelvin começa no zero absoluto, a temperatura em que a agitação seria a menor possível. Não existe temperatura em kelvin negativa. Por isso as leis dos gases só funcionam em kelvin: dobrar a temperatura em kelvin dobra a agitação; dobrar em Celsius, não.

```formula
T (K) = T (°C) + 273
temperatura em kelvin = temperatura em graus Celsius mais 273
```

## As três leis com uma grandeza parada

- **Lei de Boyle** (temperatura constante): pressão e volume são inversos. Aperte uma seringa tampada: o volume cai e a pressão sobe. P₁ · V₁ = P₂ · V₂.
- **Lei de Charles** (pressão constante): volume e temperatura são diretos. Balão no sol cresce; no congelador, murcha. V₁ ÷ T₁ = V₂ ÷ T₂.
- **Lei de Gay-Lussac** (volume constante): pressão e temperatura são diretas. Pneu quente, pressão maior. P₁ ÷ T₁ = P₂ ÷ T₂.

As três cabem numa só, a **equação geral dos gases**, para uma mesma quantidade de gás:

```formula
P₁ · V₁ ÷ T₁ = P₂ · V₂ ÷ T₂
pressão vezes volume, dividido pela temperatura em kelvin, fica constante para a mesma quantidade de gás
o que não mudou se cancela dos dois lados
```

## A equação dos gases ideais

Quando a pergunta envolve a quantidade de gás, usa-se a equação de Clapeyron:

```formula
P · V = n · R · T
pressão (atm) × volume (L) = mols × constante dos gases × temperatura (K)
R = 0,082 atm·L/(mol·K); as unidades de R decidem as unidades das outras grandezas
```

Dela sai o **volume molar**: a 0 °C (273 K) e 1 atm, 1 mol de qualquer gás ocupa V = 1 × 0,082 × 273 ÷ 1 ≈ 22,4 L. Repare: qualquer gás. O volume não depende de qual gás é, só de quantas partículas há.

A equação vale para um modelo, o **gás ideal**: partículas sem tamanho e que não se atraem. Os gases reais chegam perto disso em pressões baixas e temperaturas altas. Sob pressão muito alta ou frio intenso, as partículas ficam próximas, passam a se atrair e o gás pode virar líquido. É assim que o gás de cozinha fica líquido dentro do botijão.

Gases diferentes têm massas molares diferentes, e isso muda a densidade. Gás de massa molar menor que a do ar (cerca de 29 g/mol, numa média de nitrogênio e oxigênio) sobe, como o hélio (4 g/mol). Gás de massa maior desce, como o gás de cozinha (propano, 44; butano, 58).

```navidareal
Volte ao pneu da provocação. Rodando, a borracha esquenta pelo atrito e aquece o ar de dentro. O volume do pneu quase não muda. Pela lei de Gay-Lussac, se a temperatura em kelvin sobe, a pressão sobe junto.

Por isso o fabricante manda calibrar com o pneu frio. Calibrar quente, tirando ar até o valor da tabela, deixa o pneu murcho quando esfriar.
```

```verificar
Uma seringa tampada tem 20 mL de ar. Empurrando o êmbolo, sem mudar a temperatura, o volume vai a 10 mL. A pressão
- cai pela metade
+ dobra
- não muda
> Boyle: com temperatura constante, P · V é constante. Se o volume cai pela metade, a pressão dobra.
```

## Exemplo resolvido

**Quantos mols de gás há num tanque de 8,2 L a 27 °C e 3 atm? (R = 0,082 atm·L/(mol·K))**

1. Temperatura em kelvin: 27 + 273 = 300 K.
2. Isole n: n = P · V ÷ (R · T).
3. Substitua: n = 3 × 8,2 ÷ (0,082 × 300) = 24,6 ÷ 24,6.
4. n = 1 mol.

Confira: 1 mol a 0 °C e 1 atm ocuparia 22,4 L. Aqui a pressão é o triplo, o que espreme o gás a um terço, mas a temperatura é um pouco maior. 22,4 ÷ 3 ≈ 7,5 L, perto dos 8,2 L. Faz sentido.

## Como isso cai no ENEM

- **Formatos:** um reator, um pneu, uma panela de pressão, um airbag, um mergulho, um balão. A questão dá a constante R e pede a pressão, o volume, a temperatura ou a quantidade de gás, ou pede para explicar um fenômeno (o pneu quente, o balão que sobe).
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, as transformações químicas (gases, modelos atômicos, tabela periódica, reações) tiveram 1 das 89 questões classificadas de Ciências da Natureza (1,1%), e ela foi deste tópico: em 2023, a pressão de um gás num recipiente de 100 mL aquecido a 650 °C, com a equação P · V = n · R · T. São só duas edições: é tendência, não promessa.
- **Habilidades:** H21 (usar leis da física ou da química para interpretar processos térmicos), que teve 5 das 89 questões de Natureza nessa base, e H17 (relacionar informações em texto, tabela ou fórmula), com 6.
- **Armadilhas:**
  - Usar graus Celsius na equação. Sempre kelvin.
  - Usar mililitros com R em L. 100 mL são 0,1 L.
  - Achar que o volume molar depende do gás.
  - Trocar direto por inverso: na lei de Boyle, mais pressão é menos volume.

## Questão comentada

**Texto-base.** Um motorista de aplicativo calibrou os pneus a 2,0 atm com eles frios, a 27 °C. Depois de rodar muito numa tarde quente, mediu de novo: o ar dentro do pneu estava a 57 °C. Considere que o volume do pneu não mudou e que não entrou nem saiu ar.

**Comando.** A pressão do pneu, quente, era de

A) 4,2 atm.
B) 2,2 atm.
C) 2,0 atm.
D) 1,8 atm.
E) 2,6 atm.

**Resolução.**

1. Temperaturas em kelvin: 27 + 273 = 300 K e 57 + 273 = 330 K.
2. Volume constante: P₁ ÷ T₁ = P₂ ÷ T₂ (Gay-Lussac).
3. P₂ = 2,0 × 330 ÷ 300 = 2,0 × 1,1 = 2,2 atm.

**Gabarito: B.**

**Por que as outras não:**

- A) Você usou graus Celsius: 2,0 × 57 ÷ 27 ≈ 4,2. Com Celsius, a proporção sai errada.
- C) A temperatura subiu com o volume fixo: a pressão tem de subir.
- D) Você inverteu a fração (2,0 × 300 ÷ 330). Pressão e temperatura são diretas: mais quente, mais pressão.
- E) Você somou 0,6 atm sem conta. A subida é de 10%, porque 330 é 10% maior que 300.

```realidade
Observe uma panela de pressão no fogo, um balão de festa ao sol ou um desodorante em spray que esfria a lata quando usado. Escolha um e explique, com uma das leis desta aula, o que acontece com o gás.
```

## Resumo

- Pressão vem das batidas das partículas; temperatura mede a agitação delas.
- Temperatura sempre em kelvin: K = °C + 273.
- Boyle (T fixa): P · V constante. Charles (P fixa): V ÷ T constante. Gay-Lussac (V fixo): P ÷ T constante.
- Equação geral: P₁V₁/T₁ = P₂V₂/T₂.
- P · V = n · R · T, com R = 0,082 atm·L/(mol·K): atm, L, mol, K.
- 1 mol de qualquer gás: cerca de 22,4 L a 0 °C e 1 atm.

## Para aprofundar

- [Termodinâmica](/trilhas/fisica-medio/termodinamica)
- [Estados físicos e mudanças de estado](/trilhas/quimica-fundamental/estados-fisicos-e-mudancas-de-estado)
- [Mol e estequiometria](/trilhas/quimica-medio/mol-e-estequiometria)
- [Estequiometria](/trilhas/enem-quimica/estequiometria)
- [Formulário de química](/trilhas/enem-reta-final/formulario-de-quimica)
