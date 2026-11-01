---
titulo: "Permutações, arranjos e combinações"
resumo: "Contar filas, pódios, comissões e anagramas sem listar um por um, decidindo antes se a ordem importa."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Algebra and Trigonometry 2e, seção 13.5, Counting Principles"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/13-5-counting-principles"
  - titulo: "Mega-Sena: como jogar e probabilidades"
    autor: "Caixa Econômica Federal"
    url: "https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "De quantas formas diferentes 4 pessoas podem ficar numa fila?"
    opcoes: ["24", "16", "10", "4"]
    resposta: 0
    explicacao: "4 escolhas para o 1º lugar, 3 para o 2º, 2 para o 3º e 1 para o último: 4 × 3 × 2 × 1 = 24. Isso é 4!, a permutação de 4."
  - pergunta: "Numa chapa com 5 candidatos, de quantos jeitos se escolhem um presidente e um vice?"
    opcoes: ["10", "25", "20", "9"]
    resposta: 2
    explicacao: "Presidente e vice são cargos diferentes: a ordem importa. 5 escolhas para presidente e 4 para vice: 5 × 4 = 20."
  - pergunta: "De quantos jeitos se escolhem 2 pessoas, entre 5, para uma comissão sem cargos?"
    opcoes: ["20", "10", "25", "5"]
    resposta: 1
    explicacao: "Sem cargos, a ordem não importa: Ana e Bia é a mesma comissão que Bia e Ana. 5 × 4 = 20 conta cada dupla duas vezes. Divida por 2: 10."
  - pergunta: "Quantos anagramas tem a palavra ARARA?"
    opcoes: ["120", "60", "20", "10"]
    resposta: 3
    explicacao: "São 5 letras, com o A repetido 3 vezes e o R 2 vezes. 5! = 120, dividido por 3! = 6 e por 2! = 2: 120 ÷ 12 = 10."
---

```provocacao
Cinco amigas querem tirar uma foto, todas em fila. De quantos jeitos diferentes elas podem se arrumar? E se só três couberem na foto? E se, em vez de foto, elas forem escolher três delas para uma comissão? As três perguntas parecem iguais, mas têm respostas bem diferentes: 120, 60 e 10.
```

## O que você vai aprender

Ao fim desta aula você vai saber contar filas, pódios, cargos, comissões e anagramas usando o princípio multiplicativo, o fatorial, os arranjos e as combinações. E vai saber fazer a pergunta que decide qual conta usar: a ordem importa?

## Contar sem listar

Quando há poucas possibilidades, dá para listar todas. Quando há muitas, listar é lento e fácil de errar. A análise combinatória é o jeito de contar sem listar.

A base de tudo é o **princípio multiplicativo**: se uma escolha pode ser feita de m jeitos e, depois dela, outra de n jeitos, as duas juntas podem ser feitas de m × n jeitos.

Com 3 camisetas e 2 calças, há 3 × 2 = 6 jeitos de se vestir. Cada camiseta combina com cada calça.

O truque prático é desenhar uma **casinha para cada escolha** e escrever, em cada casinha, quantas opções sobram naquele momento. Depois, multiplique as casinhas.

## Permutação: todos em fila

Volte às cinco amigas na foto. Para o 1º lugar da fila há 5 opções. Escolhida a primeira, sobram 4 para o 2º lugar. Depois, 3, 2 e 1. O total é 5 × 4 × 3 × 2 × 1 = 120.

Esse produto, de um número até 1, aparece tanto que ganhou nome: **fatorial**. Escreve-se 5! e lê-se "cinco fatorial". Arrumar n coisas diferentes em fila, usando todas, é uma **permutação**, e o total é n!.

- 3! = 6
- 4! = 24
- 5! = 120
- 6! = 720

**Permutação com repetição.** Nos anagramas, as palavras formadas trocando as letras de lugar, letras iguais atrapalham a conta. Em ARARA, trocar dois A de lugar não cria palavra nova. Por isso, divida o total pelo fatorial de cada letra repetida: 5! ÷ (3! × 2!) = 120 ÷ 12 = 10.

## A pergunta que decide: a ordem importa?

Quando só uma parte do grupo é escolhida, a pergunta é sempre a mesma: **se eu trocar a ordem dos escolhidos, muda alguma coisa?**

- Ouro, prata e bronze numa corrida: trocar muda o pódio. **A ordem importa.**
- Presidente, vice e tesoureiro: trocar muda quem tem cada cargo. **A ordem importa.**
- Três pessoas para uma comissão sem cargos: trocar não muda nada. **A ordem não importa.**
- Seis números numa aposta de loteria: o bilhete é o mesmo. **A ordem não importa.**

## Arranjo: a ordem importa

Para escolher 3 das 5 amigas e pôr em fila na foto, use as casinhas: 5 × 4 × 3 = 60. Isso é um **arranjo** de 5 tomados 3 a 3.

```formula
A(n, p) = n × (n − 1) × … (p fatores) = n! ÷ (n − p)!
arranjo é escolher p coisas de n, em ordem
na prática: comece por n e multiplique p números, cada um uma unidade menor
```

## Combinação: a ordem não importa

Para a comissão de 3, cada grupo de três amigas foi contado várias vezes no arranjo, uma para cada ordem. Três pessoas podem ser ordenadas de 3! = 6 jeitos. Então divida: 60 ÷ 6 = 10 comissões.

```formula
C(n, p) = A(n, p) ÷ p!
combinação é escolher p coisas de n, sem importar a ordem
faça o arranjo e divida pelo fatorial de quantos foram escolhidos
```

Um teste rápido: a combinação é sempre menor ou igual ao arranjo. E escolher p é o mesmo que deixar de fora n − p. Por isso C(8, 6) = C(8, 2) = 28.

