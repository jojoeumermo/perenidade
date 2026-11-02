---
titulo: "Potência elétrica, consumo em kWh e conta de luz"
resumo: "O que é potência, como a energia vira quilowatt-hora, como calcular o gasto de cada aparelho e ler a conta de luz, e por que o chuveiro na posição inverno gasta mais."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 19.4, Electric Power"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/19-4-electric-power"
  - titulo: "College Physics 2e, seção 20.4, Electric Power and Energy"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/20-4-electric-power-and-energy"
  - titulo: "Physics, seção 9.1, Work, Power, and the Work–Energy Theorem"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/9-1-work-power-and-the-work-energy-theorem"
  - titulo: "Provas e gabaritos do Enem (as provas de 2022 e 2023, base da contagem do instituto)"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Uma lâmpada LED de 10 W fica acesa 5 horas por dia, durante 30 dias. Quanto ela consome no mês?"
    opcoes: ["15 kWh", "150 kWh", "1,5 kWh", "1.500 kWh"]
    resposta: 2
    explicacao: "Energia é potência vezes tempo: 10 W × 5 h × 30 = 1.500 Wh. Como 1.000 Wh = 1 kWh, são 1,5 kWh. Quem marcou 1.500 kWh esqueceu de dividir por 1.000."
  - pergunta: "Um quilowatt-hora (1 kWh) é a energia de"
    opcoes: ["1.000 joules", "3,6 milhões de joules", "3.600 joules", "60 joules"]
    resposta: 1
    explicacao: "1 kWh é 1.000 W (1.000 joules por segundo) durante 1 hora, que tem 3.600 segundos: 1.000 × 3.600 = 3.600.000 J, ou 3,6 milhões de joules."
  - pergunta: "Na posição inverno, o chuveiro esquenta mais porque o resistor"
    opcoes: ["tem resistência maior, e a potência cai", "tem a mesma resistência, mas recebe mais tensão", "fica desligado da tomada", "tem resistência menor, e a potência sobe"]
    resposta: 3
    explicacao: "Com a mesma tensão da casa, a potência é a tensão ao quadrado dividida pela resistência. Resistência menor deixa passar mais corrente e dá mais potência, isto é, mais calor por segundo."
  - pergunta: "Um aparelho de 1.100 W funciona ligado em 220 V. A corrente nele é de"
    opcoes: ["5 A", "0,2 A", "242.000 A", "10 A"]
    resposta: 0
    explicacao: "Potência é tensão vezes corrente. Então a corrente é a potência dividida pela tensão: 1.100 ÷ 220 = 5 A."
---

```provocacao
Na sua casa, o que pesa mais na conta de luz: a geladeira, que fica ligada o dia inteiro, ou o chuveiro, que funciona só durante os banhos?
```

## O que você vai aprender

Ao fim desta aula você vai saber o que é potência elétrica, calcular a energia que um aparelho gasta em quilowatt-hora (kWh), ler o consumo e o valor de uma conta de luz e explicar por que o chuveiro esquenta mais na posição inverno.

## Potência: quanta energia por segundo

Todo aparelho elétrico transforma energia. A lâmpada transforma energia elétrica em luz (e um pouco de calor). O chuveiro, em calor. O liquidificador, em movimento.

**Potência** é a rapidez dessa transformação: quanta energia o aparelho usa a cada segundo. A unidade é o **watt** (W). Um watt é um joule por segundo. O joule (J) é a unidade de energia.

Um chuveiro de 5.500 W usa 5.500 joules a cada segundo. Uma lâmpada LED de 10 W usa 10 joules por segundo. Por isso o chuveiro "puxa" tanto: a potência dele é centenas de vezes maior.

O número da potência vem escrito no aparelho, na etiqueta ou na caixa. Às vezes aparece em quilowatts: 1 kW = 1.000 W.

Na eletricidade, a potência sai de duas grandezas que você vai ver na aula de [Lei de Ohm](/trilhas/enem-fisica/lei-de-ohm): a **tensão** (em volts, V), que é o empurrão nas cargas, e a **corrente** (em ampères, A), que é quanta carga passa por segundo.

```formula
P = U · i
potência (em watts) = tensão (em volts) × corrente (em ampères)
um chuveiro de 4.400 W em 220 V puxa 4.400 ÷ 220 = 20 A
```

