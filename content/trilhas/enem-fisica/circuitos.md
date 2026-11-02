---
titulo: "Circuitos em série e em paralelo"
resumo: "Como a corrente e a tensão se dividem em série e em paralelo, a resistência equivalente de cada ligação, por que a casa é ligada em paralelo e por que ligar aparelhos demais desarma o disjuntor."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 19.2, Series Circuits"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/19-2-series-circuits"
  - titulo: "Physics, seção 19.3, Parallel Circuits"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/19-3-parallel-circuits"
  - titulo: "Physics, seção 19.1, Ohm's law"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/19-1-ohms-law"
  - titulo: "Provas e gabaritos do Enem (as provas de 2022 e 2023, base da contagem do instituto)"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Dois resistores, de 4 Ω e de 6 Ω, são ligados em série. A resistência equivalente é de"
    opcoes: ["2,4 Ω", "24 Ω", "10 Ω", "2 Ω"]
    resposta: 2
    explicacao: "Em série, as resistências se somam: 4 + 6 = 10 Ω. O valor 2,4 Ω seria a resistência equivalente em paralelo (4 × 6 ÷ 10)."
  - pergunta: "Dois resistores iguais, de 10 Ω cada, são ligados em paralelo. A resistência equivalente é de"
    opcoes: ["5 Ω", "20 Ω", "10 Ω", "100 Ω"]
    resposta: 0
    explicacao: "Com dois resistores iguais em paralelo, a resistência equivalente é a metade de um: 10 ÷ 2 = 5 Ω. A corrente ganha dois caminhos, e fica mais fácil passar."
  - pergunta: "Numa ligação em série, o que é igual em todos os resistores?"
    opcoes: ["A tensão", "A potência", "A resistência", "A corrente"]
    resposta: 3
    explicacao: "Em série há um caminho só. A carga que passa por um resistor passa pelos outros, então a corrente é a mesma em todos. A tensão da fonte se divide entre eles."
  - pergunta: "Por que os aparelhos de uma casa são ligados em paralelo?"
    opcoes: ["Para gastar menos energia", "Para cada um receber a tensão da rede e funcionar sem depender dos outros", "Para a corrente ser a mesma em todos", "Para a resistência total aumentar"]
    resposta: 1
    explicacao: "Em paralelo, cada aparelho fica ligado diretamente aos dois fios da rede e recebe a tensão inteira. Desligar a geladeira não apaga a lâmpada."
---

```provocacao
Nos pisca-piscas antigos de Natal, uma lâmpada queimada apagava o fio inteiro. Na sua casa, quando a lâmpada da sala queima, a geladeira continua ligada. O que é diferente na forma de ligar uma coisa e a outra?
```

## O que você vai aprender

Ao fim desta aula você vai saber reconhecer ligações em série e em paralelo, dizer como a corrente e a tensão se dividem em cada uma, calcular a resistência equivalente, entender por que a instalação da casa é em paralelo e prever quando um disjuntor vai desarmar.

## Em série: um caminho só

Na ligação **em série**, os aparelhos ficam um depois do outro, numa fila. A corrente tem um caminho só. Isso traz três consequências.

1. **A corrente é a mesma em todos.** A carga que sai de um resistor entra no próximo; ela não se acumula nem some no caminho.
2. **A tensão da fonte se divide.** Cada resistor fica com uma parte, e as partes somam a tensão total: U = U₁ + U₂ + ...
3. **Se um elemento queima, o caminho abre e tudo apaga.** É o pisca-pisca antigo da provocação.

As resistências em série se somam. Cada uma é mais um obstáculo no mesmo caminho.

```formula
Req = R₁ + R₂ + R₃ + ...
resistência equivalente em série = soma das resistências
4 Ω e 6 Ω em série equivalem a 10 Ω
```

Com a Lei de Ohm da aula [Corrente, tensão, resistência e Lei de Ohm](/trilhas/enem-fisica/lei-de-ohm), a corrente é a tensão da fonte dividida pela resistência equivalente. Depois, a tensão de cada resistor é a sua resistência vezes essa corrente. O resistor maior fica com a maior parte da tensão.

## Em paralelo: vários caminhos

