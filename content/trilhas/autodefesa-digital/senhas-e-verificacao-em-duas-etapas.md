---
titulo: "Senhas fortes e verificação em duas etapas"
resumo: "Por que senha comprida vale mais do que senha complicada, por que nunca repetir, como usar um cofre de senhas e como ligar a segunda etapa nas contas que importam."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Cartilha de Segurança para Internet: fascículos Autenticação e Verificação em Duas Etapas"
    autor: "CERT.br / Núcleo de Informação e Coordenação do Ponto BR (NIC.br)"
    url: "https://cartilha.cert.br/fasciculos/"
  - titulo: "Digital Identity Guidelines: Authentication and Authenticator Management (SP 800-63B, revisão 4)"
    autor: "National Institute of Standards and Technology (NIST)"
    ano: "2025"
    url: "https://pages.nist.gov/800-63-4/sp800-63b.html"
  - titulo: "Have I Been Pwned"
    autor: "Troy Hunt"
    url: "https://haveibeenpwned.com/"
  - titulo: "KeePassXC, gerenciador de senhas livre"
    autor: "Equipe KeePassXC"
    url: "https://keepassxc.org/"
quiz:
  - pergunta: "O que torna uma senha mais difícil de adivinhar?"
    opcoes: ["Trocar a letra \"a\" por \"@\"", "Ser comprida", "Ter a data do seu aniversário"]
    resposta: 1
    explicacao: "O comprimento é o que mais conta. Trocas como \"@\" no lugar de \"a\" são as primeiras que os programas de ataque testam."
  - pergunta: "Por que não usar a mesma senha em vários sites?"
    opcoes: ["Porque é difícil de lembrar", "Porque, se um site vazar, todas as outras contas ficam abertas", "Porque os sites proíbem"]
    resposta: 1
    explicacao: "Quem rouba uma lista de senhas testa cada uma, automaticamente, em e-mail, banco e redes sociais."
  - pergunta: "Alguém liga dizendo ser do banco e pede o código que chegou por SMS. O que fazer?"
    opcoes: ["Passar o código, para não bloquearem a conta", "Não passar e desligar: esse código nunca deve ser dito a ninguém", "Passar só a metade"]
    resposta: 1
    explicacao: "O código é a segunda etapa. Quem pede o código já tem a sua senha, ou está tentando tomar a sua conta."
  - pergunta: "Qual é a forma mais fraca de segunda etapa?"
    opcoes: ["Código por SMS", "Aplicativo autenticador", "Chave de segurança física"]
    resposta: 0
    explicacao: "O SMS pode ser desviado se o golpista transferir o seu número para outro chip. Ainda assim, é bem melhor do que não ter segunda etapa."
---

## Como as contas são invadidas

Quase nunca é alguém "adivinhando" a sua senha na frente de um computador. Na vida real acontece assim:

- **Vazamento.** Um site onde você tem cadastro é invadido e a lista de e-mails e senhas vai parar na mão de criminosos.
- **Reaproveitamento.** Um programa pega essa lista e testa cada par de e-mail e senha em centenas de outros serviços. Se você repete senha, uma porta aberta abre todas.
- **Engano.** Uma mensagem ou ligação falsa convence você a digitar a senha em uma página falsa, ou a dizer um código.
- **Senha óbvia.** Programas testam em segundos as senhas mais comuns, nomes, datas e palavras de dicionário.

Para cada um desses caminhos há uma defesa simples.

## Regra 1: comprida

O que mais dificulta a vida de quem ataca é o **comprimento**. Uma senha curta cheia de símbolos é mais fraca do que uma senha longa feita de palavras comuns.

| Senha | Como é | Avaliação |
| --- | --- | --- |
| `123456` | Curta e óbvia | Cai na primeira tentativa |
| `Maria1987` | Nome e ano | Cai em pouco tempo: nomes e datas são testados primeiro |
| `P@ssw0rd!` | Palavra conhecida com trocas | Fraca: essas trocas todo programa de ataque conhece |
| `girafa panela trovão sexta` | Quatro palavras sem relação | Forte e fácil de lembrar |

Essa última é uma **frase-senha**: quatro ou cinco palavras ao acaso, que não formem uma frase conhecida. Invente a sua: os exemplos desta aula, por estarem publicados, já não servem. Nada de letra de música, versículo, time, nome de filho ou de bicho.

O NIST, instituto de padrões dos Estados Unidos, atualizou as suas diretrizes em 2025 no mesmo sentido: o que se deve exigir é **comprimento** (pelo menos 15 caracteres quando a senha é a única proteção), e não mistura obrigatória de maiúsculas, números e símbolos. As diretrizes também dizem para não obrigar ninguém a trocar de senha de tempos em tempos: senha se troca quando há sinal de que vazou.