Essa conta explica por que aparelhos fortes pedem fio grosso e disjuntor próprio: muita potência, com a mesma tensão, quer dizer muita corrente.

## Energia: potência vezes tempo

A conta de luz não cobra a potência. Cobra a **energia**, que depende também de quanto tempo o aparelho fica ligado.

```formula
E = P · Δt
energia = potência × tempo ligado
com a potência em quilowatts e o tempo em horas, a energia sai em quilowatt-hora (kWh)
```

Um quilowatt-hora é a energia de um aparelho de 1.000 W ligado por 1 hora. Em joules, isso dá 1.000 J por segundo vezes 3.600 segundos: 3.600.000 J. O joule é pequeno demais para medir o gasto de uma casa. Por isso a distribuidora usa o kWh.

O caminho para qualquer aparelho tem três passos:

1. Passe a potência para quilowatts: divida os watts por 1.000.
2. Passe o tempo para horas: 15 minutos são 0,25 h; 30 minutos, 0,5 h.
3. Multiplique: potência em kW × horas por dia × dias no mês.

Exemplo: um chuveiro de 5.500 W, usado 15 minutos por dia, durante 30 dias. São 5,5 kW × 0,25 h × 30 = 41,25 kWh no mês.

Agora a geladeira. Ela liga e desliga sozinha, então não dá para multiplicar a potência pelas 24 horas do dia. Para ela, use o consumo mensal em kWh informado pelo fabricante.

Repare no que muda a resposta da provocação. O chuveiro tem potência enorme e funciona pouco tempo. A geladeira tem potência pequena e funciona muito. Quem pesa mais depende das duas coisas juntas, potência e tempo.

## A conta de luz

O medidor de energia (o "relógio de luz") soma os kWh que a casa gastou desde que foi instalado. Todo mês, a leitura nova menos a leitura anterior dá o consumo do mês.

O valor a pagar vem do consumo vezes a tarifa, o preço de cada kWh. A conta de verdade soma ainda impostos e outros itens, que mudam de uma distribuidora para outra. Na prova, a questão diz o que entra na conta: use só o que ela der.

```navidareal
# O chuveiro, campeão da conta
No chuveiro elétrico, a água passa por um resistor, um fio que esquenta quando a corrente passa. A chave verão e inverno muda o pedaço do resistor que fica ligado.

Na posição inverno, a resistência é menor. Com a tensão da casa fixa, a potência é a tensão ao quadrado dividida pela resistência. Resistência menor, potência maior: a água sai mais quente, e o relógio de luz anda mais depressa.

Um banho de 10 minutos a menos por dia, num chuveiro de 5.400 W, economiza 5,4 kW × 1/6 h × 30 = 27 kWh por mês.
```

```formula
P = U² ÷ R
potência = tensão ao quadrado ÷ resistência
com a mesma tensão, menos resistência dá mais potência
```

```verificar
Um aparelho de 2.000 W fica ligado 3 horas. Quanto ele consome?
- 6.000 kWh
+ 6 kWh
- 0,67 kWh
> Passe para quilowatts antes: 2.000 W = 2 kW. Depois multiplique pelas horas: 2 × 3 = 6 kWh.
```

## Exemplo resolvido

**Na conta de uma casa, a leitura anterior do medidor era 4.215 kWh e a atual é 4.395 kWh. Suponha uma tarifa de R$ 0,80 por kWh, sem outros itens. Quanto a família paga? E quanto desse consumo veio de um chuveiro de 6.000 W usado 40 minutos por dia, durante 30 dias?**

1. Consumo do mês: 4.395 − 4.215 = 180 kWh.
2. Valor: 180 × 0,80 = R$ 144,00.
3. Chuveiro: 6.000 W = 6 kW; 40 minutos são 40/60 = 2/3 de hora. Por dia: 6 × 2/3 = 4 kWh. No mês: 4 × 30 = 120 kWh.
4. Parte do chuveiro: 120 de 180 kWh, ou seja, 2/3 do consumo. Em reais, 120 × 0,80 = R$ 96,00.

Confira: o chuveiro gastou mais do que todo o resto da casa junto (60 kWh). Faz sentido: 6 kW é a potência de seiscentas lâmpadas LED de 10 W acesas ao mesmo tempo.

## Como isso cai no ENEM

