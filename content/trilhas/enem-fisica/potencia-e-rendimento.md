---
titulo: "Potência e rendimento"
resumo: "O que é potência mecânica, como calcular a potência de um elevador, de uma bomba-d'água ou de um carro, o que é rendimento e por que nenhuma máquina aproveita 100% da energia que recebe."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 9.1, Work, Power, and the Work–Energy Theorem"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/9-1-work-power-and-the-work-energy-theorem"
  - titulo: "Physics, seção 9.3, Simple Machines"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/9-3-simple-machines"
  - titulo: "Provas e gabaritos do Enem (as provas de 2022 e 2023, base da contagem do instituto)"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Um elevador ergue 500 kg a uma altura de 20 m em 10 s, com velocidade constante. Com g = 10 m/s², a potência útil do motor é de"
    opcoes: ["100.000 W", "1.000 W", "10.000 W", "250 W"]
    resposta: 2
    explicacao: "A energia útil é o ganho de energia potencial: m · g · h = 500 × 10 × 20 = 100.000 J. Em 10 s: 100.000 ÷ 10 = 10.000 W. Quem marcou 100.000 W esqueceu de dividir pelo tempo."
  - pergunta: "Um motor recebe 1.000 W de potência elétrica e entrega 800 W de potência mecânica. O rendimento dele é de"
    opcoes: ["80%", "125%", "20%", "8%"]
    resposta: 0
    explicacao: "Rendimento é o útil dividido pelo total: 800 ÷ 1.000 = 0,8, ou 80%. Os outros 200 W viram calor e som, sobretudo pelo atrito."
  - pergunta: "Por que nenhum motor real tem rendimento de 100%?"
    opcoes: ["Porque a energia some dentro do motor", "Porque a potência elétrica é sempre menor que a mecânica", "Porque os motores são mal fabricados", "Porque parte da energia sempre se dissipa, como calor, por atrito e outras perdas"]
    resposta: 3
    explicacao: "A energia não some: ela se conserva. Mas uma parte sempre vira formas que não servem ao objetivo, sobretudo calor, pelo atrito e pela resistência dos fios. Por isso o útil é sempre menor que o total."
  - pergunta: "Duas pessoas sobem a mesma escada, com o mesmo peso. Uma leva 20 s e a outra, 10 s. Comparando as duas, a que sobe em 10 s"
    opcoes: ["faz o dobro do trabalho", "desenvolve o dobro da potência", "faz metade do trabalho", "desenvolve a mesma potência"]
    resposta: 1
    explicacao: "O trabalho contra o peso é o mesmo (mesmo peso, mesma altura). A potência é o trabalho dividido pelo tempo: na metade do tempo, a potência dobra."
---

```provocacao
Duas bombas-d'água enchem a mesma caixa, no mesmo telhado. Uma leva 10 minutos; a outra, 20. A mais rápida é necessariamente a que gasta menos energia elétrica? O que mais você precisaria saber para responder?
```

## O que você vai aprender

Ao fim desta aula você vai saber o que é potência, calcular a potência de uma máquina que ergue um peso ou empurra um carro, definir rendimento, achar a energia perdida e comparar máquinas pela eficiência.

## Potência: rapidez de transformar energia

Subir um saco de cimento até a laje pela escada ou pelo guincho: a energia que o saco ganha é a mesma, porque a altura e o peso são os mesmos. O que muda é o **tempo**. O guincho faz o mesmo serviço mais depressa. Dizemos que ele tem mais **potência**.

Potência é a energia transformada (ou o trabalho realizado) a cada segundo.

```formula
P = E ÷ Δt
potência (em watts) = energia transformada (em joules) ÷ tempo (em segundos)
6.000 J em 30 s dão 6.000 ÷ 30 = 200 W
```

A unidade é o **watt** (W), um joule por segundo. É a mesma unidade da aula de [consumo elétrico](/trilhas/enem-fisica/consumo). A potência é uma só ideia, para a eletricidade e para a mecânica.

