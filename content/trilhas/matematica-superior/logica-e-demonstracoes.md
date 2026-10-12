---
titulo: "Lógica e demonstrações"
resumo: "O que torna um argumento válido e como se prova que uma afirmação vale em todos os casos, e não só nos que foram testados."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Contemporary Mathematics, seção 2.1, Statements and Quantifiers"
    autor: "Donna Kirk e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/contemporary-mathematics/pages/2-1-statements-and-quantifiers"
  - titulo: "Contemporary Mathematics, seção 2.4, Truth Tables for the Conditional and Biconditional"
    autor: "Donna Kirk e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/contemporary-mathematics/pages/2-4-truth-tables-for-the-conditional-and-biconditional"
  - titulo: "Contemporary Mathematics, seção 2.7, Logical Arguments"
    autor: "Donna Kirk e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/contemporary-mathematics/pages/2-7-logical-arguments"
  - titulo: "Os Elementos"
    autor: "Euclides"
    ano: "c. 300 a.C."
quiz:
  - pergunta: "Qual é a negação de 'todos os alunos passaram'?"
    opcoes: ["Nenhum aluno passou", "Pelo menos um aluno não passou", "Todos os alunos foram reprovados"]
    resposta: 1
    explicacao: "Para negar um 'todos', basta um caso contrário."
  - pergunta: "'Se chove, a rua fica molhada. A rua está molhada. Logo, choveu.' Esse argumento é:"
    opcoes: ["válido", "inválido: a rua pode ter sido molhada por outro motivo", "válido só no inverno"]
    resposta: 1
    explicacao: "É a falácia de afirmar o consequente. De 'se A, então B' e de B, não se conclui A."
  - pergunta: "A expressão n² + n + 41 dá número primo para n de 0 a 39. Isso prova que ela dá primo sempre?"
    opcoes: ["Sim, 40 casos bastam", "Não: para n = 40, o resultado é 41 × 41", "Sim, porque 41 é primo"]
    resposta: 1
    explicacao: "40² + 40 + 41 = 1.681 = 41². Exemplos, por mais numerosos, não substituem uma demonstração."
---

## Por que demonstrar

Nas ciências da natureza, uma teoria é aceita enquanto os experimentos a confirmam. Na matemática, o padrão é outro: uma afirmação só vira **teorema** quando é **demonstrada**, isto é, deduzida, passo a passo, de afirmações já aceitas. Depois disso, vale para sempre e em todos os casos.

Testar exemplos não basta. A expressão n² + n + 41, estudada por Euler, dá um número primo para n = 0, 1, 2, 3... até 39. Quarenta acertos seguidos. Em n = 40, falha: o resultado é 1.681 = 41 × 41.

## Proposições e conectivos

Uma **proposição** é uma frase que é verdadeira ou falsa: "7 é primo" (verdadeira), "Recife é a capital da Bahia" (falsa). Perguntas e ordens não são proposições.

Proposições se combinam com **conectivos**:

| Conectivo | Símbolo | "p ... q" é verdadeira quando |
| --- | --- | --- |
| não | ¬p | p é falsa |
| e | p ∧ q | as duas são verdadeiras |
| ou | p ∨ q | pelo menos uma é verdadeira |
| se... então | p → q | sempre, menos quando p é verdadeira e q é falsa |
| se e somente se | p ↔ q | as duas têm o mesmo valor |

O "ou" da lógica é inclusivo: vale também quando as duas são verdadeiras.

## O "se... então"

A condicional é o conectivo que mais confunde. "Se você pagar a mensalidade, entra no clube" só é **descumprida** em um caso: você paga e não entra. Se você não paga, a promessa não foi quebrada, entre você ou não.

A partir de "se p, então q", formam-se outras três frases:

| Nome | Forma | Exemplo |
| --- | --- | --- |
| original | se p, então q | se é recifense, é pernambucano |
| recíproca | se q, então p | se é pernambucano, é recifense |
| contrapositiva | se não q, então não p | se não é pernambucano, não é recifense |
| inversa | se não p, então não q | se não é recifense, não é pernambucano |

A **contrapositiva diz sempre o mesmo que a original**. A recíproca e a inversa, não: a original pode ser verdadeira e elas, falsas.

Confundir uma condicional com a sua recíproca é um dos erros de raciocínio mais comuns, dentro e fora da matemática. "Todo corrupto diz que é inocente" não permite concluir que quem diz que é inocente é corrupto.

## Todos e algum

Os **quantificadores** dizem a quantos casos uma afirmação se aplica: "para todo" (∀) e "existe" (∃).

Para negar, eles se trocam:

- a negação de "**todos** os alunos passaram" é "**existe** um aluno que não passou" (e não "nenhum passou");
- a negação de "**existe** um político honesto" é "**todo** político é desonesto".

Daí o poder do **contraexemplo**: para derrubar uma afirmação do tipo "todo", basta um caso. "Todo número primo é ímpar" cai com o 2.

## Argumentos válidos e falácias

