---
titulo: "Eventos independentes"
resumo: "Quando um acontecimento não muda a chance do outro, as probabilidades se multiplicam: lançamentos seguidos, sorteios com reposição, sistemas com peças de reserva e o mito do \"agora vai\"."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Introductory Statistics 2e, seção 3.2, Independent and Mutually Exclusive Events"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/3-2-independent-and-mutually-exclusive-events"
  - titulo: "Introductory Statistics 2e, seção 3.3, Two Basic Rules of Probability"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/3-3-two-basic-rules-of-probability"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Uma moeda e um dado comum são lançados juntos. Qual é a probabilidade de sair coroa e um número par?"
    opcoes: ["1/12", "1", "1/4", "1/8"]
    resposta: 2
    explicacao: "A moeda não influencia o dado. P(coroa) = 1/2 e P(par) = 3/6 = 1/2. Multiplicando: 1/2 × 1/2 = 1/4."
  - pergunta: "Uma moeda honesta deu cara 5 vezes seguidas. Qual é a probabilidade de dar cara no 6º lançamento?"
    opcoes: ["1/64", "1/2", "Quase zero", "1/32"]
    resposta: 1
    explicacao: "A moeda não tem memória. Cada lançamento é independente dos outros: a chance continua 1/2."
  - pergunta: "Uma caixa tem 2 bolas vermelhas e 3 brancas. Tira-se uma bola, devolve-se e tira-se outra. Qual é a probabilidade de as duas serem vermelhas?"
    opcoes: ["4/25", "1/10", "2/5", "4/5"]
    resposta: 0
    explicacao: "Com devolução, a caixa volta a ser a mesma: os sorteios são independentes. 2/5 × 2/5 = 4/25. O 1/10 seria sem devolução."
  - pergunta: "Cada semente de um pacote germina com probabilidade de 90%, uma sem influenciar a outra. Plantando duas, qual é a probabilidade de as duas germinarem?"
    opcoes: ["90%", "180%", "45%", "81%"]
    resposta: 3
    explicacao: "Independentes: 0,9 × 0,9 = 0,81 = 81%. Somar daria 180%, o que é impossível para uma probabilidade."
---

```provocacao
Numa roleta, a cor vermelha saiu dez vezes seguidas. Muita gente aposta no preto agora, porque "está na hora de mudar". Faz sentido? Pense na sua resposta. Esse raciocínio tem até nome, e aparece no fim da explicação.
```

## O que você vai aprender

Ao fim desta aula você vai saber reconhecer quando dois eventos são independentes, calcular a probabilidade de os dois acontecerem multiplicando as chances, resolver problemas de "pelo menos um" em repetições e não confundir eventos independentes com eventos que não podem acontecer juntos.

## O que é ser independente

Dois eventos são **independentes** quando um acontecer **não muda** a chance do outro.

- Lançar uma moeda e um dado: o resultado da moeda não muda nada no dado.
- Lançar a mesma moeda duas vezes: a moeda não lembra o que deu antes.
- Sortear uma bola, **devolver** e sortear de novo: a urna volta a ser a mesma.

Agora, um caso que **não** é independente: sortear uma bola e **não devolver**. A urna muda. Se a primeira bola era vermelha, sobra uma vermelha a menos para o segundo sorteio. Esses eventos são **dependentes**. A aula de probabilidade condicional trata deles.

## A regra do "e"

Quando A e B são independentes, a probabilidade de acontecerem os dois é o produto.

```formula
P(A e B) = P(A) × P(B)
se um evento não muda a chance do outro, a chance de os dois acontecerem é a multiplicação das chances de cada um
vale para mais eventos também: P(A e B e C) = P(A) × P(B) × P(C)
```

Por que multiplicar? Pense na moeda e no dado. São 2 × 6 = 12 resultados, todos com a mesma chance. "Cara e 6" é um deles: 1/12. E 1/2 × 1/6 = 1/12. A multiplicação é o princípio fundamental da contagem disfarçado.

