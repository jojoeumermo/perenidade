---
titulo: "Ondas e som: altura, intensidade, timbre, ressonância, Doppler"
resumo: "O que é uma onda, a conta v = λ · f, por que o som não anda no vácuo, o que distingue grave de agudo, forte de fraco e um instrumento de outro, e como funcionam o eco, a ressonância e o efeito Doppler."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 14.1, Speed of Sound, Frequency, and Wavelength"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/14-1-speed-of-sound-frequency-and-wavelength"
  - titulo: "Physics, seção 14.2, Sound Intensity and Sound Level"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/14-2-sound-intensity-and-sound-level"
  - titulo: "Physics, seção 14.3, Doppler Effect and Sonic Booms"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/14-3-doppler-effect-and-sonic-booms"
  - titulo: "Physics, seção 14.4, Sound Interference and Resonance"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/14-4-sound-interference-and-resonance"
  - titulo: "Provas e gabaritos do Enem (as provas de 2022 e 2023, base da contagem do instituto)"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Uma onda tem comprimento de onda de 2 m e frequência de 170 Hz. A velocidade dela é de"
    opcoes: ["85 m/s", "172 m/s", "340 m/s", "0,01 m/s"]
    resposta: 2
    explicacao: "Velocidade é comprimento de onda vezes frequência: v = λ · f = 2 × 170 = 340 m/s. É a velocidade do som no ar, perto da temperatura ambiente."
  - pergunta: "Uma pessoa diz que a voz de outra é \"fina\", isto é, aguda. Que grandeza da onda sonora ela está percebendo?"
    opcoes: ["A frequência, que é alta", "A amplitude, que é grande", "A velocidade, que é maior", "O timbre, que é igual"]
    resposta: 0
    explicacao: "Altura, na física, é o grave e o agudo, e depende da frequência. Som agudo tem frequência alta; som grave, frequência baixa. Volume (forte ou fraco) é outra coisa: depende da intensidade."
  - pergunta: "Uma ambulância com a sirene ligada vem na sua direção. Comparado ao som que o motorista ouve, você ouve um som"
    opcoes: ["mais grave", "igual", "mais fraco, mas com a mesma altura", "mais agudo"]
    resposta: 3
    explicacao: "É o efeito Doppler. Quando a fonte se aproxima, as frentes de onda chegam mais juntas, e você recebe mais ondas por segundo: a frequência percebida sobe e o som fica mais agudo. Quando ela se afasta, fica mais grave."
  - pergunta: "Por que não se ouve uma explosão que acontece no espaço, fora da atmosfera?"
    opcoes: ["Porque a explosão é rápida demais", "Porque o som precisa de um meio material para se propagar", "Porque a luz chega antes e apaga o som", "Porque o som no espaço fica agudo demais para o ouvido"]
    resposta: 1
    explicacao: "O som é uma onda mecânica: ele passa de partícula em partícula do meio (ar, água, metal). No vácuo não há partículas para vibrar, e o som não se propaga. A luz, que é onda eletromagnética, atravessa o vácuo."
---

```provocacao
Num show, você ouve o violão e a flauta tocando a mesma nota, com o mesmo volume. Mesmo de olhos fechados, sabe qual é qual. O que no som deixa você distinguir os dois?
```

## O que você vai aprender

Ao fim desta aula você vai saber o que é uma onda, usar a relação v = λ · f, explicar por que o som não se propaga no vácuo, distinguir altura, intensidade e timbre, calcular distâncias pelo eco e reconhecer a ressonância e o efeito Doppler em situações do dia a dia.

## Uma onda leva energia, não leva matéria

Jogue uma pedra num lago parado. Formam-se círculos que se espalham. Uma folha boiando ali sobe e desce, mas não viaja com os círculos. A água também não vai até a margem: ela só balança no lugar.

Isso é uma **onda**: uma perturbação que se propaga e leva energia de um lugar a outro, sem levar a matéria junto.

Há dois grandes tipos:

- **Ondas mecânicas** precisam de um meio material (ar, água, corda, chão) para se propagar. O som, as ondas do mar e as de uma corda de violão são mecânicas.
- **Ondas eletromagnéticas** não precisam de meio. Elas andam até no vácuo. A luz, o sinal do celular e o raio X são eletromagnéticas. Elas têm a aula delas, [Espectro eletromagnético](/trilhas/enem-fisica/espectro).

Há também duas formas de vibrar. Na onda **transversal**, o meio vibra de lado, perpendicular ao caminho da onda, como a corda que você sacode para cima e para baixo. Na onda **longitudinal**, o meio vibra na mesma direção do caminho, em compressões e rarefações, como uma mola que você empurra e puxa. O som no ar é uma onda mecânica e longitudinal.

## A conta das ondas: v = λ · f

Toda onda tem três medidas que andam juntas.

