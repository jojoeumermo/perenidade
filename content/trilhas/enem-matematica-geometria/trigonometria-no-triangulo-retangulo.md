---
titulo: "Trigonometria no triângulo retângulo"
resumo: "Seno, cosseno e tangente para achar alturas e distâncias que não dá para medir com trena: rampas, telhados, pipas, rios e aviões."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Contemporary Mathematics, seção 10.8, Right Triangle Trigonometry"
    autor: "Donna Kirk (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/contemporary-mathematics/pages/10-8-right-triangle-trigonometry"
  - titulo: "Algebra and Trigonometry 2e, seção 7.2, Right Triangle Trigonometry"
    autor: "Jay Abramson (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/7-2-right-triangle-trigonometry"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Num triângulo retângulo de lados 3, 4 e 5, qual é o seno do ângulo que fica em frente ao lado 3?"
    opcoes: ["3/4", "4/5", "3/5", "5/3"]
    resposta: 2
    explicacao: "Seno é cateto oposto dividido pela hipotenusa: 3 ÷ 5. O 3/4 é a tangente; o 4/5 é o cosseno."
  - pergunta: "Uma escada de 6 m faz um ângulo de 60° com o chão. A que distância da parede está o pé dela? (cos 60° = 0,5)"
    opcoes: ["3 m", "5,2 m", "6 m", "12 m"]
    resposta: 0
    explicacao: "A distância até a parede é o cateto junto do ângulo de 60° (o adjacente). Cosseno = adjacente ÷ hipotenusa, então adjacente = 6 × 0,5 = 3 m."
  - pergunta: "Quanto vale a tangente de 45°?"
    opcoes: ["0,5", "0,71", "1,73", "1"]
    resposta: 3
    explicacao: "Com 45°, os dois ângulos agudos são iguais, e os catetos também. Tangente = oposto ÷ adjacente = 1."
  - pergunta: "Uma rampa reta de 10 m de comprimento faz 30° com o chão. Quanto ela sobe? (sen 30° = 0,5)"
    opcoes: ["8,7 m", "5 m", "10 m", "20 m"]
    resposta: 1
    explicacao: "A subida é o cateto oposto ao ângulo de 30°, e a rampa é a hipotenusa: 10 × 0,5 = 5 m."
---

```provocacao
Do outro lado de um rio há uma árvore. Sem atravessar a água, dá para saber a largura do rio? E a altura de um morro, sem subir nele? Com um ângulo e uma distância, dá.
```

## O que você vai aprender

Ao fim desta aula você vai nomear os lados de um triângulo retângulo em relação a um ângulo, usar seno, cosseno e tangente para achar um lado que falta, lembrar os valores dos ângulos de 30°, 45° e 60° e resolver problemas de altura e distância.

## Os lados vistos de um ângulo

Na aula de Pitágoras, os lados do triângulo retângulo eram catetos e hipotenusa. Agora vamos olhar a partir de um dos ângulos agudos (os menores que 90°). Chame esse ângulo de α (alfa).

- A **hipotenusa** continua a mesma: o lado em frente ao ângulo reto, o maior.
- O **cateto oposto** a α é o que fica do outro lado, em frente a ele, sem tocá-lo.
- O **cateto adjacente** a α é o que encosta nele (além da hipotenusa).

Figura descrita em palavras: uma rampa vista de lado. O chão é deitado, a subida é em pé e a rampa é inclinada. O ângulo α fica no pé da rampa, entre o chão e a rampa. A rampa é a hipotenusa. O chão é o cateto adjacente a α. A subida, em pé, é o cateto oposto a α.

Troque de ângulo e os nomes trocam: o que era oposto vira adjacente. Por isso, antes de qualquer conta, marque o ângulo que o problema dá.

## As três razões

Todos os triângulos retângulos com o mesmo ângulo α são semelhantes. Então a divisão entre dois lados deles é sempre a mesma, seja a rampa pequena ou enorme. Essas divisões têm nome:

