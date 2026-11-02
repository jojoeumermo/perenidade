---
titulo: "Queda livre e lançamentos"
resumo: "Por que o martelo e a pena caem juntos no vácuo, as contas da queda livre, o que acontece no ponto mais alto de um lançamento para cima, e como o movimento se divide em dois nos lançamentos horizontal e oblíquo."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "College Physics 2e, seção 2.7, Falling Objects"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/2-7-falling-objects"
  - titulo: "Physics, seção 5.3, Projectile Motion"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/5-3-projectile-motion"
  - titulo: "Provas e gabaritos do Enem (as provas de 2022 e 2023, base da contagem do instituto)"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Uma pedra é solta do alto de um prédio e cai por 2 s. Desprezando a resistência do ar e usando g = 10 m/s², a velocidade dela nesse instante é de"
    opcoes: ["5 m/s", "20 m/s", "12 m/s", "40 m/s"]
    resposta: 1
    explicacao: "Na queda livre, a velocidade cresce 10 m/s a cada segundo: v = g · t = 10 × 2 = 20 m/s."
  - pergunta: "Uma bola é jogada para cima. No ponto mais alto da trajetória, a velocidade e a aceleração dela são"
    opcoes: ["velocidade zero e aceleração zero", "velocidade máxima e aceleração zero", "velocidade zero e aceleração g, para baixo", "velocidade e aceleração para cima"]
    resposta: 2
    explicacao: "No topo, a bola para por um instante: velocidade zero. Mas a gravidade não desliga. A aceleração continua g, para baixo, e é ela que faz a bola começar a descer."
  - pergunta: "Do alto de uma mesa, uma bolinha é chutada na horizontal e, no mesmo instante, outra é solta do mesmo lugar. Sem resistência do ar, qual chega primeiro ao chão?"
    opcoes: ["A chutada, porque é mais rápida", "A solta, porque cai em linha reta", "Depende da massa de cada uma", "As duas chegam juntas"]
    resposta: 3
    explicacao: "O movimento vertical das duas é o mesmo: as duas partem com velocidade vertical zero e caem com a mesma aceleração. A velocidade horizontal da chutada não muda o tempo de queda, só leva a bolinha mais longe."
  - pergunta: "Sem resistência do ar e com a mesma velocidade de lançamento, qual ângulo com o chão dá o maior alcance?"
    opcoes: ["45°", "30°", "60°", "90°"]
    resposta: 0
    explicacao: "O alcance é R = v₀² · sen(2θ) ÷ g. O seno é máximo, igual a 1, quando 2θ = 90°, isto é, θ = 45°. Com 90°, a bola sobe e volta ao mesmo lugar: alcance zero."
---

```provocacao
Solte, ao mesmo tempo e da mesma altura, uma folha de papel aberta e um livro. O livro chega antes. Agora amasse bem a folha e repita. O que mudou: o peso da folha ou outra coisa?
```

## O que você vai aprender

Ao fim desta aula você vai saber o que é queda livre, calcular a velocidade, o tempo e a altura de uma queda, entender o lançamento para cima e o que acontece no ponto mais alto, e dividir os lançamentos horizontal e oblíquo em dois movimentos mais simples.

## Todos caem do mesmo jeito (sem o ar)

Volte à provocação. A folha aberta e a folha amassada têm o mesmo peso. O que mudou foi o ar. Aberta, a folha empurra muito ar ao cair e é freada. Amassada, quase não é freada e cai quase junto com o livro.

Se não houvesse ar, todos os corpos, leves ou pesados, cairiam juntos. Perto da superfície da Terra, eles caem com a mesma aceleração, a **aceleração da gravidade** (g). O valor médio é g ≈ 9,8 m/s²; ele muda um pouco de lugar para lugar. Nas questões, é comum usar g = 10 m/s², para facilitar a conta.

Aceleração de 10 m/s² quer dizer: a velocidade aumenta 10 m/s a cada segundo de queda. Depois de 1 s, 10 m/s; depois de 2 s, 20 m/s; depois de 3 s, 30 m/s.

**Queda livre** é a queda sem resistência do ar, só com a gravidade agindo. É um movimento uniformemente variado, o MUV da aula de [Cinemática](/trilhas/fisica-medio/cinematica-movimento-uniforme-e-variado).

## As contas da queda livre

Para um corpo solto do repouso (velocidade inicial zero), valem três fórmulas.

