# Aula ao vivo, gravação e reunião (Etapa 9, B31)

Decisão e comparação com fontes: `docs/plano-2026-11/notas/aula-ao-vivo.md`. Passo a passo da máquina: `infra/aula-ao-vivo/LEIA-ME.md`.

## Como funciona

- **Sala do instituto (Galène, MIT)**, em máquina com IP público. Chat, tela compartilhada, entrada só com áudio, gravação no servidor. O site não guarda nada do servidor de vídeo: ao clicar em "Entrar na aula" ou "Abrir a sala do professor", `POST /api/aula-ao-vivo/entrada` confere no banco (`aula_ao_vivo_ver`, com a sessão da pessoa) se a aula usa a sala do instituto, o estado dela e se a pessoa conduz; devolve o endereço do grupo com um token JWT HS256 de 90 s.
  - Quem conduz: permissões `op`, `present`, `record` (modera, publica e grava).
  - Quem assiste: só o chat (`GALENE_PERMISSOES_ALUNO`, padrão `message`). Nunca é gravado.
  - Entra na sala só quem passa pela rota; os grupos não têm senha nem usuário.
- **Painel, Aulas ao vivo, Marcar a aula:** terceira opção "Sala do instituto (aula com gravação)" (só aparece com `NEXT_PUBLIC_GALENE_URL`). O link do professor é a própria página da aula, botão "Abrir a sala do professor". A aula guarda só o endereço do servidor em `sala_externa` (sem mudança no banco).
- **Gravação depois:** campo "Gravação" da aula. Link de PeerTube (domínio de `NEXT_PUBLIC_VIDEO_HOSTS`) ou YouTube toca na página da aula, só depois do clique (PeerTube sem P2P).
- **Plano B:** sem as variáveis, nada da sala própria aparece e a rota responde `desligada`. A aula pode usar a transmissão do YouTube do instituto (já existia) ou um link de transmissão do PeerTube no endereço da sala; ambos embutidos só depois do clique.
- **Reunião interna:** colar o link do Google Meet no endereço da sala; abre fora do site (rótulo "Abrir no Google Meet").
- **Jitsi** continua como estava (chamadas de canal, estudo em grupo e aulas já marcadas com ele).

## Variáveis (Vercel)

`NEXT_PUBLIC_GALENE_URL`, `GALENE_JWT_KEY` (segredo, só no servidor), `GALENE_GRUPOS` e `GALENE_PERMISSOES_ALUNO` (opcionais), `NEXT_PUBLIC_VIDEO_HOSTS` (já existente; domínios PeerTube). `next.config.ts` libera o endereço da sala no `frame-src` e na `Permissions-Policy`.

## Arquivos

`lib/aula-sala.ts` (token, grupos, tipos de link, puro) · `app/api/aula-ao-vivo/entrada/route.ts` · `components/aovivo/SalaPropria.tsx`, `TocadorPeerTube.tsx`, `Sala.tsx` · `components/painel/AoVivo.tsx` · `infra/aula-ao-vivo/` · `scripts/testar-aula-ao-vivo.mjs` (`npm run testar:aula-ao-vivo`).

## Pendências (antes da primeira aula real)

Teste de campo do passo 6 do LEIA-ME: permissão do aluno, pasta e formato da gravação, quadro dentro da página, vídeo no 3G atrás do NAT da Oracle, e cota grátis da Oracle para a segunda máquina. Texto de gravação em `/privacidade`: Etapa 12. Os textos novos estão em português (como os vizinhos do Jitsi); tradução para os outros idiomas fica para a revisão de i18n.
