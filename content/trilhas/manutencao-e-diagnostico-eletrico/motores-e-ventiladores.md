---
titulo: "Motores e ventiladores"
resumo: "Como um motor elétrico transforma corrente em giro, por que o motor monofásico precisa de ajuda para partir, o papel do capacitor no ventilador, como ler a placa do motor e os defeitos mais comuns."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "College Physics 2e, seção 22.8, Torque on a Current Loop: Motors and Meters"
    autor: "Paul Peter Urone e Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/22-8-torque-on-a-current-loop-motors-and-meters"
  - titulo: "Motor de indução"
    autor: "Wikipédia"
    url: "https://pt.wikipedia.org/wiki/Motor_de_indu%C3%A7%C3%A3o"
  - titulo: "Induction motor"
    autor: "Wikipédia (em inglês)"
    url: "https://en.wikipedia.org/wiki/Induction_motor"
  - titulo: "Ceiling fan"
    autor: "Wikipédia (em inglês)"
    url: "https://en.wikipedia.org/wiki/Ceiling_fan"
  - titulo: "Capacitor"
    autor: "Wikipédia"
    url: "https://pt.wikipedia.org/wiki/Capacitor"
  - titulo: "Cavalo (unidade)"
    autor: "Wikipédia"
    url: "https://pt.wikipedia.org/wiki/Cavalo-vapor"
glossario:
  - termo: "estator"
    definicao: "A parte parada do motor, com as bobinas que criam o campo magnético."
  - termo: "rotor"
    definicao: "A parte que gira, presa ao eixo."
  - termo: "capacitor"
    definicao: "Componente que armazena carga elétrica. Nos motores monofásicos, ajuda a criar o campo que faz o motor partir e girar no sentido certo."
  - termo: "cv"
    definicao: "Cavalo-vapor, unidade de potência ainda usada em placas de motor. 1 cv é cerca de 735,5 W."
quiz:
  - pergunta: "O que faz o eixo de um motor girar?"
    opcoes: ["O calor da corrente", "A força do campo magnético sobre as espiras com corrente", "A pressão do ar"]
    resposta: 1
    explicacao: "O campo magnético exerce um torque nas espiras por onde passa corrente, e isso gira o eixo: energia elétrica vira trabalho mecânico."
  - pergunta: "Por que um motor de indução monofásico precisa de um circuito de partida, com segundo enrolamento ou capacitor?"
    opcoes: ["Para gastar menos energia", "Porque, parado, ele não tem força para começar a girar sozinho", "Para diminuir o barulho"]
    resposta: 1
    explicacao: "Com um enrolamento só, o torque na partida é zero. O segundo enrolamento, com corrente defasada pelo capacitor, cria o campo girante que dá a partida."
  - pergunta: "Um ventilador de teto zumbe e não gira, ou gira devagar demais. Qual é uma causa comum?"
    opcoes: ["Capacitor com defeito ou de valor errado", "Lâmpada queimada", "Tomada sem terra"]
    resposta: 0
    explicacao: "Capacitor ruim desequilibra as correntes dos enrolamentos: o motor zumbe e perde força."
  - pergunta: "Uma bomba d'água tem placa de 1 cv. Quantos watts é isso, aproximadamente?"
    opcoes: ["100 W", "735 W", "1.000 W"]
    resposta: 1
    explicacao: "O cavalo-vapor métrico vale cerca de 735,5 W. O hp, usado em outros países, vale cerca de 745,7 W."
---

```provocacao
O ventilador de teto faz um zumbido e fica parado. Se alguém der um empurrão nas pás, ele começa a girar. Por quê?
```

## O que você vai aprender

Ao fim desta aula você vai entender como um motor elétrico funciona, por que o motor monofásico precisa de ajuda para partir, para que serve o capacitor do ventilador, como ler a placa de um motor e reconhecer os defeitos mais comuns.

## Corrente que vira giro

Um fio com corrente dentro de um campo magnético sofre uma força. Num motor, há **espiras** (voltas de fio) dentro de um campo: quando a corrente passa, o campo exerce um **torque** nas espiras, e elas fazem o **eixo girar**. A energia elétrica vira **trabalho mecânico**. Motores são a aplicação mais comum da força magnética sobre fios com corrente.

O motor tem duas partes: o **estator**, parado, com as bobinas, e o **rotor**, que gira com o eixo.

## O motor de indução

Muitos motores de aparelhos e máquinas são **de indução**. O campo das bobinas do estator **induz** corrente no rotor, sem nenhum fio ligado nele. O rotor mais comum é o de **gaiola de esquilo**, feito de barras metálicas. Os motores **trifásicos** dão partida sozinhos e são muito usados na indústria; os **monofásicos**, que funcionam com a tensão de casa, servem para cargas menores.

## Por que o monofásico precisa de ajuda para partir

