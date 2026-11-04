---
titulo: "Funções em PHP"
resumo: "Como criar funções, declarar os tipos do que entra e do que sai, e por que isso evita erros."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Manual do PHP: tipos"
    autor: "The PHP Group"
    url: "https://www.php.net/manual/pt_BR/language.types.php"
  - titulo: "Manual do PHP: um tutorial simples"
    autor: "The PHP Group"
    url: "https://www.php.net/manual/pt_BR/tutorial.php"
quiz:
  - pergunta: "Qual palavra cria uma função em PHP?"
    opcoes: ["def", "function", "func"]
    resposta: 1
    explicacao: "function, seguida do nome, dos parâmetros entre parênteses e do bloco entre chaves."
  - pergunta: "Na declaração function area(float $l, float $a): float, o que significa o último float?"
    opcoes: ["O tipo do valor que a função devolve", "O tipo do primeiro parâmetro", "Nada: é um comentário"]
    resposta: 0
    explicacao: "Depois dos dois-pontos vem o tipo de retorno."
  - pergunta: "Uma variável criada fora da função pode ser usada dentro dela, sem mais nada?"
    opcoes: ["Sim", "Não: a função só enxerga os seus parâmetros e as variáveis criadas dentro dela", "Só se for um número"]
    resposta: 1
    explicacao: "Em PHP o escopo é fechado. O jeito certo de levar um valor para dentro da função é passá-lo como parâmetro."
---

## O que você vai aprender

Ao fim desta aula você vai saber criar funções em PHP, com parâmetros, tipos e valor padrão, devolver resultados com `return` e entender por que a função só enxerga o que recebe.

## Definir e chamar

```php
<?php
function saudacao(string $nome): void
{
    echo "Bom dia, $nome!\n";
}

saudacao("Marta");
saudacao("João");
```

- `function` cria a função;
- `string $nome` é um **parâmetro**, com o tipo declarado;
- `: void` avisa que a função não devolve nada (ela só mostra algo).

A função só é executada quando é **chamada**, o que aqui acontece duas vezes.

## Devolvendo um resultado

`return` entrega o valor a quem chamou. A partir daí ele pode ser guardado, somado, comparado:

```php
<?php
function area_retangulo(float $largura, float $altura): float
{
    return $largura * $altura;
}

$sala = area_retangulo(4, 5);
$quarto = area_retangulo(3, 3);
echo "Área total: ", $sala + $quarto, " m²\n";
```

Regra prática: função que **calcula** devolve com `return`; quem decide o que mostrar na tela é o código que a chamou.

## Por que declarar os tipos

O PHP não obriga a declarar tipos, mas vale a pena. Com eles, um engano aparece na hora, com uma mensagem clara, em vez de produzir um resultado errado em silêncio:

```php
<?php
function dobro(int $n): int
{
    return $n * 2;
}

echo dobro(21), "\n";
echo dobro("abc");
```

A segunda chamada é interrompida com um `TypeError`: a função esperava um número inteiro e recebeu um texto.

```verificar
O que mostra echo dobro(dobro(3)); usando a função acima?
- 6
+ 12
- 9
> Resolva de dentro para fora: primeiro dobro(3).
```

## Valor padrão

```php
<?php
function preco_final(float $valor, float $desconto = 0): float
{
    return $valor - $valor * $desconto / 100;
}

echo preco_final(200), "\n";
echo preco_final(200, 10), "\n";
```

Se o segundo valor não for informado, vale o padrão (zero).

## Escopo: cada função na sua mesa

Diferente de outras linguagens, uma função em PHP **não enxerga** as variáveis de fora:

```php
<?php
$taxa = 10;

function com_taxa(float $valor, float $taxa): float
{
    return $valor + $valor * $taxa / 100;
}

echo com_taxa(50, $taxa);
```

O valor de `$taxa` entra na função porque foi passado como parâmetro. É o jeito certo: a função deixa claro tudo de que precisa.

## Um exemplo completo

```php
<?php
function media(array $valores): float
{
    return array_sum($valores) / count($valores);
}

function situacao(float $nota): string
{
    return $nota >= 6 ? "aprovado" : "recuperação";
}

$notas = [7.5, 4.0, 6.5];
$m = media($notas);
echo "Média ", number_format($m, 1, ","), ": ", situacao($m), "\n";
```

Cada função faz uma coisa só e tem um nome que explica o que é.

## Para praticar

1. Escreva `eh_par(int $n): bool`.
2. Escreva `maior(float $a, float $b): float` sem usar `max`.
3. Escreva `formata_reais(float $valor): string`, que devolve o valor no formato `R$ 1.234,50`.

## Exemplo resolvido

**Um restaurante cobra 10% de serviço. Quanto paga quem consumiu R$ 80? E se a pessoa recusar o serviço?**

1. A conta é sempre a mesma: consumo mais uma porcentagem do consumo. Vale uma função.
2. Os dados que mudam são o consumo e a porcentagem: dois parâmetros. A porcentagem recebe o valor padrão 10, para quem não disser nada.
3. A função calcula e devolve com `return`; quem chama decide o que mostrar.

```php
<?php
function conta_com_servico(float $consumo, float $servico = 10): float
{
    return $consumo + $consumo * $servico / 100;
}

echo conta_com_servico(80), "\n";
echo conta_com_servico(80, 0), "\n";
```

A primeira chamada usa o padrão: 80 + 80 × 10 / 100 = 80 + 8 = 88. A segunda informa 0 e dá 80. O programa mostra 88 e 80.

## Resumo

- `function nome(tipo $parametro): tipo` cria a função; ela só roda quando é chamada.
- `return` devolve o resultado; função que calcula devolve, e quem chama decide o que mostrar.
- Declarar os tipos faz o engano aparecer na hora, como `TypeError`.
- Um parâmetro pode ter valor padrão.
- A função não enxerga as variáveis de fora: tudo de que precisa entra como parâmetro.