Um argumento é **válido** quando a conclusão decorre das premissas: se elas forem verdadeiras, a conclusão não pode ser falsa. Validade não é o mesmo que verdade. Um argumento válido com premissa falsa pode concluir qualquer coisa.

Duas formas válidas:

- **De "se p, então q" e de p, conclui-se q.** Se estudo, passo. Estudei. Logo, passei.
- **De "se p, então q" e de não q, conclui-se não p.** Se estudo, passo. Não passei. Logo, não estudei.

Duas formas **inválidas**, muito parecidas com as de cima:

- **Afirmar o consequente:** Se chove, a rua molha. A rua está molhada. Logo, choveu. (Pode ter passado o caminhão-pipa.)
- **Negar o antecedente:** Se chove, a rua molha. Não choveu. Logo, a rua está seca.

```verificar
'Se a empresa está em crise, ela demite. A empresa demitiu. Logo, está em crise.' O argumento é válido?
- Sim
+ Não: é a falácia de afirmar o consequente
- Depende do tamanho da empresa
> Empresas também demitem com lucro alto. De 'se p, então q' e de q, não se conclui p.
```

## Como se demonstra

**Demonstração direta.** Parte-se da hipótese e chega-se à conclusão.

*A soma de dois números pares é par.* Um número par é da forma 2a; outro, 2b. A soma é 2a + 2b = 2(a + b), que é o dobro de um inteiro: é par.

**Pela contrapositiva.** Em vez de "se p, então q", prova-se "se não q, então não p".

*Se n² é par, então n é par.* Prova-se: se n é ímpar, então n² é ímpar. Um ímpar é da forma 2k + 1, e (2k + 1)² = 4k² + 4k + 1 = 2(2k² + 2k) + 1, que é ímpar.

**Por absurdo.** Supõe-se que a afirmação é falsa e chega-se a uma contradição.

*A raiz de 2 é irracional.* Suponha que não: que √2 = p/q, uma fração já simplificada. Elevando ao quadrado, p² = 2q². Então p² é par e, pelo resultado anterior, p é par: p = 2k. Substituindo, 4k² = 2q², isto é, q² = 2k². Então q também é par. Mas, se p e q são os dois pares, a fração não estava simplificada. Contradição. Logo, √2 não é fração nenhuma.

Essa demonstração tem mais de dois mil anos e continua sendo um modelo: curta, sem contas e definitiva.

**Por indução.** Serve para afirmações sobre todos os números naturais. Funciona como uma fila de dominós: mostra-se que o primeiro cai e que cada um derruba o seguinte.

*1 + 2 + ... + n = n(n + 1) ÷ 2.*

- Para n = 1: 1 = 1 × 2 ÷ 2. Vale.
- Suponha que vale para n. Somando n + 1 aos dois lados: n(n + 1) ÷ 2 + (n + 1) = (n + 1)(n + 2) ÷ 2, que é a fórmula para n + 1.

Logo, vale para todos.

## O ponto de partida

Toda demonstração se apoia em afirmações anteriores, e estas em outras. A cadeia tem de começar em algum lugar: nos **axiomas**, afirmações aceitas sem prova. Euclides organizou a geometria assim, a partir de cinco postulados.

Os axiomas não são "verdades evidentes": são escolhas. No século XIX, ao trocar um dos postulados de Euclides, os matemáticos obtiveram geometrias diferentes e perfeitamente coerentes, que mais tarde serviram à física.

E há um limite. Em 1931, o lógico Kurt Gödel demonstrou que, em qualquer sistema de axiomas coerente e capaz de expressar a aritmética, existem afirmações que não podem ser provadas nem refutadas dentro do próprio sistema. A matemática é o terreno mais seguro do conhecimento, e ela mesma provou que não é completa.

## Para que serve fora da matemática

Distinguir uma condicional da sua recíproca, saber negar um "todos", exigir que a conclusão decorra das premissas, procurar o contraexemplo: são ferramentas para ler um contrato, analisar um discurso e não ser levado por um argumento que só parece bom.

## Para praticar

1. Escreva a contrapositiva de "se é paulista, é brasileiro".
2. Negue: "todos os bancos cobram tarifa".
3. Válido ou inválido? "Se o salário sobe, o consumo sobe. O consumo subiu. Logo, o salário subiu."
4. Demonstre que a soma de dois números ímpares é par.
5. Dê um contraexemplo para: "todo múltiplo de 3 é ímpar".
6. Mostre por indução que 2 + 4 + 6 + ... + 2n = n(n + 1).

**Respostas:** 1) Se não é brasileiro, não é paulista. 2) Existe pelo menos um banco que não cobra tarifa. 3) Inválido (afirma o consequente). 4) (2a + 1) + (2b + 1) = 2(a + b + 1). 5) 6, por exemplo. 6) Para n = 1: 2 = 1 × 2. Supondo para n e somando 2(n + 1): n(n + 1) + 2(n + 1) = (n + 1)(n + 2).