- **Comprimento de onda** (λ, a letra grega lambda): a distância entre duas cristas seguidas. Em metros.
- **Frequência** (f): quantas ondas passam por um ponto a cada segundo. Em hertz (Hz). 1 Hz é uma oscilação por segundo.
- **Velocidade** (v): quanto a onda anda por segundo. Em metros por segundo.

```formula
v = λ · f
velocidade da onda = comprimento de onda × frequência
uma onda de 2 m que passa 170 vezes por segundo anda 2 × 170 = 340 m a cada segundo
```

O **período** (T) é o tempo de uma oscilação completa. Ele é o inverso da frequência: T = 1 ÷ f. Uma onda de 50 Hz tem período de 1/50 = 0,02 s.

Dois fatos resolvem muitas questões:

1. A **frequência** é dada pela fonte, quem produz a onda. Quando a onda muda de meio (do ar para a água, por exemplo), a frequência não muda.
2. A **velocidade** é dada pelo meio. No ar, o som anda a cerca de 340 m/s à temperatura ambiente (a 0 °C, são 331 m/s). Na água e nos sólidos, o som anda bem mais depressa. Se a velocidade muda e a frequência não, quem muda é o comprimento de onda.

## O som e as suas três qualidades

O som é a vibração do ar que chega ao ouvido. O ouvido humano percebe, em geral, frequências entre cerca de 20 Hz e 20.000 Hz. Abaixo disso há o **infrassom**; acima, o **ultrassom**, que os morcegos usam para se orientar e os hospitais usam na ultrassonografia.

O ouvido distingue três qualidades do som. Cada uma vem de uma grandeza diferente da onda.

- **Altura** é o grave e o agudo. Depende da **frequência**: quanto maior a frequência, mais agudo. Atenção: no dia a dia, "som alto" quer dizer som forte. Na física, "alto" quer dizer agudo.
- **Intensidade** é o forte e o fraco, o volume. Depende da energia que a onda leva, ligada à sua **amplitude** (o tamanho da vibração). Ela se mede em **decibéis** (dB).
- **Timbre** é o que distingue duas fontes tocando a mesma nota com o mesmo volume. Depende da **forma da onda**: cada instrumento e cada voz mistura à nota principal outras frequências mais fracas, os harmônicos, numa receita própria. É a resposta da provocação.

A escala de decibéis não cresce como uma régua comum. A cada 10 dB a mais, a intensidade fica **10 vezes** maior. Então 20 dB a mais são 10 × 10 = 100 vezes, e 30 dB a mais, 1.000 vezes.

```formula
β = 10 · log (I ÷ I₀)
nível sonoro em decibéis = 10 × logaritmo da intensidade dividida pela menor intensidade que se ouve (I₀ = 10⁻¹² W/m²)
na prática: +10 dB, intensidade × 10; +20 dB, intensidade × 100
```

## Eco, ressonância e efeito Doppler

**Eco** é o som que bate num obstáculo e volta. O som faz o caminho de ida e de volta, então a distância até o obstáculo é a metade do caminho total: d = v · t ÷ 2. O sonar dos navios e a ultrassonografia funcionam assim.

**Ressonância** acontece quando uma coisa é sacudida na sua **frequência natural**, a frequência em que ela vibraria sozinha. Nessa frequência, a energia passa com mais facilidade e a vibração cresce. É a criança no balanço: empurrões fracos, no ritmo certo, levam o balanço cada vez mais alto. Uma nota forte, na frequência natural de uma taça, pode fazê-la vibrar até trincar.

**Efeito Doppler** é a mudança da frequência percebida quando a fonte e quem ouve se movem um em relação ao outro. Na aproximação, as frentes de onda chegam mais juntas: o som fica mais agudo. No afastamento, ficam mais espaçadas: o som fica mais grave. O som que a fonte emite não mudou; mudou o que chega a você.

```navidareal
# A sirene que muda de nota
Fique na calçada quando uma ambulância passar com a sirene ligada. Enquanto ela vem, a sirene soa mais aguda. No instante em que passa por você, a nota "cai", e enquanto se afasta soa mais grave.

O motorista, que anda junto com a sirene, ouve sempre a mesma nota. Quem muda de nota é só quem está parado na rua. O radar de velocidade usa a mesma ideia com ondas de rádio: a onda que volta do carro chega com a frequência mudada, e a mudança diz a velocidade.
```

```verificar
Você grita diante de um paredão e ouve o eco 2 segundos depois. Com o som a 340 m/s, a que distância está o paredão?
- 680 m
+ 340 m
- 170 m
> Em 2 s o som anda 340 × 2 = 680 m. Mas esse é o caminho de ida e volta. O paredão está na metade: 340 m.
```

## Exemplo resolvido

