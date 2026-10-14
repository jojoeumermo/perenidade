---
titulo: "Epidemiologia"
resumo: "Objetivo: conhecer os principais tipos de estudo epidemiológico, calcular medidas de risco, entender viés e confusão, interpretar testes diagnósticos e discutir como se estabelece uma relação de causa."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Microbiology, seção 16.1, The Language of Epidemiologists"
    autor: "Nina Parker, Mark Schneegurt, Anh-Hue Thi Tu, Philip Lister, Brian M. Forster (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/microbiology/pages/16-1-the-language-of-epidemiologists"
  - titulo: "Microbiology, seção 16.2, Tracking Infectious Diseases"
    autor: "Nina Parker, Mark Schneegurt, Anh-Hue Thi Tu, Philip Lister, Brian M. Forster (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/microbiology/pages/16-2-tracking-infectious-diseases"
  - titulo: "Smoking and carcinoma of the lung: preliminary report"
    autor: "Richard Doll e A. Bradford Hill"
    ano: "1950"
  - titulo: "The Environment and Disease: Association or Causation?"
    autor: "Austin Bradford Hill"
    ano: "1965"
quiz:
  - pergunta: "Em um estudo de coorte, como se escolhem os participantes?"
    opcoes: ["Pela exposição (expostos e não expostos), e depois se acompanha quem adoece", "Pela doença (doentes e não doentes), e depois se investiga a exposição passada", "Ao acaso, sem acompanhamento"]
    resposta: 0
    explicacao: "O segundo desenho descrito é o estudo de caso-controle."
  - pergunta: "Em um exemplo hipotético, 20 de 1 000 fumantes e 2 de 1 000 não fumantes desenvolvem uma doença. Qual é o risco relativo?"
    opcoes: ["2", "10", "18"]
    resposta: 1
    explicacao: "Risco nos expostos (0,02) dividido pelo risco nos não expostos (0,002)."
  - pergunta: "O que é um fator de confusão?"
    opcoes: ["Um erro de digitação", "Uma terceira variável, ligada tanto à exposição quanto ao desfecho, que distorce a associação entre eles", "A margem de erro de uma pesquisa"]
    resposta: 1
    explicacao: "Exemplo: a idade pode confundir a relação entre um hábito e uma doença."
  - pergunta: "Por que um teste muito bom pode dar muitos falsos positivos quando a doença é rara?"
    opcoes: ["Porque, com poucos doentes, os falsos positivos entre os muitos sadios podem superar os verdadeiros positivos", "Porque o teste piora com o tempo", "Porque doenças raras não podem ser testadas"]
    resposta: 0
    explicacao: "O valor preditivo positivo depende da prevalência."
---

## A ciência das populações

A [epidemiologia](/trilhas/biologia-medio/saude-publica-e-epidemias) estuda a distribuição das doenças e dos seus determinantes nas populações. Ela não trata só de epidemias infecciosas: é com os seus métodos que se descobriu que o cigarro causa câncer, que se avalia se uma vacina funciona e que se mede a desigualdade em saúde.

## Os tipos de estudo

### Descritivos

Respondem a **quem**, **onde** e **quando**: quantos casos, em que grupos, em que regiões, como variam no tempo. Levantam hipóteses.

### Analíticos (observacionais)

| Desenho | Como funciona | Pontos fortes e fracos |
| --- | --- | --- |
| **Transversal** | mede exposição e doença ao mesmo tempo, em uma amostra | rápido; não mostra o que veio primeiro |
| **Caso-controle** | parte de doentes (casos) e não doentes (controles) e compara as exposições passadas | bom para doenças raras; sujeito a falhas de memória |
| **Coorte** | parte de expostos e não expostos e acompanha quem adoece ao longo do tempo | mostra a sequência temporal; caro e demorado |

### Experimentais

No **ensaio clínico randomizado**, os participantes são **sorteados** para receber a intervenção (um remédio, uma vacina) ou um controle (placebo ou tratamento padrão). O sorteio distribui por igual os outros fatores entre os grupos. Quando possível, nem os participantes nem os pesquisadores sabem quem recebeu o quê (**duplo-cego**). É o desenho mais forte para avaliar tratamentos.

## O caso do cigarro

