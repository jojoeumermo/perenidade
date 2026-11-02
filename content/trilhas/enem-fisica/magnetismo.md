---
titulo: "Magnetismo, motores, geradores e transformadores"
resumo: "Ímãs, polos e campo magnético, a bússola e a Terra, a corrente que cria campo, a indução que cria corrente, e como funcionam o motor, o gerador da usina e o transformador."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 20.1, Magnetic Fields, Field Lines, and Force"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/20-1-magnetic-fields-field-lines-and-force"
  - titulo: "Physics, seção 20.2, Motors, Generators, and Transformers"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/20-2-motors-generators-and-transformers"
  - titulo: "Physics, seção 20.3, Electromagnetic Induction"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/20-3-electromagnetic-induction"
  - titulo: "Provas e gabaritos do Enem (as provas de 2022 e 2023, base da contagem do instituto)"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Um transformador tem 1.000 espiras no primário, ligado em 220 V, e 50 espiras no secundário. A tensão no secundário é de"
    opcoes: ["4.400 V", "11 V", "1.050 V", "0,22 V"]
    resposta: 1
    explicacao: "A tensão segue a razão entre as espiras: Us ÷ Up = Ns ÷ Np. Então Us = 220 × 50 ÷ 1.000 = 11 V. Menos espiras no secundário, menos tensão."
  - pergunta: "Num liquidificador, o motor elétrico transforma"
    opcoes: ["energia mecânica em energia elétrica", "energia térmica em energia elétrica", "energia elétrica em energia mecânica", "energia magnética em energia química"]
    resposta: 2
    explicacao: "No motor, a corrente passa por bobinas dentro de um campo magnético. A força magnética faz o eixo girar: energia elétrica vira energia de movimento. O gerador faz o caminho contrário."
  - pergunta: "Um ímã em barra é quebrado ao meio. O que se obtém?"
    opcoes: ["Um pedaço só com polo norte e outro só com polo sul", "Dois pedaços sem nenhum magnetismo", "Um ímã e um pedaço de ferro comum", "Dois ímãs menores, cada um com polo norte e polo sul"]
    resposta: 3
    explicacao: "Os polos de um ímã não se separam. Cada pedaço vira um ímã completo, com os dois polos. Até hoje nunca se encontrou um polo magnético isolado."
  - pergunta: "Por que um transformador não funciona ligado a uma pilha?"
    opcoes: ["Porque a pilha dá corrente contínua, e o transformador precisa de um campo magnético que varie", "Porque a tensão da pilha é alta demais", "Porque a pilha não tem polos", "Porque o transformador só funciona com corrente zero"]
    resposta: 0
    explicacao: "O transformador funciona por indução: o campo magnético do primário tem de mudar o tempo todo para criar tensão no secundário. A corrente alternada da tomada faz isso; a contínua da pilha, não."
---

```provocacao
Numa usina hidrelétrica, a água cai e gira uma turbina. Na outra ponta do fio, a sua lâmpada acende. A água não chega à sua casa. O que passa, então, da turbina girando até a corrente no fio?
```

## O que você vai aprender

Ao fim desta aula você vai saber como os ímãs se atraem e se repelem, o que é campo magnético, por que a bússola aponta para o norte, como a corrente elétrica cria magnetismo e o magnetismo cria corrente, e como funcionam o motor, o gerador e o transformador.

## Ímãs, polos e campo magnético

Todo ímã tem dois **polos**, chamados norte e sul. A regra é curta: **polos iguais se repelem, polos diferentes se atraem**. Os polos não se separam. Quebre um ímã ao meio e você terá dois ímãs, cada um com norte e sul.

Em volta do ímã existe um **campo magnético**: a região onde ele age sobre outros ímãs e sobre o ferro. Para desenhar o campo, usamos **linhas de campo**. Fora do ímã, elas saem do polo norte e entram no polo sul, sempre em laços fechados. Onde as linhas ficam mais juntas, perto dos polos, o campo é mais forte.

A **bússola** é um pequeno ímã que gira livre. A Terra se comporta como um grande ímã. O polo norte da agulha aponta para perto do polo norte geográfico. Como polos diferentes se atraem, ali, perto do norte geográfico, fica um polo **sul** magnético da Terra. É uma pegadinha clássica.

## A corrente cria campo magnético

Em 1820, o dinamarquês Hans Christian Ørsted percebeu que a agulha de uma bússola se mexia perto de um fio com corrente. Foi a descoberta de que **corrente elétrica cria campo magnético**. Eletricidade e magnetismo são duas faces de um mesmo fenômeno, o eletromagnetismo.

