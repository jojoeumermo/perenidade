---
titulo: "Teoria dos conjuntos"
resumo: "Funções, correspondências e a descoberta de que existem infinitos maiores que outros."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Contemporary Mathematics, seção 1.1, Basic Set Concepts"
    autor: "Donna Kirk e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/contemporary-mathematics/pages/1-1-basic-set-concepts"
  - titulo: "Contemporary Mathematics, seção 1.2, Subsets"
    autor: "Donna Kirk e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/contemporary-mathematics/pages/1-2-subsets"
  - titulo: "Contribuições para a fundamentação da teoria dos números transfinitos"
    autor: "Georg Cantor"
    ano: "1895"
quiz:
  - pergunta: "Quantos subconjuntos tem o conjunto {a, b, c}?"
    opcoes: ["3", "6", "8"]
    resposta: 2
    explicacao: "Cada elemento pode entrar ou não: 2 × 2 × 2 = 8, contando o vazio e o próprio conjunto."
  - pergunta: "O conjunto dos números pares tem 'menos' elementos que o dos números naturais?"
    opcoes: ["Sim, a metade", "Não: dá para emparelhar cada natural com um par, sem sobrar nenhum", "Não dá para comparar infinitos"]
    resposta: 1
    explicacao: "A correspondência n → 2n liga cada natural a um par diferente e alcança todos os pares. Os dois conjuntos têm o mesmo tamanho."
  - pergunta: "O que Cantor demonstrou sobre os números reais?"
    opcoes: ["Que são tantos quantos os naturais", "Que não podem ser postos em lista: seu infinito é maior que o dos naturais", "Que são finitos"]
    resposta: 1
    explicacao: "Pelo argumento da diagonal, qualquer lista de números reais deixa algum de fora."
---

A aula [Conjuntos e intervalos](/trilhas/matematica-medio/conjuntos-e-intervalos) apresenta a linguagem básica: pertencer, união, interseção. Aqui vamos mais longe, até a pergunta que deu origem à teoria: o que é o infinito?

## O conjunto das partes

Dado um conjunto A, pode-se formar o conjunto de **todos os seus subconjuntos**, chamado conjunto das partes de A.

Para A = {a, b, c}: ∅, {a}, {b}, {c}, {a, b}, {a, c}, {b, c} e {a, b, c}. São 8.

Para montar um subconjunto, decide-se, elemento por elemento, se ele entra ou não: duas opções para cada um. Um conjunto com n elementos tem **2^n** subconjuntos. Com 10 elementos, 1.024; com 20, mais de um milhão.

## Produto cartesiano

O **produto cartesiano** A × B é o conjunto de todos os pares (a, b), com a em A e b em B. Se A = {1, 2} e B = {x, y}, então A × B = {(1, x), (1, y), (2, x), (2, y)}.

O plano cartesiano é ℝ × ℝ: todos os pares de números reais. Uma tabela de banco de dados é um subconjunto de um produto cartesiano (nomes × datas × valores).

## Funções, com precisão

Uma **função** de A em B associa a cada elemento de A exatamente um elemento de B. Três tipos importam:

| Tipo | Significa | Exemplo |
| --- | --- | --- |
| injetora | elementos diferentes vão a elementos diferentes | cada pessoa e o seu CPF |
| sobrejetora | todo elemento de B é alcançado | cada pessoa e o seu mês de nascimento |
| bijetora | as duas coisas ao mesmo tempo | cada cadeira numerada de um teatro lotado e o seu ocupante |

Uma **bijeção** é um emparelhamento perfeito: ninguém sobra de nenhum dos lados.

## Contar é emparelhar

Como saber se há tantas cadeiras quantas pessoas em uma sala, sem contar? Peça que todos se sentem. Se não sobrar cadeira nem pessoa, as quantidades são iguais.

Essa é a definição de "mesmo tamanho" que serve para qualquer conjunto: **dois conjuntos têm a mesma cardinalidade quando existe uma bijeção entre eles**. Para conjuntos finitos, isso coincide com contar. Para os infinitos, as surpresas começam.

## A parte do tamanho do todo

Os números pares são uma parte dos naturais. Parece claro que são "a metade". Mas veja o emparelhamento:

```
0  1  2  3  4  5 ...
↓  ↓  ↓  ↓  ↓  ↓
0  2  4  6  8  10 ...
```

Cada natural n fica com o par 2n. Nenhum natural sobra; nenhum par sobra. Pela definição, os dois conjuntos têm **o mesmo tamanho**.

Galileu notou algo parecido em 1638, com os quadrados perfeitos, e concluiu que "maior" e "menor" não se aplicariam ao infinito. Dois séculos e meio depois, o matemático alemão Georg Cantor tirou a conclusão oposta: aplicam-se, só que de outro jeito. Em um conjunto infinito, **uma parte pode ter o tamanho do todo**. Longe de ser um defeito, essa é a propriedade que caracteriza os conjuntos infinitos.

### O hotel de Hilbert

O matemático David Hilbert ilustrou a ideia com um hotel de infinitos quartos, numerados 1, 2, 3..., todos ocupados. Chega um hóspede. O gerente pede a cada um que passe para o quarto seguinte (do n para o n + 1), e o quarto 1 fica livre. Chega um ônibus com infinitos passageiros. O gerente manda cada hóspede para o quarto de número dobrado (do n para o 2n), e todos os quartos ímpares ficam livres.

