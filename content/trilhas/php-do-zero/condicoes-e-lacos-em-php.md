---
titulo: "Condições e laços em PHP"
resumo: "if, elseif e else para decidir; while, for e foreach para repetir."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Manual do PHP: estruturas de controle"
    autor: "The PHP Group"
    url: "https://www.php.net/manual/pt_BR/language.control-structures.php"
  - titulo: "Manual do PHP: um tutorial simples"
    autor: "The PHP Group"
    url: "https://www.php.net/manual/pt_BR/tutorial.php"
quiz:
  - pergunta: "Em PHP, o que delimita o bloco de um if?"
    opcoes: ["O recuo das linhas", "As chaves { }", "A palavra end"]
    resposta: 1
    explicacao: "As chaves marcam o começo e o fim do bloco. O recuo é só para facilitar a leitura, mas faça-o sempre."
  - pergunta: "Quantas vezes o bloco de for ($i = 1; $i <= 3; $i++) é executado?"
    opcoes: ["Duas", "Três", "Quatro"]
    resposta: 1
    explicacao: "Para $i igual a 1, 2 e 3. Quando $i chega a 4, a condição fica falsa e o laço termina."
  - pergunta: "O que $i++ faz?"
    opcoes: ["Soma 1 a $i", "Dobra o valor de $i", "Compara $i com ele mesmo"]
    resposta: 0
    explicacao: "É um atalho para $i = $i + 1."
---

## O que você vai aprender

Ao fim desta aula você vai saber fazer o PHP decidir entre caminhos com `if`, `elseif` e `else`, e repetir tarefas com `while`, `for` e `foreach`, sem cair em laço infinito.

## Decidir com if

```php
<?php
$idade = 17;
if ($idade >= 16) {
    echo "Pode votar.";
} else {
    echo "Ainda não pode votar.";
}
```

Diferenças em relação ao que você viu em lógica:

- a condição vai **entre parênteses**;
- o bloco vai **entre chaves**;
- o recuo não é obrigatório, mas mantenha-o: código sem recuo é difícil de ler.

Para mais de dois caminhos, use `elseif`. O PHP testa de cima para baixo e executa só o primeiro bloco verdadeiro:

```php
<?php
$nota = 7.5;
if ($nota >= 9) {
    echo "Excelente";
} elseif ($nota >= 6) {
    echo "Aprovado";
} elseif ($nota >= 4) {
    echo "Recuperação";
} else {
    echo "Reprovado";
}
```

## Operadores lógicos

| Operador | Significa |
| --- | --- |
| `&&` | e: as duas condições precisam ser verdadeiras |
| `\|\|` | ou: basta uma |
| `!` | não: inverte |

```php
<?php
$idade = 20;
$tem_titulo = true;
if ($idade >= 18 && $tem_titulo) {
    echo "Pode votar hoje.";
}
```

## Repetir com while

```php
<?php
$contador = 1;
while ($contador <= 5) {
    echo $contador, "\n";
    $contador++;
}
```

`$contador++` soma 1 à variável. Sem essa linha, a condição nunca ficaria falsa: seria um laço infinito.

## Repetir com for

O `for` reúne em uma linha as três partes de um laço com contador: **começo; condição; passo**.

```php
<?php
for ($i = 1; $i <= 10; $i++) {
    echo "7 x $i = " . (7 * $i) . "\n";
}
```

```verificar
Quais valores este laço mostra? for ($i = 0; $i < 3; $i++) { echo $i; }
- 1, 2, 3
+ 0, 1, 2
- 0, 1, 2, 3
> O laço começa em 0 e continua enquanto $i for menor que 3.
```

## Uma primeira olhada no foreach

Para percorrer uma lista de valores (um **array**, assunto da próxima aula), o PHP tem o `foreach`:

```php
<?php
$frutas = ["uva", "caju", "manga"];
foreach ($frutas as $fruta) {
    echo "- $fruta\n";
}
```

A cada volta, `$fruta` recebe um item da lista.

## break e continue

`break` sai do laço; `continue` pula para a próxima volta:

```php
<?php
for ($i = 1; $i <= 10; $i++) {
    if ($i === 4) {
        continue;
    }
    if ($i === 8) {
        break;
    }
    echo $i, " ";
}
```

Saem 1 2 3 5 6 7.

## Para praticar

1. Dado um número em uma variável, diga se ele é par ou ímpar.
2. Mostre a tabuada do 9.
3. Some os números de 1 a 100 com um laço e mostre o total (deve dar 5050).

## Qual laço usar

Os três laços fazem repetição, mas cada um combina com uma situação:

- **for**: quando você sabe quantas voltas quer dar ("de 1 a 10", "dez vezes");
- **while**: quando a repetição depende de algo que muda no caminho ("enquanto a condição for verdadeira"); lembre-se de alterar a variável dentro do bloco, para a condição um dia ficar falsa;
- **foreach**: quando há uma lista e você quer fazer algo com cada item dela.

E a condição pode ficar dentro do laço: a cada volta o programa decide o que fazer com aquele valor. É a combinação mais usada, e o exemplo a seguir mostra um caso.

## Exemplo resolvido

**Qual é a soma dos números pares de 1 a 10?**

1. Precisamos olhar cada número de 1 a 10: um `for` com `$i` indo de 1 a 10.
2. Precisamos de uma variável para ir somando, que começa em zero: `$total = 0`.
3. Em cada volta, só queremos os pares. Um número é par quando o resto da divisão por 2 é zero: `$i % 2 === 0`.
4. Se for par, somamos `$i` ao total.

```php
<?php
$total = 0;
for ($i = 1; $i <= 10; $i++) {
    if ($i % 2 === 0) {
        $total = $total + $i;
    }
}
echo "Soma dos pares: ", $total, "\n";
```

O laço passa por 2, 4, 6, 8 e 10 e o programa mostra `Soma dos pares: 30`.

Confira à mão: 2 + 4 + 6 + 8 + 10 = 30.

## Resumo

- `if`, `elseif` e `else` escolhem um caminho; a condição vai entre parênteses e o bloco entre chaves.
- `&&` (e), `||` (ou) e `!` (não) juntam condições.
- `while` repete enquanto a condição for verdadeira; sem mudar a variável, vira laço infinito.
- `for` reúne começo, condição e passo; `foreach` percorre uma lista.
- `break` sai do laço; `continue` pula para a próxima volta.