Quando a tarefa é **erguer um peso** com velocidade constante, a energia útil é o ganho de energia potencial gravitacional, m · g · h. Então:

```formula
P = m · g · h ÷ Δt
potência para erguer = massa × gravidade × altura ÷ tempo
500 kg erguidos 20 m em 10 s, com g = 10 m/s²: 500 × 10 × 20 ÷ 10 = 10.000 W
```

Quando uma força **empurra** algo com velocidade constante, a potência é a força vezes a velocidade. Um carro que anda a 20 m/s com uma força motriz de 2.000 N para a frente desenvolve 2.000 × 20 = 40.000 W.

```formula
P = F · v
potência = força × velocidade (com a força na direção do movimento)
mais força ou mais velocidade, mais potência
```

## Rendimento: quanto da energia vira o que se quer

Nenhuma máquina usa toda a energia que recebe para fazer o serviço. O motor do liquidificador recebe energia elétrica; uma parte vira o giro das lâminas, e outra parte vira calor e barulho. A parte que interessa é a **útil**; a que se perde é a **dissipada**.

```formula
η = P útil ÷ P total
rendimento = potência útil ÷ potência recebida (o mesmo vale com as energias)
a perda é a diferença: P dissipada = P total − P útil
```

O rendimento (η, a letra grega eta) é um número entre 0 e 1. Multiplique por 100 para ter a porcentagem. Um motor que recebe 1.000 W e entrega 800 W tem rendimento de 0,8, ou 80%, e dissipa 200 W.

O rendimento das máquinas reais é **sempre menor que 100%**. A energia não some (ela se conserva), mas uma parte sempre vira calor, pelo atrito entre peças, pela resistência dos fios e pela resistência do ar. Essa parte não volta a ser útil para o serviço.

Quando a energia passa por várias máquinas em sequência, os rendimentos se **multiplicam**. Uma turbina com 90% de rendimento ligada a um gerador com 90% dá, no conjunto, 0,9 × 0,9 = 0,81, ou 81%. Não se somam nem se tira a média.

Agora a provocação. A bomba mais rápida tem mais potência útil. Mas a energia elétrica gasta depende do **rendimento**: uma bomba lenta e eficiente pode gastar menos energia para o mesmo serviço do que uma rápida e cheia de perdas. Para responder, seria preciso saber o rendimento (ou a potência elétrica) de cada uma.

```navidareal
# A lâmpada que esquenta
Encoste a mão perto de uma lâmpada incandescente acesa: ela queima. Faça o mesmo com uma lâmpada LED de mesma luz: ela fica morna. As duas iluminam igual, mas a incandescente transforma grande parte da energia elétrica em calor, que não serve para iluminar.

Na linguagem desta aula, a LED tem rendimento muito maior: mais da energia recebida vira luz. Por isso ela ilumina igual com uma potência bem menor, e a conta de luz cai.
```

```verificar
Um motor recebe 2.000 W e tem rendimento de 75%. Quanto ele dissipa?
- 1.500 W
+ 500 W
- 2.667 W
> Potência útil: 2.000 × 0,75 = 1.500 W. A dissipada é o resto: 2.000 − 1.500 = 500 W.
```

## Exemplo resolvido

**Uma bomba elétrica sobe 1.000 L de água (1.000 kg) até uma caixa a 10 m de altura em 200 s. O rendimento da bomba é de 50%. Use g = 10 m/s². Qual é a potência útil? Qual é a potência elétrica que ela consome? Quanta energia ela dissipa nesse tempo?**

1. Energia útil: m · g · h = 1.000 × 10 × 10 = 100.000 J.
2. Potência útil: 100.000 ÷ 200 = 500 W.
3. Potência elétrica: de η = P útil ÷ P total, temos P total = P útil ÷ η = 500 ÷ 0,5 = 1.000 W.
4. Energia elétrica consumida em 200 s: 1.000 × 200 = 200.000 J. Energia dissipada: 200.000 − 100.000 = 100.000 J.

