---
trimestre: "AAAA-TN"
periodo: "1º de mês a 31 de mês de AAAA"
publicado: "AAAA-MM-DD"
---

<!--
MODELO do relatório público trimestral de segurança e de pedidos (não é publicado: a página lista só os arquivos AAAA-TN.md).
Para publicar: copie este arquivo para content/transparencia/trimestral/AAAA-TN.md (por exemplo 2027-T1.md), troque cada campo
entre colchetes e apague as linhas que não valem. Regras: nenhum nome de pessoa, nenhum número abaixo de 3 sobre pessoas (escreva
"menos de 3"), nenhum endereço de servidor, nenhum detalhe que ajude a atacar uma falha que ainda está aberta (a falha aberta entra
com a gravidade e a área, e o detalhe sai no relatório seguinte, depois da correção). As contas de falhas vêm do registro de
bugs da auditoria; as de pedidos, de content/transparencia/pedidos.json.
-->

## Em resumo

[Duas ou três frases: o que mudou na segurança neste trimestre, quantos pedidos de órgãos públicos chegaram e se o canário foi
renovado em dia.]

## Falhas de segurança

| Gravidade | Achadas no trimestre | Corrigidas no trimestre | Em aberto no fim do trimestre |
| --- | --- | --- | --- |
| Crítica | [n] | [n] | [n] |
| Alta | [n] | [n] | [n] |
| Média | [n] | [n] | [n] |
| Baixa | [n] | [n] | [n] |

**Quem achou:** [a auditoria interna, as ferramentas automáticas (fuzzing, análise estática, dependências), uma auditoria
externa, alguém de fora pelo canal do SECURITY.md]. Crédito a quem pediu para ser creditado: [nome ou apelido escolhido pela
pessoa].

**As corrigidas, uma a uma:**

| Gravidade | Área | O que era | Desde quando estava no ar | Corrigida em |
| --- | --- | --- | --- | --- |
| [Alta] | [chat, caixas anônimas, site, painel, banco, app Android, app do computador] | [descrição curta, sem receita de ataque] | [data] | [data] |

**As em aberto** (sem detalhe até a correção): [gravidade, área e o prazo combinado].

## Pedidos de órgãos públicos

| | No trimestre | Desde o começo |
| --- | --- | --- |
| Pedidos recebidos | [n] | [n] |
| Pedidos em que entregamos algum dado | [n] | [n] |
| Pedidos contestados na Justiça | [n] | [n] |
| Pedidos com proibição de contar | [o canário responde] | |

O que foi entregue, pedido por pedido, está na página [Pedidos de órgãos públicos](/transparencia/pedidos). O que o servidor
tem para entregar é só o que está em [O que o servidor guarda](/transparencia/o-que-o-servidor-guarda); as conversas são cifradas
nos aparelhos e o servidor não tem as chaves.

## O que o servidor guarda

[O que entrou e o que saiu da lista neste trimestre: tabelas e colunas novas, dados que deixaram de ser guardados, prazos que
mudaram. A lista inteira é gerada do banco e fica na página.]

## Auditorias

[Auditoria externa feita ou contratada neste trimestre, com o link para o relatório na íntegra em
[Relatórios de auditoria](/transparencia/relatorios); ou "nenhuma neste trimestre", e a próxima prevista.]

## Ferramentas automáticas

[Quanto tempo de fuzzing rodou, quantos travamentos achou; o que a análise estática e a conferência das dependências acharam e o
que foi feito.]

## Canário

[Renovado em [data], válido até [data]. Ou: não renovado (e por quê, se puder dizer).]