```verificar
Qual destas é a senha mais forte?
- Br@sil2026
+ tomate janela violão quinze rio
- qwerty123456
> Compare o comprimento e pense em qual delas um programa testaria primeiro.
```

## Regra 2: uma para cada conta

Senha repetida é o que transforma o vazamento de uma loja qualquer na perda do seu e-mail. E o e-mail é a chave de todas as outras contas: é por ele que se pede "esqueci minha senha".

Ninguém consegue decorar dezenas de senhas compridas e diferentes. Não precisa.

### O cofre de senhas

Um **gerenciador de senhas** é um programa que guarda todas as suas senhas em um cofre trancado por **uma** senha mestra. Você decora só essa. Ele cria senhas longas e aleatórias para cada site e as preenche sozinho.

- **Bitwarden**: gratuito para uso pessoal, de código aberto, funciona no celular e no computador e sincroniza entre os dois.
- **KeePassXC**: software livre, guarda o cofre em um arquivo no seu próprio aparelho, sem depender de servidor de ninguém.
- Os cofres embutidos no celular e no navegador também são melhores do que repetir senha.

A senha mestra tem de ser a sua melhor frase-senha, e não pode estar em nenhum outro lugar.

**E anotar em papel?** Para quem não se dá bem com aplicativos, um caderno guardado em casa é mais seguro do que usar a mesma senha em tudo. O ladrão de senhas está na internet, não na sua gaveta. Só não deixe o papel junto do computador, na carteira ou na capa do celular.

## Regra 3: ligue a segunda etapa

A **verificação em duas etapas** (também chamada de dois fatores, 2FA) pede, além da senha, uma segunda prova de que é você. Com ela, quem descobre a sua senha continua do lado de fora.

| Tipo | Como funciona | Segurança |
| --- | --- | --- |
| **Código por SMS** | Chega por mensagem de texto | A mais fraca: o número pode ser transferido para o chip de um golpista. Melhor do que nada |
| **Aplicativo autenticador** | Um aplicativo no celular mostra um código que muda a cada trinta segundos, mesmo sem internet | Boa |
| **Chave de segurança** | Um pequeno aparelho que se encosta ou se pluga | A mais forte |
| **Códigos de reserva** | Lista de códigos de uso único, gerada na hora de ligar a segunda etapa | É o seu estepe: imprima ou copie à mão e guarde em casa |

Comece pelas contas que abrem as outras:

1. o **e-mail** principal;
2. o **gov.br** e os aplicativos de **banco**;
3. o **WhatsApp**: em *Configurações → Conta → Confirmação em duas etapas*, crie um PIN de seis dígitos;
4. as **redes sociais**.

### O código não se diz a ninguém

Banco, operadora, loja, pesquisa de opinião, "suporte do WhatsApp": **nenhum** deles liga ou manda mensagem pedindo o código que chegou no seu celular. Quem pede esse código está, naquele instante, tentando entrar na sua conta. Desligue.

```verificar
Chega um SMS com um código de seis dígitos que você não pediu. Em seguida, uma mensagem de um "amigo" diz que mandou o código para o seu número por engano e pede para você reenviar. O que é isso?
- Um engano comum, pode reenviar
+ Uma tentativa de tomar a sua conta: o código era a chave dela
- Um defeito do celular
> Quem recebe o código é o dono da conta que está sendo aberta.
```

## Se a senha vazou

1. **Troque a senha** daquela conta, e de qualquer outra em que você tenha usado a mesma.
2. **Ligue a segunda etapa**, se ainda não estava ligada.
3. **Encerre as sessões abertas**: quase todo serviço tem, nas configurações de segurança, um botão para sair de todos os aparelhos.
4. **Confira** se o endereço de e-mail e o telefone de recuperação continuam sendo os seus.

O site **Have I Been Pwned** mostra em quais vazamentos conhecidos um endereço de e-mail apareceu. Ele pede só o e-mail. Nunca digite uma senha sua em um site para "testar se é forte".

## Para quem se organiza em grupo

Em sindicato, coletivo ou associação, a conta do grupo é de todos, e a perda é de todos.

- A página, o e-mail e o perfil do grupo não podem depender de **uma** pessoa e de **um** celular. Tenham pelo menos duas pessoas responsáveis.
- Senha de conta coletiva não se manda por mensagem. Usem um cofre de senhas compartilhado.
- Quando alguém deixa o grupo, troca-se a senha no mesmo dia. Não é desconfiança; é rotina.

A última aula desta trilha volta a esse assunto.