- **Formatos:** tabela de aparelhos com potência e tempo de uso, conta de luz, etiqueta de aparelho, chuveiro com chave de temperatura. A questão pede o consumo em kWh, o valor em reais, a economia de uma troca (lâmpada, geladeira, tempo de banho) ou a corrente de um aparelho para escolher fio e disjuntor. Pode vir junto com calor: em 2022, uma questão ligou a potência de um chuveiro à vazão e ao aumento de temperatura da água.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, os fenômenos elétricos e magnéticos tiveram 7 das 89 questões classificadas de Ciências da Natureza (7,9%). Este tópico, consumo e potência, teve 1 delas. São só duas edições: é tendência, não promessa.
- **Habilidades:** H5 (dimensionar circuitos e aparelhos elétricos do dia a dia), que teve 4 questões nessa mesma base, e H23 (avaliar formas de gerar, usar ou transformar energia), quando a questão compara economias.
- **Armadilhas:**
  - Multiplicar watts por horas e esquecer de dividir por 1.000. Watt-hora não é quilowatt-hora.
  - Usar minutos como se fossem horas. 15 minutos são 0,25 h, não 15 h.
  - Achar que resistência maior esquenta mais. Com a mesma tensão, é o contrário.
  - Confundir potência (kW, no aparelho) com energia (kWh, na conta).

## Questão comentada

**Texto-base.** Uma associação de moradores trocou 5 lâmpadas incandescentes de 60 W da sua sede por lâmpadas LED de 10 W, que iluminam do mesmo jeito. As lâmpadas ficam acesas 4 horas por dia, todos os dias.

**Comando.** Em 30 dias, a troca economiza uma energia de

A) 1 kWh.
B) 6 kWh.
C) 30 kWh.
D) 36 kWh.
E) 30.000 kWh.

**Resolução.**

1. Economia de potência por lâmpada: 60 − 10 = 50 W. Nas 5 lâmpadas: 5 × 50 = 250 W.
2. Horas no mês: 4 × 30 = 120 h.
3. Energia economizada: 250 W × 120 h = 30.000 Wh.
4. Em quilowatt-hora: 30.000 ÷ 1.000 = 30 kWh.

**Gabarito: C.**

**Por que as outras não:**

- A) 1 kWh: é a economia de um dia só (250 W × 4 h = 1.000 Wh). Faltou multiplicar pelos 30 dias.
- B) 6 kWh: é a economia de uma lâmpada só (50 W × 120 h). São 5 lâmpadas.
- D) 36 kWh: é o consumo das incandescentes (5 × 60 W × 120 h). A economia é a diferença entre o gasto antigo e o novo.
- E) 30.000 kWh: o valor está em watt-hora. Divida por 1.000 para chegar a kWh.

```realidade
Pegue a última conta de luz da sua casa e ache o consumo do mês em kWh. Depois anote a potência do chuveiro (está na caixa ou no próprio aparelho) e estime quantos minutos de banho a casa toma por dia. Quanto do consumo vem do chuveiro?
```

## Resumo

- Potência é energia por segundo, em watts. P = U · i.
- Energia é potência vezes tempo. Com kW e horas, ela sai em kWh.
- 1 kWh = 1.000 W durante 1 hora = 3.600.000 J.
- Consumo do mês = leitura atual − leitura anterior. Valor = consumo × tarifa (mais o que a conta somar).
- Com a mesma tensão, menos resistência dá mais potência: P = U² ÷ R. Por isso o inverno do chuveiro gasta mais.
- As fórmulas também estão no [Formulário de física](/trilhas/enem-reta-final/formulario-de-fisica).

## Para aprofundar

- [Eletricidade em casa](/trilhas/fisica-fundamental/eletricidade-em-casa)
- [Circuitos elétricos](/trilhas/fisica-medio/circuitos-eletricos)
- [Trabalho, energia e potência](/trilhas/fisica-medio/trabalho-energia-e-potencia)
- [Contas do dia a dia: luz, água, salário, parcelamento e impostos](/trilhas/enem-matematica-proporcionalidade/contas-do-dia-a-dia)
- [Formulário de física](/trilhas/enem-reta-final/formulario-de-fisica)
- [Natureza, o essencial: física](/trilhas/enem-reta-final/natureza-o-essencial-fisica)
