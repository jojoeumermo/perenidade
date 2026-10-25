---
titulo: "O quadro de distribuição: disjuntores e DR"
resumo: "O caminho da energia do poste até a tomada, o que há dentro do quadro de luz, a diferença entre disjuntor e DR e onde a norma brasileira exige o DR."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Instalações elétricas residenciais, parte 1 (manual baseado na NBR 5410)"
    autor: "ELEKTRO e Pirelli, com revisão técnica de Hilton Moreno"
    ano: "2003"
    url: "https://www.coe.ufrj.br/~kleber/INST_ELET_RES_PARTE_01.pdf"
  - titulo: "Instalações elétricas residenciais, parte 2 (manual baseado na NBR 5410)"
    autor: "ELEKTRO e Pirelli, com revisão técnica de Hilton Moreno"
    ano: "2003"
    url: "https://www.coe.ufrj.br/~kleber/INST_ELET_RES_PARTE_02.pdf"
  - titulo: "ABNT NBR 5410: Instalações elétricas de baixa tensão (edição de 2004, versão corrigida de 2008)"
    autor: "Associação Brasileira de Normas Técnicas"
    ano: "2004"
  - titulo: "Disjuntor"
    autor: "Wikipédia"
    url: "https://pt.wikipedia.org/wiki/Disjuntor"
  - titulo: "Disjuntor diferencial"
    autor: "Wikipédia"
    url: "https://pt.wikipedia.org/wiki/Disjuntor_diferencial"
  - titulo: "Residual-current device"
    autor: "Wikipédia (em inglês)"
    url: "https://en.wikipedia.org/wiki/Residual-current_device"
glossario:
  - termo: "quadro de distribuição"
    definicao: "A caixa, também chamada de quadro de luz, que recebe os fios vindos do medidor, guarda os dispositivos de proteção e de onde saem os circuitos da casa."
  - termo: "circuito terminal"
    definicao: "Cada circuito que sai do quadro e alimenta diretamente lâmpadas, tomadas ou um aparelho, com seu próprio dispositivo de proteção."
  - termo: "corrente de fuga"
    definicao: "Corrente que escapa do caminho normal (fase e neutro) e vai para a terra, por exemplo por um fio descascado ou por uma pessoa."
quiz:
  - pergunta: "O disjuntor termomagnético protege principalmente:"
    opcoes: ["As pessoas contra choque", "Os fios do circuito contra sobrecarga e curto-circuito", "Os aparelhos contra raios"]
    resposta: 1
    explicacao: "Ele desliga quando passa corrente demais, antes que os fios esquentem a ponto de estragar. Quem protege as pessoas contra choque é o DR."
  - pergunta: "Para proteger pessoas, o DR deve ser de alta sensibilidade. Qual é o valor máximo da corrente diferencial dele?"
    opcoes: ["30 mA", "300 mA", "30 A"]
    resposta: 0
    explicacao: "A NBR 5410 fixa 30 mA (trinta miliampères) como máximo. DRs de 100 mA ou mais protegem só o patrimônio, por exemplo contra incêndio."
  - pergunta: "Em qual destes circuitos a NBR 5410 exige proteção DR?"
    opcoes: ["Tomadas da cozinha", "Iluminação do quarto", "Nenhum, o DR é opcional"]
    resposta: 0
    explicacao: "A norma exige DR em tomadas de cozinhas, lavanderias, áreas de serviço, garagens, áreas externas e em pontos de locais com chuveiro ou banheira."
  - pergunta: "Um interruptor DR sozinho protege o circuito contra curto-circuito?"
    opcoes: ["Sim, ele faz tudo", "Não, ele precisa de um disjuntor ou fusível antes dele", "Só se for tetrapolar"]
    resposta: 1
    explicacao: "O interruptor DR só sente a corrente de fuga. A proteção contra sobrecarga e curto fica com um disjuntor ou fusível ligado antes."
---

```provocacao
O disjuntor desarmou. Você religa, e ele desarma de novo. Ele está com defeito ou está avisando alguma coisa?
```

## O que você vai aprender

Ao fim desta aula você vai saber o caminho que a energia faz do poste até a tomada, o que existe dentro do quadro de distribuição, a diferença entre disjuntor, disjuntor DR e interruptor DR e em quais circuitos a norma brasileira exige o DR.

## Do poste até a tomada

A energia chega da **rede pública** pelo **ramal de ligação** e entra no **padrão de entrada**: o poste com o isolador, a caixa de medição e a haste de aterramento. O padrão é instalado seguindo a norma técnica da distribuidora da cidade; depois a distribuidora inspeciona, instala o **medidor** e liga.

Do medidor, um circuito com os fios mais grossos da casa, chamado **circuito de distribuição**, leva a energia até o **quadro de distribuição**, o quadro de luz. Do quadro saem os **circuitos terminais**, cada um alimentando um grupo de lâmpadas, de tomadas ou um aparelho só, como o chuveiro.

O quadro deve ficar em **lugar de fácil acesso** e o mais **perto possível do medidor**: os fios do circuito de distribuição são os mais grossos e, por isso, os mais caros.

## O que há dentro do quadro

| Peça | Para que serve |
| --- | --- |
| Disjuntor geral (ou DR geral) | desliga a casa inteira |
| Barramento das fases | recebe a fase do disjuntor geral e a distribui para os disjuntores dos circuitos |
| Barramento de neutro | junta os neutros dos circuitos; fica **isolado** da caixa do quadro |
| Barramento de proteção (terra) | junta os fios terra; fica **ligado** à caixa do quadro |
| Disjuntores dos circuitos | um para cada circuito terminal, monopolar ou bipolar |

