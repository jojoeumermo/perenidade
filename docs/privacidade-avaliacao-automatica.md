# Texto de privacidade para a avaliação automática da Comunidade

Este arquivo guarda o trecho que entra em `content/paginas/privacidade.md` **no dia em que a segunda avaliação for ligada em produção** (`select public.comunidade_avaliacao_externa(true);`). Ele fica aqui, fora de `content/`, porque tudo o que está em `content/` vai ao ar na publicação seguinte, e a página não pode descrever um tratamento de dados que ainda não acontece.

A página de privacidade existe só em português; nos outros idiomas o site mostra o original com o aviso de "ainda não traduzido". Não há outra versão para atualizar.

## Antes de publicar, confirme

1. A função `avaliar-comunidade` está publicada e a segunda avaliação está ligada no banco.
2. As condições do serviço contratado sobre guarda e uso do conteúdo enviado, na conta que gerou a chave. O texto abaixo não promete prazo nem "não guarda": diz que o serviço trata o conteúdo conforme as regras dele. Se a conta tiver uma configuração mais restrita (por exemplo, sem guarda), dá para dizer isso; se não tiver, não diga.
3. A data no alto da página.

## O que muda na página

### 1. Em "Os serviços que mantêm o site no ar"

Trocar a frase

> O instituto não entrega dados a anunciantes, corretores de dados nem a nenhuma outra empresa.

por

> O instituto não entrega dados a anunciantes nem a corretores de dados. A única situação em que um texto escrito por você é enviado a outra empresa está explicada abaixo, em "Avaliação automática na Comunidade".

### 2. Seção nova, logo depois de "Se você tem uma conta"

```markdown
## Avaliação automática na Comunidade

Tudo o que é escrito na [Comunidade](/comunidade) passa por uma avaliação automática antes de aparecer. Ela existe para manter a convivência respeitosa, segura e voltada ao estudo: ajuda a barrar spam, assédio, ameaças, discurso de ódio e outras violações das regras da página.

Essa avaliação tem duas partes. A primeira roda dentro do próprio sistema do instituto e olha sinais simples, como palavras de uma lista, endereços de sites e texto repetido. A segunda usa uma ferramenta de inteligência artificial de uma empresa de fora, com servidores fora do Brasil: o texto da sua mensagem (o título e o corpo, e nada além disso) é enviado a esse serviço, que devolve uma classificação.

O pedido leva só o texto. O instituto não acrescenta o seu nome, o seu e-mail, o identificador da sua conta nem o seu endereço de rede. Se você mesmo escrever um dado pessoal dentro da mensagem, ele vai junto, porque faz parte do texto. O serviço externo trata o que recebe de acordo com as regras dele, e pode guardar o conteúdo por um período para o próprio funcionamento e para a prevenção de abuso; o instituto não controla esse prazo.

Com o resultado, três coisas podem acontecer: a mensagem aparece na hora, é barrada, ou fica esperando a leitura de uma pessoa da mediação. Nenhuma conta é suspensa ou banida por decisão automática: isso é sempre decisão de gente.

Avaliação automática erra, para os dois lados. Por isso os casos de dúvida vão para uma pessoa, a mediação pode liberar o que foi barrado por engano, e toda decisão pode ser revista pela coordenação. Se uma mensagem sua foi barrada e você acha que não devia, escreva pela página [Denunciar](/denunciar).

O instituto guarda, junto de cada mensagem, o resultado da avaliação (publicada, barrada ou enviada para revisão) e o motivo, pelo tempo em que a mensagem existir. A classificação detalhada devolvida pelo serviço não é guardada.

A avaliação automática vale só para a Comunidade. Anúncios do Mural dos Trabalhadores e contribuições para o acervo continuam sendo lidos por pessoas da equipe antes de irem ao ar, e não são enviados a esse serviço.
```

### 3. Em "Com que base a lei permite isso"

Acrescentar ao item do legítimo interesse:

> **Legítimo interesse**, para os registros de segurança do painel, a proteção contra ataques e abuso e a avaliação automática das mensagens da Comunidade.

### 4. Em "Seus direitos"

Acrescentar um item:

> - **Pedir que uma pessoa reveja uma decisão automática** sobre uma mensagem sua na Comunidade: página [Denunciar](/denunciar).

## O que o texto afirma e de onde vem cada afirmação

| Afirmação | Onde está no código |
| --- | --- |
| Só o texto é enviado | `supabase/functions/avaliar-comunidade/moderacao.mjs`: o corpo do pedido tem `model` e `input`, mais nada |
| Sem nome, e-mail, conta ou endereço de rede | A função busca o texto por `comunidade_para_avaliar`, que devolve só `texto`; o pedido sai do servidor da função, não do navegador de quem escreveu |
| Ninguém é banido automaticamente | `comunidade_avaliada` e `interno.decidir_externa` não tocam em `perfis` nem em `banimentos` (conferido em `npm run testar:banco`) |
| A classificação detalhada não é guardada | `comunidade_avaliada` grava só `avaliacao` e `motivo` |
| Mural e contribuições não passam por ela | Só `topico_criar` e `responder` chamam a avaliação |
