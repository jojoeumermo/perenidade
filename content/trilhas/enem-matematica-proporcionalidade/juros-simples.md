---
titulo: "Juros simples"
resumo: "Capital, taxa, tempo, juros e montante: como calcular juros simples, acertar a unidade da taxa com a do tempo, achar a taxa ou o prazo que faltam e ler o crescimento em linha reta."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Contemporary Mathematics, seção 6.3, Simple Interest"
    autor: "Donna Kirk e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/contemporary-mathematics/pages/6-3-simple-interest"
  - titulo: "Prealgebra 2e, seção 6.4, Solve Simple Interest Applications"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/6-4-solve-simple-interest-applications"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Quanto rendem R$ 500,00 a juros simples de 3% ao mês, durante 4 meses?"
    opcoes: ["R$ 15,00", "R$ 12,00", "R$ 560,00", "R$ 60,00"]
    resposta: 3
    explicacao: "3% de 500 é 15 reais por mês. Em 4 meses, 4 × 15 = 60 reais de juros. R$ 560,00 seria o montante, e não os juros."
  - pergunta: "Em juros simples, uma taxa de 1,5% ao mês corresponde a quanto ao ano?"
    opcoes: ["12%", "18%", "1,5%", "19,56%"]
    resposta: 1
    explicacao: "Nos juros simples, as taxas são proporcionais ao tempo: 12 meses × 1,5% = 18% ao ano."
  - pergunta: "Um capital de R$ 800,00, a juros simples, virou R$ 920,00 em 5 meses. Qual foi a taxa mensal?"
    opcoes: ["3%", "15%", "2,4%", "5%"]
    resposta: 0
    explicacao: "Os juros foram 920 − 800 = 120 reais, ou 24 reais por mês. E 24 ÷ 800 = 0,03, ou 3% ao mês."
  - pergunta: "Nos juros simples, o gráfico do montante ao longo do tempo é"
    opcoes: ["uma curva que sobe cada vez mais rápido", "uma reta horizontal", "uma reta que sobe", "uma curva que desce"]
    resposta: 2
    explicacao: "O montante cresce o mesmo valor a cada mês, porque os juros são sempre calculados sobre o capital inicial. Crescimento constante dá uma reta."
---

```provocacao
Você pega R$ 1.000,00 emprestados com uma parente e combina pagar juros simples de 2% ao mês. Depois de 6 meses, quanto você vai dever? E se o prazo passar para um ano?
```

## O que você vai aprender

Ao fim desta aula você vai conhecer as palavras dos juros (capital, taxa, tempo, juros e montante), calcular juros simples de cabeça, acertar a unidade da taxa com a do tempo, achar a taxa, o prazo ou o capital que faltam e reconhecer o crescimento em linha reta.

## O preço do dinheiro

Quem empresta dinheiro cobra por isso. Esse preço são os **juros**. Quem guarda dinheiro numa aplicação também recebe juros, porque está emprestando ao banco.

Cinco palavras aparecem em toda questão:

- **Capital (C):** o valor emprestado ou aplicado, no começo.
- **Taxa (i):** a porcentagem cobrada a cada período (ao mês, ao ano, ao dia).
- **Tempo (t):** quantos períodos se passaram.
- **Juros (J):** quanto se paga ou se ganha a mais.
- **Montante (M):** o total no fim, capital mais juros.

## Juros simples: sempre sobre o capital

Nos **juros simples**, a taxa incide sempre sobre o capital inicial. Os juros de cada mês são iguais.

Volte à provocação. 2% de 1.000 são 20 reais. Todo mês, a dívida cresce 20 reais. Em 6 meses, são 6 × 20 = 120 reais de juros. O montante é 1.000 + 120 = 1.120 reais. Em um ano (12 meses), 12 × 20 = 240 reais de juros, e o montante vai a 1.240.

```formula
J = C · i · t        M = C + J = C · (1 + i · t)
juros = capital × taxa × tempo; o montante é o capital mais os juros
a taxa entra em decimal (2% = 0,02), e taxa e tempo têm de estar na mesma unidade
```

## Taxa e tempo na mesma unidade

Este é o erro que mais derruba. Se a taxa é ao mês, o tempo tem de estar em meses. Se a taxa é ao ano, em anos.

Nos juros simples, trocar de unidade é uma regra de três. 2% ao mês dão 12 × 2% = 24% ao ano. E 36% ao ano dão 36% ÷ 12 = 3% ao mês. Taxas assim, que dão o mesmo juro no mesmo prazo, se chamam **proporcionais**.

Um prazo de 45 dias, com taxa ao mês, vira 1,5 mês. Um prazo de 18 meses, com taxa ao ano, vira 1,5 ano.

## Achar o que falta

A fórmula J = C · i · t tem quatro letras. Se a questão dá três, você acha a quarta.

- **A taxa:** um capital de 800 rendeu 120 em 5 meses. Por mês, 120 ÷ 5 = 24 reais. Sobre 800: 24 ÷ 800 = 0,03, ou 3% ao mês.
- **O tempo:** 2.000 a 4% ao mês rendem 80 por mês. Para render 640: 640 ÷ 80 = 8 meses.
- **O capital:** quais são os juros de um mês? Divida os juros totais pelo tempo. Depois, pergunte de que valor esse número é a taxa.

## Uma reta no gráfico

Como os juros de cada mês são iguais, o montante cresce sempre o mesmo tanto. Os montantes, mês a mês, formam uma progressão aritmética: 1.000, 1.020, 1.040, 1.060... No gráfico, isso é uma **reta** que sobe. O montante é uma função afim do tempo: M = 1.000 + 20t.