## O disjuntor termomagnético

O **disjuntor** protege os **fios** do circuito. Ele tem duas partes:

- uma **térmica**, com uma lâmina bimetálica que se curva quando esquenta: ela desliga quando a corrente fica acima do valor do disjuntor por algum tempo (**sobrecarga**);
- uma **magnética**, com uma bobina que abre o disjuntor na hora quando a corrente sobe de repente (**curto-circuito**).

Ele também serve de chave: dá para desligar só o circuito em que se vai trabalhar. O fusível faz a mesma proteção, mas queima e precisa ser trocado; o disjuntor desarma e é religado. Os disjuntores comuns são ligados **só nas fases**: monopolar para circuitos de 127 V (uma fase e o neutro) e bipolar para circuitos de 220 V entre duas fases.

## O DR: proteção para as pessoas

O dispositivo **diferencial residual** (DR) compara a corrente que vai pela fase com a que volta pelo neutro. Se a diferença passa do limite, é sinal de que uma parte da corrente está fugindo por outro caminho, que pode ser o corpo de alguém, e ele desliga. Ele percebe correntes de centésimos de ampère, que um disjuntor comum nem nota, mas que podem matar.

O DR protege contra os dois tipos de contato:

- **direto**: encostar numa parte que normalmente tem tensão, como um fio descascado;
- **indireto**: encostar numa parte metálica que normalmente não tem tensão, mas ficou energizada por defeito, como a carcaça de uma máquina de lavar.

Para proteger pessoas, o DR precisa ser de **alta sensibilidade**: no máximo **30 mA**. Os de 100 mA ou mais servem só para proteger o patrimônio, por exemplo contra incêndio causado por fuga de corrente.

Existem dois tipos:

- **Disjuntor DR**: disjuntor e DR num aparelho só. Protege os fios e as pessoas.
- **Interruptor DR**: liga, desliga e protege contra choque, mas **não** protege contra sobrecarga e curto. Precisa de um disjuntor ou fusível antes dele.

Os dois são ligados na **fase e no neutro**, e o neutro não pode ser aterrado depois do DR. Todo DR tem um **botão de teste**, que cria de propósito uma pequena fuga: apertado, o DR tem de desarmar. Se não desarmar, ele precisa ser trocado.

## Onde a norma exige o DR

Desde 1997, a NBR 5410, a norma da ABNT para instalações de baixa tensão, exige DR de alta sensibilidade nos circuitos que atendem:

- tomadas de **cozinhas**, copas-cozinhas, **lavanderias**, **áreas de serviço**, **garagens** e qualquer local interno molhado ou lavado com frequência;
- tomadas em **áreas externas**;
- tomadas internas que possam alimentar aparelhos usados do lado de fora;
- pontos em locais com **chuveiro ou banheira**.

Os outros circuitos podem ter só o disjuntor. A norma também permite um DR geral para a casa toda; a desvantagem é que ele sente todas as pequenas fugas naturais da instalação somadas e pode desarmar com mais frequência.

```navidareal
**"Troca por um disjuntor maior que ele para de desarmar."** Parar de desarmar ele para, mas o disjuntor foi escolhido para proteger aquele fio. Um disjuntor maior deixa passar uma corrente que o fio não aguenta, e quem passa a esquentar é a fiação dentro da parede. Disjuntor que desarma sempre é sinal de sobrecarga, de curto ou de defeito: a causa é que precisa ser encontrada.
```

```verificar
Um aparelho com defeito deixa a carcaça energizada. O fio do circuito está bom e a corrente é pequena. Quem desliga o circuito quando alguém encosta na carcaça?
- O disjuntor termomagnético
+ O DR
- Nenhum dos dois
> A corrente que passa pela pessoa é pequena demais para o disjuntor, mas é uma diferença entre a ida e a volta: é isso que o DR mede.
```

## Exemplo resolvido

**Uma casa tem cinco circuitos: iluminação da sala e quartos, tomadas da sala e quartos, tomadas da cozinha, chuveiro (220 V) e tomada do quintal. Que proteção vai em cada um, seguindo a NBR 5410?**

| Circuito | Proteção | Por quê |
| --- | --- | --- |
| Iluminação da sala e quartos | disjuntor monopolar | não está na lista da norma |
| Tomadas da sala e quartos | disjuntor monopolar | não está na lista da norma |
| Tomadas da cozinha | disjuntor + DR | cozinha está na lista |
| Chuveiro (220 V) | disjuntor bipolar + DR | local com chuveiro; 220 V entre duas fases |
| Tomada do quintal | disjuntor + DR | área externa |

Nos circuitos com DR, pode-se usar um disjuntor DR ou um disjuntor comum seguido de um interruptor DR.

## Resumo

- A energia vai da rede ao padrão de entrada, ao medidor, ao quadro e, por fim, aos circuitos terminais.
- O **disjuntor** protege os **fios** contra sobrecarga (parte térmica) e curto-circuito (parte magnética).
- O **DR** protege as **pessoas**: compara ida e volta da corrente e desliga com fuga de no máximo 30 mA.
- O interruptor DR precisa de um disjuntor ou fusível antes dele.
- A NBR 5410 exige DR em cozinhas, áreas de serviço, lavanderias, garagens, áreas externas e locais com chuveiro.

```leve
- Abra a porta do quadro de luz de casa (sem tirar a tampa interna) e anote quantos disjuntores existem e se há algum DR, reconhecível pelo botão de teste.
- Confira se cada disjuntor tem etiqueta dizendo o que ele desliga. Se não tiver, descubra e etiquete.
```