```formula
v = g · t
velocidade = aceleração da gravidade × tempo de queda
depois de 3 s, com g = 10 m/s²: 10 × 3 = 30 m/s
```

```formula
h = g · t² ÷ 2
altura que o corpo caiu = gravidade × tempo ao quadrado ÷ 2
em 3 s: 10 × 9 ÷ 2 = 45 m
```

```formula
v² = 2 · g · h
velocidade ao quadrado = 2 × gravidade × altura caída
caindo 45 m: v² = 2 × 10 × 45 = 900, então v = 30 m/s
```

Repare: a altura cresce com o **quadrado** do tempo. No primeiro segundo o corpo cai 5 m; em 2 s, 20 m; em 3 s, 45 m. Cada segundo cai mais que o anterior, porque está cada vez mais rápido.

## Lançamento para cima

Jogue uma bola para cima com velocidade v₀. A gravidade freia a bola em 10 m/s a cada segundo. Ela sobe cada vez mais devagar, para por um instante no ponto mais alto e volta.

- **Tempo de subida:** t = v₀ ÷ g.
- **Altura máxima:** h = v₀² ÷ (2 · g).
- A descida é o espelho da subida. Sem ar, a bola volta à mão com a mesma velocidade com que saiu, e o tempo de descida é igual ao de subida.

No ponto mais alto, a velocidade é zero, mas a **aceleração não é zero**. Ela continua sendo g, para baixo, o tempo todo: na subida, no topo e na descida.

## Lançamentos horizontal e oblíquo: dois movimentos em um

Quando algo é lançado de lado, a trajetória é uma curva, uma parábola. O truque é separar o movimento em dois, que não interferem um no outro:

- **Na horizontal**, nada empurra nem freia (sem o ar). A velocidade horizontal fica constante: é um movimento uniforme. Distância = velocidade horizontal × tempo.
- **Na vertical**, o corpo faz uma queda livre (ou um lançamento para cima), como se não andasse de lado.

No **lançamento horizontal**, o corpo sai com velocidade só para o lado. O tempo de queda depende só da altura, igual ao de um corpo solto. A velocidade horizontal só decide quão longe ele vai.

No **lançamento oblíquo**, o corpo sai inclinado, com um ângulo θ em relação ao chão. A velocidade se divide numa parte horizontal (v₀ · cos θ) e numa vertical (v₀ · sen θ). A parte vertical decide o tempo no ar e a altura; a horizontal, junto com o tempo, decide o alcance.

```formula
R = v₀² · sen(2θ) ÷ g
alcance = velocidade inicial ao quadrado × seno do dobro do ângulo ÷ gravidade
o alcance é máximo em 45°; ângulos que somam 90° (como 30° e 60°) dão o mesmo alcance
```

```navidareal
# O martelo e a pena, na Lua
Em 1971, na missão Apollo 15, o astronauta David Scott soltou ao mesmo tempo um martelo e uma pena na superfície da Lua, que não tem atmosfera. Os dois chegaram juntos ao chão.

Na Terra, a pena cai devagar porque o ar a freia. Sem ar, o que vale é só a gravidade, e ela acelera tudo igual, qualquer que seja a massa.
```

```verificar
Um objeto cai em queda livre durante 3 s, a partir do repouso. Com g = 10 m/s², quanto ele caiu?
- 30 m
- 90 m
+ 45 m
> h = g · t² ÷ 2 = 10 × 3 × 3 ÷ 2 = 90 ÷ 2 = 45 m. Quem marcou 30 m usou a velocidade; quem marcou 90 m esqueceu de dividir por 2.
```

## Exemplo resolvido

**Uma pessoa joga uma bola verticalmente para cima com velocidade de 20 m/s. Despreze a resistência do ar e use g = 10 m/s². Quanto tempo a bola leva para chegar ao ponto mais alto? Qual é a altura máxima? Depois de quanto tempo e com que velocidade ela volta à mão?**

1. Tempo de subida: t = v₀ ÷ g = 20 ÷ 10 = 2 s.
2. Altura máxima: h = v₀² ÷ (2 · g) = 20 × 20 ÷ 20 = 400 ÷ 20 = 20 m.
3. A descida dura o mesmo que a subida: 2 s. A bola volta à mão 2 + 2 = 4 s depois do lançamento.
4. Ela chega à mão com 20 m/s, agora para baixo.

