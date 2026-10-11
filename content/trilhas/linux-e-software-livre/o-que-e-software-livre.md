---
titulo: "O que é software livre"
resumo: "As quatro liberdades, a diferença entre livre e gratuito, a história do projeto GNU e do Linux e por que isso interessa a quem trabalha."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "O que é o software livre?"
    autor: "Free Software Foundation / Projeto GNU"
    url: "https://www.gnu.org/philosophy/free-sw.pt-br.html"
  - titulo: "Anúncio inicial do Projeto GNU"
    autor: "Richard Stallman"
    ano: "1983"
    url: "https://www.gnu.org/gnu/initial-announcement.pt-br.html"
  - titulo: "O Projeto GNU"
    autor: "Richard Stallman"
    ano: "1998"
    url: "https://www.gnu.org/gnu/thegnuproject.pt-br.html"
  - titulo: "O que é copyleft?"
    autor: "Free Software Foundation / Projeto GNU"
    url: "https://www.gnu.org/licenses/copyleft.pt-br.html"
  - titulo: "The Open Source Definition"
    autor: "Open Source Initiative"
    url: "https://opensource.org/osd"
  - titulo: "The Linux Kernel Archives"
    autor: "Linux Kernel Organization"
    url: "https://www.kernel.org/"
quiz:
  - pergunta: "Um programa gratuito é sempre software livre?"
    opcoes: ["Sim, livre e gratuito são a mesma coisa", "Não: livre quer dizer que você pode usar, estudar, modificar e compartilhar", "Só se for brasileiro"]
    resposta: 1
    explicacao: "Há muito programa gratuito que é fechado: você não pode ver como funciona nem mudar nada. E software livre pode até ser vendido."
  - pergunta: "O que é o código-fonte?"
    opcoes: ["A senha do programa", "O texto, escrito por programadores, que diz ao computador o que fazer", "O número de série do computador"]
    resposta: 1
    explicacao: "Sem acesso ao código-fonte não dá para estudar nem modificar um programa. Por isso ele é condição para duas das quatro liberdades."
  - pergunta: "O que o copyleft exige?"
    opcoes: ["Que o programa seja de graça", "Que quem distribui o programa, modificado ou não, passe adiante as mesmas liberdades", "Que o autor fique anônimo"]
    resposta: 1
    explicacao: "É o que impede que alguém pegue um programa livre, melhore e feche. A licença GPL funciona assim."
  - pergunta: "Quando Richard Stallman anunciou o Projeto GNU?"
    opcoes: ["1969", "1983", "2005"]
    resposta: 1
    explicacao: "Em setembro de 1983. O núcleo Linux, de Linus Torvalds, veio em 1991 e completou o sistema."
---

## Uma receita de bolo

Pense em uma receita. Com ela na mão, você faz o bolo quando quiser, descobre por que ele cresce, troca o leite por suco porque alguém em casa não pode tomar leite, e passa a receita para a vizinha, com a sua mudança.

Agora imagine um bolo que só se compra pronto, com um contrato: é proibido descobrir a receita, proibido mudar, proibido dividir com outra pessoa, e o fabricante pode alterar o sabor quando quiser.

Um programa de computador é uma receita que a máquina segue. A receita se chama **código-fonte**. Quando ele vem trancado e com proibições, o programa é **proprietário**. Quando vem aberto e com as liberdades garantidas, é **software livre**.

## As quatro liberdades

Um programa é software livre quando quem o usa tem quatro liberdades. Elas são contadas a partir do zero, como os programadores costumam contar:

| Liberdade | O que garante |
| --- | --- |
| **0** | **Usar** o programa como quiser, para qualquer finalidade |
| **1** | **Estudar** como ele funciona e **adaptá-lo** às suas necessidades |
| **2** | **Compartilhar** cópias, para ajudar outras pessoas |
| **3** | **Distribuir as suas versões modificadas**, para que toda a comunidade aproveite a melhoria |

As liberdades 1 e 3 só existem se o código-fonte estiver disponível.

## Livre não é o mesmo que gratuito

Em inglês, *free* quer dizer tanto "livre" quanto "grátis", e a confusão nasceu aí. O movimento explica com uma comparação: livre como em **liberdade de expressão**, não como em **cerveja grátis**.

| | Dá para usar sem pagar? | Dá para ver e mudar o código? | Dá para compartilhar? |
| --- | --- | --- | --- |
| **Software livre** | Quase sempre | Sim | Sim |
| **Programa gratuito e fechado** | Sim | Não | Em geral, não |
| **Programa proprietário pago** | Não | Não | Não |

