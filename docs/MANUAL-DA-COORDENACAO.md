# Manual da coordenação

Este é o texto único do manual. Ele vive aqui e aparece igualzinho dentro do painel, em **Minha conta, aba Ajuda** (o painel lê uma cópia gerada deste arquivo: `npm run manual-painel`). Para mudar o manual, mude só este arquivo e rode o comando.

Ele é curto de propósito. Diz onde fica cada coisa, como fazer as tarefas de todo dia, o que é seguro e o que pede uma segunda pessoa. Quando algo ainda não existe no painel, o texto diz "ainda não" em vez de fingir.

## 1. Como o painel está arrumado

O menu da esquerda tem oito espaços. No celular, a barra de baixo leva a Mesa, Escrever, Revisar, Atender e Mais.

| Espaço | O que tem | Para quem |
|---|---|---|
| **Mesa** | O que espera por você hoje, em ordem: pendências, recados, avisos de segurança, saúde da casa e atalhos | todo mundo (cada função tem a sua Mesa) |
| **Escrever e produzir** | Escrever, aulas em vídeo e ao vivo, Estúdio de design, podcast, pautas, materiais, divulgação, disciplinas e trilhas | quem produz |
| **Revisar e publicar** | Fila de revisão, triagem, Vale o Escrito (curadoria), traduções, acervo por dentro | revisão, curadoria, coordenação |
| **Comunidade e atendimento** | Alumia (denúncias e fila, com Rede: propostas e Alumia: semeadura dentro), aula de reforço, Mural dos Trabalhadores, Gaveta Aberta, boletim, Mural de Saúde | mediação, coordenação |
| **Equipe** | Conversas, Mural da equipe, assembleias, núcleos, departamentos, voluntários e convites, supervisão, horas, termos, estatísticas, avisos à equipe | todo voluntário (parte só da coordenação) |
| **Site e operação** | Controles do site (faixa e pausa de envios), aviso de abertura, rádio, apoio e transparência, erros relatados, estado técnico | coordenação e desenvolvimento |
| **Segurança** | Segurança e sucessão, interdição e expurgo, registro de atividades | coordenação, coordenação pedagógica, supervisão |
| **Minha conta** | Perfil, contribuições, proteção da conta, e esta Ajuda | todo mundo |

Atalhos que valem em qualquer tela:

- **Ctrl K** (ou o campo "Ir para...") abre a busca: digite parte do nome da seção, sem se preocupar com acento.
- **Esc** fecha janelas. As janelas de confirmação seguram o foco: dá para responder só com o teclado.
- O botão **Menu** recolhe o menu lateral até os ícones, no computador.
- **Modo leve** (sem animação, para aparelho fraco) e **modo foco** (só o essencial no menu) ficam na busca do painel.
- Tema claro, escuro e idioma do painel: Minha conta, aba Perfil. Ficam guardados só neste aparelho.

Você só vê o que a sua função permite. Se falta uma seção, é porque a função não tem aquele acesso: peça à coordenação. A Mesa nunca dá acesso novo.


**Menu mais curto (09/11/2026).** Algumas seções saíram do menu e abrem pelo "Também aqui", a linha de botões logo
abaixo do título da seção-mãe, e pela busca do painel (Ctrl+K). Continuam com o mesmo endereço e as mesmas permissões:
Controles do site, Controles avançados, Operação do site, Estado técnico e Aviso de abertura ficam em **Centro de
controle**; Reuniões, em Conversas e reuniões; Rede: propostas e Alumia: semeadura, em **Alumia**; Compartilhadas comigo
e Minhas contribuições, em Meus envios; Resumo diário e Pesquisa dos 12 eixos, em Minha conta; Termos assinados, em
Voluntários e convites; Triagem, em Fila de revisão.

## 2. Tarefas comuns, passo a passo

### Aprovar uma aula (ou matéria)