Confira: com rendimento de 50%, metade da energia vira o serviço e metade se perde. 100.000 J de cada lado.

## Como isso cai no ENEM

- **Formatos:** elevadores e guindastes, bombas-d'água, carros e motos, usinas e a cadeia de rendimentos, lâmpadas e motores comparados, atletas subindo escadas. A questão pede a potência pelo tempo do serviço, o rendimento a partir das potências, a energia perdida ou a comparação de máquinas pela eficiência.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, o objeto "Energia, trabalho e potência" teve 1 das 89 questões classificadas de Ciências da Natureza (1,1%), e foi deste tópico. São só duas edições: é tendência, não promessa. Potência e rendimento também aparecem dentro de questões de eletricidade e de usinas.
- **Habilidades:** H23 (avaliar formas de gerar, usar ou transformar energia), que teve 2 questões nessa mesma base, H20 (explicar causas ou efeitos do movimento de objetos), com 10, e H17 (relacionar informações em texto, gráfico, tabela ou fórmula), com 6.
- **Armadilhas:**
  - Esquecer de dividir pelo tempo e responder com a energia (em joules) no lugar da potência (em watts).
  - Inverter o rendimento: é o útil sobre o total, nunca maior que 1.
  - Somar rendimentos em sequência. Eles se multiplicam.
  - Achar que a energia perdida "some". Ela vira calor e outras formas não aproveitadas.

## Questão comentada

**Texto-base.** Numa obra, um guincho elétrico ergue uma carga de 400 kg a 15 m de altura, com velocidade constante, em 20 s. Durante a subida, o motor do guincho consome uma potência elétrica de 4.000 W. Use g = 10 m/s².

**Comando.** O rendimento do guincho nessa operação é de

A) 7,5%.
B) 133%.
C) 25%.
D) 75%.
E) 100%.

**Resolução.**

1. Energia útil: m · g · h = 400 × 10 × 15 = 60.000 J.
2. Potência útil: 60.000 ÷ 20 = 3.000 W.
3. Rendimento: 3.000 ÷ 4.000 = 0,75, ou 75%.

**Gabarito: D.**

**Por que as outras não:**

- A) 7,5%: você esqueceu a gravidade (400 × 15 ÷ 20 = 300 W). O peso é a massa vezes g.
- B) 133%: você dividiu o total pelo útil. Rendimento acima de 100% é impossível: a máquina daria mais energia do que recebe.
- C) 25%: é a parte perdida (1.000 W de 4.000 W), não o rendimento.
- E) 100%: você supôs que o motor não perde nada. Todo motor real dissipa uma parte da energia.

```realidade
Escolha uma máquina da sua rotina (o motor do ônibus, a bomba do prédio, o ventilador, o liquidificador). Onde você percebe a energia que se perde: calor, barulho, vibração? O que poderia diminuir essa perda?
```

## Resumo

- Potência é energia (ou trabalho) por segundo: P = E ÷ Δt, em watts.
- Para erguer um peso: P = m · g · h ÷ Δt. Para empurrar com velocidade constante: P = F · v.
- Rendimento: η = P útil ÷ P total (ou E útil ÷ E total), sempre menor que 1 (100%).
- Perda: P dissipada = P total − P útil. A energia não some; vira calor e outras formas.
- Máquinas em sequência: os rendimentos se multiplicam.
- As fórmulas também estão no [Formulário de física](/trilhas/enem-reta-final/formulario-de-fisica).

## Para aprofundar

- [Energia e suas transformações](/trilhas/fisica-fundamental/energia-e-suas-transformacoes)
- [Máquinas simples](/trilhas/fisica-fundamental/maquinas-simples)
- [Trabalho, energia e potência](/trilhas/fisica-medio/trabalho-energia-e-potencia)
- [Potência elétrica, consumo em kWh e conta de luz](/trilhas/enem-fisica/consumo)
- [Formulário de física](/trilhas/enem-reta-final/formulario-de-fisica)