Outro exemplo: a chance de três lançamentos de moeda darem três caras é 1/2 × 1/2 × 1/2 = 1/8.

## Pelo menos um: use o contrário

"Qual é a chance de pelo menos uma das três lâmpadas acender?" Somar casos dá muito trabalho e é fácil esquecer algum. O caminho curto é o **complementar**: o contrário de "pelo menos uma" é "nenhuma".

1. Calcule a chance de **nenhuma** acontecer, multiplicando.
2. Tire de 1 (ou de 100%).

Se cada lâmpada acende com 70% de chance, sem influenciar as outras, cada uma falha com 30%. As três falham com 0,3 × 0,3 × 0,3 = 0,027. Pelo menos uma acende com 1 − 0,027 = 0,973, ou 97,3%.

É por isso que hospitais e aviões têm sistemas de reserva. Cada peça extra, independente das outras, deixa muito menor a chance de **todas** falharem juntas.

## Exatamente um: some os jeitos

"Exatamente um" pede mais cuidado. Com duas peças, o evento "exatamente uma falha" acontece de dois jeitos: a primeira falha e a segunda não, ou a primeira não falha e a segunda sim. Calcule cada jeito multiplicando e, no fim, some os jeitos.

## Independente não é o mesmo que excludente

Dois eventos são **mutuamente exclusivos** (excludentes) quando não podem acontecer juntos. Num dado, "sair 2" e "sair 5" são excludentes: P(os dois) = 0.

Esses eventos não são independentes. Se sair 2, a chance de sair 5 no mesmo lançamento cai para zero: um mudou a chance do outro. Por isso, dois eventos excludentes que podem acontecer (chance maior que zero) nunca são independentes.

Resumo útil: com "ou" e eventos excludentes, **some**. Com "e" e eventos independentes, **multiplique**.

## A falácia do jogador

Volte à roleta da provocação. Se cada giro é independente, a chance de dar preto no próximo é a mesma de sempre. A roleta não lembra das dez vermelhas. Achar que "agora tem de mudar" é um erro tão comum que ganhou nome: **falácia do jogador**.

O que é raro é a sequência inteira: dez vermelhas seguidas, antes de começar, tinham chance pequena. Mas, depois que elas já saíram, o próximo giro não sabe disso.

```navidareal
Em muitas famílias se ouve: "já são três meninos, o próximo vai ser menina". Se considerarmos a chance de 1/2 para cada sexo e cada nascimento independente do anterior, a chance de o quarto bebê ser menina continua 1/2. Os três meninos não "puxam" uma menina. É a falácia do jogador na vida real.
```

```verificar
Um dado comum é lançado duas vezes. Qual é a probabilidade de sair 6 nas duas?
- 2/6, porque são duas chances de 1/6
+ 1/36, porque 1/6 × 1/6 = 1/36
- 1/12, porque são 12 faces nos dois lançamentos
> Os lançamentos são independentes: multiplique as chances. Somar (2/6) serviria para "ou", e mesmo assim contaria duas vezes o caso 6 e 6.
```

## Exemplo resolvido

**O alarme de uma escola tem dois sensores que funcionam de forma independente. Cada um falha em 10% das vezes. Calcule a probabilidade de: (a) os dois falharem; (b) pelo menos um funcionar; (c) exatamente um falhar.**

1. **(a) Os dois falham.** Independentes: 0,1 × 0,1 = 0,01 = 1%.
2. **(b) Pelo menos um funciona.** É o contrário de "os dois falham": 1 − 0,01 = 0,99 = 99%.
3. **(c) Exatamente um falha.** Há dois jeitos. Primeiro falha e segundo funciona: 0,1 × 0,9 = 0,09. Primeiro funciona e segundo falha: 0,9 × 0,1 = 0,09. Somando: 0,18 = 18%.