```navidareal
Na Mega-Sena, a aposta simples marca 6 números entre 60, e a ordem não importa. O número de apostas diferentes é C(60, 6) = (60 × 59 × 58 × 57 × 56 × 55) ÷ 720 = 50.063.860.

A própria Caixa informa que a chance de acertar a sena com uma aposta simples é de 1 em 50.063.860. É o mesmo número da conta.
```

```verificar
Numa associação com 8 pessoas, vão ser escolhidas 3 para uma comissão sem cargos. A conta certa é:
- 8 × 7 × 6 = 336
+ (8 × 7 × 6) ÷ 6 = 56
- 8 × 3 = 24
> Sem cargos, a ordem não importa. O arranjo 8 × 7 × 6 conta cada trio 3! = 6 vezes. Divida por 6.
```

## Exemplo resolvido

**Uma associação de moradores tem 8 pessoas na diretoria. (a) De quantos jeitos se escolhem presidente, vice e tesoureiro? (b) De quantos jeitos se escolhe uma comissão de 3 pessoas, sem cargos?**

1. **(a) A ordem importa?** Sim: trocar o presidente com o tesoureiro muda a diretoria. É arranjo.
2. Casinhas: 8 opções para presidente, 7 para vice, 6 para tesoureiro. 8 × 7 × 6 = 56 × 6 = 336.
3. **(b) A ordem importa?** Não: a comissão Ana, Beto e Caio é a mesma que Caio, Ana e Beto. É combinação.
4. Faça o arranjo e divida pelas ordens de 3 pessoas (3! = 6): 336 ÷ 6 = 56.

Confira: 56 é menor que 336, como toda combinação em relação ao arranjo correspondente. E cada comissão de (b) vira 6 diretorias diferentes em (a): 56 × 6 = 336.

## Como isso cai no ENEM

- **Formatos:** senhas e placas, filas e lugares, cardápios, escolha de comissões e equipes, anagramas, apostas de loteria. Muitas vezes há uma condição ("Ana tem de estar", "as irmãs ficam juntas", "pelo menos uma mulher") que muda a conta.
- **Habilidades:** H2 (identificar padrões numéricos ou princípios de contagem) e H3 (resolver problemas com conhecimentos numéricos).
- **O que mais caiu:** nas provas de 2022 e 2023, classificadas pelo instituto, de 81 questões de Matemática, 2 (2,5%) foram de permutações, arranjos e combinações, e mais 1 (1,2%) foi do princípio fundamental da contagem. A H2 teve 6 questões (7,4%), somando contagem e progressões. São só duas provas: é uma tendência, não uma promessa.
- **Armadilhas:**
  - Usar arranjo quando a ordem não importa (ou combinação quando importa). Faça sempre a pergunta antes.
  - Esquecer de dividir pelas letras repetidas nos anagramas.
  - Ignorar uma condição do enunciado, como uma pessoa obrigatória ou proibida.
  - Em "pelo menos um", somar casos e esquecer algum. Muitas vezes é mais fácil fazer o total menos o caso proibido.
  - Somar quando deveria multiplicar: escolhas feitas uma depois da outra se multiplicam.

## Questão comentada

**Texto-base.** Uma cooperativa de costura tem 7 costureiras. Para uma feira de economia solidária, será formada uma equipe de 3 costureiras, sem funções diferentes entre elas. Ana, que organizou a participação na feira, estará obrigatoriamente na equipe.

**Comando.** O número de equipes diferentes que podem ser formadas é

A) 20.
B) 35.
C) 15.
D) 30.
E) 210.

**Resolução.**

1. Ana já está na equipe. Faltam 2 vagas, a serem escolhidas entre as outras 6 costureiras.
2. A ordem importa? Não: a equipe não tem funções. É combinação de 6 tomadas 2 a 2.
3. C(6, 2) = (6 × 5) ÷ 2 = 30 ÷ 2 = 15.

**Gabarito: C.**

**Por que as outras não:**

- A) 20 é C(6, 3): você escolheu 3 entre as outras 6, deixando Ana de fora. Ela é obrigatória e já ocupa uma vaga.
- B) 35 é C(7, 3): você ignorou a condição de que Ana tem de estar na equipe.
- D) 30 é 6 × 5, um arranjo: você contou cada dupla duas vezes, como se a ordem importasse.
- E) 210 é 7 × 6 × 5: um arranjo de 7 tomados 3 a 3, ignorando a condição e contando a ordem.

```realidade
Escolha um grupo de que você faz parte (família, trabalho, time, igreja, coletivo). Conte quantas pessoas há nele e calcule de quantos jeitos daria para escolher uma comissão de 3 pessoas. Depois, calcule de quantos jeitos daria para escolher coordenação, secretaria e tesouraria. Por que os dois números são diferentes?
```

## Resumo

- Princípio multiplicativo: escolhas seguidas se multiplicam. Use uma casinha para cada escolha.
- Permutação de n coisas: n!. Com letras repetidas, divida pelo fatorial de cada repetição.
- A pergunta que decide: trocar a ordem dos escolhidos muda alguma coisa?
- Ordem importa: arranjo, n × (n − 1) × … com p fatores.
- Ordem não importa: combinação, o arranjo dividido por p!.
- Condições primeiro: fixe quem é obrigatório, tire quem é proibido, e conte o resto.

## Para aprofundar

- [Análise combinatória](/trilhas/matematica-medio/analise-combinatoria)
- [Probabilidade](/trilhas/matematica-medio/probabilidade)
- [Probabilidade e distribuições](/trilhas/matematica-superior/probabilidade-e-distribuicoes)
- [Matemática: o que mais cai](/trilhas/enem-por-area/matematica-o-que-mais-cai)
