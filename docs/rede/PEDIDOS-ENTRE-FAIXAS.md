# Alumia: pedidos entre as frentes de trabalho

Uma frente pede à outra uma mudança num arquivo que não é dela (por exemplo, pôr um componente novo na linha do Início).
Escreva embaixo, com data, quem pede, o arquivo e o que pôr. Quem atende marca "feito" com o commit.

- Faixa 1: telas, linha, perfil, stories, atos, comunidade (`components/rede/**`, `app/[lang]/alumia/**`, `lib/rede/**` fora de fediverso e chat).
- Faixa 2: Fediverso e criptografia (`lib/rede/fediverso/**`, `app/api/fediverso/**`, `app/.well-known/**`, `components/rede/fediverso/**`, chat e `lib/sigilo.ts`).

## Cooperação (pedido do Jonathan, 10/11/2026)

"Caso você termine primeiro que a outra faixa, eu quero que vocês ajudem uma à outra, cooperando."

**Regra principal:** "as faixas vão se ajudar entre si, mas caso uma finalize todo o trabalho dela primeiro, a outra faixa vai dividir o serviço da faixa que ainda falta com ela."
Ou seja: quando uma faixa terminar, a faixa que ainda tem trabalho **divide o que falta** com ela (metade cada, sem arquivo em comum), escreve a divisão aqui e dá push. Até lá, ajudam uma à outra quando puderem.

- Quem terminar a própria lista primeiro escreve aqui "Faixa N terminou" e passa a ajudar a outra.
- Para não fazerem a mesma coisa: antes de pegar um item da outra faixa, escreva aqui "Faixa N assume: <item>" e dê push;
  só comece depois que o push entrar. A faixa dona pode responder "não, já estou nisso" e aí a ajudante pega outro item.
- A ajudante segue as regras de arquivo da dona (cada arquivo tem uma dona; mudar arquivo da outra só pelo item assumido),
  trabalha em ramo próprio e junta no master depois de testar, avisando aqui com o commit.
- Ordem de ajuda sugerida: da Faixa 1 para a 2, os ajustes por rede do Fediverso e as proteções do chat sem biblioteca;
  da Faixa 2 para a 1, a proteção contra ataques (F8) e o alcance (F9).

## Pedidos

### 10/11/2026 · Faixa 1 → Faixa 2 · "Combinar pelo chat" das caronas do ato

- **Onde:** `lib/rede/atos/combinar.ts` (Faixa 1) já tem o encaixe. A Faixa 2 só registra, no encaixe do chat
  (`components/rede/chat/encaixe.tsx` ou onde o chat privado carrega), a função que abre a conversa:
  `registrarConversaDaCarona(async ({ id, ato }) => { ... })`.
- **O que a função faz:** abre (ou cria) a conversa privada cifrada com a pessoa que publicou a carona `id` do ato `ato` e navega
  para ela. A pessoa sai de `interno.rede_ato_caronas.quem` (`supabase/migracoes/20261110-alumia-b1-atos.sql`), resolvida NO
  SERVIDOR numa função da Faixa 2 (security definer, `search_path = interno, pg_temp`, membro 18+, quem chama vê o ato por
  `interno.rede_ato_achar`, não bloqueado, limite de uso). Nenhuma resposta devolve o id nem o codinome de quem ofereceu antes de
  a conversa existir; nenhuma lista de quem combinou.
- **Enquanto não houver:** o quadro de caronas inteiro fica escondido atrás de `alumia-proximas` (sem o chat, a única saída
  seria combinar em público, e a conversa do ato mostra quem vai com quem). Com a flag ligada, o botão aparece desligado com a
  frase `caronas.combinarEmBreve` (6 idiomas), que avisa para NÃO combinar na conversa pública. Assim que o encaixe for
  registrado, o quadro aparece sozinho, sem flag. Quem atender marca "feito <hash>" aqui.

### 2026-11-12 · Faixa 1 avisa a Faixa 2 · a porta da entrada nas funções novas

A Onda 6 (`20261112-alumia-portas.sql`) põe uma porta em toda função `public.rede_*` e `alumia_*` de membro: com a trava da entrada ligada, só passa conta aprovada e com o segundo fator.

- Função `public.rede_*` criada depois (chat, Fediverso) nasce SEM a porta. Depois de rodar a migração de vocês, rode `select interno.alumia_trancar();` e confira que `abertas` volta vazia. `interno.alumia_entrada_ligar(true)` também roda isso.
- O que precisa responder a quem não tem conta (WebFinger, ator, caixa de entrada do Fediverso) tem de entrar na lista de exceções em `interno.alumia_porta_aberta`. O desenho está em `docs/rede/ENTRADA.md`.
- O pedido das caronas continua valendo: `registrarConversaDaCarona` em `lib/rede/atos/combinar.ts`; até lá os botões ficam desligados.

## Aviso da Faixa 1 para a Faixa 2 (2026-11-12)

- A Faixa 1 não mexe mais em chat, Fediverso nem `lib/sigilo.ts`. Para o chat e a privacidade do Fediverso vale o ramo
  `faixa2-wip-chat-blocos-e-privacidade`; o `chat-wip-fim` fica abandonado. Os pedidos P16 a P20 serão atendidos no ramo
  `alumia-onda7`.
- Ramos da Faixa 1: `alumia-onda6` (PR #38) e `alumia-onda7` (entrada nova, perfil público opcional, painel de controle da
  coordenação, linha com regra aberta, modo claro). Em `supabase/install.sql`, `i18n/rede/*.json`, `lib/recursos.ts` e neste
  arquivo, cada frente só acrescenta; quem junta as frentes é a Faixa 1.
- Ficam com a Faixa 2 as funções de conversa pedidas pela coordenação: chat em grupo e canais, lista de transmissão, salas
  de voz e palco, sala de estudo silenciosa, pedidos de mensagem, pastas de conversas, notas para si, lembrete de mensagem,
  soneca, resposta automática, caixa da moderação, chat do painel interno e a cifra dos posts privados (a tela é da Faixa 1:
  dizer aqui a interface a chamar).
- Decisões da coordenação que valem para as duas frentes: nenhuma cifra feita à mão; subdomínio próprio para o chat; canal
  grande e lista de transmissão cifrados até onde der; registro de acesso guardado por 6 meses (Marco Civil), em tabela à
  parte, lida só pela coordenação, apagado no fim do prazo. Há um recado mais longo, com as perguntas sobre a cifra, na pasta
  do plano (fora do repositório), em `faixa2-passagem/`.
- Toda função nova de membro precisa de `select interno.alumia_trancar();` depois da migração (porta da entrada).
- Responder aqui mesmo, embaixo, com data.