1. Vá em **Revisar e publicar, Fila de revisão**. O número ao lado do nome é o que espera.
2. Abra o item. Leia o texto, as fontes e os pareceres que já chegaram. Setas do teclado percorrem a lista.
3. Quem revisa dá o **parecer** (favorável ou pedir ajustes), com texto. Só a curadoria e a coordenação decidem.
4. Quem decide escreve um recado (opcional) e escolhe **Aprovar** ou **Não aprovar**.
5. Aprovar **não publica na hora**: o texto entra no site na próxima publicação (a rotina roda uma vez por dia). Para antecipar, veja "Publicar agora" abaixo.
6. Envios do público passam antes pela **Triagem**: "Liberar para a fila de revisão" não aprova nada; "Barrar" exige um recado, que vai a quem enviou se a pessoa tiver conta.

Antes de aprovar, confira se cada afirmação importante tem fonte e se a fonte diz mesmo aquilo (a lista completa está em Biblioteca da equipe, checklist de revisão).

### Publicar agora

1. Em **Escrever e produzir, Disciplinas e trilhas**, o botão **Mudanças** mostra o que está esperando e o que está a caminho do site.
2. Com mudanças a caminho, a coordenação vê **Publicar agora**: roda a rotina de publicação sem esperar a da hora.
3. O site confere tudo antes de ir ao ar; o GitHub às vezes atrasa. Se não aparecer em alguns minutos, olhe **Site e operação, Estado técnico**.

### Moderar a comunidade

1. **Comunidade e atendimento, Alumia** tem a fila de mensagens retidas, as denúncias, as anotações e o filtro de palavras. O número no menu é a soma do que espera.
2. Em cada mensagem retida, leia e decida: liberar ou recusar. Há **respostas prontas** para o recado, para não escrever tudo de novo.
3. Denúncia que fala de menores, ameaça, dados expostos, violência ou autolesão vai na frente. Quem denuncia nunca aparece para ninguém.
4. **Banir quem escreveu** é o último recurso, para quem insiste depois de ter mensagens recusadas. A conta banida continua lendo, mas não envia mais nada. Escreva o motivo.
5. Num ataque coordenado, use o modo de segurança da Alumia (tudo passa pela mediação) e a **pausa geral de envios** em Site e operação, Centro de controle, Controles do site. Os dois se desfazem e ficam no registro.
6. Mural dos Trabalhadores, Gaveta Aberta e Aula de reforço seguem o mesmo ritmo: abrir o item, conferir, publicar ou recusar com recado.

### Ligar um recurso novo

Os recursos novos entram **desligados**. O caminho seguro, que vale para todas as páginas, é a variável do site:

1. Em `NEXT_PUBLIC_RECURSOS` (Vercel, Settings, Environment Variables, só em Production; ou só em Preview para testar antes), escreva os nomes separados por vírgula. Exemplo: `todos,escola`.
2. Faça um novo deploy: o valor é lido quando o site é montado, não ao vivo.
3. Três recursos **só ligam pelo nome**, porque `todos` não os liga: `escola`, `vale-o-escrito` e `rede-v2`. Cada um tem uma condição antes de ligar (texto da Escola entregue; curadoria e assessoria jurídica conferindo o Vale o Escrito; migrações SQL da Rede rodadas no Supabase). Quem liga é a coordenação, depois de ler o arquivo do recurso em `docs/`.
4. Para desligar, tire o nome (ou escreva `-nome`) e faça o deploy de novo. O site volta a ser o de antes.

Também há um interruptor no painel (**Site e operação, Controles avançados**, aba de recursos; só coordenação e vice). Desligar ali vale como interruptor de emergência. Ligar `escola`, `vale-o-escrito` ou `rede-v2` só abre um **pedido de segunda pessoa**: outra pessoa da coordenação ou da vice-coordenação precisa confirmar em **Segurança, Confirmações** (o pedido vence em 48 horas). Atenção: páginas montadas no deploy só mudam no próximo deploy; por isso, para conferir se o recurso apareceu, faça também o passo 2.

### Responder à imprensa

