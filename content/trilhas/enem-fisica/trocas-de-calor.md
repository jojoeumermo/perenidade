---
titulo: "Calor sensível e latente, trocas de calor e mudanças de estado"
resumo: "A diferença entre calor e temperatura, as contas Q = m · c · ΔT e Q = m · L, por que a água fervendo não passa de 100 °C, e como achar a temperatura final de uma mistura."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 11.2, Heat, Specific Heat, and Heat Transfer"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/11-2-heat-specific-heat-and-heat-transfer"
  - titulo: "Physics, seção 11.3, Phase Change and Latent Heat"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/11-3-phase-change-and-latent-heat"
  - titulo: "Provas e gabaritos do Enem (as provas de 2022 e 2023, base da contagem do instituto)"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Quanto calor é preciso para aquecer 200 g de água de 20 °C até 70 °C? Use c = 1 cal/(g · °C)."
    opcoes: ["10.000 cal", "14.000 cal", "250 cal", "18.000 cal"]
    resposta: 0
    explicacao: "Q = m · c · ΔT. A variação de temperatura é 70 − 20 = 50 °C. Então Q = 200 × 1 × 50 = 10.000 cal. Quem marcou 14.000 usou 70 °C no lugar da variação."
  - pergunta: "Uma panela de água ferve ao nível do mar, com o fogo alto. Enquanto ainda há água líquida, a temperatura dela"
    opcoes: ["sobe sem parar", "cai, porque a água perde vapor", "fica constante, em cerca de 100 °C", "sobe até 200 °C e para"]
    resposta: 2
    explicacao: "Durante uma mudança de estado, a temperatura fica constante. O calor do fogo é usado para transformar líquido em vapor (calor latente), não para esquentar mais a água."
  - pergunta: "Uma colher de metal fria é posta numa xícara de café quente. O calor passa"
    opcoes: ["da colher para o café", "nos dois sentidos, na mesma medida", "da xícara para a colher, mas não do café", "do café para a colher, até as temperaturas se igualarem"]
    resposta: 3
    explicacao: "O calor sempre passa, por conta própria, do corpo mais quente para o mais frio. A troca para quando os dois chegam à mesma temperatura: é o equilíbrio térmico."
  - pergunta: "Quanto calor é preciso para derreter 100 g de gelo que já está a 0 °C? Use o calor latente de fusão do gelo, 80 cal/g."
    opcoes: ["180 cal", "8.000 cal", "1,25 cal", "800 cal"]
    resposta: 1
    explicacao: "Na mudança de estado, Q = m · L = 100 × 80 = 8.000 cal. A temperatura não muda enquanto o gelo derrete; todo esse calor vai para desfazer a estrutura do gelo."
---

```provocacao
Duas panelas iguais vão a duas bocas iguais do fogão, com a mesma chama, pelo mesmo tempo. Numa há 1 kg de água; na outra, 1 kg de óleo de cozinha. O óleo esquenta muito mais depressa. Por quê, se as duas panelas receberam o mesmo calor?
```

## O que você vai aprender

Ao fim desta aula você vai saber a diferença entre calor e temperatura, calcular o calor que aquece um corpo (Q = m · c · ΔT) e o calor que muda o seu estado (Q = m · L), ler uma curva de aquecimento e achar a temperatura final quando se misturam duas porções de água.

## Calor e temperatura não são a mesma coisa

No dia a dia, "está calor" e "a temperatura subiu" parecem dizer o mesmo. Na física, são duas ideias diferentes.

**Temperatura** mede o grau de agitação das partículas de um corpo. Quanto mais as partículas se agitam, maior a temperatura. Ela se mede em graus Celsius (°C), no Brasil, ou em kelvin (K), na ciência.

**Calor** é energia em trânsito. É a energia que passa de um corpo para outro **por causa de uma diferença de temperatura**. Ela sempre vai, por conta própria, do corpo mais quente para o mais frio. A passagem para quando os dois chegam à mesma temperatura. Esse estado final se chama **equilíbrio térmico**.

Por isso um corpo não "tem calor". Ele tem temperatura, e pode receber ou ceder calor. O calor se mede em joules (J) ou em calorias (cal). Uma caloria é o calor que aquece 1 g de água em 1 °C, e vale cerca de 4,2 J.

## Calor sensível: Q = m · c · ΔT

Quando um corpo recebe calor e a temperatura dele muda, chamamos esse calor de **sensível**: dá para "sentir" a mudança no termômetro.

Quanto calor é preciso depende de três coisas: da massa (mais água pede mais calor), de quanto a temperatura vai mudar e do material.