Um aplicativo "grátis" que vive dos seus dados não é livre. E um programa livre pode ser vendido: o que não se pode é tirar de quem compra as quatro liberdades.

```verificar
Um aplicativo de mensagens é gratuito, mas ninguém fora da empresa pode ver o seu código. Ele é software livre?
- Sim, porque é de graça
+ Não: faltam as liberdades de estudar, modificar e redistribuir
- Depende do celular
> O preço não entra na definição.
```

## De onde veio

Nos primeiros tempos da computação, compartilhar programas entre universidades era o normal. No fim dos anos 1970 as empresas começaram a trancar o código e a proibir cópias.

- **1983**: o programador **Richard Stallman**, do Instituto de Tecnologia de Massachusetts, anuncia o **Projeto GNU**: escrever um sistema operacional inteiro que fosse livre.
- **1985**: é fundada a **Free Software Foundation** (Fundação para o Software Livre).
- **1989**: sai a primeira versão da **GPL**, a Licença Pública Geral GNU.
- **1991**: o estudante finlandês **Linus Torvalds** publica um núcleo de sistema operacional, o **Linux**. No ano seguinte ele passa a ser distribuído sob a GPL.

O GNU tinha quase tudo, menos o núcleo. O Linux era o núcleo. Juntos, formaram o sistema completo que hoje muita gente chama só de Linux e que a Free Software Foundation prefere chamar de **GNU/Linux**. A próxima aula explica essa história e o que é uma distribuição.

## Copyleft: a liberdade que não pode ser tirada

O direito autoral (*copyright*) costuma ser usado para proibir. Stallman virou a ferramenta do avesso e criou o **copyleft**: a licença diz que qualquer pessoa pode usar, modificar e redistribuir o programa, **desde que passe adiante as mesmas liberdades**.

É o que impede uma empresa de pegar um programa feito em comum, melhorar um pouco e fechar. A **GPL** é a licença copyleft mais conhecida.

Há também licenças livres **permissivas**, como a MIT e a BSD, que deixam fazer quase tudo, inclusive fechar o código em uma versão nova.

### E "código aberto"?

Em 1998, um grupo passou a usar o nome **open source** (código aberto), por achar que ele soava melhor para as empresas. Na prática, quase todo programa de código aberto é também software livre, e as licenças são quase as mesmas. A diferença é de ênfase: "código aberto" destaca a vantagem técnica de muita gente poder revisar o código; "software livre" destaca a **liberdade de quem usa**.

## Você já usa

| Para quê | Software livre |
| --- | --- |
| Navegar na internet | Firefox |
| Textos, planilhas e apresentações | LibreOffice |
| Vídeo e música | VLC |
| Editar imagens | GIMP |
| Desenho e pintura | Krita, Inkscape |
| Editar som | Audacity |
| Sistema operacional | Debian, Ubuntu, Linux Mint e muitas outras distribuições |

O núcleo do **Android** é o Linux. A maior parte dos servidores que mantêm a internet de pé roda software livre. A Wikipédia funciona sobre um programa livre, o MediaWiki.

## Por que isso é assunto de quem trabalha

- **Sem aluguel.** Escola, sindicato, associação de moradores e cooperativa não precisam pagar licença por computador, todo ano, para escrever um texto ou fazer uma planilha.
- **Computador velho volta a servir.** Há sistemas livres leves que rodam bem em máquinas que o sistema proprietário já abandonou. É menos lixo eletrônico e menos gasto.
- **Dá para conferir.** Com o código aberto, qualquer pessoa que entenda do assunto pode verificar o que o programa faz com os seus dados. No programa fechado, resta acreditar.
- **Ninguém desliga.** O programa não deixa de funcionar porque a empresa faliu, mudou o preço ou resolveu que o seu país não interessa.
- **Compartilhar é permitido.** Instalar no computador da vizinha não é "pirataria": é exatamente o que a licença quer.
- **É trabalho coletivo.** Milhares de pessoas, no mundo inteiro, constroem juntas algo que pertence a todos. É uma amostra, pequena e real, de produção voltada ao uso comum e não ao lucro de um dono.

Nem tudo são flores: grandes empresas lucram bastante em cima de software livre escrito por voluntários, e há programas livres difíceis de usar. Mas a regra do jogo é outra, e ela está do lado de quem usa.

```verificar
Uma associação de bairro ganhou cinco computadores antigos. O que o software livre permite?
- Nada: computador antigo não tem uso
+ Instalar um sistema leve e os programas de escritório em todos, sem pagar licença e sem infringir lei nenhuma
- Instalar só em um, porque a licença é por máquina
> Lembre das liberdades 0 e 2.
```
