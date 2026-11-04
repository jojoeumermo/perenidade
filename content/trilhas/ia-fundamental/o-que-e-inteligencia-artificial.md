---
titulo: "O que é inteligência artificial"
resumo: "O que essas máquinas fazem de verdade, de onde veio o nome e por que elas erram."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Recomendação sobre a Ética da Inteligência Artificial"
    autor: "UNESCO"
    ano: "2021"
    url: "https://unesdoc.unesco.org/ark:/48223/pf0000381137_por"
  - titulo: "Inteligência Artificial: uma abordagem moderna"
    autor: "Stuart Russell e Peter Norvig"
    ano: "2021"
  - titulo: "Computing Machinery and Intelligence"
    autor: "Alan Turing (revista Mind, v. 59, n. 236)"
    ano: "1950"
  - titulo: "Amazon scraps secret AI recruiting tool that showed bias against women"
    autor: "Jeffrey Dastin (Reuters)"
    ano: "2018"
    url: "https://www.euronews.com/2018/10/10/amazon-scraps-secret-ai-recruiting-tool-that-showed-bias-against-women"
quiz:
  - pergunta: "Como a maior parte dos sistemas de inteligência artificial de hoje 'aprende'?"
    opcoes: ["Lendo um manual de regras escrito por programadores", "Encontrando padrões em enormes quantidades de exemplos", "Conversando com outras máquinas"]
    resposta: 1
    explicacao: "É o chamado aprendizado de máquina: em vez de receber as regras, o sistema as extrai dos dados."
  - pergunta: "Um sistema de inteligência artificial entende o que diz?"
    opcoes: ["Sim, como uma pessoa", "Não há evidência disso: ele calcula respostas prováveis a partir de padrões", "Só quando acerta"]
    resposta: 1
    explicacao: "Por isso pode produzir, com a mesma segurança, uma resposta correta e uma inventada."
  - pergunta: "De onde vêm os preconceitos que um sistema desses pode reproduzir?"
    opcoes: ["Da eletricidade", "Dos dados com que foi treinado e das escolhas de quem o construiu", "Do acaso"]
    resposta: 1
    explicacao: "Se os exemplos refletem uma sociedade desigual, o sistema aprende a desigualdade junto."
modelo: 9
---
## O que você vai aprender

Ao fim desta aula você vai saber dizer de onde vem a expressão inteligência artificial, como um sistema de aprendizado de máquina funciona, onde ele já está no seu dia a dia e quais perguntas fazer antes de confiar em uma IA.


```suarealidade
Em que momentos do seu dia o celular "adivinha" alguma coisa por você (um vídeo, uma palavra, um anúncio)? Você sabe com base em quê?
```

## Um nome de 1956

A expressão **inteligência artificial** (IA) foi criada em 1956 pelo cientista da computação John McCarthy, para um encontro de pesquisadores nos Estados Unidos. Seis anos antes, o matemático inglês Alan Turing já havia perguntado, em um artigo famoso: "As máquinas podem pensar?".

O nome impressiona, mas a definição é modesta: IA é o campo que constrói **sistemas de computador capazes de realizar tarefas que costumam exigir inteligência humana**, como reconhecer um rosto, traduzir um texto, sugerir uma rota ou responder a uma pergunta.

## Como ela funciona hoje

Um programa tradicional segue regras escritas por alguém: "se o saldo for menor que zero, mostre um aviso". Para tarefas como reconhecer um gato em uma foto, ninguém consegue escrever todas as regras.

A saída foi inverter o método. No **aprendizado de máquina**, mostram-se ao sistema milhões de exemplos (fotos com e sem gato, frases e suas traduções) e ele ajusta sozinho milhões de números internos até acertar a maioria dos casos. O resultado é chamado de **modelo**.

O modelo não recebeu uma definição de gato. Ele encontrou **padrões estatísticos** nos exemplos. Os assistentes de texto funcionam assim: foram treinados com uma quantidade gigantesca de textos e calculam, palavra por palavra, qual é a continuação mais provável.

```verificar
Qual é a diferença entre um programa tradicional e um sistema de aprendizado de máquina?
- Nenhuma
+ O tradicional segue regras escritas por pessoas; o outro extrai padrões de exemplos
- O tradicional é mais novo
> Releia os dois primeiros parágrafos desta seção.
```

## Onde ela já está

- Na recomendação de vídeos e de músicas.
- No filtro de mensagens indesejadas do e-mail.
- No teclado do celular, que sugere a próxima palavra.
- Na tradução automática e nas legendas geradas por voz.
- Na análise de crédito dos bancos e na triagem de currículos.
- No reconhecimento facial de câmeras de segurança.

Os três últimos mostram que não se trata só de comodidade: decisões que afetam a vida das pessoas já são tomadas com a ajuda desses sistemas.

## O que ela não é

