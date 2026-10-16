# Texto de privacidade para o assistente de reforço

Este arquivo guarda o trecho que entra em `content/paginas/privacidade.md` **no dia em que o assistente for ligado em produção** (*Controles do site → Assistente de reforço → Ligar o assistente*). Ele fica aqui, fora de `content/`, porque tudo o que está em `content/` vai ao ar na publicação seguinte, e a página não pode descrever um tratamento de dados que ainda não acontece. Se o assistente for desligado de vez, tire o trecho da página.

A página de privacidade existe só em português; nos outros idiomas o site mostra o original com o aviso de "ainda não traduzido". Não há outra versão para atualizar.

## Antes de publicar, confirme

1. A função `assistente` está publicada, com a chave, e o teste do painel deu certo.
2. As condições do serviço contratado (os termos comerciais da Anthropic para a API, na conta que gerou a chave) sobre guarda e uso do que é enviado. O texto abaixo não promete prazo nem "não guarda": diz que o serviço trata o conteúdo conforme as regras dele. Se a conta tiver uma configuração mais restrita (por exemplo, sem guarda), dá para dizer isso; se não tiver, não diga.
3. A data no alto da página.

## O que muda na página

### 1. Em "Os serviços que mantêm o site no ar"

Se a frase sobre "a única situação em que um texto escrito por você é enviado a outra empresa" já estiver lá (por causa da avaliação automática da Comunidade), troque "A única situação" por "As situações" e cite as duas seções. Se não estiver, troque

> O instituto não entrega dados a anunciantes, corretores de dados nem a nenhuma outra empresa.

por

> O instituto não entrega dados a anunciantes nem a corretores de dados. A única situação em que um texto escrito por você é enviado a outra empresa está explicada abaixo, em "Assistente de reforço".

### 2. Seção nova, logo depois de "Se você tem uma conta"

```markdown
## Assistente de reforço

Quando não há voluntário disponível, quem tem conta pode tirar uma dúvida com o assistente automático, na página [Aula de reforço](/reforco) e no resolvedor passo a passo ("Foto do exercício"). O assistente usa uma ferramenta de inteligência artificial de uma empresa de fora, a Anthropic, com servidores fora do Brasil. Ele só é usado quando você aperta o botão de perguntar ou escolhe uma foto; escrever no formulário não envia nada.

O que vai para esse serviço: o texto da sua dúvida e o assunto, a disciplina escolhida, o idioma do site, os títulos e endereços das aulas do próprio site sugeridas para a sua dúvida e, se você mandar, a foto do exercício. A foto é redesenhada e reduzida no seu aparelho antes de sair, e com isso perde o que a câmera grava junto (lugar, data, modelo do aparelho). O pedido sai do servidor do instituto, não do seu aparelho: o instituto não acrescenta o seu nome, o seu e-mail, o identificador da sua conta nem o seu endereço de rede. Se você mesmo escrever um dado pessoal na dúvida, ou se ele aparecer na foto, ele vai junto, porque faz parte do que você mandou. Por isso o site pede, ao lado do botão, que você não escreva dados pessoais e que fotografe só o exercício.

O serviço externo trata o que recebe de acordo com as regras dele, e pode guardar o conteúdo por um período para o próprio funcionamento e para a prevenção de abuso; o instituto não controla esse prazo.

O instituto não guarda a sua pergunta, a foto nem a resposta. Guarda só quantas perguntas cada conta fez em cada dia, para aplicar o limite diário, e apaga essa contagem depois de 90 dias.

A resposta é automática e pode errar. Ela não substitui professor, médico, advogado nem nenhum outro profissional, e o próprio assistente indica um serviço adequado quando a dúvida pede isso. Se a resposta não resolver, peça reforço a um voluntário pelo formulário da mesma página.
```

## Antes de desligar

Nada a apagar: o banco não tem pergunta, foto nem resposta guardadas. Os contadores somem sozinhos em 90 dias.