Em **1950**, os britânicos **Richard Doll** e **Austin Bradford Hill** publicaram um estudo de **caso-controle**: pacientes com câncer de pulmão tinham, muito mais frequentemente que os controles, o hábito de fumar. Em seguida, iniciaram uma **coorte** com médicos britânicos, acompanhados por décadas, que confirmou a associação. A indústria do tabaco passou anos contestando os resultados.

## Medidas de associação

Com uma tabela simples:

| | Doentes | Não doentes | Total |
| --- | --- | --- | --- |
| Expostos | a | b | a + b |
| Não expostos | c | d | c + d |

- **Risco nos expostos** = a ÷ (a + b)
- **Risco nos não expostos** = c ÷ (c + d)
- **Risco relativo (RR)** = risco nos expostos ÷ risco nos não expostos
- **Risco atribuível** = risco nos expostos − risco nos não expostos

```conta
Exemplo hipotético: 1 000 fumantes e 1 000 não fumantes acompanhados por 10 anos.
doença entre fumantes: 20      risco = 20 ÷ 1 000 = 0,020
doença entre não fumantes: 2   risco = 2 ÷ 1 000 = 0,002
RR = 0,020 ÷ 0,002 = 10
risco atribuível = 0,020 − 0,002 = 0,018 (18 casos a mais por mil expostos)
```

RR = 1 indica ausência de associação; maior que 1, maior risco nos expostos; menor que 1, efeito protetor. Nos estudos de caso-controle, que não permitem calcular riscos diretamente, usa-se a **razão de chances** (*odds ratio*).

## Erros possíveis

- **Acaso**: avaliado com intervalos de confiança e testes estatísticos.
- **Viés**: erro sistemático. Por exemplo, um **viés de seleção** (os participantes não representam a população) ou um **viés de memória** (doentes lembram mais das exposições).
- **Confusão**: uma terceira variável ligada à exposição e ao desfecho. Se quem toma café também fuma mais, o café pode parecer associado ao câncer de pulmão, quando a causa é o cigarro.

```verificar
Um estudo encontra que pessoas que andam de bicicleta para o trabalho têm menos doenças do coração. Antes de concluir que a bicicleta protege, o que se deve verificar?
- Nada: a associação prova a causa
+ Possíveis fatores de confusão, como idade e condições de saúde anteriores de quem consegue pedalar
- Só o número de bicicletas da cidade
> Quem pedala pode ser diferente de quem não pedala em outros aspectos.
```

## Associação não é causa

Em **1965**, Bradford Hill propôs um conjunto de aspectos a considerar antes de concluir que uma associação é causal, entre eles:

- **força** da associação;
- **consistência** (repete-se em estudos diferentes);
- **temporalidade** (a causa vem antes do efeito; é o único indispensável);
- **gradiente** (mais exposição, mais doença);
- **plausibilidade** biológica;
- **evidência experimental**.

Não são uma lista de verificação mecânica, mas um guia para o julgamento. Veja também [Correlação não é causa](/trilhas/estatistica-para-ler-o-brasil/correlacao-nao-e-causa).

## Testes diagnósticos

- **Sensibilidade**: entre os doentes, a proporção que o teste acerta (positivo).
- **Especificidade**: entre os sadios, a proporção que o teste acerta (negativo).
- **Valor preditivo positivo**: entre os que deram positivo, a proporção que está realmente doente. **Depende da prevalência.**

```conta
Exemplo hipotético: 10 000 pessoas, prevalência de 1% (100 doentes).
Teste com sensibilidade de 90% e especificidade de 95%.
verdadeiros positivos: 90% de 100 = 90
falsos positivos: 5% de 9 900 = 495
valor preditivo positivo = 90 ÷ (90 + 495) ≈ 15%
```

Mesmo com um bom teste, só cerca de 15% dos positivos estão doentes. Por isso, programas de rastreamento em populações de baixo risco precisam de exames de confirmação, e por isso se discute com cuidado **para quem** indicar cada exame.

## Para praticar

1. Classifique: (a) estudo que compara o histórico de uso de agrotóxicos entre pessoas com e sem certo câncer; (b) estudo que acompanha por 20 anos trabalhadores expostos e não expostos a amianto.
2. Calcule o risco relativo: 30 casos em 600 expostos; 10 casos em 1 000 não expostos.
3. Dê um exemplo de possível fator de confusão na relação entre renda e uma doença.
4. Refaça o cálculo do valor preditivo positivo com prevalência de 10%. O que muda?