```formula
sen α = oposto ÷ hipotenusa   ·   cos α = adjacente ÷ hipotenusa   ·   tg α = oposto ÷ adjacente
o seno é o cateto oposto dividido pela hipotenusa; o cosseno é o cateto adjacente dividido pela hipotenusa; a tangente é o cateto oposto dividido pelo adjacente
```

Para escolher qual usar, pergunte: que lado eu sei e que lado eu quero? A razão certa é a que liga os dois.

- Sei a hipotenusa e quero a altura (oposto): seno.
- Sei a hipotenusa e quero a base (adjacente): cosseno.
- Sei a base e quero a altura, ou o contrário: tangente.

## Os ângulos que a prova usa

A prova costuma dar os valores no enunciado. Mesmo assim, vale conhecer os três ângulos mais usados:

| ângulo | seno | cosseno | tangente |
| --- | --- | --- | --- |
| 30° | 1/2 = 0,5 | √3/2 ≈ 0,87 | √3/3 ≈ 0,58 |
| 45° | √2/2 ≈ 0,71 | √2/2 ≈ 0,71 | 1 |
| 60° | √3/2 ≈ 0,87 | 1/2 = 0,5 | √3 ≈ 1,73 |

Repare em duas coisas. O seno de 30° é o cosseno de 60°, e o contrário também: os dois ângulos agudos de um triângulo retângulo somam 90°, e o oposto de um é o adjacente do outro. E a tangente de 45° é 1: com 45°, os catetos são iguais.

```verificar
Uma pessoa está a 20 m da base de uma árvore e vê o topo dela sob um ângulo de 45°, medido a partir do chão. Qual é a altura da árvore?
- 10 m
+ 20 m
- 28 m
> Sei o adjacente (20 m) e quero o oposto (a altura): tangente. tg 45° = 1, então altura = 20 × 1 = 20 m.
```

## Inclinação: o ângulo e a porcentagem

Uma placa de estrada que avisa "subida de 10%" fala de tangente. Ela quer dizer que a estrada sobe 10 m a cada 100 m andados na horizontal: oposto ÷ adjacente = 10 ÷ 100 = 0,10. Isso dá um ângulo pequeno, bem menor que 10°. A tangente de 45°, que é 1, seria uma subida de 100%: um metro para cima a cada metro para a frente.

Isso ajuda a não confundir o ângulo com a porcentagem. São medidas diferentes da mesma inclinação.

```navidareal
Engenheiros e topógrafos medem distâncias que não dá para percorrer com trena, como a largura de um rio ou a altura de um morro, usando ângulos. Um aparelho de mira mede o ângulo; uma trena mede uma distância no chão firme; a tangente faz o resto. É a mesma conta deste capítulo, com instrumento melhor.
```

## Exemplo resolvido

**Um telhado de duas águas cobre uma casa de 8 m de largura. Cada lado do telhado faz 30° com a horizontal, e a cumeeira (o ponto mais alto) fica no meio. Qual é a altura da cumeeira acima da laje? Use tg 30° ≈ 0,58.**

1. Desenhe a metade: um triângulo retângulo com base de 8 ÷ 2 = 4 m (do canto até o meio) e altura h (a cumeeira).
2. O ângulo de 30° fica no canto. A base de 4 m é o cateto adjacente. A altura é o cateto oposto.
3. Sei o adjacente e quero o oposto: tangente. tg 30° = h ÷ 4.
4. h = 4 × 0,58 = 2,32 m.

Confira: com 45°, a altura seria igual à base, 4 m. Com 30°, o telhado é mais baixo. 2,32 m é menor que 4 m, e faz sentido.

## Como isso cai no ENEM

