---
titulo: "Conjuntos e intervalos"
resumo: "A linguagem que organiza a matemática: pertencer, unir, cruzar, e os tipos de número que existem."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Algebra and Trigonometry 2e, seção 1.1, Real Numbers: Algebra Essentials"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/1-1-real-numbers-algebra-essentials"
  - titulo: "Algebra and Trigonometry 2e, seção 2.7, Linear Inequalities and Absolute Value Inequalities"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/2-7-linear-inequalities-and-absolute-value-inequalities"
  - titulo: "Constituição da República Federativa do Brasil, artigo 14, parágrafo 1º"
    autor: "Brasil"
    ano: "1988"
    url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm"
quiz:
  - pergunta: "Numa turma de 30 pessoas, 18 gostam de samba, 15 de forró e 8 dos dois. Quantas não gostam de nenhum dos dois?"
    opcoes: ["5", "3", "0"]
    resposta: 0
    explicacao: "Gostam de pelo menos um: 18 + 15 − 8 = 25. Os 8 seriam contados duas vezes. Sobram 30 − 25 = 5."
  - pergunta: "Qual destes números NÃO é racional?"
    opcoes: ["0,75", "√2", "−3"]
    resposta: 1
    explicacao: "√2 não pode ser escrito como fração de inteiros: é irracional. 0,75 = 3/4 e −3 = −3/1."
  - pergunta: "Como se escreve, em intervalo, 'os números maiores que 3 e menores ou iguais a 10'?"
    opcoes: ["[3, 10]", "]3, 10]", "]3, 10["]
    resposta: 1
    explicacao: "O 3 fica de fora (colchete virado para fora) e o 10 entra (colchete virado para dentro)."
---

## Juntar coisas em um grupo

Um **conjunto** é uma coleção de coisas, chamadas **elementos**. Os moradores de uma rua, as letras do seu nome, os números pares. A ideia é simples, e quase toda a matemática pode ser escrita com ela.

Escreve-se um conjunto entre chaves, listando os elementos ou dizendo a regra:

- A = {2, 4, 6, 8}
- B = {x tal que x é um estado da região Sul}

Para dizer que um elemento **pertence** a um conjunto usa-se ∈; para dizer que não pertence, ∉. Assim, 4 ∈ A e 5 ∉ A.

O conjunto sem elemento nenhum é o **conjunto vazio**, escrito ∅. Quando todos os elementos de um conjunto estão dentro de outro, ele é um **subconjunto**: {2, 4} ⊂ A.

## Operações entre conjuntos

Sejam A = {1, 2, 3, 4, 5, 6} e B = {4, 5, 6, 7, 8}.

| Operação | Símbolo | Significa | Resultado |
| --- | --- | --- | --- |
| União | A ∪ B | está em A **ou** em B | {1, 2, 3, 4, 5, 6, 7, 8} |
| Interseção | A ∩ B | está em A **e** em B | {4, 5, 6} |
| Diferença | A − B | está em A e não está em B | {1, 2, 3} |

O "ou" da matemática inclui o caso dos dois: quem está em A e em B também está na união.

## Contar sem contar duas vezes

Numa turma de 30 pessoas, 18 gostam de samba, 15 gostam de forró e 8 gostam dos dois. Quantas gostam de pelo menos um?

Se você somar 18 + 15, os 8 que gostam dos dois entram duas vezes. Tire uma:

```conta
18 + 15 − 8 = 25 gostam de pelo menos um
30 − 25 = 5 não gostam de nenhum
```

Desenhar dois círculos que se cruzam (o **diagrama de Venn**) ajuda: no cruzamento vão os 8; só samba, 18 − 8 = 10; só forró, 15 − 8 = 7; fora dos círculos, 5. Toda pesquisa em que a pessoa pode marcar mais de uma resposta pede esse cuidado.

```verificar
Em uma pesquisa com 40 trabalhadores, 25 usam ônibus, 20 usam trem e 10 usam os dois. Quantos usam só ônibus?
- 25
+ 15
- 5
> Dos 25 que usam ônibus, tire os que também usam trem.
```

## Os conjuntos numéricos

Os números foram sendo criados à medida que os anteriores não davam conta de um problema.

| Conjunto | Símbolo | O que tem | Para que foi preciso |
| --- | --- | --- | --- |
| Naturais | ℕ | 0, 1, 2, 3... | contar |
| Inteiros | ℤ | os naturais e os negativos | registrar dívidas e faltas |
| Racionais | ℚ | tudo o que se escreve como fração de inteiros | repartir e medir |
| Reais | ℝ | os racionais e os irracionais | medir qualquer comprimento |

Cada conjunto contém o anterior: ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ.

Os **racionais** incluem as frações, os decimais que terminam (0,75) e as dízimas periódicas (0,333...). Os **irracionais** são os números cuja parte decimal nunca termina nem se repete, como √2 = 1,41421... e π = 3,14159... A diagonal de um quadrado de lado 1 mede exatamente √2: é um comprimento que nenhuma fração consegue expressar.

## Intervalos

Um **intervalo** é um pedaço contínuo da reta dos números reais. Em vez de listar os elementos (são infinitos), dizem-se as pontas.

| Escrita | Significa | Na linguagem das desigualdades |
| --- | --- | --- |
| [2, 5] | de 2 a 5, com as duas pontas | 2 ≤ x ≤ 5 |
| ]2, 5[ | de 2 a 5, sem as pontas | 2 < x < 5 |
| [2, 5[ | com o 2, sem o 5 | 2 ≤ x < 5 |
| [18, +∞[ | de 18 em diante | x ≥ 18 |

O colchete virado **para dentro** inclui a ponta; virado **para fora**, exclui. Muitos livros usam parênteses para a ponta excluída: (2, 5) em vez de ]2, 5[. Do lado do infinito, o colchete é sempre aberto, porque infinito não é um número que se alcance.

### Um exemplo da Constituição

O artigo 14 da Constituição diz que o voto é obrigatório para os maiores de 18 anos e facultativo para os maiores de 70 e para os que têm 16 ou 17 anos (e também para os analfabetos). Em intervalos de idade:

- voto facultativo: [16, 18[
- voto obrigatório: [18, 70]
- voto facultativo outra vez: ]70, +∞[

Leis, editais e regras de benefício estão cheios de intervalos escondidos em expressões como "até", "a partir de", "mais de" e "no mínimo". Ler com atenção se a ponta entra ou não é o que decide se você tem ou não o direito.

## Para praticar

1. Com A = {1, 3, 5, 7, 9} e B = {3, 6, 9, 12}, ache A ∪ B, A ∩ B e A − B.
2. Diga se é verdadeiro ou falso: −2 ∈ ℕ; 0,5 ∈ ℚ; √9 é irracional.
3. Numa assembleia com 60 pessoas, 35 são do sindicato, 30 são da associação de moradores e 15 são das duas. Quantas não são de nenhuma?
4. Escreva em intervalo: x ≥ −1 e x < 4.
5. Um edital aceita candidatos "com mais de 18 e até 29 anos". Escreva como intervalo. Quem acabou de fazer 18 pode se inscrever?

**Respostas:** 1) {1, 3, 5, 6, 7, 9, 12}; {3, 9}; {1, 5, 7}. 2) Falso; verdadeiro; falso (√9 = 3). 3) 10. 4) [−1, 4[. 5) ]18, 29]. Pela letra do edital, só quem tem mais de 18; na prática, vale conferir como o edital conta a idade.