- **Não é consciente.** Não há evidência de que esses sistemas sintam, queiram ou entendam. Eles calculam.
- **Não é neutra.** Aprende com dados produzidos por uma sociedade desigual e pode repetir racismo, machismo e outros preconceitos presentes neles.
- **Não é infalível.** Pode afirmar algo falso com total segurança, inventar uma citação, uma lei ou um livro que não existem. Isso ficou conhecido como "alucinação".
- **Não surge do nada.** Depende do trabalho de milhares de pessoas que rotulam dados, muitas vezes por pagamentos baixíssimos, de centros de dados que consomem muita energia e água, e de textos e imagens produzidos por gente que quase nunca foi consultada.

## As perguntas certas

Diante de qualquer sistema de IA, vale perguntar:

1. Quem o construiu e quem lucra com ele?
2. Com que dados foi treinado? De quem eram?
3. O que acontece quando ele erra, e quem responde pelo erro?
4. Dá para conferir a resposta em outra fonte?

Em 2021, os países-membros da UNESCO aprovaram uma recomendação sobre a ética da IA que parte de princípios parecidos: transparência, responsabilidade humana, proteção de dados e respeito aos direitos.

A tecnologia não decide sozinha o seu uso. A mesma ferramenta pode servir para diagnosticar doenças mais cedo ou para vigiar trabalhadores. Quem decide é a sociedade, e por isso entender o assunto é uma questão de cidadania.

## Exemplo resolvido

**Uma empresa usa uma IA para triar currículos. Como aplicar as quatro perguntas da aula?**

1. **Quem construiu e quem lucra?** Descubra se o sistema foi feito pela própria empresa ou comprado de uma fornecedora, e quem ganha com ele (a empresa contrata mais rápido e gasta menos).
2. **Com que dados foi treinado? De quem eram?** Se foi treinado com currículos de quem já foi contratado no passado, ele aprende o padrão daquelas contratações. Se naquele passado havia preconceito (contra mulheres, contra negros, contra moradores de certos bairros), o sistema pode repeti-lo: a aula diz que a IA não é neutra.
3. **O que acontece quando ele erra? Quem responde?** Uma pessoa recusada por engano consegue saber por quê? Consegue pedir que um ser humano revise? A responsabilidade é da empresa, não da máquina.
4. **Dá para conferir em outra fonte?** Compare com a avaliação feita por uma pessoa do setor de recursos humanos, e veja se as duas concordam.

Conclusão do exemplo: a IA não decide sozinha o que é justo. Ela calcula a partir de dados e regras que alguém escolheu. Por isso as perguntas vêm antes da confiança.

```outrolado
# O argumento de quem confia na IA
Uma máquina não tem cansaço, simpatias nem preconceitos pessoais. Um recrutador humano erra e discrimina; um sistema treinado com milhões de exemplos seria mais justo e mais barato.
---
Como você responderia a esse argumento, com respeito e com fatos?
---
O argumento acerta num ponto: pessoas têm preconceitos e cansaço. Mas a IA aprende com dados produzidos por uma sociedade desigual e pode repetir o que está neles, como diz a aula. Um caso documentado: segundo reportagem da Reuters (10 de outubro de 2018), a Amazon abandonou uma ferramenta experimental de triagem de currículos que aprendeu a penalizar currículos com a palavra "women's" e a rebaixar formadas de duas faculdades só para mulheres; a empresa afirmou que a ferramenta nunca foi usada por recrutadores para avaliar candidatos. A saída é manter a pergunta da aula: com que dados foi treinada, quem responde pelo erro e dá para conferir em outra fonte.
```

```agir
# Esta semana
Na próxima vez que um aplicativo sugerir algo a você (vídeo, música, palavra, anúncio), pare e anote no papel duas respostas: com que dados ele pode ter feito essa sugestão? Quem lucra se eu aceitar? Não precisa mostrar a ninguém.
```

## Para praticar

1. Liste cinco situações do seu dia em que um sistema desses tomou uma decisão por você ou sobre você.
2. Faça a um assistente de texto uma pergunta sobre algo que você conhece muito bem. Ele acertou tudo? Onde errou?

## Resumo

- A expressão inteligência artificial foi criada em 1956 por John McCarthy; seis anos antes, Alan Turing havia perguntado se as máquinas podem pensar.
- Um programa tradicional segue regras escritas por alguém; no aprendizado de máquina, mostram-se ao sistema milhões de exemplos e ele encontra os padrões.
- A IA já está na recomendação de vídeos, no filtro de spam, no teclado do celular, na tradução, na análise de crédito, na triagem de currículos e no reconhecimento facial.
- Ela não é consciente, não é neutra (pode repetir preconceitos dos dados) e não é infalível.
- Pergunte sempre: quem construiu e quem lucra, com que dados foi treinada, quem responde pelo erro e se dá para conferir em outra fonte.