- **Formatos:** rampas e escadas com ângulo dado, telhados, altura de prédio, árvore ou morro vista de longe, largura de rio, pipa, avião ou foguete subindo em linha reta, inclinação de estrada e o ângulo de um brinquedo de parque.
- **Habilidades:** H7 (identificar características de figuras planas e espaciais), H8 (resolver problemas de geometria de espaço e forma) e H9 (usar a geometria para escolher argumentos que resolvem problemas do cotidiano). Nas provas de 2022 e 2023, classificadas pelo instituto, o tópico trigonometria no triângulo retângulo teve 1 das 81 questões de Matemática (1,2%). São só duas provas: tendência, não promessa.
- **Armadilhas:**
  - Trocar oposto e adjacente: eles dependem do ângulo marcado.
  - Usar seno quando o problema liga os dois catetos (é tangente).
  - Multiplicar quando é para dividir: se a hipotenusa é o que falta, ela fica embaixo na conta (hipotenusa = oposto ÷ seno).
  - Esquecer uma parte que não está no triângulo, como a altura da mão ou dos olhos de quem mede.
  - Confundir a inclinação em porcentagem com o ângulo em graus.

## Questão comentada

**Texto-base.** Logo depois de sair do chão, um avião sobe em linha reta, fazendo um ângulo constante de 30° com a pista, que é horizontal. Considere sen 30° = 0,5, cos 30° ≈ 0,87 e tg 30° ≈ 0,58.

**Comando.** Depois de percorrer 4.000 m nessa trajetória reta, a altura do avião em relação à pista é de

A) 3.480 m.
B) 2.000 m.
C) 2.320 m.
D) 8.000 m.
E) 4.000 m.

**Resolução.**

1. A trajetória de 4.000 m é a hipotenusa. A altura é o cateto oposto ao ângulo de 30°.
2. Sei a hipotenusa e quero o oposto: seno. sen 30° = altura ÷ 4.000.
3. Altura = 4.000 × 0,5 = 2.000 m.

**Gabarito: B.**

**Por que as outras não:**

- A) 3.480 m: foi usado o cosseno (4.000 × 0,87). Isso dá o avanço na horizontal, o cateto adjacente, não a altura.
- C) 2.320 m: foi usada a tangente (4.000 × 0,58). A tangente liga os dois catetos; aqui o que se sabe é a hipotenusa.
- D) 8.000 m: os 4.000 m foram divididos pelo seno. Isso seria certo se 4.000 fosse a altura e a pergunta fosse a trajetória. A altura tem de ser menor que a trajetória.
- E) 4.000 m: é a própria trajetória. O avião sobe inclinado, então a altura é menor que a distância percorrida.

```realidade
Escolha algo alto perto de casa. Afaste-se até ver o topo dele "na diagonal", com o olhar fazendo mais ou menos 45° com o chão (o braço esticado, apontando para o topo, a meio caminho entre o chão e o alto). Meça a distância em passos até a base. A altura é perto dessa distância, mais a altura dos seus olhos. Por que funciona?
```

## Resumo

- Em relação a um ângulo α: hipotenusa (maior lado), cateto oposto (em frente a α) e cateto adjacente (encostado em α).
- sen α = oposto ÷ hipotenusa; cos α = adjacente ÷ hipotenusa; tg α = oposto ÷ adjacente.
- Escolha a razão que liga o lado que você sabe ao lado que você quer.
- 30°: sen 0,5. 45°: tg 1. 60°: cos 0,5. Seno de um ângulo é o cosseno do outro agudo.
- Inclinação em porcentagem é tangente vezes 100, não o ângulo.

## Para aprofundar

- [Trigonometria no triângulo retângulo (ensino médio)](/trilhas/matematica-medio/trigonometria-no-triangulo-retangulo)
- [Teorema de Pitágoras e relações métricas](/trilhas/enem-matematica-geometria/pitagoras-e-relacoes-metricas)
- [Semelhança e Teorema de Tales](/trilhas/enem-matematica-geometria/semelhanca-e-tales)
- [Formulário de matemática](/trilhas/enem-reta-final/formulario-de-matematica)