Na ligação **em paralelo**, cada aparelho tem os dois terminais ligados diretamente aos dois pontos da fonte. A corrente sai da fonte, se divide entre os ramos e se junta de novo.

1. **A tensão é a mesma em todos.** Cada ramo está entre os mesmos dois pontos.
2. **A corrente total se divide.** Cada ramo leva uma parte, e as partes somam a corrente total: i = i₁ + i₂ + ... O ramo de menor resistência leva mais corrente.
3. **Os ramos são independentes.** Abrir ou queimar um ramo não desliga os outros.

```formula
1 ÷ Req = 1 ÷ R₁ + 1 ÷ R₂ + ...
em paralelo, o inverso da resistência equivalente é a soma dos inversos
para dois resistores: Req = (R₁ × R₂) ÷ (R₁ + R₂); para dois iguais, Req = R ÷ 2
```

A resistência equivalente em paralelo é **sempre menor que a menor** das resistências. Cada ramo novo é mais um caminho, e a corrente passa com mais facilidade. Exemplo: 3 Ω e 6 Ω em paralelo dão 3 × 6 ÷ 9 = 18 ÷ 9 = 2 Ω, menos que 3 Ω.

## A instalação da casa

Os aparelhos da casa são ligados **em paralelo**. Assim, cada um recebe a tensão da rede inteira, 127 V ou 220 V, e funciona sem depender dos outros. Essa é a resposta da provocação. O interruptor, por sua vez, fica **em série** com a lâmpada que ele controla: abriu o interruptor, abriu o caminho daquela lâmpada.

Há um preço. Cada aparelho ligado é mais um ramo, e a corrente total que passa pelos fios do circuito é a soma das correntes de todos. O **disjuntor** fica em série no começo do circuito e desliga quando essa corrente total passa do limite. Para saber a corrente de cada aparelho, use P = U · i: i = P ÷ U.

O **curto-circuito** é um caminho de resistência quase zero entre os dois fios, sem aparelho no meio. Pela Lei de Ohm, a corrente fica enorme. O disjuntor existe para cortar isso antes que os fios esquentem.

Os medidores seguem a mesma lógica: o **amperímetro**, que mede corrente, é ligado em série; o **voltímetro**, que mede tensão, em paralelo.

```navidareal
# O benjamim e a extensão sobrecarregados
O benjamim (o "T") e a régua de tomadas ligam vários aparelhos em paralelo no mesmo ponto. Cada aparelho recebe a tensão da tomada, mas todas as correntes passam juntas pelo mesmo fio da extensão e pela mesma tomada da parede.

Uma sanduicheira de 762 W e uma chaleira elétrica de 1.524 W, em 127 V, puxam 6 A e 12 A. Juntas, 18 A passam pelo fio da extensão. Se ele for fino, esquenta pelo efeito Joule. É por isso que aparelhos que esquentam pedem tomada própria.
```

```verificar
Dois resistores, de 3 Ω e de 6 Ω, são ligados em paralelo. Qual é a resistência equivalente?
- 9 Ω
+ 2 Ω
- 4,5 Ω
> Para dois resistores em paralelo: (3 × 6) ÷ (3 + 6) = 18 ÷ 9 = 2 Ω. Repare que o resultado é menor que o menor resistor, 3 Ω. 9 Ω seria em série.
```

## Exemplo resolvido

**Uma bateria de 12 V alimenta dois resistores, de 2 Ω e de 4 Ω. Calcule a corrente e a tensão em cada um quando eles estão (a) em série e (b) em paralelo.**

(a) Em série:

1. Req = 2 + 4 = 6 Ω.
2. Corrente, a mesma nos dois: i = 12 ÷ 6 = 2 A.
3. Tensões: no de 2 Ω, 2 × 2 = 4 V; no de 4 Ω, 4 × 2 = 8 V. Soma: 4 + 8 = 12 V, a tensão da bateria.

(b) Em paralelo:

1. Tensão, a mesma nos dois: 12 V.
2. Correntes: no de 2 Ω, 12 ÷ 2 = 6 A; no de 4 Ω, 12 ÷ 4 = 3 A. Total: 6 + 3 = 9 A.
3. Confira pela resistência equivalente: Req = 2 × 4 ÷ 6 = 8/6 = 4/3 Ω, e 12 ÷ (4/3) = 12 × 3 ÷ 4 = 9 A. Bate.

