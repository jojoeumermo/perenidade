---
titulo: "Princípio fundamental da contagem"
resumo: "Contar senhas, cardápios, caminhos e códigos sem listar um por um: uma casinha para cada escolha, multiplicar quando é \"e\", somar quando é \"ou\"."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Algebra and Trigonometry 2e, seção 13.5, Counting Principles"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/13-5-counting-principles"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Uma pessoa tem 3 camisas e 4 bermudas. De quantos jeitos diferentes ela pode se vestir com uma camisa e uma bermuda?"
    opcoes: ["7", "12", "34", "1"]
    resposta: 1
    explicacao: "Cada camisa combina com cada bermuda: 3 × 4 = 12. Somar (7) seria escolher uma camisa ou uma bermuda, e não as duas."
  - pergunta: "Quantas senhas de 3 algarismos existem, podendo repetir algarismos (de 000 a 999)?"
    opcoes: ["720", "30", "1.000", "999"]
    resposta: 2
    explicacao: "Cada posição tem 10 opções (de 0 a 9): 10 × 10 × 10 = 1.000. O 720 seria sem repetir (10 × 9 × 8)."
  - pergunta: "De uma cidade A para uma cidade B há 3 estradas. De B para C há 2. Quantos caminhos diferentes levam de A a C, passando por B?"
    opcoes: ["6", "5", "9", "8"]
    resposta: 0
    explicacao: "É preciso ir de A a B e depois de B a C: as escolhas se multiplicam. 3 × 2 = 6."
  - pergunta: "Para viajar, uma pessoa pode ir de ônibus, com 4 horários por dia, ou de trem, com 2 horários. Quantas opções de viagem ela tem num dia?"
    opcoes: ["8", "2", "4", "6"]
    resposta: 3
    explicacao: "Ela vai de ônibus ou de trem, não dos dois. Quando é \"ou\", os casos se somam: 4 + 2 = 6."
---

```provocacao
A senha do seu celular tem 4 algarismos. Quantas senhas diferentes existem? Se alguém tentasse uma senha a cada 10 segundos, sem parar, quanto tempo levaria para tentar todas? Faça um palpite. A conta aparece no meio da aula.
```

## O que você vai aprender

Ao fim desta aula você vai saber contar quantas possibilidades existem numa situação com várias escolhas: senhas, cardápios, caminhos, códigos e placas. Vai usar o princípio multiplicativo, o princípio aditivo e o truque das casinhas, e vai saber começar pelas escolhas que têm restrição.

## Contar sem listar

Uma lanchonete monta lanches assim: você escolhe um pão (francês, de forma ou integral) e um recheio (queijo, frango, ovo ou legumes). Quantos lanches diferentes dá para montar?

Dá para listar. Com o pão francês: francês com queijo, francês com frango, francês com ovo, francês com legumes. São 4. Com o pão de forma, mais 4. Com o integral, mais 4. Ao todo, 12.

Esse desenho mental tem nome: **árvore de possibilidades**. Cada pão abre 4 galhos, um para cada recheio. São 3 pães com 4 galhos cada: 3 × 4 = 12.

Agora acrescente a bebida: suco ou café. Cada um dos 12 lanches abre 2 galhos. São 12 × 2 = 24 combinações. Listar já começa a cansar. Com mais escolhas, fica impossível.

## O princípio multiplicativo

Esse é o **princípio fundamental da contagem**, também chamado de princípio multiplicativo:

```formula
total = n₁ × n₂ × n₃ × …
se uma decisão tem n₁ opções, a seguinte tem n₂, a outra n₃, e uma é tomada depois da outra, o total de resultados é o produto
vale quando as escolhas são feitas em sequência, uma e depois a outra
```

O jeito prático de usar é desenhar uma **casinha para cada escolha**. Dentro de cada casinha, escreva quantas opções existem naquele momento. Depois, multiplique.

Lanche: [3 pães] × [4 recheios] × [2 bebidas] = 24.

## Com repetição e sem repetição