**Um morcego emite um ultrassom de 34.000 Hz e ouve o eco que volta de um inseto 0,02 s depois. Considere a velocidade do som no ar igual a 340 m/s. Qual é o comprimento de onda desse ultrassom? A que distância está o inseto?**

1. Comprimento de onda: de v = λ · f, temos λ = v ÷ f = 340 ÷ 34.000 = 0,01 m, ou seja, 1 cm.
2. Caminho do som até o inseto e de volta: 340 × 0,02 = 6,8 m.
3. Distância até o inseto: metade do caminho, 6,8 ÷ 2 = 3,4 m.

Confira: 34.000 Hz está acima de 20.000 Hz, então é mesmo ultrassom, que o ouvido humano não percebe. E a volta: λ · f = 0,01 × 34.000 = 340 m/s, a velocidade dada.

## Como isso cai no ENEM

- **Formatos:** instrumentos musicais, sirene, sonar, ultrassonografia, poluição sonora em decibéis, ressonância em pontes e taças, rádio e celular. A questão pede para reconhecer a qualidade do som envolvida (altura, intensidade ou timbre), calcular com v = λ · f ou com o eco, ou explicar um fenômeno (ressonância, Doppler, interferência).
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, o objeto "Oscilações, ondas, óptica e radiação" teve 9 das 89 questões classificadas de Ciências da Natureza (10,1%), o objeto de física com mais questões nessa base. Este tópico, ondas e som, teve 3 delas (3,4%). São só duas edições: é tendência, não promessa.
- **Habilidades:** H1 (reconhecer propriedades de ondas e oscilações e seus usos), que teve 7 questões nessa mesma base, e H2 (ligar soluções de problemas, como na comunicação e na saúde, ao avanço científico e tecnológico).
- **Armadilhas:**
  - Confundir "som alto" do dia a dia (forte) com altura na física (agudo).
  - Achar que a frequência muda quando o som passa de um meio para outro. Muda a velocidade e o comprimento de onda.
  - Esquecer de dividir por 2 no eco: o som vai e volta.
  - Tratar decibéis como uma escala comum: 20 dB a mais não é o dobro, é 100 vezes a intensidade.

## Questão comentada

**Texto-base.** Um morador reclama do barulho de um bar vizinho. Dentro do bar, um aparelho mede o nível sonoro de 90 dB. Na janela do morador, o mesmo tipo de aparelho mede 70 dB. Na escala de decibéis, cada aumento de 10 dB corresponde a multiplicar a intensidade sonora por 10.

**Comando.** A intensidade sonora dentro do bar é quantas vezes a intensidade na janela do morador?

A) 1,3 vez.
B) 2 vezes.
C) 20 vezes.
D) 100 vezes.
E) 1.000 vezes.

**Resolução.**

1. Diferença de nível: 90 − 70 = 20 dB.
2. São dois aumentos de 10 dB. Cada um multiplica a intensidade por 10.
3. Intensidade no bar: 10 × 10 = 100 vezes a da janela.

**Gabarito: D.**

**Por que as outras não:**

- A) 1,3 vez: é 90 ÷ 70. Os decibéis não se dividem assim: a escala é logarítmica, cada 10 dB multiplica por 10.
- B) 2 vezes: é o número de degraus de 10 dB, não o fator. Cada degrau multiplica por 10.
- C) 20 vezes: é a diferença em decibéis, não a razão entre as intensidades.
- E) 1.000 vezes: seriam 30 dB de diferença (três degraus de 10 dB). Aqui são só 20 dB.

```realidade
Pense em três sons da sua rua ou do seu trabalho: um grave, um agudo e um muito forte. Para cada um, diga qual qualidade do som (altura, intensidade ou timbre) mais chama a sua atenção, e por quê.
```

## Resumo

- Onda leva energia, não matéria. Mecânica precisa de meio; eletromagnética anda no vácuo.
- O som é onda mecânica e longitudinal: não se propaga no vácuo.
- v = λ · f. A frequência vem da fonte e não muda de um meio para outro; a velocidade vem do meio.
- Altura depende da frequência (grave ou agudo). Intensidade depende da energia e da amplitude (forte ou fraco), em decibéis. Timbre depende da forma da onda.
- +10 dB multiplica a intensidade por 10.
- Eco: d = v · t ÷ 2. Ressonância: vibrar na frequência natural. Doppler: aproximação deixa mais agudo, afastamento mais grave.
- As fórmulas também estão no [Formulário de física](/trilhas/enem-reta-final/formulario-de-fisica).

## Para aprofundar

- [Som](/trilhas/fisica-fundamental/som)
- [Ondas](/trilhas/fisica-medio/ondas)
- [Espectro eletromagnético](/trilhas/enem-fisica/espectro)
- [Formulário de física](/trilhas/enem-reta-final/formulario-de-fisica)
- [Natureza, o essencial: física](/trilhas/enem-reta-final/natureza-o-essencial-fisica)