```formula
Q = m · c · ΔT
calor = massa × calor específico × variação de temperatura
aquecer 200 g de água de 20 °C a 70 °C: 200 × 1 × 50 = 10.000 cal
```

O **calor específico** (c) diz quanto calor o material pede para cada grama subir 1 °C. Para a água, c = 1 cal/(g · °C), que no Sistema Internacional dá cerca de 4.200 J/(kg · °C) (o valor de tabela é 4.186). A água tem um calor específico alto: ela pede muito calor para esquentar e demora a esfriar. O óleo de cozinha tem calor específico menor que o da água. Com o mesmo calor e a mesma massa, ele esquenta mais. É a resposta da provocação.

O produto m · c tem nome: **capacidade térmica** (C). É o calor que o corpo inteiro pede para subir 1 °C. Uma piscina tem capacidade térmica enorme; uma colher, pequena.

ΔT (lê-se "delta T") é a variação: temperatura final menos inicial. Se o corpo esfria, ΔT é negativo, e Q também: o corpo cedeu calor.

## Calor latente: mudar de estado sem mudar de temperatura

Ponha gelo a −10 °C numa panela no fogo e acompanhe o termômetro. Primeiro, o gelo esquenta até 0 °C. Aí o termômetro para. O gelo vai derretendo, e a temperatura fica em 0 °C até sobrar só água. Depois, a água esquenta até cerca de 100 °C (ao nível do mar). De novo o termômetro para, enquanto a água ferve. Só quando acaba o líquido o vapor volta a esquentar.

Nos trechos parados, o calor não some. Ele é usado para mudar o estado: separar as partículas do gelo, ou da água líquida. Esse calor se chama **latente** ("escondido", porque o termômetro não mostra).

```formula
Q = m · L
calor = massa × calor latente
derreter 100 g de gelo a 0 °C, com L = 80 cal/g: 100 × 80 = 8.000 cal
```

Para a água, os valores de tabela são: calor latente de fusão de 334 kJ/kg (cerca de 80 cal/g) e de vaporização de 2.256 kJ/kg (cerca de 540 cal/g). Ferver a água toda pede muito mais calor do que derretê-la.

As mudanças de estado têm nomes. Sólido para líquido: **fusão**; o contrário, **solidificação**. Líquido para gasoso: **vaporização** (lenta, a evaporação; ou com bolhas, a ebulição); o contrário, **condensação**. Sólido direto para gás: **sublimação**. Fusão e vaporização pedem calor. Solidificação e condensação devolvem calor ao ambiente.

## Trocas de calor: quem cede, quem recebe

Quando se misturam corpos a temperaturas diferentes, num recipiente que não troca calor com o lado de fora, todo o calor que um cede, o outro recebe.

```formula
Q cedido + Q recebido = 0
o calor que sai do corpo quente é igual ao que entra no corpo frio
com dois corpos de água: m₁ · (T₁ − Tf) = m₂ · (Tf − T₂)
```

Com duas porções de água, a temperatura final fica mais perto da temperatura da porção maior. É uma média ponderada pelas massas.

```navidareal
# O suor que esfria o corpo
Num dia quente, o corpo sua. O suor evapora na pele, e para evaporar a água precisa de calor latente. Boa parte desse calor sai da própria pele. Por isso o suor esfria o corpo.

Num dia abafado, com o ar muito úmido, o suor evapora pouco, escorre, e o alívio é menor. O mesmo vale para a moringa de barro: a água que passa pelos poros e evapora por fora leva calor da água de dentro.
```

```verificar
Misturam-se 1 kg de água a 80 °C e 1 kg de água a 20 °C, sem perda de calor. Qual é a temperatura final?
- 100 °C
- 60 °C
+ 50 °C
> As massas são iguais, então a temperatura final é a média simples: (80 + 20) ÷ 2 = 50 °C. A água quente perdeu 30 °C e a fria ganhou 30 °C.
```

## Exemplo resolvido

**Para o banho de um bebê, há 2 L de água a 20 °C numa banheira. Quanto de água a 80 °C é preciso juntar para a mistura ficar a 40 °C? Considere 1 L de água com 1 kg (1.000 g), c = 1 cal/(g · °C) e nenhuma perda de calor.**

1. Água fria: 2.000 g, sobe de 20 °C para 40 °C. Recebe Q = 2.000 × 1 × 20 = 40.000 cal.
2. Água quente: massa m, desce de 80 °C para 40 °C. Cede Q = m × 1 × 40.
3. Calor cedido = calor recebido: m × 40 = 40.000. Então m = 1.000 g, ou seja, 1 L.

