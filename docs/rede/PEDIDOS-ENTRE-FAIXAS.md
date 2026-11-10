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
- **Enquanto não houver:** o botão "Combinar pelo chat" aparece desligado com a frase "O chat das caronas chega em breve" (já
  nos 6 idiomas, `i18n/rede/atos/*.json` → `caronas.combinarEmBreve`). Quem atender marca "feito <hash>" aqui.