Volte à senha de 4 algarismos. São quatro casinhas. Em cada uma, cabe qualquer algarismo de 0 a 9: 10 opções. Pode repetir, como em 1111 ou 2020.

10 × 10 × 10 × 10 = 10.000 senhas.

Tentando uma a cada 10 segundos, seriam 100.000 segundos, perto de 28 horas sem parar. Com 6 algarismos, seriam 1.000.000 de senhas: 100 vezes mais.

E se a senha não pudesse repetir algarismos? A primeira casinha tem 10 opções. A segunda, só 9, porque um algarismo já foi usado. Depois, 8 e 7.

10 × 9 × 8 × 7 = 5.040 senhas.

A pergunta que você faz em cada casinha é: **quantas opções sobraram agora?**

## Comece pela restrição

Muitas questões trazem uma condição: "o código não pode começar por zero", "o número tem de ser par", "a vogal vem primeiro". A regra de ouro é **preencher primeiro a casinha que tem restrição**.

Exemplo: quantos números de 3 algarismos diferentes existem? O primeiro algarismo não pode ser 0 (senão o número teria só 2 algarismos). Então:

- 1ª casinha (centena): 9 opções (de 1 a 9).
- 2ª casinha (dezena): 9 opções (de 0 a 9, menos o já usado).
- 3ª casinha (unidade): 8 opções.

9 × 9 × 8 = 648 números.

Se a restrição estiver no fim, comece pelo fim. Para um número par de 3 algarismos, podendo repetir, a unidade tem 5 opções (0, 2, 4, 6 ou 8), a centena tem 9 e a dezena tem 10: 5 × 9 × 10 = 450.

## Quando é "ou": o princípio aditivo

Nem tudo se multiplica. Se a situação pede **uma coisa ou outra**, e as duas não acontecem juntas, os casos se **somam**. Esse é o **princípio aditivo**.

Para ir ao centro, você pode pegar um de 4 ônibus ou um de 2 trens. São 4 + 2 = 6 opções. Você não pega um ônibus e um trem: escolhe um dos dois meios.

Um resumo que ajuda: **"e" multiplica, "ou" soma**. Com cuidado: "ou" só soma direto quando os dois grupos não têm nada em comum.

```navidareal
É por causa do princípio multiplicativo que senhas maiores são mais seguras. Cada algarismo a mais multiplica por 10 o número de senhas possíveis. Trocar algarismos por letras e algarismos aumenta ainda mais: cada casinha passa a ter 36 opções (26 letras e 10 algarismos), em vez de 10. Uma senha de 4 casinhas assim tem 36 × 36 × 36 × 36 = 1.679.616 possibilidades.
```

```verificar
Quantos números de 2 algarismos diferentes existem (de 10 a 98)?
- 90
+ 81
- 100
> A dezena não pode ser 0: 9 opções. A unidade pode ser qualquer algarismo, menos o já usado: 9 opções. 9 × 9 = 81. O 90 conta também os números com algarismos repetidos, como 11 e 22.
```

## Exemplo resolvido

**Um sistema pede uma senha com 2 letras seguidas de 2 algarismos, como AB12. Use as 26 letras do alfabeto. (a) Quantas senhas existem, podendo repetir? (b) E sem repetir nenhuma letra nem nenhum algarismo?**

1. **Desenhe as casinhas:** [letra] [letra] [algarismo] [algarismo].
2. **(a) Com repetição:** 26 × 26 × 10 × 10. Primeiro, 26 × 26 = 676. Depois, 10 × 10 = 100. Total: 676 × 100 = 67.600.
3. **(b) Sem repetição:** a segunda letra tem uma opção a menos, e o segundo algarismo também. 26 × 25 × 10 × 9.
4. 26 × 25 = 650. 10 × 9 = 90. Total: 650 × 90 = 58.500.

Confira: a resposta sem repetição tem de ser menor, porque é um caso particular da outra. 58.500 é menor que 67.600. A diferença, 9.100, são as senhas com letra ou algarismo repetido.

