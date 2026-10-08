---
titulo: "Arrays em PHP"
resumo: "Listas e tabelas de chave e valor: a estrutura de dados mais usada da linguagem."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Manual do PHP: arrays"
    autor: "The PHP Group"
    url: "https://www.php.net/manual/pt_BR/language.types.array.php"
  - titulo: "Manual do PHP: estruturas de controle"
    autor: "The PHP Group"
    url: "https://www.php.net/manual/pt_BR/language.control-structures.php"
quiz:
  - pergunta: "Em $frutas = ['uva', 'caju', 'manga'], qual é o valor de $frutas[0]?"
    opcoes: ["uva", "caju", "Dá erro"]
    resposta: 0
    explicacao: "A contagem das posições começa em zero."
  - pergunta: "O que é um array associativo?"
    opcoes: ["Um array que só aceita números", "Um array em que cada valor é guardado sob uma chave com nome", "Dois arrays ligados entre si"]
    resposta: 1
    explicacao: "Em vez de posições numeradas, usam-se chaves como 'nome' ou 'preco'."
  - pergunta: "Como se acrescenta um item no fim de um array?"
    opcoes: ["$lista[] = 'novo';", "$lista + 'novo';", "add($lista, 'novo');"]
    resposta: 0
    explicacao: "Colchetes vazios dizem ao PHP para usar a próxima posição livre."
---

## Lista simples

Um **array** guarda vários valores sob um nome só. Escreve-se entre colchetes:

```php
<?php
$frutas = ["uva", "caju", "manga"];
echo $frutas[0], "\n";
echo $frutas[2], "\n";
echo count($frutas), "\n";
```

As posições (índices) começam em **zero**. `count` devolve a quantidade de itens.

Para trocar um item ou acrescentar outro no fim:

```php
<?php
$frutas = ["uva", "caju", "manga"];
$frutas[1] = "acerola";
$frutas[] = "goiaba";
print_r($frutas);
```

`print_r` mostra o array inteiro de forma legível. Use-o para conferir o que há dentro de uma variável.

## Array associativo: chave e valor

Em vez de posições numeradas, você pode dar **nome** a cada valor. A seta `=>` liga a chave ao valor:

```php
<?php
$produto = [
    "nome" => "Feijão carioca",
    "preco" => 8.9,
    "estoque" => 40,
];
echo $produto["nome"], " custa R$ ", number_format($produto["preco"], 2, ",", "."), "\n";
```

É assim que o PHP representa quase tudo: uma linha do banco de dados, os campos de um formulário, as configurações de um site.

```verificar
No array $produto acima, como se lê a quantidade em estoque?
- $produto[2]
+ $produto["estoque"]
- $produto->estoque
> Em um array associativo, o valor é buscado pela chave, escrita entre aspas.
```

## Percorrendo com foreach

Só os valores:

```php
<?php
$notas = [7.5, 9.0, 6.0, 8.5];
foreach ($notas as $nota) {
    echo $nota >= 7 ? "$nota aprovado\n" : "$nota recuperação\n";
}
```

A forma `condição ? valor_se_sim : valor_se_não` é o **operador ternário**: um `if` curto que cabe em uma linha.

Chaves e valores:

```php
<?php
$precos = ["arroz" => 6.5, "feijão" => 8.9, "óleo" => 7.2];
foreach ($precos as $item => $preco) {
    echo "$item: R$ " . number_format($preco, 2, ",", ".") . "\n";
}
```

## Funções prontas para arrays

```php
<?php
$notas = [7.5, 9.0, 6.0, 8.5];
echo array_sum($notas), "\n";
echo max($notas), "\n";
echo min($notas), "\n";
echo array_sum($notas) / count($notas), "\n";
sort($notas);
print_r($notas);
var_dump(in_array(9.0, $notas));
```

- `array_sum` soma; `max` e `min` acham os extremos;
- `sort` põe o próprio array em ordem crescente;
- `in_array` diz se um valor está no array.

## Lista de registros

Na prática, é comum ter um array de arrays: uma lista em que cada item é um registro.

```php
<?php
$alunos = [
    ["nome" => "Ana", "nota" => 8.0],
    ["nome" => "Bento", "nota" => 5.5],
    ["nome" => "Clara", "nota" => 9.5],
];
foreach ($alunos as $aluno) {
    $situacao = $aluno["nota"] >= 6 ? "aprovado" : "recuperação";
    echo "{$aluno['nome']}: $situacao\n";
}
```

Dentro de aspas duplas, um valor de array vai entre chaves: `{$aluno['nome']}`.

## Para praticar

1. Crie um array com as temperaturas de uma semana e mostre a maior, a menor e a média.
2. Crie um array associativo com três produtos e seus preços, e mostre o total da compra.
3. A partir de um array de números, monte outro só com os pares.