1. **Porta-voz** é uma função que a coordenação dá a quem leva a palavra do instituto. Ninguém fala em nome do instituto sem ela. A caixa abre em **Comunidade e atendimento, Caixa de imprensa** (só coordenação e porta-voz).
2. A lista mostra os pedidos feitos em /imprensa, com veículo, prazo e situação (Novo, Em andamento, Respondido, Arquivado). Abra o pedido, leia a mensagem e clique em **Em andamento** para os colegas verem que alguém cuida.
3. O painel **não envia nada em nome de ninguém**: a resposta sai pelo e-mail do instituto, por escrito, com o que já é público no site. Depois clique em **Respondido** (ou **Arquivar**). A anotação da equipe é opcional e a pessoa não a vê.
4. Pedido respondido ou arquivado é eliminado do banco em 180 dias.
5. Não passe dados de pessoas (nome, contato, núcleo de alguém) a jornalista. O instituto guarda o mínimo justamente para isso.
6. Direito de resposta e correção de reportagem do Vale o Escrito seguem o fluxo da curadoria (abaixo).

### Curadoria do Vale o Escrito

1. **Revisar e publicar, Vale o Escrito: curadoria**. A fila reúne as sugestões do robô e do público; também dá para fazer entrada manual.
2. Toda entrada precisa de **fonte, data e trecho**, e de **situação jurídica escrita** (suspeito, denunciado, réu, condenado em primeira instância, condenado com trânsito em julgado, absolvido), com "segundo [fonte]" quando for o caso.
3. Pessoa só entra se for pública no caso e com fonte. **Nunca** vítima, criança, adolescente ou testemunha.
4. **Aprovar e publicar** só passa se a conferência passar. Ao aprovar, o painel pede o arquivo de cada fonte no Internet Archive.
5. **Devolver** (com nota) e **Recusar** tiram a sugestão da fila. **Mesclar** junta duplicatas. **Retirar entrada** tira do ar uma ficha já publicada.
6. Mudou a situação (absolvição, arquivamento, nova decisão)? Atualize com fonte nova. O histórico aparece na ficha, sem nome de ninguém.
7. **Correções**: a meta é responder em 7 dias. Direito de resposta aceito fica ao lado da ficha.
8. O Vale o Escrito só aparece no site com o recurso `vale-o-escrito` ligado (ver acima).

### Rede Lúcia: propostas e moderação

1. **Comunidade e atendimento, Rede: propostas de comunidade** (só coordenação e coordenação pedagógica). Comunidade nova só nasce por proposta.
2. Leia o objetivo e as regras, confira os moderadores indicados e escolha **Aprovar** (a comunidade já entra no ar) ou **Recusar**. Recusar exige o motivo, com pelo menos 10 letras.
3. Denúncias da Rede entram na fila por prioridade; as de prioridade 1 avisam a coordenação e a mediação. Post de núcleo fechado não é lido pela equipe geral: abrir o conteúdo fica registrado.
4. A Rede v2 só existe com o recurso `rede-v2` ligado. Desligado, a Rede e o Fórum de hoje seguem como estão.
5. **Comunidade e atendimento, Alumia: semeadura** (coordenação): o roteiro de docs/rede/SEMEAR.md em números, com os posts reais de cada comunidade e quantas pessoas moderam (a meta é 2). Só números, sem nome; nada ali publica.

### Convidar e cuidar da equipe

1. **Equipe, Voluntários e convites**: convidar, confiar funções e acompanhar. Quem dá e tira funções é a coordenação (a supervisão cuida das funções de trabalho).
2. **Termos assinados** guarda o texto exato que cada pessoa aceitou, a versão, a data e a impressão digital. Ninguém apaga. Quem aceitou sem o texto guardado vê o termo de novo ao abrir o painel.
3. **Departamentos** mostra a meta do mês, o quadro da semana e os pedidos entre departamentos. Em Voluntários, o quadro "departamentos com pouca gente" é clicável e lista quais são.
4. **Avisos à equipe** põe um quadro por cima do painel de todos (ou de algumas funções) até cada pessoa fechar.
5. **Pesquisa dos 12 eixos** é opcional e anônima. A coordenação vê só média e distribuição da equipe, e só com 5 respostas ou mais, nunca a resposta de alguém. Não peça a ninguém que responda.

