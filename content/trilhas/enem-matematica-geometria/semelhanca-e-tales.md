---
titulo: "Semelhança e Teorema de Tales"
resumo: "Mesma forma, outro tamanho: medir a altura de uma árvore pela sombra, ampliar uma foto, dividir lotes entre ruas paralelas e saber o que acontece com a área."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Prealgebra 2e, seção 9.3, Use Properties of Angles, Triangles, and the Pythagorean Theorem"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/9-3-use-properties-of-angles-triangles-and-the-pythagorean-theorem"
  - titulo: "Contemporary Mathematics, seção 10.3, Triangles"
    autor: "Donna Kirk (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/contemporary-mathematics/pages/10-3-triangles"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Uma pessoa de 1,8 m projeta uma sombra de 1,2 m. No mesmo instante, um poste projeta uma sombra de 6 m. Qual é a altura do poste?"
    opcoes: ["9 m", "4 m", "7,2 m", "10 m"]
    resposta: 0
    explicacao: "No mesmo instante, altura e sombra estão na mesma razão: 1,8 ÷ 1,2 = 1,5. O poste tem 6 × 1,5 = 9 m. Quem marcou 4 m inverteu a razão."
  - pergunta: "Dois triângulos são semelhantes, e os lados do maior são 3 vezes os do menor. A área do maior é quantas vezes a do menor?"
    opcoes: ["3", "6", "9", "27"]
    resposta: 2
    explicacao: "Área tem duas medidas: 3 × 3 = 9. O 27 seria o fator de volume, num sólido."
  - pergunta: "Três retas paralelas cortam duas transversais. Numa, os segmentos medem 4 e 6. Na outra, o primeiro mede 6. Quanto mede o segundo?"
    opcoes: ["8", "9", "4", "12"]
    resposta: 1
    explicacao: "Pelo Teorema de Tales, os segmentos são proporcionais: 4 está para 6 assim como 6 está para x. Então 4x = 36 e x = 9."
  - pergunta: "Uma foto de 10 cm por 15 cm é ampliada sem deformar, e o lado menor passa a 20 cm. Quanto mede o lado maior?"
    opcoes: ["25 cm", "20 cm", "45 cm", "30 cm"]
    resposta: 3
    explicacao: "O lado menor dobrou (10 para 20), então o maior também dobra: 15 × 2 = 30 cm. Somar os mesmos 10 cm (dando 25) deforma a foto."
---

```provocacao
Como medir a altura de uma árvore, de uma caixa-d'água ou de um prédio sem subir neles? Num dia de sol, uma vara e uma trena bastam. Por quê?
```

## O que você vai aprender

Ao fim desta aula você vai reconhecer figuras semelhantes, usar a razão entre elas para achar medidas que faltam, aplicar o Teorema de Tales em retas paralelas e prever o que acontece com a área quando uma figura é ampliada ou reduzida.

## Mesma forma, outro tamanho

Tire uma foto no celular e amplie com os dedos. A imagem cresce, mas o rosto continua o mesmo rosto: nada fica esticado. Isso é **semelhança**. Duas figuras são semelhantes quando uma é a outra ampliada ou reduzida, sem deformar.

Na linguagem da geometria, figuras semelhantes têm:

- os ângulos correspondentes iguais;
- os lados correspondentes proporcionais, isto é, todos multiplicados pelo mesmo número.

Esse número é a **razão de semelhança**, que vamos chamar de k. Se uma foto de 10 cm por 15 cm vira uma de 20 cm por 30 cm, os dois lados foram multiplicados por 2: k = 2. Se virasse 20 cm por 25 cm, um lado teria dobrado e o outro não, e a foto sairia esticada. Semelhança é multiplicar, não somar.

## Triângulos semelhantes

Com triângulos há um atalho: basta que **dois ângulos** sejam iguais. Como a soma dos ângulos de qualquer triângulo é 180 graus, o terceiro ângulo também será igual, e os lados ficam proporcionais.

Isso aparece o tempo todo, porque raios de sol chegam paralelos. Num mesmo instante, todos os objetos em pé fazem com a própria sombra o mesmo ângulo. Figura descrita em palavras: uma vara em pé e a sombra dela formam um triângulo retângulo pequeno; a árvore e a sombra dela formam um triângulo retângulo grande. Os dois têm o canto reto no chão e o mesmo ângulo do sol. São semelhantes.