## Conjuntos enumeráveis

Um conjunto infinito é **enumerável** quando pode ser emparelhado com os naturais, isto é, quando os seus elementos podem ser postos em uma **lista** que alcance todos.

- Os **inteiros** são enumeráveis: 0, 1, −1, 2, −2, 3, −3...
- Os **racionais** também. Cantor mostrou como percorrer todas as frações em zigue-zague, sem deixar nenhuma de fora. Entre dois racionais quaisquer há infinitos outros, e ainda assim eles cabem em uma lista.

Até aqui, parecia que todo infinito era do mesmo tamanho.

```verificar
Qual das correspondências abaixo é uma bijeção entre os naturais (0, 1, 2, 3...) e os números ímpares (1, 3, 5, 7...)?
- n → 2n
+ n → 2n + 1
- n → n + 1
> Teste: para onde vão o 0, o 1 e o 2? Todos os ímpares são alcançados, cada um uma só vez?
```

## O infinito maior

Em 1874, Cantor demonstrou que os **números reais não são enumeráveis**. Em 1891, deu a prova que ficou famosa, o **argumento da diagonal**.

Suponha que alguém afirme ter uma lista com todos os números reais entre 0 e 1:

```
1º:  0, 5 1 7 3 ...
2º:  0, 3 3 3 3 ...
3º:  0, 1 4 1 5 ...
4º:  0, 9 0 0 2 ...
...
```

Construa um novo número assim: a primeira casa decimal é diferente da primeira casa do 1º número; a segunda, diferente da segunda casa do 2º; a terceira, diferente da terceira casa do 3º; e assim por diante. Na lista acima, percorrendo a diagonal (5, 3, 1, 2...) e trocando cada algarismo, obtém-se, por exemplo, 0,6423...

Esse número **não está na lista**: difere do 1º na primeira casa, do 2º na segunda, do enésimo na enésima. E isso vale para qualquer lista que se proponha. Logo, nenhuma lista contém todos os reais.

Há, portanto, **mais** números reais que naturais, embora os dois conjuntos sejam infinitos. Existem infinitos de tamanhos diferentes.

## Uma escada sem fim

Cantor provou ainda que o conjunto das partes de um conjunto é sempre maior que o próprio conjunto, mesmo para os infinitos. Tomando as partes das partes, e as partes disso, obtém-se uma escada de infinitos cada vez maiores, sem último degrau.

Ele chamou de ℵ₀ (álefe-zero) o tamanho dos naturais, o menor infinito. E perguntou: existe algum infinito entre o dos naturais e o dos reais? A conjectura de que não existe ficou conhecida como **hipótese do contínuo**. A resposta, obtida por Kurt Gödel em 1940 e por Paul Cohen em 1963, foi inesperada: com os axiomas usuais da teoria dos conjuntos, a hipótese não pode ser provada nem refutada.

## A crise e os axiomas

A teoria de Cantor tratava como conjunto qualquer coleção que se pudesse descrever. Em 1901, o filósofo Bertrand Russell mostrou que isso leva a uma contradição. A versão popular é a do barbeiro: em uma vila, o barbeiro faz a barba de todos os homens que não se barbeiam a si mesmos, e só desses. Quem faz a barba do barbeiro? Se ele se barbeia, não deveria; se não se barbeia, deveria.

Na versão original: considere "o conjunto de todos os conjuntos que não pertencem a si mesmos". Ele pertence a si mesmo? Qualquer resposta se contradiz.

A saída foi restringir o que pode ser chamado de conjunto, por meio de **axiomas**. O sistema mais usado, construído a partir dos trabalhos de Ernst Zermelo e Abraham Fraenkel no começo do século XX, é a base sobre a qual quase toda a matemática atual é escrita.

## Resistência

As ideias de Cantor foram combatidas por matemáticos influentes do seu tempo, que consideravam um absurdo tratar o infinito como uma totalidade acabada. Hilbert tomou o partido dele com uma frase que ficou célebre: ninguém nos expulsará do paraíso que Cantor criou para nós.

A história lembra que a matemática não avança só por acúmulo tranquilo de resultados. Ideias novas contrariam certezas antigas, e a comunidade que hoje as ensina como óbvias já as tratou como escândalo.

## Para praticar

1. Liste todos os subconjuntos de {1, 2}. Quantos subconjuntos tem um conjunto com 5 elementos?
2. Com A = {1, 2, 3} e B = {x, y}, quantos pares tem A × B?
3. A função f(x) = x², dos reais nos reais, é injetora? É sobrejetora?
4. Escreva uma bijeção entre os naturais e os múltiplos de 5 (0, 5, 10, 15...).
5. No hotel de Hilbert lotado, chegam três hóspedes novos. O que o gerente faz?
6. Explique, com as suas palavras, por que o número construído pela diagonal não pode estar na lista.

**Respostas:** 1) ∅, {1}, {2} e {1, 2}; 32. 2) 6. 3) Não é injetora (2 e −2 dão 4) nem sobrejetora (nenhum real tem quadrado −1). 4) n → 5n. 5) Manda cada hóspede do quarto n para o quarto n + 3; ficam livres os quartos 1, 2 e 3. 6) Porque ele difere de cada número da lista em pelo menos uma casa decimal.
