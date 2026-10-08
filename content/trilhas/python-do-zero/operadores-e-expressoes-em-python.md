---
titulo: "Operadores e expressões em Python"
resumo: "Contas, comparações e os operadores lógicos e, ou e não."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "O tutorial de Python: uma introdução informal ao Python"
    autor: "Python Software Foundation"
    url: "https://docs.python.org/pt-br/3/tutorial/introduction.html"
  - titulo: "Pense em Python (2ª edição)"
    autor: "Allen B. Downey"
    ano: "2016"
    url: "https://penseallen.github.io/PensePython2e/"
quiz:
  - pergunta: "Quanto vale 17 // 5?"
    opcoes: ["3.4", "3", "2"]
    resposta: 1
    explicacao: "// é a divisão inteira: quantas vezes o 5 cabe inteiro no 17. Cabe 3 vezes."
  - pergunta: "Quanto vale 17 % 5?"
    opcoes: ["2", "3", "3.4"]
    resposta: 0
    explicacao: "% devolve o resto da divisão: 17 = 3 × 5 + 2."
  - pergunta: "Qual é o resultado de 10 > 5 and 3 > 8?"
    opcoes: ["True", "False", "Erro"]
    resposta: 1
    explicacao: "Com and, as duas partes precisam ser verdadeiras. A segunda (3 > 8) é falsa."
---

## Operadores aritméticos

| Operador | O que faz | Exemplo | Resultado |
| --- | --- | --- | --- |
| `+` | soma | `7 + 2` | `9` |
| `-` | subtração | `7 - 2` | `5` |
| `*` | multiplicação | `7 * 2` | `14` |
| `/` | divisão | `7 / 2` | `3.5` |
| `//` | divisão inteira | `7 // 2` | `3` |
| `%` | resto da divisão | `7 % 2` | `1` |
| `**` | potência | `7 ** 2` | `49` |

A divisão com `/` sempre devolve um número decimal (`float`), mesmo quando a conta é exata: `6 / 2` dá `3.0`.

O **resto** (`%`) parece estranho, mas é muito usado. Um número é par quando o resto da divisão por 2 é zero:

```python
numero = 14
print(numero % 2)
```

## Ordem das operações

Vale a mesma ordem da matemática: primeiro potências, depois multiplicações e divisões, por último somas e subtrações. Parênteses mudam a ordem:

```python
print(2 + 3 * 4)
print((2 + 3) * 4)
```

Na dúvida, use parênteses. Eles não custam nada e deixam a intenção clara.

## Comparações

Comparar dois valores produz um `bool`: `True` (verdadeiro) ou `False` (falso).

| Operador | Significa |
| --- | --- |
| `==` | igual a |
| `!=` | diferente de |
| `>` e `<` | maior que, menor que |
| `>=` e `<=` | maior ou igual, menor ou igual |

```python
idade = 16
print(idade >= 18)
print(idade == 16)
```

Cuidado com a armadilha clássica: um sinal de igual (`=`) **guarda**; dois (`==`) **comparam**.

```verificar
Qual linha pergunta se x vale 10?
- x = 10
+ x == 10
> Um sinal guarda um valor; dois sinais comparam.
```

## Operadores lógicos

Servem para juntar comparações:

- `and` (e): verdadeiro só se **as duas** partes forem verdadeiras;
- `or` (ou): verdadeiro se **pelo menos uma** for verdadeira;
- `not` (não): inverte.

```python
idade = 20
tem_titulo = True
print(idade >= 18 and tem_titulo)
print(idade < 16 or idade > 70)
print(not tem_titulo)
```

## Operadores com texto

Com textos, `+` junta e `*` repete:

```python
print("sol" + "dado")
print("-" * 20)
```

## Para praticar

1. Calcule quantas dúzias inteiras há em 100 ovos e quantos ovos sobram.
2. Dado um total de minutos, mostre quantas horas e quantos minutos isso dá (use `//` e `%`).
3. Escreva uma expressão que seja verdadeira quando um número está entre 1 e 10, inclusive.