Então altura e sombra estão sempre na mesma razão:

```formula
H ÷ S = h ÷ s
a altura da árvore dividida pela sombra dela é igual à altura da vara dividida pela sombra da vara
```

Vara de 2 m com sombra de 1,5 m. Árvore com sombra de 12 m. A razão é 2 ÷ 1,5. A árvore tem 12 × 2 ÷ 1,5 = 16 m.

Para montar a proporção sem errar, escreva lado com lado correspondente: o maior do triângulo pequeno com o maior do grande, e assim por diante. Uma tabela de duas colunas (pequeno e grande) ajuda.

## Uma reta paralela dentro do triângulo

Num triângulo ABC, trace um segmento DE paralelo ao lado BC, com D no lado AB e E no lado AC. O triângulo pequeno ADE é semelhante ao grande ABC: eles dividem o ângulo do vértice A, e a paralela faz os outros ângulos iguais.

Cuidado com o lado correspondente: se AD = 4 e DB = 6, o lado inteiro AB é 10. A razão entre o grande e o pequeno é 10 ÷ 4, e não 6 ÷ 4. Se DE = 6, então BC = 6 × 10 ÷ 4 = 15.

```verificar
Um triângulo tem lados 3, 4 e 5. Um triângulo semelhante a ele tem o maior lado igual a 15. Quanto mede o menor lado do segundo?
- 13
+ 9
- 5
> O maior lado foi de 5 para 15: k = 3. O menor também é multiplicado por 3: 3 × 3 = 9. Somar 10 a cada lado (dando 13) deformaria o triângulo.
```

## O Teorema de Tales

Agora imagine três ruas paralelas cortadas por duas avenidas inclinadas. O **Teorema de Tales** diz: quando um feixe de retas paralelas corta duas retas transversais, os segmentos que se formam numa transversal são proporcionais aos que se formam na outra.

Figura descrita em palavras: três linhas horizontais paralelas, uma em cima da outra, com espaços diferentes entre elas. Duas linhas inclinadas cruzam as três. Na inclinada da esquerda, os pedaços entre as paralelas medem 3 e 5. Na da direita, medem 4,5 e x. Pelo teorema, 3 está para 5 assim como 4,5 está para x. Então 3x = 22,5 e x = 7,5.

```formula
a ÷ b = c ÷ d
num feixe de paralelas, a razão entre os pedaços de uma transversal é igual à razão entre os pedaços correspondentes da outra
```

Na prova, as paralelas costumam ser ruas, cercas ou fileiras, e as transversais são avenidas ou divisas de terreno. A pergunta clássica é a frente de um lote do outro lado do quarteirão.

## O que acontece com a área

Se os lados ficam k vezes maiores, a área fica k² vezes maior, porque área tem duas medidas (comprimento vezes largura). Num sólido, o volume fica k³ vezes maior.

Uma toalha com a mesma forma de outra, mas com lados 1,5 vez maiores, gasta 1,5 × 1,5 = 2,25 vezes mais tecido. Esse é o engano mais caro: achar que lado dobrado é área dobrada. Lado dobrado é área quatro vezes maior.

```navidareal
Na copiadora, ampliar uma folha A4 (21 cm por 29,7 cm) para uma A3 (29,7 cm por 42 cm) pede 141%. A conta de semelhança explica: 29,7 ÷ 21 e 42 ÷ 29,7 dão perto de 1,41 cada, a mesma razão nos dois lados. E 1,41 × 1,41 dá perto de 2: a folha A3 tem o dobro da área da A4. Quem pede "200%" para dobrar o tamanho recebe lados duas vezes maiores e quatro vezes mais área, e o texto não cabe na folha.
```

## Exemplo resolvido

**Uma pessoa de 1,6 m de altura está a 3 m de um poste com uma lâmpada no alto. À noite, a sombra dela no chão mede 2 m. A que altura está a lâmpada?**

1. Desenhe: a lâmpada, a cabeça da pessoa e a ponta da sombra ficam alinhadas. Há dois triângulos retângulos com o mesmo ângulo na ponta da sombra.
2. Triângulo pequeno: altura 1,6 m (a pessoa) e base 2 m (a sombra).
3. Triângulo grande: altura H (o poste) e base 3 + 2 = 5 m, do pé do poste até a ponta da sombra.
4. Proporção: H ÷ 5 = 1,6 ÷ 2. Então H = 5 × 0,8 = 4 m.

