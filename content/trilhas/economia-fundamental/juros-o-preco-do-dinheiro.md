---
titulo: "Juros: o preço do dinheiro"
resumo: "O que são juros, por que os compostos fazem a dívida explodir e como se defender."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Cidadania financeira"
    autor: "Banco Central do Brasil"
    url: "https://www.bcb.gov.br/cidadaniafinanceira"
  - titulo: "Calculadora do cidadão"
    autor: "Banco Central do Brasil"
    url: "https://www.bcb.gov.br/meubc/calculadoradocidadao"
  - titulo: "DIEESE: Departamento Intersindical de Estatística e Estudos Socioeconômicos"
    autor: "DIEESE"
    url: "https://www.dieese.org.br/"
quiz:
  - pergunta: "O que são juros?"
    opcoes: ["Um imposto", "O valor cobrado pelo uso de um dinheiro emprestado durante certo tempo", "Uma taxa de entrega"]
    resposta: 1
    explicacao: "Quem empresta recebe juros; quem toma emprestado paga."
  - pergunta: "Qual é a diferença entre juros simples e compostos?"
    opcoes: ["Nenhuma", "Nos compostos, os juros de cada mês passam a render juros também", "Os simples são sempre maiores"]
    resposta: 1
    explicacao: "É o 'juro sobre juro'. Em prazos longos, a diferença é enorme."
  - pergunta: "Uma dívida de R$ 1.000 a 10% ao mês, em juros compostos, chega a quanto depois de um ano sem pagamentos?"
    opcoes: ["R$ 1.100", "R$ 2.200", "Cerca de R$ 3.138"]
    resposta: 2
    explicacao: "1.000 × 1,1 multiplicado por ele mesmo doze vezes. Em juros simples seriam R$ 2.200."
---

## Aluguel de dinheiro

Quem aluga uma casa paga pelo tempo em que a usa. Com o dinheiro é igual: quem pega emprestado paga um aluguel a quem emprestou. Esse aluguel se chama **juro**.

Você **paga** juros quando parcela uma compra, usa o cheque especial, deixa a fatura do cartão para depois ou faz um empréstimo. Você **recebe** juros quando guarda dinheiro na poupança ou em outra aplicação: nesse caso, é você quem está emprestando ao banco.

O tamanho do juro é dado pela **taxa**, uma porcentagem por período: 2% ao mês, 12% ao ano. (Se porcentagem ainda é um problema, veja a aula [Porcentagem](/trilhas/matematica-fundamental/porcentagem).)

## Juros simples

Nos juros simples, a taxa incide sempre sobre o valor **inicial**.

R$ 1.000 emprestados a 10% ao mês rendem R$ 100 de juros por mês. Em 12 meses: R$ 1.200 de juros. Total: **R$ 2.200**.

## Juros compostos

Nos juros compostos, a taxa incide sobre **tudo o que já se acumulou**: o valor inicial mais os juros dos meses anteriores. É o "juro sobre juro". É assim que funcionam, na vida real, o cartão de crédito, o cheque especial, os empréstimos e também as aplicações.

Os mesmos R$ 1.000 a 10% ao mês:

| Mês | Dívida |
| --- | --- |
| 0 | R$ 1.000,00 |
| 1 | R$ 1.100,00 |
| 2 | R$ 1.210,00 |
| 3 | R$ 1.331,00 |
| 6 | R$ 1.771,56 |
| 12 | **R$ 3.138,43** |

No segundo mês, os 10% já são calculados sobre R$ 1.100, e não sobre R$ 1.000. Parece pouca diferença no começo. No fim de um ano, a dívida mais que triplicou.

```verificar
No exemplo da tabela, de quanto são os juros cobrados no terceiro mês?
- R$ 100,00
+ R$ 121,00
- R$ 331,00
> Calcule 10% sobre a dívida do mês 2.
```

## Por que isso pesa no Brasil

As taxas cobradas das famílias brasileiras estão entre as mais altas do mundo. Segundo os dados do Banco Central, os juros do **rotativo do cartão de crédito**, cobrados de quem paga só uma parte da fatura, têm ficado acima de 400% ao ano. Desde janeiro de 2024, uma lei limita o total de juros e encargos dessa modalidade ao valor original da dívida: ela pode, no máximo, dobrar.

Juros altos não são um fenômeno da natureza. São uma transferência de renda: de quem precisa de crédito para pagar as contas para quem tem dinheiro sobrando para emprestar. Quando a taxa básica de juros do país sobe, cresce também a parte do orçamento público que vai para os credores da dívida pública.

## Como se defender

1. **Fuja do rotativo e do cheque especial.** São os créditos mais caros que existem.
2. **Compare o custo total**, e não só a parcela. Peça sempre o Custo Efetivo Total (CET), que os bancos são obrigados a informar.
3. **Desconfie de "sem juros".** Pergunte o preço à vista: a diferença, muitas vezes, são juros embutidos.
4. **Se a dívida já existe**, procure trocar uma dívida cara por outra mais barata e renegocie. Os Procons e a Defensoria Pública orientam de graça.
5. **Faça a conta antes.** Use a ferramenta de [juros compostos](/ferramentas/juros-compostos) do instituto com os seus próprios números.

## Para praticar

1. Na ferramenta de juros compostos, simule uma dívida de R$ 500 a 12% ao mês por 12 meses, sem depósitos. Quanto se paga de juros?
2. Agora simule R$ 100 guardados todo mês, a 0,6% ao mês, por 10 anos. Quanto você depositou e quanto ganhou de juros?
3. Compare os dois resultados. O que eles dizem sobre quem ganha com os juros?