Confira com a média ponderada: (2 × 20 + 1 × 80) ÷ 3 = 120 ÷ 3 = 40 °C. Bate.

## Como isso cai no ENEM

- **Formatos:** chuveiro e aquecedor solar, panela de pressão, garrafa térmica, mistura de água no banho, gelo no suco, clima do litoral e do interior, suor e moringa. A questão pede o calor para aquecer ou derreter, a temperatura final de uma mistura, a leitura de uma curva de aquecimento ou a explicação de um fenômeno pelo calor específico ou pelo calor latente. Pode vir junto com eletricidade: a potência do chuveiro vira calor na água.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, o objeto "O calor e os fenômenos térmicos" teve 2 das 89 questões classificadas de Ciências da Natureza (2,2%), e as duas foram deste tópico. São só duas edições: é tendência, não promessa.
- **Habilidades:** H21 (usar leis da física para interpretar processos térmicos), que teve 5 questões nessa mesma base, e H23 (avaliar formas de gerar, usar ou transformar energia), quando a questão compara aquecedores.
- **Armadilhas:**
  - Usar a temperatura final no lugar da variação ΔT.
  - Achar que a temperatura sobe durante a fervura ou o derretimento. Ela fica parada.
  - Esquecer o calor latente quando o gelo derrete e depois a água esquenta: são duas contas, uma de cada tipo.
  - Fazer média simples quando as massas são diferentes.

## Questão comentada

**Texto-base.** Para tomar um chá morno, uma pessoa coloca numa garrafa térmica 300 g de água a 90 °C e completa com 100 g de água da torneira, a 10 °C. Considere que a garrafa não troca calor com o ambiente nem com a água.

**Comando.** Depois de atingido o equilíbrio térmico, a temperatura da água na garrafa é de

A) 30 °C.
B) 70 °C.
C) 90 °C.
D) 50 °C.
E) 100 °C.

**Resolução.**

1. Calor cedido pela água quente: 300 × 1 × (90 − Tf).
2. Calor recebido pela água fria: 100 × 1 × (Tf − 10).
3. Igualando: 300 × (90 − Tf) = 100 × (Tf − 10). Divida tudo por 100: 3 × (90 − Tf) = Tf − 10.
4. 270 − 3Tf = Tf − 10, então 280 = 4Tf, e Tf = 70 °C.

Confira com a média ponderada: (300 × 90 + 100 × 10) ÷ 400 = 28.000 ÷ 400 = 70 °C.

**Gabarito: B.**

**Por que as outras não:**

- A) 30 °C: você trocou as massas, dando peso 300 à água fria. A água quente é a de maior massa.
- C) 90 °C: você achou que a água em maior quantidade impõe a sua temperatura. Ela puxa a média para perto dela, mas também esfria.
- D) 50 °C: é a média simples de 90 e 10. As massas são diferentes, e a média tem de ser ponderada.
- E) 100 °C: você somou as temperaturas. Na mistura, a temperatura final fica sempre entre as duas iniciais.

```realidade
Na próxima vez que ferver água em casa, observe: quanto tempo leva para começar a ferver, e quanto tempo leva para a água secar quase toda, com o mesmo fogo? Compare com os valores da aula: derreter pede cerca de 80 cal/g e ferver, cerca de 540 cal/g.
```

## Resumo

- Temperatura mede a agitação das partículas. Calor é energia que passa do mais quente para o mais frio, até o equilíbrio térmico.
- Calor sensível muda a temperatura: Q = m · c · ΔT. Para a água, c = 1 cal/(g · °C), cerca de 4.200 J/(kg · °C).
- Calor latente muda o estado, com a temperatura parada: Q = m · L. Água: fusão cerca de 80 cal/g, vaporização cerca de 540 cal/g.
- Fusão e vaporização pedem calor; solidificação e condensação devolvem.
- Num sistema isolado, calor cedido = calor recebido. Com água, a temperatura final é a média ponderada pelas massas.
- As fórmulas também estão no [Formulário de física](/trilhas/enem-reta-final/formulario-de-fisica).

## Para aprofundar

- [Calor e temperatura](/trilhas/fisica-fundamental/calor-e-temperatura)
- [Termodinâmica](/trilhas/fisica-medio/termodinamica)
- [Potência elétrica, consumo em kWh e conta de luz](/trilhas/enem-fisica/consumo)
- [Formulário de física](/trilhas/enem-reta-final/formulario-de-fisica)
- [Natureza, o essencial: física](/trilhas/enem-reta-final/natureza-o-essencial-fisica)
