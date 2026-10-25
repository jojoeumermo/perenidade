---
titulo: "Chuveiro elétrico: resistência e ligação"
resumo: "Como o chuveiro elétrico funciona, por que o inverno gasta mais, quanto a água esquenta, como se liga com segurança e como trocar a resistência sem errar a tensão."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Chuveiro elétrico"
    autor: "Wikipédia"
    url: "https://pt.wikipedia.org/wiki/Chuveiro_el%C3%A9trico"
  - titulo: "College Physics 2e, seção 14.2, Temperature Change and Heat Capacity"
    autor: "Paul Peter Urone e Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/14-2-temperature-change-and-heat-capacity"
  - titulo: "College Physics 2e, seção 20.4, Electric Power and Energy"
    autor: "Paul Peter Urone e Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/20-4-electric-power-and-energy"
  - titulo: "Instalações elétricas residenciais, parte 1 (manual baseado na NBR 5410)"
    autor: "ELEKTRO e Pirelli, com revisão técnica de Hilton Moreno"
    ano: "2003"
    url: "https://www.coe.ufrj.br/~kleber/INST_ELET_RES_PARTE_01.pdf"
  - titulo: "Instalações elétricas residenciais, parte 2 (manual baseado na NBR 5410)"
    autor: "ELEKTRO e Pirelli, com revisão técnica de Hilton Moreno"
    ano: "2003"
    url: "https://www.coe.ufrj.br/~kleber/INST_ELET_RES_PARTE_02.pdf"
glossario:
  - termo: "resistência"
    definicao: "No chuveiro, o nome do fio espiralado, de liga de níquel e cromo, que esquenta quando a corrente passa e aquece a água."
  - termo: "diafragma"
    definicao: "A peça de borracha que a pressão da água empurra. É ela que fecha os contatos e liga a resistência só quando a água passa."
  - termo: "vazão"
    definicao: "Quanta água passa por minuto. Menos vazão, com a mesma potência, deixa a água mais quente."
quiz:
  - pergunta: "Na posição inverno, a resistência usada no chuveiro é:"
    opcoes: ["Maior, para gastar menos", "Menor, para a potência ser maior", "Igual à do verão"]
    resposta: 1
    explicacao: "Com tensão fixa, P = V² ÷ R: menos resistência, mais potência, mais calor."
  - pergunta: "Por que o chuveiro só esquenta quando a água está passando?"
    opcoes: ["Porque a água conduz a eletricidade até a resistência", "Porque a pressão da água empurra um diafragma que fecha os contatos", "Porque o registro é um interruptor elétrico"]
    resposta: 1
    explicacao: "Desde o primeiro chuveiro automático, criado em Jaú (SP), é a pressão da água que liga a resistência."
  - pergunta: "Uma resistência de 220 V instalada numa casa de 127 V:"
    opcoes: ["Queima na hora", "Esquenta pouco: dá cerca de um terço da potência", "Funciona igual"]
    resposta: 1
    explicacao: "P = V² ÷ R. Com a mesma resistência e 127 V em vez de 220 V, a potência cai para (127 ÷ 220)², cerca de 33%."
  - pergunta: "O circuito do chuveiro precisa de DR?"
    opcoes: ["Sim, a norma exige DR em pontos de locais com chuveiro", "Não, só tomadas precisam", "Só se for 127 V"]
    resposta: 0
    explicacao: "A NBR 5410 exige DR de alta sensibilidade nos pontos situados em locais com chuveiro ou banheira."
---

```provocacao
No inverno, a conta de luz sobe. Mas o chuveiro é o mesmo e o banho dura o mesmo tempo. De onde vem a diferença?
```

## O que você vai aprender

Ao fim desta aula você vai entender como o chuveiro elétrico funciona, calcular a potência no verão e no inverno, estimar quanto a água esquenta, saber como ele deve ser ligado e trocar a resistência com segurança.

## Uma invenção brasileira

O chuveiro elétrico foi criado em **Jaú, no interior de São Paulo, em meados da década de 1930**, por Francisco Canhos. Num tempo em que quase não havia rede de gás nas cidades, ele usou a eletricidade para aquecer a água. O chuveiro automático dele tinha um **diafragma de borracha**: ao abrir o registro, a pressão da água enchia o diafragma e aproximava os contatos da resistência dos contatos energizados, fechando o circuito. E tinha duas resistências, que combinadas davam temperaturas diferentes. Quase todos os chuveiros feitos depois seguem essa ideia.

A **resistência** é um fio espiralado de liga de níquel e cromo, metais que aguentam temperatura alta.