Confira: os dois funcionam com 0,9 × 0,9 = 0,81. Os três casos possíveis, nenhum falha, um falha e os dois falham, somam 0,81 + 0,18 + 0,01 = 1. Nada ficou de fora.

## Como isso cai no ENEM

- **Formatos:** lançamentos seguidos de moedas e dados, sorteios com reposição, sistemas com peças de segurança, sementes que germinam, testes repetidos, filhos de um casal, trajetos com vários semáforos. A pergunta costuma ser "todos", "nenhum", "pelo menos um" ou "exatamente um".
- **Habilidades:** H28 (resolver problemas de estatística e probabilidade), a principal; H29 (usar estatística e probabilidade para construir argumentos); H30 (avaliar propostas de intervenção usando estatística e probabilidade), quando se compara, por exemplo, um sistema com uma peça e outro com duas.
- **O que mais caiu:** nas provas de 2022 e 2023, classificadas pelo instituto, de 81 questões de Matemática, 2 (2,5%) foram deste tópico. A H28 teve 4 questões (4,9%). São só duas provas: é uma tendência, não uma promessa.
- **Armadilhas:**
  - Somar chances quando a pergunta é "e" (o certo é multiplicar).
  - Achar que resultados passados mudam o próximo, num processo independente.
  - Tratar sorteio sem devolução como independente.
  - Em "pelo menos um", esquecer de fazer 1 menos "nenhum".
  - Em "exatamente um", contar só um dos jeitos.

## Questão comentada

**Texto-base.** Uma agricultora familiar usa sementes de milho cuja taxa de germinação, informada na embalagem, é de 80%. Para garantir uma planta por cova, ela coloca 3 sementes em cada cova. Considere que a germinação de uma semente não interfere na das outras.

**Comando.** A probabilidade de pelo menos uma das três sementes de uma cova germinar é

A) 99,2%.
B) 51,2%.
C) 0,8%.
D) 38,4%.
E) 80%.

**Resolução.**

1. "Pelo menos uma" pede o contrário: nenhuma germinar.
2. Cada semente deixa de germinar com 100% − 80% = 20%, ou 0,2.
3. As três não germinam com 0,2 × 0,2 × 0,2 = 0,008.
4. Pelo menos uma germina: 1 − 0,008 = 0,992 = 99,2%.

**Gabarito: A.**

**Por que as outras não:**

- B) 51,2% é 0,8 × 0,8 × 0,8: a chance de as três germinarem. A pergunta é "pelo menos uma".
- C) 0,8% é 0,008: a chance de nenhuma germinar. Faltou tirar de 100%.
- D) 38,4% é a chance de exatamente duas germinarem (3 × 0,8 × 0,8 × 0,2). Faltam os casos de uma e de três.
- E) 80% é a chance de uma semente sozinha. Com três sementes, a chance de ter alguma planta na cova aumenta.

```realidade
Pense numa situação da sua vida em que você usa um "plano B": dois despertadores, duas rotas para o trabalho, uma segunda pessoa para buscar a criança. Por que ter duas opções independentes diminui tanto a chance de tudo dar errado? Em que caso as duas opções não seriam independentes?
```

## Resumo

- Independentes: um evento não muda a chance do outro.
- "E" com independentes: multiplique. P(A e B) = P(A) × P(B).
- Pelo menos um: 1 − P(nenhum).
- Exatamente um: some os jeitos, cada jeito calculado multiplicando.
- Com devolução, os sorteios são independentes. Sem devolução, não.
- Excludente não é independente. E o passado não muda o próximo lançamento.

## Para aprofundar

- [Probabilidade simples](/trilhas/enem-matematica-estatistica-e-probabilidade/probabilidade-simples)
- [União, complementar e probabilidade condicional](/trilhas/enem-matematica-estatistica-e-probabilidade/uniao-complementar-e-probabilidade-condicional)
- [Probabilidade](/trilhas/matematica-medio/probabilidade)
- [Probabilidade e distribuições](/trilhas/matematica-superior/probabilidade-e-distribuicoes)
