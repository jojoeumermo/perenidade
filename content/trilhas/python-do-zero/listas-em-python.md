---
titulo: "Listas em Python"
resumo: "Como guardar vários valores em uma variável só, percorrê-los e modificá-los."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "O tutorial de Python: estruturas de dados"
    autor: "Python Software Foundation"
    url: "https://docs.python.org/pt-br/3/tutorial/datastructures.html"
  - titulo: "Pense em Python (2ª edição)"
    autor: "Allen B. Downey"
    ano: "2016"
    url: "https://penseallen.github.io/PensePython2e/"
quiz:
  - pergunta: "Na lista frutas = ['uva', 'caju', 'manga'], qual é o valor de frutas[1]?"
    opcoes: ["uva", "caju", "manga"]
    resposta: 1
    explicacao: "A contagem das posições começa em zero: frutas[0] é uva e frutas[1] é caju."
  - pergunta: "O que faz frutas.append('goiaba')?"
    opcoes: ["Apaga a lista", "Acrescenta goiaba no fim da lista", "Procura goiaba na lista"]
    resposta: 1
    explicacao: "append acrescenta um item no final."
  - pergunta: "O que devolve len([4, 8, 15, 16])?"
    opcoes: ["4", "16", "43"]
    resposta: 0
    explicacao: "len devolve a quantidade de itens. A soma (43) seria dada por sum."
---

## Vários valores, um nome só

Imagine guardar as notas de quarenta alunos. Criar quarenta variáveis seria um pesadelo. Uma **lista** guarda vários valores em ordem, sob um único nome. Ela é escrita entre colchetes, com os itens separados por vírgula:

```python
notas = [7.5, 9.0, 6.0, 8.5]
frutas = ["uva", "caju", "manga"]
print(notas)
print(frutas)
```

## Posições começam em zero

Cada item tem uma posição, o **índice**, e a contagem começa no **zero**:

```python
frutas = ["uva", "caju", "manga"]
print(frutas[0])
print(frutas[2])
print(frutas[-1])
```

O índice `-1` é um atalho para o último item. Pedir uma posição que não existe, como `frutas[3]`, causa um `IndexError`.

```verificar
Em uma lista com 5 itens, qual é o índice do último?
- 5
+ 4
- 6
> Se a contagem começa em zero, o quinto item fica em qual posição?
```

## Modificando a lista

```python
frutas = ["uva", "caju", "manga"]
frutas[1] = "acerola"
frutas.append("goiaba")
frutas.remove("uva")
print(frutas)
print(len(frutas))
```

- `lista[i] = valor` troca o item da posição `i`;
- `append` acrescenta no fim;
- `remove` tira a primeira ocorrência do valor;
- `len` diz quantos itens há.

## Percorrendo com for

O `for` da aula passada foi feito para isso: a cada volta, a variável recebe um item da lista.

```python
notas = [7.5, 9.0, 6.0, 8.5]
for nota in notas:
    if nota >= 7:
        print(nota, "aprovado")
    else:
        print(nota, "recuperação")
```

## Funções prontas

```python
notas = [7.5, 9.0, 6.0, 8.5]
print(sum(notas))
print(max(notas))
print(min(notas))
print(sum(notas) / len(notas))
print(sorted(notas))
```

A penúltima linha calcula a média: soma dividida pela quantidade. `sorted` devolve uma cópia em ordem crescente.

## Está na lista?

O operador `in` responde verdadeiro ou falso:

```python
convidados = ["Ana", "Bento", "Clara"]
print("Bento" in convidados)
print("Dora" in convidados)
```

## Fatias

Dois-pontos dentro dos colchetes recortam um pedaço. O começo entra, o fim fica de fora, como no `range`:

```python
letras = ["a", "b", "c", "d", "e"]
print(letras[1:4])
print(letras[:2])
print(letras[3:])
```

## Montando uma lista com dados digitados

```python
nomes = []
for i in range(3):
    nome = input("Nome: ")
    nomes.append(nome)
print("Chamada:", sorted(nomes))
```

## Para praticar

1. Crie uma lista com as temperaturas de uma semana e mostre a maior, a menor e a média.
2. Dada uma lista de números, crie outra só com os pares.
3. Leia cinco nomes e mostre-os em ordem alfabética, um por linha.