Confira: a lâmpada tem de ser mais alta que a pessoa, senão não haveria sombra no chão. 4 m é mais alto que 1,6 m, e a razão 4 ÷ 5 é igual a 1,6 ÷ 2.

## Como isso cai no ENEM

- **Formatos:** sombras para medir alturas, ampliação e redução de fotos, mapas e maquetes, lotes entre ruas paralelas (Tales), rampas e escadas com degraus, área de figuras ampliadas, triângulos encaixados um dentro do outro.
- **Habilidades:** H7 (identificar características de figuras planas e espaciais), H8 (resolver problemas de geometria de espaço e forma) e H9 (usar a geometria para escolher argumentos que resolvem problemas do cotidiano). Nas provas de 2022 e 2023, classificadas pelo instituto, nenhuma questão foi classificada neste tópico específico. A ideia de proporção, porém, sustenta outros tópicos que apareceram, como escalas (3 das 81 questões de Matemática, 3,7%). São só duas provas: tendência, não promessa.
- **Armadilhas:**
  - Somar a diferença em vez de multiplicar pela razão.
  - Montar a proporção com lados que não se correspondem.
  - No triângulo com paralela, usar o pedaço DB no lugar do lado inteiro AB.
  - Esquecer que a área muda com k², e não com k.
  - Inverter a razão (sombra sobre altura num lado, altura sobre sombra no outro).

## Questão comentada

**Texto-base.** Num bairro, três ruas paralelas são cortadas por duas avenidas, a Avenida A e a Avenida B. Entre as três ruas há dois lotes de cada lado do quarteirão. Na Avenida A, as frentes dos dois lotes medem 20 m e 30 m. Na Avenida B, as frentes dos dois lotes, juntas, somam 75 m.

**Comando.** A frente, na Avenida B, do lote que tem 30 m na Avenida A mede

A) 50 m.
B) 37,5 m.
C) 45 m.
D) 30 m.
E) 55 m.

**Resolução.**

1. Pelo Teorema de Tales, as frentes são proporcionais nas duas avenidas.
2. Na Avenida A, o total é 20 + 30 = 50 m. Na Avenida B, é 75 m. A razão é 75 ÷ 50 = 1,5.
3. O lote de 30 m na A tem, na B, 30 × 1,5 = 45 m. (O outro tem 20 × 1,5 = 30 m; confira: 45 + 30 = 75.)

**Gabarito: C.**

**Por que as outras não:**

- A) 50 m: é o total das frentes na Avenida A, não a frente de um lote na B.
- B) 37,5 m: o total da B foi dividido ao meio. Os lotes não são iguais; a divisão segue a proporção 20 para 30.
- D) 30 m: é a frente, na Avenida B, do outro lote, o que mede 20 m na A.
- E) 55 m: os 20 m do lote menor foram tirados do total da B (75 − 20). Mas os 20 m são medidos na outra avenida.

```realidade
Num dia de sol, meça a sua sombra e a sombra de alguma coisa alta perto de casa (um poste, uma árvore, a caixa-d'água). Sabendo a sua altura, calcule a altura dela. Faça a medição de novo uma hora depois. As sombras mudaram, mas a altura calculada deveria dar quase a mesma. Deu?
```

## Resumo

- Figuras semelhantes: ângulos iguais e lados multiplicados pelo mesmo número k.
- Triângulos com dois ângulos iguais são semelhantes. Sombras no mesmo instante formam triângulos semelhantes.
- Monte a proporção com lados correspondentes: pequeno com pequeno, grande com grande.
- Tales: paralelas cortando transversais formam segmentos proporcionais.
- Lados × k: área × k², volume × k³.

## Para aprofundar

- [Razão e proporção](/trilhas/matematica-fundamental/razao-e-proporcao)
- [Regra de três](/trilhas/matematica-fundamental/regra-de-tres)
- [Escalas](/trilhas/enem-matematica-proporcionalidade/escalas)
- [Geometria plana](/trilhas/matematica-medio/geometria-plana)
- [Teorema de Pitágoras e relações métricas](/trilhas/enem-matematica-geometria/pitagoras-e-relacoes-metricas)