Confira pela queda: caindo 20 m a partir do repouso, h = g · t² ÷ 2 = 10 × 2 × 2 ÷ 2 = 20 m em 2 s. Bate.

## Como isso cai no ENEM

- **Formatos:** objetos que caem de prédios e de árvores, saltos, chutes e arremessos no esporte, pacotes soltos de aviões ou drones, jato de água de mangueira, paraquedas, experiências de Galileu e da Lua. A questão pede o tempo, a altura ou a velocidade de uma queda, compara tempos de queda, ou pede o alcance e o melhor ângulo de um lançamento.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, o objeto "O movimento, o equilíbrio e a descoberta de leis físicas" teve 8 das 89 questões classificadas de Ciências da Natureza (9%). Este tópico, queda livre e lançamentos, teve 2 delas (2,2%). São só duas edições: é tendência, não promessa.
- **Habilidades:** H20 (explicar causas ou efeitos do movimento de objetos), a habilidade de física com mais questões nessa mesma base (10), e H17 (relacionar informações em texto, gráfico, tabela ou fórmula), com 6.
- **Armadilhas:**
  - Achar que o corpo mais pesado cai mais depressa. Sem ar, todos caem juntos.
  - Dizer que a aceleração é zero no ponto mais alto. Só a velocidade é zero.
  - Esquecer o "÷ 2" ou o quadrado do tempo em h = g · t² ÷ 2.
  - Achar que a velocidade horizontal muda o tempo de queda. O tempo depende só da altura.

## Questão comentada

**Texto-base.** Um drone de entrega voa na horizontal, a 45 m de altura, com velocidade de 20 m/s, e solta um pacote. Despreze a resistência do ar e use g = 10 m/s². No instante em que é solto, o pacote tem a mesma velocidade horizontal do drone.

**Comando.** Ao chegar ao chão, o pacote terá percorrido, na horizontal, uma distância de

A) 3 m.
B) 20 m.
C) 60 m.
D) 45 m.
E) 900 m.

**Resolução.**

1. Tempo de queda, só pela vertical: 45 = 10 × t² ÷ 2, então t² = 9 e t = 3 s.
2. Na horizontal, a velocidade fica constante em 20 m/s durante esses 3 s.
3. Distância horizontal: 20 × 3 = 60 m.

**Gabarito: C.**

**Por que as outras não:**

- A) 3 m: 3 é o tempo de queda, em segundos, não a distância.
- B) 20 m: é o que o pacote anda em 1 s. A queda dura 3 s.
- D) 45 m: é a altura. A distância horizontal não é igual à altura; depende da velocidade e do tempo.
- E) 900 m: você multiplicou a velocidade pela altura. Grandezas assim não se combinam: primeiro ache o tempo pela altura.

```realidade
Na próxima vez que vir água saindo de uma mangueira ou de um cano na horizontal, repare na curva do jato. Se a água saísse mais rápida, do mesmo cano, ela cairia no chão mais longe ou mais perto? E em mais ou em menos tempo?
```

## Resumo

- Sem ar, todos os corpos caem com a mesma aceleração g ≈ 9,8 m/s² (na prova, muitas vezes 10 m/s²).
- Queda livre a partir do repouso: v = g · t; h = g · t² ÷ 2; v² = 2 · g · h.
- Lançamento para cima: tempo de subida v₀ ÷ g; altura máxima v₀² ÷ (2 · g). No topo, velocidade zero e aceleração g.
- Lançamentos de lado: horizontal em movimento uniforme, vertical em queda livre. O tempo depende só do movimento vertical.
- Alcance R = v₀² · sen(2θ) ÷ g: máximo em 45°; ângulos complementares dão o mesmo alcance.
- As fórmulas também estão no [Formulário de física](/trilhas/enem-reta-final/formulario-de-fisica).

## Para aprofundar

- [Peso, massa e gravidade](/trilhas/fisica-fundamental/peso-massa-e-gravidade)
- [Cinemática: movimento uniforme e variado](/trilhas/fisica-medio/cinematica-movimento-uniforme-e-variado)
- [Vetores](/trilhas/fisica-medio/vetores)
- [Leis de Newton, atrito e plano inclinado](/trilhas/enem-fisica/leis-de-newton)
- [Formulário de física](/trilhas/enem-reta-final/formulario-de-fisica)
