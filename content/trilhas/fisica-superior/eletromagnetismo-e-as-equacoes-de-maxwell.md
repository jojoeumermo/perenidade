---
titulo: "Eletromagnetismo e as equações de Maxwell"
resumo: "Objetivo: conhecer as quatro equações de Maxwell, o que cada uma significa fisicamente e como delas resulta a existência de ondas eletromagnéticas que viajam à velocidade da luz."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "University Physics, volume 2, seção 6.2, Explaining Gauss's Law"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-2/pages/6-2-explaining-gausss-law"
  - titulo: "University Physics, volume 2, seção 12.5, Ampère's Law"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-2/pages/12-5-amperes-law"
  - titulo: "University Physics, volume 2, seção 13.1, Faraday's Law"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-2/pages/13-1-faradays-law"
  - titulo: "University Physics, volume 2, seção 16.1, Maxwell's Equations and Electromagnetic Waves"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-2/pages/16-1-maxwells-equations-and-electromagnetic-waves"
quiz:
  - pergunta: "O que afirma a lei de Gauss para o campo elétrico?"
    opcoes: ["O fluxo elétrico através de uma superfície fechada é proporcional à carga dentro dela", "Não existem cargas elétricas", "O campo elétrico é sempre nulo"]
    resposta: 0
    explicacao: "Φ = Q interna / ε₀."
  - pergunta: "O que diz a lei de Gauss para o magnetismo?"
    opcoes: ["Que existem polos magnéticos isolados", "Que o fluxo magnético através de qualquer superfície fechada é zero: não há monopolos magnéticos", "Que o campo magnético é sempre uniforme"]
    resposta: 1
    explicacao: "Quebre um ímã ao meio e cada pedaço terá polo norte e polo sul."
  - pergunta: "Que termo Maxwell acrescentou à lei de Ampère?"
    opcoes: ["A corrente de deslocamento: um campo elétrico variável também cria campo magnético", "A carga do elétron", "A resistência elétrica"]
    resposta: 0
    explicacao: "Com esse termo, as equações passaram a prever ondas eletromagnéticas."
  - pergunta: "A velocidade das ondas eletromagnéticas calculada a partir das equações de Maxwell é igual a:"
    opcoes: ["A velocidade do som", "A velocidade da luz", "Zero"]
    resposta: 1
    explicacao: "c = 1/√(μ₀·ε₀) ≈ 3 × 10⁸ m/s. Daí a conclusão de que a luz é uma onda eletromagnética."
---

## Quatro equações para tudo

Em meados do século XIX, o escocês **James Clerk Maxwell** reuniu o que se sabia sobre eletricidade e magnetismo e acrescentou uma peça que faltava. O resultado são **quatro equações** que descrevem todos os fenômenos elétricos e magnéticos clássicos: das pilhas aos motores, das antenas à luz.

Esta aula supõe [Eletrostática](/trilhas/fisica-medio/eletrostatica) e [Eletromagnetismo](/trilhas/fisica-medio/eletromagnetismo) do ensino médio e a noção de [integral](/trilhas/matematica-superior/integrais).

## A ideia de fluxo

O **fluxo** de um campo através de uma superfície mede "quanto campo atravessa" essa superfície. Para uma superfície fechada (como um balão), o fluxo para fora menos o fluxo para dentro diz se há uma **fonte** do campo lá dentro.

## As quatro equações (na forma integral)

| Lei | Equação | O que diz |
| --- | --- | --- |
| **Gauss (elétrica)** | ∮ E · dA = Q / ε₀ | cargas elétricas são fontes de campo elétrico |
| **Gauss (magnética)** | ∮ B · dA = 0 | não existem "cargas magnéticas" isoladas |
| **Faraday** | ∮ E · dl = −dΦ_B/dt | campo magnético variável cria campo elétrico |
| **Ampère-Maxwell** | ∮ B · dl = μ₀·I + μ₀·ε₀·dΦ_E/dt | correntes e campo elétrico variável criam campo magnético |

