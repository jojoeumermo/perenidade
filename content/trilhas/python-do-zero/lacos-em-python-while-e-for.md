---
titulo: "Laços em Python: while e for"
resumo: "Como repetir instruções sem copiar e colar, e como evitar o laço que nunca termina."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "O tutorial de Python: mais ferramentas de controle de fluxo"
    autor: "Python Software Foundation"
    url: "https://docs.python.org/pt-br/3/tutorial/controlflow.html"
  - titulo: "Pense em Python (2ª edição)"
    autor: "Allen B. Downey"
    ano: "2016"
    url: "https://penseallen.github.io/PensePython2e/"
quiz:
  - pergunta: "Quais números range(5) produz?"
    opcoes: ["1, 2, 3, 4, 5", "0, 1, 2, 3, 4", "0, 1, 2, 3, 4, 5"]
    resposta: 1
    explicacao: "range(5) começa em 0 e para antes do 5: são cinco números, de 0 a 4."
  - pergunta: "O que causa um laço infinito com while?"
    opcoes: ["Usar números grandes", "A condição nunca se tornar falsa", "Esquecer o print"]
    resposta: 1
    explicacao: "Se nada dentro do laço muda a condição, ela continua verdadeira para sempre."
  - pergunta: "O que o comando break faz?"
    opcoes: ["Pausa o programa por um segundo", "Sai do laço imediatamente", "Pula para a próxima repetição"]
    resposta: 1
    explicacao: "break encerra o laço. Quem pula para a próxima volta é o continue."
---

## Repetir com while

`while` quer dizer "enquanto". O bloco é repetido **enquanto a condição for verdadeira**:

```python
contador = 1
while contador <= 5:
    print(contador)
    contador = contador + 1
print("Acabou!")
```

A cada volta, o Python testa a condição. A linha `contador = contador + 1` é essencial: sem ela, o contador ficaria em 1 para sempre e o laço nunca terminaria. Isso se chama **laço infinito**. Na ferramenta do site, um programa assim é interrompido depois de 15 segundos.

Um jeito mais curto de escrever a mesma soma é `contador += 1`.

## Repetir com for

Quando você sabe quantas vezes quer repetir, o `for` é mais simples. Ele percorre uma sequência, e a função `range` cria sequências de números:

```python
for numero in range(5):
    print(numero)
```

Saem os números 0, 1, 2, 3 e 4: `range(5)` começa no zero e para **antes** do 5. Para escolher o começo, passe dois valores; para escolher o passo, três:

```python
for numero in range(1, 6):
    print(numero)

for par in range(0, 11, 2):
    print(par)
```

```verificar
Quantas vezes o bloco de "for i in range(2, 8):" é executado?
- 8
+ 6
- 7
> Os valores são 2, 3, 4, 5, 6 e 7. O 8 fica de fora.
```

## Acumuladores

Um padrão que aparece o tempo todo: uma variável que vai somando a cada volta.

```python
total = 0
for numero in range(1, 101):
    total = total + numero
print(total)
```

O programa soma os números de 1 a 100 e mostra 5050.

## A tabuada

```python
n = int(input("Tabuada de qual número? "))
for i in range(1, 11):
    print(f"{n} x {i} = {n * i}")
```

## break e continue

- `break` sai do laço na hora;
- `continue` pula o resto da volta atual e vai para a próxima.

```python
for numero in range(1, 11):
    if numero == 4:
        continue
    if numero == 8:
        break
    print(numero)
```

Saem 1, 2, 3, 5, 6 e 7: o 4 foi pulado e, no 8, o laço acabou.

## Qual usar?

- **for**: quando a quantidade de repetições é conhecida ("dez vezes", "para cada item da lista").
- **while**: quando depende de algo que acontece no caminho ("até a pessoa acertar", "enquanto houver saldo").

## Para praticar

1. Mostre os números de 10 a 1, em contagem regressiva (dica: o passo de `range` pode ser negativo).
2. Some todos os números pares de 1 a 50.
3. Calcule o fatorial de um número digitado (5! = 5 × 4 × 3 × 2 × 1).