Enrole um fio em espiral em volta de um prego de ferro e ligue-o a uma pilha: você tem um **eletroímã**. Ele é um ímã que se liga e desliga. Guindastes de ferro-velho, campainhas e fechaduras elétricas usam eletroímãs.

## Motor: de elétrica para mecânica

Um fio com corrente, dentro de um campo magnético, recebe uma **força magnética**. No **motor elétrico**, uma bobina (um fio enrolado em muitas voltas) fica entre ímãs. A corrente passa pela bobina, as forças magnéticas giram o eixo. No motor de corrente contínua, uma peça chamada comutador inverte a corrente a cada meia volta, para o giro continuar no mesmo sentido.

O motor transforma **energia elétrica em energia mecânica**. Está no liquidificador, no ventilador, na máquina de lavar, na bomba-d'água e no carro elétrico.

## Gerador: de mecânica para elétrica

Em 1831, o inglês Michael Faraday mostrou o caminho de volta: **um campo magnético que varia cria corrente** numa bobina. Isso se chama **indução eletromagnética**. Mova um ímã para dentro e para fora de uma bobina, e aparece corrente. Com o ímã parado, ela some. O que conta é a **variação**.

```formula
ε = −N · ΔΦ ÷ Δt
tensão induzida = número de espiras × variação do fluxo magnético ÷ tempo (o sinal de menos é a Lei de Lenz)
quanto mais rápida a variação e mais espiras, maior a tensão induzida
```

O sinal de menos é a **Lei de Lenz**: a corrente induzida cria um campo que se opõe à variação que a produziu. Por isso é preciso fazer força para girar um gerador: a energia elétrica sai do trabalho de quem gira.

No **gerador**, uma bobina gira dentro de um campo magnético (ou um ímã gira dentro de bobinas). O campo através da bobina varia o tempo todo, e aparece corrente. O gerador transforma **energia mecânica em energia elétrica**. É a resposta da provocação: na hidrelétrica, a água gira a turbina, a turbina gira o gerador, e o que viaja pelo fio é energia elétrica, não a água. Usinas térmicas, nucleares e eólicas usam o mesmo princípio; muda só o que gira a turbina.

## Transformador: muda a tensão

O **transformador** tem duas bobinas enroladas no mesmo núcleo de ferro. A corrente alternada no **primário** cria um campo que muda o tempo todo; esse campo atravessa o **secundário** e induz nele uma tensão.

```formula
Us ÷ Up = Ns ÷ Np
tensão no secundário ÷ tensão no primário = espiras do secundário ÷ espiras do primário
num transformador ideal, a potência se conserva: Up · ip = Us · is
```

Mais espiras no secundário, mais tensão: é um transformador **elevador**. Menos espiras, menos tensão: **abaixador**. Ele só funciona com **corrente alternada**, porque precisa de um campo que varie. Com a corrente contínua de uma pilha, não induz nada.

```navidareal
# Por que as linhas de transmissão têm tensão tão alta
Perto da usina, transformadores elevam muito a tensão antes de mandar a energia pelos fios. Para a mesma potência (P = U · i), tensão maior quer dizer corrente menor.

A perda nos fios é calor, pelo efeito Joule, e vai com a corrente ao quadrado (P = R · i²). Corrente 10 vezes menor dá perda 100 vezes menor. Perto da cidade, outros transformadores, nos postes, abaixam a tensão para a das tomadas.
```

```verificar
Uma bússola fica longe de ímãs e de fios com corrente. Para onde o polo norte da agulha aponta?
- Para o polo norte magnético da Terra, que fica perto do norte geográfico
+ Para perto do norte geográfico, onde está um polo sul magnético da Terra
- Para o sul geográfico, porque polos iguais se atraem
> O polo norte da agulha é atraído por um polo sul. Ele aponta para perto do norte geográfico; logo, ali está um polo sul magnético da Terra.
```

## Exemplo resolvido

**Um transformador abaixador recebe 12.000 V no primário, que tem 5.000 espiras, e entrega 240 V no secundário. Quantas espiras tem o secundário? Se o secundário fornece 50 A, qual é a corrente no primário, supondo o transformador ideal?**

1. Espiras: Ns = Np × Us ÷ Up = 5.000 × 240 ÷ 12.000 = 100 espiras.
2. Potência no secundário: 240 × 50 = 12.000 W.
3. No transformador ideal, a mesma potência entra no primário: 12.000 × ip = 12.000, então ip = 1 A.