Com um enrolamento só, o motor monofásico **parado não tem torque**: ele zumbe e não sai do lugar. Por isso ele tem um **segundo enrolamento**, alimentado com uma corrente "atrasada" em relação à do primeiro. Essa defasagem costuma vir de um **capacitor** e cria um campo que gira e dá a partida.

- No motor com **capacitor de partida**, o segundo enrolamento é desligado depois que o motor embala, normalmente por uma chave centrífuga.
- No motor com **capacitor permanente**, o segundo enrolamento fica sempre ligado, o que melhora o torque.

Isso explica a provocação: quando o capacitor falha, o motor não tem força para sair do lugar, mas, se for empurrado, já tem torque para continuar girando. Ainda assim, empurrar pás de ventilador energizado é arriscado: o certo é desligar e trocar o capacitor.

Também é o segundo enrolamento que define o **sentido do giro**: em muitos motores, inverter a ligação dele inverte o sentido.

## O ventilador de teto

Nos ventiladores de teto, o capacitor fica numa caixinha abaixo do motor, junto com fios e chaves. Os motores com **capacitor permanente** são mais eficientes que os modelos mais simples, sem capacitor. O controle de velocidade antigo era uma bobina grande na parede; os novos usam capacitores pequenos e eletrônica.

Um zumbido no ventilador pode vir de **capacitor com defeito ou de valor errado**, ou de um **dimmer de lâmpada** usado como controle de velocidade, que não foi feito para motor.

Atenção: o capacitor **armazena carga elétrica** e pode continuar carregado depois que o aparelho é desligado. Não encoste nos terminais dele.

## A placa do motor

Todo motor traz uma placa com:

| Informação | Para que serve |
| --- | --- |
| Potência (W, cv ou hp) | o trabalho que ele entrega no eixo |
| Tensão (V) | 127 V, 220 V ou as duas, com esquema de ligação |
| Corrente (A) | para dimensionar fio e disjuntor |
| Rotação (rpm) | voltas por minuto |
| Frequência (Hz) | no Brasil, 60 Hz |
| Capacitor (µF e V) | o valor do capacitor, quando tem |

O **cavalo-vapor** (cv) vale cerca de **735,5 W**; o **hp**, cerca de **745,7 W**. Para dimensionar o circuito, use a **corrente da placa**: ela já considera as perdas do motor. Na partida, o motor puxa mais corrente do que depois de embalar.

```navidareal
**O motor que esquenta demais.** Motor que fica quente a ponto de não dar para encostar a mão pode estar com rolamento gasto, ventilação entupida de poeira, tensão errada ou carga pesada demais. Antes de trocar o motor, limpe, confira a tensão na placa e na tomada e veja se o eixo gira livre com o aparelho desligado.
```

```verificar
A placa de um motor monofásico diz: 220 V, 4,2 A, capacitor de 20 µF. Você vai trocar o capacitor estufado. Qual comprar?
+ Um de 20 µF, com tensão igual ou maior que a do original
- Qualquer capacitor que caiba no lugar
- Um de 40 µF, para dar mais força
> O valor do capacitor muda as correntes dos enrolamentos. Valor errado também faz o motor zumbir e perder força.
```

## Exemplo resolvido

**Um ventilador de teto de 127 V, com placa de 130 W, zumbe e gira bem devagar. Ele fica ligado 8 horas por dia. (a) Qual é a causa provável e o que fazer? (b) Quanto ele consome por mês, funcionando bem?**

(a) Zumbido e giro lento num motor monofásico com capacitor apontam para o **capacitor**: com ele ruim, o segundo enrolamento não recebe a corrente certa. O procedimento:

1. **Desligue o disjuntor** e confirme a ausência de tensão.
2. Abra a caixinha do capacitor e anote o valor (µF) e a tensão escritos nele.
3. Troque por um capacitor **do mesmo valor** e com tensão **igual ou maior**, sem encostar nos terminais do antigo.
4. Confira se o controle de velocidade é o próprio do ventilador, e não um dimmer de lâmpada.

(b) Consumo:

```conta
130 W × 8 h × 30 dias = 31.200 Wh = 31,2 kWh por mês
```

## Resumo

- No motor, o campo magnético faz **torque** nas espiras com corrente e gira o eixo.
- O motor de **indução** induz corrente no rotor, sem fio ligado nele.
- O monofásico precisa de **segundo enrolamento e capacitor** para partir; sem isso, zumbe parado.
- Capacitor ruim ou de valor errado causa **zumbido e perda de força**; troque pelo mesmo valor.
- **1 cv ≈ 735,5 W**. Use a corrente da placa para dimensionar o circuito.

```leve
- Procure a placa do motor de um aparelho em casa (ventilador, bomba, máquina de lavar) e anote potência, tensão, corrente e rotação.
- Calcule quanto o seu ventilador consome por mês e compare com o consumo do chuveiro.
```