```verificar
R$ 1.000,00 aplicados a juros simples de 2% ao mês, durante 6 meses, dão um montante de:
- R$ 1.012,00
- R$ 1.200,00
+ R$ 1.120,00
> Por mês, 2% de 1.000 são 20 reais. Em 6 meses, 120 reais de juros. Montante: 1.000 + 120 = 1.120.
```

```navidareal
Num boleto ou numa conta de consumo, os acréscimos por atraso costumam vir descritos no próprio papel: uma multa, que é uma porcentagem fixa sobre o valor, e juros por dia ou por mês de atraso. Lendo essas linhas, dá para calcular antes quanto o atraso vai custar e decidir qual conta pagar primeiro.

Na hora de comparar um empréstimo, peça sempre a taxa e o prazo na mesma unidade. "Só 2% ao mês" e "24% ao ano" são a mesma coisa em juros simples.
```

## Exemplo resolvido

**Um boleto de R$ 200,00 diz: em caso de atraso, multa de 2% e juros simples de 0,1% ao dia. Quanto se paga com 15 dias de atraso?**

1. Multa: 2% de 200 = 4 reais. Ela é cobrada uma vez só.
2. Juros: 0,1% de 200 = 0,20 real por dia. Em 15 dias, 15 × 0,20 = 3 reais.
3. Total: 200 + 4 + 3 = 207 reais.

Confira a unidade: a taxa é ao dia, e o tempo está em dias. Se a taxa fosse ao mês, seria preciso converter os 15 dias em meio mês.

## Como isso cai no ENEM

- **Formatos:** empréstimo ou compra a prazo com juros simples; boleto ou conta com multa e juros por atraso; comparação entre duas propostas de pagamento; achar a taxa embutida num preço a prazo; tabela ou gráfico do montante ao longo do tempo.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, nenhuma das 81 questões classificadas de Matemática foi marcada em juros simples, e 1 foi marcada em juros compostos (1,2%). A H3 foi a habilidade mais frequente da área, com 12 das 81 questões (14,8%). São só duas provas: é tendência, não promessa.
- **Habilidades:** H3 (resolver problemas com conhecimentos numéricos), H4 (julgar se um resultado numérico faz sentido ao discutir uma afirmação com números) e H5 (avaliar propostas de intervenção na realidade usando conhecimentos numéricos), quando é preciso escolher a melhor proposta.
- **Armadilhas:**
  - Misturar a taxa ao mês com o tempo em anos (ou o contrário).
  - Usar a taxa em porcentagem na conta, sem passar para decimal (2 em vez de 0,02).
  - Dar os juros quando a questão pede o montante, ou o contrário.
  - Calcular os juros sobre o montante do mês anterior, que é a regra dos juros compostos.

## Questão comentada

**Texto-base.** Uma costureira precisa de R$ 2.000,00 para comprar uma máquina e vai pagar tudo de uma vez, com os juros, depois de 10 meses. Ela tem duas propostas, as duas a juros simples. No banco, a taxa é de 2,5% ao mês. Na cooperativa de crédito do bairro, a taxa é de 24% ao ano.

**Comando.** Escolhendo a cooperativa em vez do banco, a costureira vai

A) pagar R$ 100,00 a mais.
B) pagar R$ 4.300,00 a mais.
C) economizar R$ 20,00.
D) economizar R$ 500,00.
E) economizar R$ 100,00.

**Resolução.**

1. Banco: 2,5% de 2.000 são 50 reais por mês. Em 10 meses, 500 reais de juros. Ela paga 2.500.
2. Cooperativa: a taxa está ao ano e o tempo, em meses. Em juros simples, 24% ao ano são 24 ÷ 12 = 2% ao mês.
3. 2% de 2.000 são 40 reais por mês. Em 10 meses, 400 reais de juros. Ela paga 2.400.
4. Diferença: 2.500 − 2.400 = 100 reais a menos na cooperativa.

**Gabarito: E.**

**Por que as outras não:**

- A) pagar R$ 100,00 a mais: a diferença está certa, mas o sentido está trocado. A cooperativa cobra menos.
- B) pagar R$ 4.300,00 a mais: a taxa ao ano foi usada com o tempo em meses (24% × 10 = 240%). Taxa e tempo têm de estar na mesma unidade.
- C) economizar R$ 20,00: na cooperativa foi usado um ano inteiro (480 reais de juros). O prazo é de 10 meses.
- D) economizar R$ 500,00: R$ 500,00 são os juros do banco, não a diferença entre as propostas.

```realidade
Pegue uma conta ou boleto que você tenha em casa e procure as linhas sobre atraso. Que multa e que juros estão escritos? Calcule quanto você pagaria a mais com 10 dias de atraso. Os juros estão ao dia ou ao mês?
```

## Resumo

- Juros simples: J = C · i · t, com a taxa sempre sobre o capital inicial.
- Montante é capital mais juros: M = C · (1 + i · t).
- Taxa e tempo na mesma unidade. Em juros simples, 2% ao mês = 24% ao ano.
- Para achar o que falta, isole a letra na fórmula ou pense nos juros de um período.
- O montante cresce em linha reta: os juros de cada período são iguais.

## Para aprofundar

- [Juros simples e compostos](/trilhas/matematica-medio/juros-simples-e-compostos)
- [Juros: o preço do dinheiro](/trilhas/economia-fundamental/juros-o-preco-do-dinheiro)
- [Porcentagem](/trilhas/enem-matematica-proporcionalidade/porcentagem)
- [Função afim](/trilhas/enem-matematica-funcoes-e-algebra/funcao-afim)
