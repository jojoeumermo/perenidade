---
titulo: "Como funciona a internet"
resumo: "O caminho que uma página percorre do servidor até a sua tela."
autores: ["Equipe Projeto Lucia"]
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

## Pratique

Pense no último site que você abriu hoje e descreva, com suas palavras, as cinco etapas que aconteceram entre digitar o endereço e ver a página.