## Como isso cai no ENEM

- **Formatos:** senhas, códigos, placas, cardápios, roupas, caminhos num mapa, bandeiras pintadas com cores diferentes, números com algarismos que obedecem a uma regra. Quase sempre há uma condição que muda uma das casinhas.
- **Habilidades:** H2 (identificar padrões numéricos ou princípios de contagem), a principal, e H3 (resolver problemas com conhecimentos numéricos).
- **O que mais caiu:** nas provas de 2022 e 2023, classificadas pelo instituto, de 81 questões de Matemática, 1 (1,2%) foi deste tópico, e mais 2 (2,5%) foram de permutações, arranjos e combinações, que usam o mesmo princípio. A H2 teve 6 questões (7,4%), somando contagem e progressões. São só duas provas: é uma tendência, não uma promessa.
- **Armadilhas:**
  - Somar quando as escolhas são feitas uma e depois a outra (o certo é multiplicar).
  - Esquecer que o primeiro algarismo de um número não pode ser 0.
  - Não tirar o elemento já usado quando o enunciado diz "diferentes" ou "distintos".
  - Preencher a casinha com restrição por último, quando ela já não tem as opções que você contou.
  - Contar duas vezes um caso que pertence aos dois grupos de um "ou".

## Questão comentada

**Texto-base.** Uma rádio comunitária vai dar a cada ouvinte cadastrado um código numérico de três algarismos. Para evitar confusão na hora de ler no ar, os três algarismos do código devem ser diferentes entre si, o código não pode começar por zero, e ele deve ser um número ímpar.

**Comando.** A quantidade de códigos diferentes que podem ser formados é

A) 648.
B) 450.
C) 405.
D) 360.
E) 320.

**Resolução.**

1. Há duas restrições: o fim (ímpar) e o começo (não começa por 0). Comece pela unidade, que tem a regra mais forte.
2. **Unidade:** 1, 3, 5, 7 ou 9. São 5 opções.
3. **Centena:** não pode ser 0 nem o algarismo usado na unidade. De 10 algarismos, tiram-se 2: 8 opções.
4. **Dezena:** pode ser 0, mas não pode repetir os dois já usados. 10 − 2 = 8 opções.
5. Total: 5 × 8 × 8 = 320.

**Gabarito: E.**

**Por que as outras não:**

- A) 648 é 9 × 9 × 8: todos os números de 3 algarismos diferentes. Faltou a condição de ser ímpar.
- B) 450 é 9 × 10 × 5: números ímpares de 3 algarismos, mas permitindo repetir algarismos.
- C) 405 é 9 × 9 × 5: você começou pela centena e, no fim, deu 5 opções à unidade sem tirar o ímpar que já podia estar na centena.
- D) 360 é 5 × 9 × 8: você começou certo pela unidade, mas deu 9 opções à centena, esquecendo de tirar o algarismo da unidade.

```realidade
Pense numa escolha que você faz quase todo dia: o caminho até o trabalho, a roupa, o que comer no café. Quantas opções há em cada parte? Multiplique e descubra de quantos jeitos diferentes o seu dia poderia começar.
```

## Resumo

- Escolhas em sequência ("e") se multiplicam. Escolhas alternativas ("ou", sem nada em comum) se somam.
- Uma casinha para cada escolha. Em cada uma, quantas opções sobraram naquele momento.
- "Diferentes" ou "distintos": cada casinha tem uma opção a menos que a anterior.
- Comece pela casinha que tem restrição.
- O primeiro algarismo de um número não pode ser zero.

## Para aprofundar

- [Permutações, arranjos e combinações](/trilhas/enem-matematica-estatistica-e-probabilidade/permutacoes-arranjos-e-combinacoes)
- [Probabilidade simples](/trilhas/enem-matematica-estatistica-e-probabilidade/probabilidade-simples)
- [Análise combinatória](/trilhas/matematica-medio/analise-combinatoria)
- [Matemática: o que mais cai](/trilhas/enem-por-area/matematica-o-que-mais-cai)
