---
titulo: "Juros do cartão e do cheque especial"
modelo: 9
resumo: "Por que o rotativo do cartão e o cheque especial são as dívidas que mais crescem, como a conta de juros compostos funciona e o que a lei limita."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Taxas de juros de operações de crédito (séries históricas)"
    autor: "Banco Central do Brasil"
    url: "https://www.bcb.gov.br/estabilidadefinanceira/historicotaxasjuros"
  - titulo: "Lei nº 14.690, de 3 de outubro de 2023 (Programa Desenrola Brasil e limite de juros do cartão)"
    autor: "Presidência da República"
    url: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/L14690.htm"
  - titulo: "Lei nº 8.078, de 11 de setembro de 1990 (Código de Defesa do Consumidor), art. 52"
    autor: "Presidência da República"
    url: "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm"
ferramentas: [juros-compostos, contas-do-dia-a-dia]
quiz:
  - pergunta: "O que é o rotativo do cartão?"
    opcoes: ["Um desconto para quem paga em dia", "O crédito automático que começa quando você paga menos que o total da fatura; sobre o que sobra incidem juros altos", "O limite do cartão", "A anuidade"]
    resposta: 1
    explicacao: "Se você paga só o mínimo (ou menos que o total), o restante entra no rotativo e é cobrado com juros bem acima dos de outros créditos."
  - pergunta: "Por que a dívida de juros compostos cresce cada vez mais rápido?"
    opcoes: ["Porque o banco muda o valor sem avisar", "Porque os juros de cada mês incidem também sobre os juros dos meses anteriores", "Porque o cartão cobra mais com o tempo, de graça", "Porque o dólar sobe"]
    resposta: 1
    explicacao: "É o efeito dos juros sobre juros: cada mês, o saldo maior rende mais juros do que o mês anterior."
  - pergunta: "Qual é o limite de juros do cheque especial fixado pelo Conselho Monetário Nacional (regra em vigor desde 2020)?"
    opcoes: ["Não há limite", "8% ao mês", "1% ao mês", "20% ao mês"]
    resposta: 1
    explicacao: "Pela Resolução CMN 4.765/2019, os juros do cheque especial não podem passar de 8% ao mês. É o teto, e ainda é um custo alto."
  - pergunta: "Desde 2024, a Lei 14.690/2023 limita os juros e encargos do rotativo e do parcelamento de fatura a quanto?"
    opcoes: ["Ao dobro da dívida original", "Ao valor da dívida original, isto é, 100%", "A 1% ao mês", "Não limita"]
    resposta: 1
    explicacao: "A soma de juros e encargos não pode passar do valor original da dívida. Ainda assim, a dívida pode dobrar: por isso vale evitar entrar no rotativo."
  - pergunta: "Qual é a melhor atitude quando não dá para pagar a fatura inteira?"
    opcoes: ["Pagar o mínimo e esquecer", "Pagar o máximo possível, comparar as opções de parcelamento e procurar o crédito mais barato antes de entrar no rotativo", "Pagar só no mês seguinte", "Pegar outro cartão para pagar o primeiro sem calcular"]
    resposta: 1
    explicacao: "O rotativo é uma das taxas mais caras do mercado. Pagar o que der e trocar por uma dívida mais barata (com cuidado) costuma ser melhor, e vale conferir as taxas no Banco Central."
---

## O que você vai aprender

Ao fim desta aula você vai saber por que as dívidas do cartão e do cheque especial crescem tão rápido, vai conseguir calcular quanto uma dívida vira em alguns meses e vai conhecer os limites que a lei coloca.

```suarealidade
Na sua casa, alguém já pagou só o mínimo da fatura do cartão ou entrou no cheque especial para fechar o mês? O que aconteceu com o valor depois de alguns meses?
```

## Juros: o preço de usar o dinheiro dos outros

Quando você deve a um banco, paga um **preço** por isso, os **juros**. A economia do dia a dia explica isso melhor na aula "Juros: o preço do dinheiro". Aqui, o ponto é que há créditos **baratos** (como o consignado ou o financiamento de casa) e créditos **muito caros**. O cartão rotativo e o cheque especial estão entre os mais caros do país.

O **Banco Central** publica, todo mês, as **taxas médias** que os bancos cobram em cada tipo de crédito. Em 2024 e 2025, a taxa média do rotativo do cartão ficou bem acima de 400% ao ano (confira a tabela atual no site do Banco Central). O cheque especial tem teto de 8% ao mês (cerca de 150% ao ano).

## Juros sobre juros

A dívida cresce de forma **composta**: no mês seguinte, os juros incidem sobre o valor que já inclui os juros do mês anterior. Por isso, no começo parece pouco, e depois dispara.

