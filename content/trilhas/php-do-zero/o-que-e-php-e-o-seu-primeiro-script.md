---
titulo: "O que é PHP e o seu primeiro script"
resumo: "Para que serve o PHP, onde ele roda e como escrever as primeiras linhas."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Manual do PHP: um tutorial simples"
    autor: "The PHP Group"
    url: "https://www.php.net/manual/pt_BR/tutorial.php"
  - titulo: "Manual do PHP: tipos"
    autor: "The PHP Group"
    url: "https://www.php.net/manual/pt_BR/language.types.php"
quiz:
  - pergunta: "Onde o código PHP de um site é executado?"
    opcoes: ["No navegador de quem visita", "No servidor, antes de a página ser enviada", "No roteador"]
    resposta: 1
    explicacao: "O servidor executa o PHP e envia ao navegador só o resultado, em geral HTML. O visitante não vê o código."
  - pergunta: "Como começa um bloco de código PHP?"
    opcoes: ["<php>", "<?php", "#!php"]
    resposta: 1
    explicacao: "A marca de abertura é <?php. Tudo o que vem depois dela é tratado como código."
  - pergunta: "O que termina cada instrução em PHP?"
    opcoes: ["Ponto e vírgula", "Dois-pontos", "Nada: basta mudar de linha"]
    resposta: 0
    explicacao: "Diferente do Python, em PHP cada instrução termina com ponto e vírgula."
---

## Para que serve

PHP é uma linguagem criada para construir páginas da web. A primeira versão foi publicada em 1995 pelo programador Rasmus Lerdorf. Hoje a sigla significa "PHP: Hypertext Preprocessor", e a linguagem é gratuita e de código aberto. Uma parte enorme dos sites que você visita, incluindo muitos blogs, lojas e portais, é feita com ela.

A ideia central: quando você pede uma página, o **servidor** executa o programa em PHP, monta a página na hora (com o seu nome, o seu carrinho, as notícias do dia) e envia o resultado pronto ao navegador. O visitante nunca vê o código PHP, só o que ele produziu.

Esta trilha supõe que você já fez [Lógica de programação](/trilhas/logica-de-programacao). Variáveis, condições, laços e funções são as mesmas ideias; o que muda é o jeito de escrever.

## Onde executar

Para um site de verdade, o PHP fica instalado em um servidor. Para aprender, basta a ferramenta [PHP no navegador](/ferramentas/php): escreva o código e aperte **Executar**.

## O primeiro script

```php
<?php
echo "Olá, mundo!";
```

Três coisas para notar:

1. **`<?php`** abre o código. Sem essa marca, o PHP trata o arquivo como texto comum e o copia para a saída sem executar nada.
2. **`echo`** escreve na saída. É o equivalente ao `print` de outras linguagens.
3. Cada instrução termina com **ponto e vírgula**. Esquecê-lo é o erro mais comum de quem começa.

Várias instruções são executadas de cima para baixo:

```php
<?php
echo "Bom dia!\n";
echo "Hoje é dia de aprender PHP.\n";
echo 2 + 3;
```

O `\n` dentro das aspas duplas é uma **quebra de linha**. Sem ele, tudo sairia grudado na mesma linha.

```verificar
O que acontece se você esquecer o ponto e vírgula no fim de uma linha de echo, com outra instrução logo abaixo?
- O PHP adivinha e continua
+ O PHP mostra um erro de sintaxe (Parse error)
- A linha é ignorada
> Releia o item 3 da lista: o ponto e vírgula é o que separa uma instrução da outra.
```

## Comentários

```php
<?php
// Comentário de uma linha
# Também vale com cerquilha
/* Comentário
   de várias linhas */
echo "Só esta linha é executada.";
```

## Lendo um erro

Apague o ponto e vírgula do primeiro `echo` de um dos exemplos e execute. O PHP responde com algo como `Parse error: syntax error, unexpected…` e o número da linha. Repare: muitas vezes o erro é apontado na linha **seguinte** àquela em que o ponto e vírgula faltou, porque é ali que o PHP percebe o problema.

## Para praticar

1. Escreva um script que mostre o seu nome em uma linha e a sua cidade em outra.
2. Faça o PHP calcular quantas horas há em um ano de 365 dias.
3. Provoque um erro de propósito e localize a linha indicada na mensagem.
