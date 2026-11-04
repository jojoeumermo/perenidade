---
titulo: "Como funciona a internet"
resumo: "O caminho que uma página percorre do servidor até a sua tela."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Como a internet funciona?"
    autor: "MDN Web Docs (Mozilla)"
    url: "https://developer.mozilla.org/pt-BR/docs/Learn_web_development/Howto/Web_mechanics/How_does_the_Internet_work"
  - titulo: "Cartilha de Segurança para Internet"
    autor: "CERT.br / NIC.br"
    url: "https://cartilha.cert.br/"
quiz:
  - pergunta: "O que o DNS faz?"
    opcoes: ["Protege o computador contra vírus", "Traduz nomes de sites em endereços IP", "Aumenta a velocidade da conexão"]
    resposta: 1
    explicacao: "O DNS funciona como uma lista telefônica: você dá o nome e ele devolve o número."
  - pergunta: "Qual é a relação entre internet e web?"
    opcoes: ["São a mesma coisa", "A web é um dos serviços que funcionam sobre a internet", "A internet é uma parte da web"]
    resposta: 1
    explicacao: "A internet é a rede. A web, o e-mail e as chamadas de vídeo são serviços que usam essa rede."
  - pergunta: "O que o cadeado do HTTPS garante?"
    opcoes: ["Que o site é honesto e confiável", "Que a conversa com o site está criptografada", "Que o site não tem anúncios"]
    resposta: 1
    explicacao: "O HTTPS impede que terceiros leiam ou alterem os dados no caminho. Ele não diz nada sobre as intenções de quem fez o site."
---
## O que você vai aprender

Ao fim desta aula você vai saber explicar que a internet é uma rede de redes, a diferença entre internet e web, o que fazem o IP, o DNS, os servidores e os pacotes, e por que o cadeado do HTTPS importa.


## Uma rede de redes

A internet não é uma nuvem nem um lugar. É uma enorme quantidade de computadores ligados entre si por cabos, fibras ópticas e ondas de rádio. O nome vem de *interconnected networks*: redes interconectadas.

A rede da sua casa se liga à do seu provedor, que se liga a outras maiores, que cruzam países e oceanos por cabos submarinos.

## Internet não é o mesmo que web

- A **internet** é a infraestrutura: a rede em si.
- A **web** é um dos serviços que funcionam sobre ela: as páginas que você abre no navegador.

E-mail, chamadas de vídeo, jogos online e aplicativos de mensagem também usam a internet, mas não são a web.

## Endereços: o IP

Para que os dados cheguem ao destino certo, cada aparelho conectado recebe um endereço numérico, o **endereço IP**. Um exemplo é `203.0.113.42`.

Funciona como o endereço de uma casa: sem ele, a correspondência não tem como chegar.

## Nomes: o DNS

Ninguém quer decorar números. Por isso existe o **DNS**, um sistema que traduz nomes, como `wikipedia.org`, em endereços IP. Ele funciona como uma lista telefônica: você informa o nome e recebe o número.

## Clientes e servidores

- **Servidor** é o computador que guarda um site e o entrega a quem pede.
- **Cliente** é o aparelho que faz o pedido: o seu celular ou computador, por meio do navegador.

## Pacotes

Os dados não viajam inteiros. Uma página, uma foto ou um vídeo são divididos em pedaços pequenos, chamados **pacotes**. Cada pacote leva o endereço de origem e o de destino e pode seguir um caminho diferente pela rede. No destino, eles são reunidos na ordem certa. Se algum se perde, é pedido de novo.

Essa ideia torna a internet resistente: se um caminho falha, os pacotes vão por outro.

## O que acontece quando você abre um site

1. Você digita o endereço no navegador.
2. O navegador pergunta ao DNS qual é o IP daquele nome.
3. Com o IP em mãos, o navegador envia um pedido ao servidor.
4. O servidor responde com os arquivos da página, divididos em pacotes.
5. O navegador junta os pacotes e desenha a página na tela.

Tudo isso leva, em geral, menos de um segundo.

## HTTP e HTTPS

O conjunto de regras que navegador e servidor usam para conversar se chama **HTTP**. A versão segura é o **HTTPS**: nela a conversa é **criptografada**, ou seja, embaralhada de modo que só as duas pontas consigam ler.

O cadeado ao lado do endereço indica HTTPS. Ele garante que ninguém no meio do caminho consegue ler ou alterar os dados. **Ele não garante que o site seja honesto**: páginas de golpe também usam HTTPS. Por isso, confira sempre se o endereço é mesmo o do site que você queria visitar.

## Exemplo resolvido

**Você digita um endereço no navegador e a página não abre. Onde procurar o problema?**

Percorra os passos de "o que acontece quando você abre um site", um de cada vez.

1. **Seu aparelho está na rede?** Se nenhum site abre, o problema está entre você e o provedor (Wi-Fi, cabo, sinal). Se outros sites abrem, a rede está de pé.
2. **O nome foi traduzido?** O DNS transforma o nome em IP. Se o navegador diz que não encontrou o endereço, confira se digitou certo: um erro de uma letra leva a um nome que não existe.
3. **O servidor respondeu?** O servidor é quem guarda o site. Se o nome existe e ainda assim não abre, o servidor pode estar fora do ar ou sobrecarregado. O problema não está com você.
4. **A conversa é segura?** Olhe o cadeado (HTTPS). Se o navegador avisa que a conexão não é segura, não digite senha nem dados.

Lição do exemplo: a internet é uma cadeia (aparelho, rede, DNS, servidor). Saber a ordem da cadeia diz onde olhar primeiro.

## Pratique

Pense no último site que você abriu hoje e descreva, com suas palavras, as cinco etapas que aconteceram entre digitar o endereço e ver a página.

## Resumo

- A internet é uma rede de redes (interconnected networks): computadores ligados por cabos, fibras ópticas e ondas de rádio.
- Internet é a infraestrutura; a web é um dos serviços sobre ela. E-mail, chamadas de vídeo e mensagens também usam a internet.
- Cada aparelho tem um endereço IP; o DNS traduz nomes em endereços IP, como uma lista telefônica.
- O servidor guarda o site e o entrega; o cliente (seu celular ou computador) faz o pedido pelo navegador.
- Os dados viajam em pacotes, que podem seguir caminhos diferentes e são reunidos na ordem certa no destino.
- HTTP é o conjunto de regras; HTTPS é a versão criptografada, indicada pelo cadeado.