A fórmula é:

```formula
Valor final = valor inicial × (1 + taxa)^meses
taxa em forma de decimal: 8% = 0,08; 14% = 0,14
```

## O que a lei limita

- **Cheque especial:** os juros não podem passar de **8% ao mês** (Resolução CMN 4.765/2019).
- **Rotativo e parcelamento do cartão:** desde 2024, a **Lei 14.690/2023** diz que a soma de juros e encargos não pode ultrapassar o **valor original da dívida**. Ou seja, uma dívida de R$ 1.000 pode chegar, no máximo, a R$ 2.000 de juros e encargos somados ao principal. É um teto, e é alto.
- O **Código de Defesa do Consumidor** (Lei 8.078/1990, art. 52) obriga o fornecedor a informar o preço total, a taxa de juros e as multas **antes** de você contratar.

Teto não é desconto: o cartão e o cheque especial continuam sendo dívidas caras.

```verificar
O rotativo cobra juros mensais de 14%. Depois de 6 meses sem pagar, o valor de uma dívida de R$ 1.000 será mais próximo de:
- R$ 1.840
+ R$ 2.195 (sem o teto legal)
- R$ 1.084
> Use a fórmula: 1.000 × (1,14)^6. Releia "Juros sobre juros".
```

## Exemplo resolvido

**Seu Roberto ficou R$ 1.000 no cheque especial (8% ao mês) e, ao mesmo tempo, a mulher dele deixou R$ 1.000 da fatura no rotativo (14% ao mês, como exemplo). Ninguém pagou nada por 6 meses. Quanto cada dívida virou?**

1. **Cheque especial:** 1.000 × (1,08)^6. Calculando: 1,08² = 1,1664; 1,08³ = 1,2597; 1,08⁶ = 1,5869. Resultado: **R$ 1.587**.
2. **Rotativo:** 1.000 × (1,14)^6. Calculando: 1,14² = 1,2996; 1,14³ = 1,4815; 1,14⁶ = 2,1950. Resultado: **R$ 2.195** sem o limite.
3. **Com o limite da Lei 14.690/2023**, os juros e encargos não passam do valor original: o máximo seria R$ 1.000 de juros, ou seja, **R$ 2.000** no total. Neste exemplo, o teto seria atingido no sexto mês.
4. **A diferença entre as duas:** em seis meses, uma dívida cresceu 59% e a outra mais que dobrou (ou chegou ao teto).
5. **O que ele podia ter feito:** pagar o que desse e procurar um crédito mais barato para quitar a dívida mais cara (com cuidado: veja a aula sobre renegociação), em vez de deixar os dois juros correndo.

(A taxa de 14% é um exemplo para treinar. Veja a taxa real no site do Banco Central e no contrato.)

```outrolado
# O argumento mais forte dos bancos
Os bancos dizem que as taxas de crédito sem garantia no Brasil são altas porque o risco de calote é alto: muita gente não paga, e quem paga acaba bancando quem não paga. Para eles, limitar juros demais reduz o crédito e leva as pessoas ao crédito informal, que é pior. Defendem educação financeira e mais concorrência, em vez de tetos.
---
Se o risco existe, mas os juros do rotativo estão entre os mais altos do mundo, como você responderia? Quem deveria arcar com esse risco?
---
Uma resposta possível: o risco de calote existe, mas o rotativo é usado muitas vezes por quem não escolhe: a fatura de um mês apertado vira dívida cara. Defensores dos limites dizem que o teto de 100% e outras regras protegem o consumidor sem acabar com o crédito, e que a concorrência (portabilidade e o cadastro positivo) ajuda mais quando funciona. Fontes: Banco Central; Lei 14.690/2023.
```

```agir
# Esta semana
Pegue a última fatura do cartão (ou o extrato) e anote: (1) o valor total; (2) quanto foi pago; (3) se entrou no rotativo ou no cheque especial. Procure no extrato a taxa de juros mensal e escreva ao lado. Não precisa pagar nada novo agora: o objetivo é ver o número.
```

## Resumo

- O rotativo do cartão e o cheque especial estão entre os créditos mais caros do país; o Banco Central publica as taxas médias.
- Os juros são compostos: crescem sobre os juros anteriores. Valor final = valor inicial × (1 + taxa)^meses.
- Limites: 8% ao mês no cheque especial (Resolução CMN 4.765/2019); juros e encargos do rotativo e do parcelamento limitados ao valor original da dívida (Lei 14.690/2023, desde 2024).
- Teto não é desconto: pague o que puder e compare com crédito mais barato antes de entrar no rotativo. Procon e Defensoria ajudam de graça.