## 3. O que é seguro e o que pede uma segunda pessoa

**Seguro, pode fazer sozinho** (dá para desfazer ou não tira nada do ar):

- Escrever, dar parecer, comentar, pedir ajustes, devolver com nota.
- Liberar da triagem, recusar mensagem retida, usar resposta pronta.
- Pausar envios, ligar o modo de segurança da Alumia, mudar a faixa do alto. Tudo reversível e registrado.
- Suspender uma conta em emergência (a coordenação é avisada, e a supervisão reativa).
- Fixar e desafixar seções, trocar de Mesa, tema, idioma.

**Pede cuidado, e o painel confirma antes** (janela com o nome da ação; nas que apagam ou tiram do ar, o foco começa em "Cancelar"):

- Aprovar e publicar uma ficha do Vale o Escrito, retirar uma entrada, recusar um pedido.
- Banir, apagar a aula, encerrar, cancelar.
- Publicar agora.

**Pede uma segunda pessoa** (a ação só vale depois que outra pessoa, com função de decisão, aprova):

- **Interdição** (Segurança, Interdição e expurgo): tirar o site ou uma área do ar por um tempo, e a **liberação** depois. A supervisão pede; a coordenação ou a coordenação pedagógica aprova e aplica.
- **Expurgo**: apagar de uma vez uma chuva de spam. A tela mostra primeiro quanto vai sumir. A coordenação confirma digitando EXPURGAR; a supervisão só pede, e outra pessoa aprova.
- **Segundo fator obrigatório, coordenação pedagógica e ordem de sucessão** (Segurança e sucessão): mude com calma, depois de combinar na equipe.

- **Zerar o segundo fator ou os aparelhos de alguém** e **ligar a segunda avaliação externa** (Segurança, Confirmações): uma pessoa da coordenação pede, com o motivo, e outra confirma. Zerar o segundo fator também encerra as sessões da conta; zerar aparelhos não mexe nas chaves das conversas cifradas. O pedido vence em 48 horas e quem pediu não confirma o próprio pedido. Quem perdeu o acesso ainda pode usar os códigos de recuperação.

**Nunca**:

- Mande senha, código de recuperação, código de WhatsApp ou o link de quem pede "suporte" por canal nenhum. Ninguém da equipe pede isso.
- Tire print de conversa, de denúncia ou de lista de pessoas e compartilhe fora do painel.
- Publique nome, foto, telefone, CPF, endereço ou núcleo de alguém sem a pessoa ter pedido.
- Prometa a ninguém reconhecimento oficial além do comprovante de voluntariado e do certificado de horas que o painel emite.

## 4. Se algo der errado

- **Não consigo entrar**: use um código de recuperação (Minha conta, Segurança, mostra quantos restam). Sem eles, fale com a coordenação por outro canal.
- **Aprovei e não apareceu**: aprovar não publica na hora. Espere a rotina diária ou use Publicar agora; depois veja Estado técnico.
- **Fiz uma ação errada**: o **Registro de atividades** (Segurança) mostra o que foi decidido, por quem e quando. A maioria das proteções se desfaz; avise a coordenação.
- **Parece um ataque**: pausa geral de envios, modo de segurança da Alumia e, se for grave, um pedido de interdição. Registre o que viu.
- **Erro no painel**: **Site e operação, Erros relatados** e **Estado técnico**. Conte à coordenação o que você clicou e o que apareceu.
- **Dúvida de uma palavra** (triagem, parecer, retido, passagem de bastão): Ctrl K, "Glossário do painel".

Quando este manual disser uma coisa e a tela outra, vale a tela, e vale avisar a coordenação para o manual ser corrigido.
