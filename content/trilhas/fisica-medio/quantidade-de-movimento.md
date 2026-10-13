---
titulo: "Quantidade de movimento"
resumo: "Objetivo: calcular quantidade de movimento e impulso, entender por que aumentar o tempo de um impacto reduz a força e aplicar a conservação da quantidade de movimento a colisões."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 8.1, Linear Momentum, Force, and Impulse"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/8-1-linear-momentum-force-and-impulse"
  - titulo: "Physics, seção 8.2, Conservation of Momentum"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/8-2-conservation-of-momentum"
  - titulo: "Physics, seção 8.3, Elastic and Inelastic Collisions"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/8-3-elastic-and-inelastic-collisions"
quiz:
  - pergunta: "Como se calcula a quantidade de movimento de um corpo?"
    opcoes: ["Massa vezes velocidade", "Massa vezes aceleração", "Força vezes distância"]
    resposta: 0
    explicacao: "Q = m·v. É uma grandeza vetorial, com a direção e o sentido da velocidade."
  - pergunta: "Por que o airbag protege o passageiro?"
    opcoes: ["Porque diminui a massa do passageiro", "Porque aumenta o tempo da parada, o que reduz a força", "Porque elimina a quantidade de movimento antes da batida"]
    resposta: 1
    explicacao: "Para a mesma variação da quantidade de movimento, quanto maior o tempo, menor a força."
  - pergunta: "Um vagão de 2 000 kg a 3 m/s engata em um vagão parado de 1 000 kg. Com que velocidade seguem juntos?"
    opcoes: ["3 m/s", "2 m/s", "1 m/s"]
    resposta: 1
    explicacao: "A quantidade de movimento se conserva: 6 000 = 3 000 × v, logo v = 2 m/s."
  - pergunta: "O que se conserva em toda colisão entre corpos de um sistema isolado?"
    opcoes: ["A energia cinética", "A quantidade de movimento total", "A velocidade de cada corpo"]
    resposta: 1
    explicacao: "A energia cinética só se conserva nas colisões perfeitamente elásticas."
---

## Massa em movimento

É mais difícil parar um caminhão do que uma bicicleta na mesma velocidade. E é mais difícil parar uma bola chutada com força do que uma rolada devagar. A grandeza que junta as duas coisas, massa e velocidade, é a **quantidade de movimento**, também chamada de **momento linear**:

**Q = m · v**

A unidade é o **kg·m/s**. É uma grandeza [vetorial](/trilhas/fisica-medio/vetores): tem a direção e o sentido da velocidade.

```conta
carro de 1 000 kg a 20 m/s:      Q = 20 000 kg·m/s
caminhão de 10 000 kg a 20 m/s:  Q = 200 000 kg·m/s
```

## Impulso

Para mudar a quantidade de movimento de um corpo, é preciso aplicar uma força durante algum tempo. O produto da força pelo tempo é o **impulso**:

**I = F · Δt**

e o impulso é igual à **variação da quantidade de movimento**:

**F · Δt = ΔQ**

Essa relação é outro jeito de escrever a segunda lei de Newton, e tem uma consequência prática enorme.

## Mais tempo, menos força

Para parar um corpo, a variação ΔQ está dada: ele tem de ir da velocidade em que estava até zero. O que pode mudar é **como** isso acontece: com uma força grande em pouco tempo ou com uma força pequena em muito tempo.

```conta
Um passageiro de 70 kg em um carro a 20 m/s (72 km/h). ΔQ = 70 × 20 = 1 400 kg·m/s
parada em 0,01 s (contra o painel):   F = 1 400 ÷ 0,01 = 140 000 N
parada em 0,1 s (cinto e airbag):     F = 1 400 ÷ 0,1  =  14 000 N
```

Dez vezes mais tempo, força dez vezes menor. É o princípio de quase todo equipamento de proteção:

- o **airbag** e o **cinto**, que cedem um pouco;
- a frente do carro, projetada para **amassar** e alongar o tempo da batida;
- o **capacete**, cujo forro se deforma;
- o colchão do salto com vara, a rede do trapezista, a luva do goleiro;
- **dobrar os joelhos** ao cair de um salto.

Em uma obra, é a diferença entre cair em uma rede de proteção e cair no concreto.

```verificar
Um ovo cai da mesma altura sobre uma almofada e sobre o piso de cerâmica. Por que só quebra no piso?
- Porque no piso a variação da quantidade de movimento é maior
+ Porque no piso a parada é muito mais rápida, e a força, muito maior
- Porque a almofada diminui a massa do ovo
> A variação da quantidade de movimento é a mesma nos dois casos. O que muda?
```

## Conservação da quantidade de movimento

Em um **sistema isolado** (em que as forças externas são desprezíveis), a quantidade de movimento **total** não muda:

**Q total antes = Q total depois**

É consequência da terceira lei de Newton: na interação entre dois corpos, as forças são iguais e opostas e agem pelo mesmo tempo; o que um ganha de quantidade de movimento, o outro perde.

### O recuo

Um patinador de 60 kg, parado, atira para a frente uma bola de 3 kg a 10 m/s.

```conta
antes: Q total = 0
depois: 3 × 10 + 60 × v = 0
v = −30 ÷ 60 = −0,5 m/s
```

O sinal negativo indica o sentido contrário: o patinador recua a 0,5 m/s. É o mesmo que acontece no coice de uma arma e no **foguete**, que avança lançando gases para trás. O foguete não precisa de ar para "empurrar": funciona no vácuo.

### Colisões

| Tipo | Quantidade de movimento | Energia cinética | Exemplo |
| --- | --- | --- | --- |
| Elástica | conserva | conserva | bolas de bilhar (aproximadamente) |
| Inelástica | conserva | parte vira calor, som e deformação | a maioria das batidas |
| Perfeitamente inelástica | conserva | perda máxima; os corpos seguem juntos | vagões que se engatam |

```conta
Um vagão de 2 000 kg a 3 m/s engata em outro, de 1 000 kg, parado.
antes: 2 000 × 3 + 1 000 × 0 = 6 000 kg·m/s
depois: (2 000 + 1 000) × v = 6 000
v = 2 m/s
```

Confira a energia cinética: antes, 2 000 × 9 ÷ 2 = 9 000 J; depois, 3 000 × 4 ÷ 2 = 6 000 J. Os 3 000 J que faltam viraram calor, som e deformação. A quantidade de movimento se conservou; a energia cinética, não.

## No trânsito

Quando um caminhão e um carro pequeno batem de frente, a força sobre os dois é a mesma (terceira lei). Mas o carro, com massa muito menor, sofre uma **variação de velocidade** muito maior, e é essa mudança brusca que fere os ocupantes. Daí a importância de limites de velocidade e de separar o tráfego pesado do leve.

## Para praticar

1. Calcule a quantidade de movimento de uma bola de 0,4 kg a 25 m/s.
2. Um martelo de 1 kg atinge um prego a 6 m/s e para em 0,002 s. Qual é a força média sobre o prego?
3. Uma criança de 30 kg corre a 4 m/s e pula em um carrinho parado de 10 kg. Com que velocidade seguem juntos?
4. Explique, usando a ideia de impulso, por que o piso de um parquinho deve ser de areia ou de borracha.
