# Segurança das pessoas

O site é feito para gente que estuda, se organiza e fala de política, e por isso pode ser alvo. Este documento diz quem
pode querer atacar, o que cada ataque busca e o que o instituto faz contra cada um. Ele complementa a política de
privacidade (`content/paginas/privacidade.md`) e o guia público (`/seguranca-digital`).

## Quem pode atacar e o que busca

| Quem | O que quer | Como costuma agir |
| --- | --- | --- |
| Grupos de extrema direita organizados | Intimidar, desmoralizar, tirar o site do ar | Ataque coordenado de comentários, denúncias falsas em massa, exposição de dados (doxxing), prints fora de contexto |
| Assediadores individuais | Perseguir uma pessoa | Mensagens repetidas, contas novas depois de banidas, procurar endereço e família |
| Golpistas | Dinheiro e contas | Anúncio falso no Mural, link de "suporte", pedido de código do WhatsApp |
| Quem quer derrubar o site | Tirar o acesso do ar | Excesso de pedidos, abuso de formulários, varredura de falhas |
| Quem tem poder sobre a pessoa (patrão, escola, família, Estado) | Saber quem participa | Cruzar nome, foto, rede social e presença em núcleo |

## O que o site faz

**Guardar o mínimo**
- Estudar não pede conta. A conta da Comunidade guarda só o e-mail; o nome visível nasce como codinome.
- Nada de rastreamento de publicidade. As contagens das aulas ("abriu", "terminou", "ajudou") são agregadas por aula, sem
  identificar ninguém, e só aparecem com cinco ou mais.
- Núcleos: o painel guarda só cidade, estado e quem da equipe acompanha. O mapa público mostra apenas os que a
  coordenação publicou, com ponto de encontro público e contato do próprio núcleo, nunca de uma pessoa.
- Lista de presença do kit do núcleo: só nome ou apelido, em papel, com quem media.
- Área infantil: nada sai do aparelho; não há conta, placar nem coleta.

**Barrar a exposição**
- Rede Lúcia, fórum e Mural barram telefone, CPF e e-mail antes de publicar.
- "Estão me expondo" (página Denunciar e o denunciar de cada post): quem tem conta tira o post da Rede do ar na hora; a
  mediação é avisada e decide depois. Limite de três por pessoa por dia, para não virar arma de censura.
- Perfil invisível, alcance por post (todo mundo, quem me segue, só a equipe), bloqueio e palavras silenciadas.
- Núcleos fechados da Rede: entra só quem recebe o código, e quem cuida troca o código quando precisa.

**Aguentar ataque coordenado**
- Pausa geral de envios, modo de segurança da Comunidade (tudo passa pela mediação), suspensão de conta em emergência e
  interdição de áreas do site, todos reversíveis e registrados.
- Limites por pessoa e por origem em todas as funções que escrevem (`interno.limite`).
- Registro público de moderação, por semana, sem nomes: transparência contra a acusação de censura.

**Proteger a equipe**
- Segundo fator obrigatório para funções sensíveis, sessões antigas expiram, botão de pânico (encerra tudo e avisa a
  coordenação) e registro de quem abriu dados sensíveis (lista de e-mails, termos assinados, vitrine de saúde).
- Conversas e Mural da equipe cifrados de ponta a ponta no aparelho.
- Linha de apoio: férias marcadas, termômetro anônimo e críticas anônimas.

## O que fica com as pessoas

O site não protege um celular desbloqueado nem uma senha repetida. O guia `/seguranca-digital` ensina o básico: senha
diferente por conta, segundo fator, confirmação em duas etapas do WhatsApp, Signal para conversa sensível, rosto borrado
em foto de ato e o que fazer quando alguém tenta expor.

## O que ainda falta

- Borrar rostos e tirar a localização das fotos automaticamente na Rede (hoje a Rede não aceita foto).
- Lista de bloqueio compartilhada entre pessoas de confiança.
- Espelho estático do site fora da Vercel, para o caso de derrubada (ver `docs/ESPELHO-E-COPIAS.md`).