ε₀ e μ₀ são constantes medidas em laboratório: a permissividade e a permeabilidade do vácuo.

### 1. Lei de Gauss

O fluxo do campo elétrico através de uma superfície fechada é proporcional à **carga dentro** dela. Daí sai a lei de Coulomb, e também conclusões práticas: em um condutor em equilíbrio, toda a carga fica na superfície e o campo interno é zero. É a explicação da gaiola de Faraday.

### 2. Gauss para o magnetismo

O fluxo magnético através de qualquer superfície fechada é **zero**: as linhas de campo magnético não começam nem terminam, sempre se fecham. Não existem polos magnéticos isolados. Corte um ímã ao meio e você terá dois ímãs, cada um com norte e sul.

### 3. Lei de Faraday

Um fluxo magnético que **varia** com o tempo induz um campo elétrico, e portanto uma tensão, em um circuito. O sinal negativo (a **lei de Lenz**) diz que a corrente induzida se opõe à variação que a criou. É a base dos geradores e dos transformadores.

### 4. Lei de Ampère-Maxwell

Correntes elétricas criam campo magnético (lei de Ampère). Maxwell percebeu que a lei original era inconsistente quando a corrente varia, por exemplo ao carregar um capacitor: entre as placas não passa corrente, mas há campo magnético em volta. Ele acrescentou um termo, a **corrente de deslocamento**: um **campo elétrico variável também cria campo magnético**.

```verificar
Qual das quatro equações explica o funcionamento de um gerador de usina hidrelétrica?
- Lei de Gauss
- Lei de Gauss para o magnetismo
+ Lei de Faraday
> No gerador, uma bobina gira em um campo magnético. O que varia, e o que isso produz?
```

## A grande consequência: a luz

Junte a lei de Faraday (campo magnético variável gera campo elétrico) com o termo de Maxwell (campo elétrico variável gera campo magnético). Um alimenta o outro. Uma perturbação pode se **propagar sozinha pelo espaço**, sem precisar de cargas nem de meio material.

Das equações sai a **equação de onda**, e a velocidade dessas ondas é:

**c = 1 / √(μ₀ · ε₀)**

```conta
μ₀ = 4π × 10⁻⁷ T·m/A ≈ 1,257 × 10⁻⁶
ε₀ ≈ 8,854 × 10⁻¹² C²/(N·m²)
μ₀ · ε₀ ≈ 1,113 × 10⁻¹⁷
c = 1 ÷ √(1,113 × 10⁻¹⁷) ≈ 3,0 × 10⁸ m/s
```

Duas constantes medidas com ímãs e cargas em bancada deram exatamente a velocidade da luz, medida por outros caminhos. Maxwell concluiu que **a luz é uma onda eletromagnética**. Ótica, eletricidade e magnetismo viraram uma só teoria.

Nas ondas eletromagnéticas, os campos E e B são perpendiculares entre si e à direção de propagação, e oscilam em fase. Elas transportam energia (a luz do Sol aquece) e momento (a luz exerce uma pequena pressão).

## Da teoria à prática

Maxwell morreu em 1879, sem ver as suas ondas detectadas. No fim da década de 1880, o alemão **Heinrich Hertz** as produziu e detectou em laboratório. Poucos anos depois, vieram a telegrafia sem fio e o rádio. Hoje, celular, Wi-Fi, GPS, radar, forno de micro-ondas, raios X e a fibra óptica são aplicações das mesmas quatro equações.

E elas deixaram um enigma: a velocidade c não aparece referida a nenhum observador. Velocidade em relação a quê? A resposta levou à [relatividade restrita](/trilhas/fisica-superior/relatividade-restrita).

## Para praticar

1. Explique, com a lei de Gauss, por que o campo elétrico dentro de uma esfera condutora carregada é zero.
2. Por que não existe um "ímã com um polo só"? Qual das equações trata disso?
3. Um ímã cai por dentro de um tubo de cobre e desce muito devagar. Explique com as leis de Faraday e de Lenz.
4. Refaça a conta de c com os valores de μ₀ e ε₀ e compare com a velocidade da luz.