## Verão e inverno

A tensão da casa é fixa. A chave do chuveiro muda **quanto de resistência** a corrente atravessa:

```formula
P = V² ÷ R
Com a tensão fixa, quanto menor a resistência, maior a potência.
```

- **Inverno**: resistência **menor**, potência **maior**, água mais quente, conta maior.
- **Verão**: resistência **maior**, potência **menor**.

## Quanto a água esquenta

A potência vai quase toda para a água. A física do calor diz quanto ela esquenta:

```formula
P = (massa de água por segundo) × c × ΔT
c é o calor específico da água: 4.186 J para esquentar 1 kg em 1 °C. ΔT é quanto a temperatura sobe.
```

Daí vem uma coisa que todo mundo já percebeu: **fechar um pouco o registro deixa a água mais quente**. Menos água por segundo, com a mesma potência, sobe mais a temperatura.

## Como o chuveiro deve ser ligado

- **Circuito só para ele**: a corrente passa de 10 A, e a NBR 5410 pede circuito exclusivo para aparelhos assim.
- **Fio e disjuntor dimensionados** para a potência do chuveiro (veja a aula de dimensionamento).
- **DR** de alta sensibilidade: a norma exige em pontos de locais com chuveiro.
- **Fio terra** ligado ao chuveiro: todos os circuitos levam terra, inclusive os de chuveiro.
- A ligação pode ser direta, com **conectores** adequados à corrente; não precisa ser tomada.

## Trocar a resistência com segurança

1. **Desligue o disjuntor do chuveiro** e confirme a ausência de tensão com o multímetro. Só desligar a chave do chuveiro não basta.
2. Feche o registro e abra o chuveiro conforme o manual dele.
3. Compre a resistência do **mesmo modelo**, com a **mesma tensão** e a **mesma potência** indicadas no chuveiro.
4. Encaixe a resistência nova como o manual do chuveiro indica, feche tudo e só então religue o disjuntor.
5. Abra a água antes de testar a posição mais quente.

```navidareal
**A resistência que queimou de novo.** Se a resistência queima toda semana, o problema não é a resistência. Pode ser tensão errada (uma resistência de 127 V numa casa de 220 V recebe três vezes a potência), mau contato nos bornes, que esquenta e funde o ponto, ou pouca água passando. Trocar sem descobrir a causa é pagar a mesma peça de novo.
```

```verificar
Um chuveiro de 220 V tem 4.400 W no inverno e 2.200 W no verão. Em qual posição a resistência é maior?
- No inverno
+ No verão
- São iguais
> P = V² ÷ R: com a mesma tensão, potência menor significa resistência maior.
```

## Exemplo resolvido

**Um chuveiro de 5.500 W em 220 V, na posição inverno. (a) Qual é a resistência? (b) Com 3 litros por minuto, quanto a água esquenta? E com 6 litros por minuto? (c) Se esse chuveiro fosse instalado em 127 V, que potência daria?**

```conta
(a) R = V² ÷ P = 220 × 220 ÷ 5.500 = 48.400 ÷ 5.500 = 8,8 Ω

(b) 3 L/min = 3 kg por 60 s = 0,05 kg/s
ΔT = P ÷ (0,05 × 4.186) = 5.500 ÷ 209,3 ≈ 26 °C
6 L/min = 0,1 kg/s → ΔT = 5.500 ÷ 418,6 ≈ 13 °C

(c) P = 127 × 127 ÷ 8,8 = 16.129 ÷ 8,8 ≈ 1.833 W
```

Com água chegando a 20 °C, 3 L/min dão um banho perto de 46 °C; 6 L/min, perto de 33 °C. E o chuveiro de 220 V ligado em 127 V dá só cerca de **um terço** da potência: a água mal esquenta. Por isso a tensão do chuveiro e da resistência tem de ser a da casa.

## Resumo

- O chuveiro elétrico foi criado em Jaú (SP), nos anos 1930; a pressão da água empurra um diafragma que liga a resistência.
- **P = V² ÷ R**: no inverno a resistência é menor e a potência, maior.
- Menos vazão com a mesma potência deixa a água mais quente.
- Chuveiro tem **circuito próprio**, **DR** e **fio terra**.
- Resistência nova: **mesmo modelo, mesma tensão, mesma potência**, com o disjuntor desligado.

```leve
- Leia a etiqueta do chuveiro da sua casa: tensão e potência no verão e no inverno. Calcule a resistência de cada posição.
- Calcule quanto custa um banho de 10 minutos na posição inverno com o valor do kWh da sua conta de luz.
```