Em série, a bateria fornece 2 A; em paralelo, 9 A. Os mesmos resistores, ligados de outro jeito, pedem bem mais corrente da fonte.

## Como isso cai no ENEM

- **Formatos:** instalação elétrica da casa, interruptores, pisca-piscas, benjamins e extensões, disjuntores, esquemas com pilhas e lâmpadas, medidores. A questão pede a resistência equivalente, a corrente ou a tensão num trecho, compara o brilho de lâmpadas em série e em paralelo ou diz se um disjuntor vai desarmar.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, os fenômenos elétricos e magnéticos tiveram 7 das 89 questões classificadas de Ciências da Natureza (7,9%). Este tópico, circuitos em série e em paralelo, teve 1 delas (1,1%). São só duas edições: é tendência, não promessa.
- **Habilidades:** H5 (dimensionar circuitos e aparelhos elétricos do dia a dia), que teve 4 questões nessa mesma base, e H6 (entender manuais de instalação ou de uso de aparelhos).
- **Armadilhas:**
  - Somar as resistências em paralelo. Em paralelo, a equivalente é menor que a menor.
  - Achar que em paralelo a corrente é a mesma. Em paralelo, a mesma é a tensão; em série, a corrente.
  - Esquecer que todos os aparelhos ligados no mesmo circuito somam corrente no disjuntor.
  - Achar que o interruptor fica em paralelo com a lâmpada. Ele fica em série.

## Questão comentada

**Texto-base.** Numa casa com rede de 127 V, uma pessoa liga numa mesma extensão, ao mesmo tempo, um ferro de passar de 1.270 W e um secador de cabelo de 1.016 W. Na extensão, os aparelhos ficam ligados em paralelo, e o fio dela leva a soma das correntes dos dois.

**Comando.** A corrente que passa pelo fio da extensão é de

A) 10 A.
B) 8 A.
C) 2 A.
D) 18 A.
E) 2.286 A.

**Resolução.**

1. Corrente do ferro: i = P ÷ U = 1.270 ÷ 127 = 10 A.
2. Corrente do secador: 1.016 ÷ 127 = 8 A.
3. Em paralelo, as correntes se somam no fio comum: 10 + 8 = 18 A.

**Gabarito: D.**

**Por que as outras não:**

- A) 10 A: é só a corrente do ferro. O secador também está ligado.
- B) 8 A: é só a corrente do secador.
- C) 2 A: é a diferença entre as correntes. No fio comum, elas se somam.
- E) 2.286 A: é a soma das potências, em watts. Para chegar à corrente, divida pela tensão: 2.286 ÷ 127 = 18 A.

```realidade
Escolha um cômodo da sua casa. Liste os aparelhos que costumam ficar ligados ao mesmo tempo e a potência de cada um. Some as correntes (i = P ÷ U) e compare com o valor do disjuntor daquele circuito, se você souber qual é.
```

## Resumo

- Série: um caminho só. Corrente igual em todos; tensões se somam; Req = R₁ + R₂ + ...; um queima, tudo apaga.
- Paralelo: vários caminhos. Tensão igual em todos; correntes se somam; 1 ÷ Req = 1 ÷ R₁ + 1 ÷ R₂ + ...; Req menor que a menor.
- Dois resistores em paralelo: Req = (R₁ × R₂) ÷ (R₁ + R₂). Dois iguais: R ÷ 2.
- A casa é ligada em paralelo; o interruptor fica em série com a sua lâmpada; o disjuntor, em série no começo do circuito.
- Corrente de cada aparelho: i = P ÷ U. No circuito, as correntes se somam.
- As fórmulas também estão no [Formulário de física](/trilhas/enem-reta-final/formulario-de-fisica).

## Para aprofundar

- [Eletricidade em casa](/trilhas/fisica-fundamental/eletricidade-em-casa)
- [Circuitos elétricos](/trilhas/fisica-medio/circuitos-eletricos)
- [Corrente, tensão, resistência e Lei de Ohm](/trilhas/enem-fisica/lei-de-ohm)
- [Potência elétrica, consumo em kWh e conta de luz](/trilhas/enem-fisica/consumo)
- [Formulário de física](/trilhas/enem-reta-final/formulario-de-fisica)