Confira: a tensão caiu 50 vezes (12.000 ÷ 240) e a corrente subiu 50 vezes (de 1 A para 50 A). O transformador troca tensão por corrente; não cria energia.

## Como isso cai no ENEM

- **Formatos:** bússola e campo da Terra, eletroímã, motor de eletrodoméstico, lanterna de manivela e dínamo de bicicleta, usinas e o caminho da energia, transformador de poste e linhas de transmissão, carregadores por indução. A questão pede para identificar a transformação de energia, explicar por indução, calcular tensão ou espiras de um transformador ou justificar a alta tensão na transmissão.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, os fenômenos elétricos e magnéticos tiveram 7 das 89 questões classificadas de Ciências da Natureza (7,9%). Este tópico, magnetismo, motores, geradores e transformadores, teve 2 delas (2,2%). São só duas edições: é tendência, não promessa.
- **Habilidades:** H21 (usar leis da física para interpretar processos eletromagnéticos), que teve 5 questões nessa mesma base, e H23 (avaliar formas de gerar, usar ou transformar energia), com 2.
- **Armadilhas:**
  - Achar que o polo norte da bússola aponta para um polo norte magnético. Aponta para um polo sul.
  - Achar que ímã parado perto da bobina gera corrente. É preciso variação.
  - Inverter a razão do transformador. Mais espiras, mais tensão, no mesmo lado.
  - Achar que o transformador aumenta a energia. Ele aumenta a tensão e diminui a corrente na mesma proporção.

## Questão comentada

**Texto-base.** Uma usina envia uma potência elétrica fixa a uma cidade, por linhas de transmissão de resistência fixa. A perda de energia nos fios, por aquecimento, é proporcional ao quadrado da corrente que passa por eles. Os engenheiros decidem elevar a tensão de transmissão a um valor 10 vezes maior, mantendo a mesma potência enviada.

**Comando.** Com essa mudança, a perda por aquecimento nos fios fica

A) 100 vezes menor.
B) 10 vezes menor.
C) igual.
D) 10 vezes maior.
E) 100 vezes maior.

**Resolução.**

1. A potência é P = U · i e fica fixa. Se a tensão fica 10 vezes maior, a corrente fica 10 vezes menor.
2. A perda vai com o quadrado da corrente: P perdida = R · i².
3. Corrente 10 vezes menor dá perda 10 × 10 = 100 vezes menor.

**Gabarito: A.**

**Por que as outras não:**

- B) 10 vezes menor: é o que acontece com a corrente. A perda vai com o quadrado dela.
- C) igual: a resistência dos fios é a mesma, mas a corrente mudou, e a perda depende da corrente.
- D) 10 vezes maior: você achou que tensão maior aumenta a perda. Para a mesma potência, tensão maior quer dizer corrente menor.
- E) 100 vezes maior: você elevou ao quadrado, mas no sentido errado. A corrente cai, e a perda cai junto.

```realidade
Olhe os postes da sua rua. Muitas vezes há um transformador, uma caixa cilíndrica ou retangular presa no alto. Pela aula, ele eleva ou abaixa a tensão? Por que ele fica perto das casas, e não na usina?
```

## Resumo

- Polos iguais se repelem, diferentes se atraem. Os polos não se separam.
- Linhas de campo saem do norte e entram no sul, fora do ímã.
- O polo norte da bússola aponta para perto do norte geográfico, onde há um polo sul magnético.
- Corrente cria campo magnético (Ørsted, 1820): eletroímã e motor (elétrica para mecânica).
- Campo que varia cria corrente (Faraday, 1831): gerador (mecânica para elétrica). Lei de Lenz: a corrente induzida se opõe à variação.
- Transformador: Us ÷ Up = Ns ÷ Np; só com corrente alternada; ideal: Up · ip = Us · is.
- Transmissão em alta tensão: corrente menor, perda (R · i²) muito menor.
- As fórmulas também estão no [Formulário de física](/trilhas/enem-reta-final/formulario-de-fisica).

## Para aprofundar

- [Ímãs e magnetismo](/trilhas/fisica-fundamental/imas-e-magnetismo)
- [Eletromagnetismo](/trilhas/fisica-medio/eletromagnetismo)
- [Corrente, tensão, resistência e Lei de Ohm](/trilhas/enem-fisica/lei-de-ohm)
- [Potência elétrica, consumo em kWh e conta de luz](/trilhas/enem-fisica/consumo)
- [Formulário de física](/trilhas/enem-reta-final/formulario-de-fisica)
