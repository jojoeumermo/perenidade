# Mesa organizada e Mesa por função (Etapa 8, pacote mesa)

Itens do plano: B39 (Mesa organizada, uma por função) e B14 (departamentos com pouca gente, clicáveis).

## O que mudou

A Mesa tinha tudo no mesmo fluxo. Agora são cinco partes que não se misturam, cada uma com título, contagem e âncora:

| Parte | O que mora nela |
|---|---|
| Pendências | aula ao vivo agora, férias, primeira semana, a lista do que espera a pessoa (com filtro Revisar, Responder, Fazer), o último rascunho, as horas do certificado, as tarefas de 5 a 30 minutos |
| Recados | os recados do painel e os agradecimentos da equipe |
| Avisos de segurança | contas suspensas, publicação parada há mais de três horas, pedidos da supervisão, denúncias abertas |
| Saúde da casa | equipe e envios do público, faixa do alto, conquistas da equipe, termômetro da semana, o que chegou no site |
| Atalhos | os da função, mais as seções fixadas, sugerir ao marketing, pedir função, guia de primeiros passos e dica do tutorial |

Nada que a Mesa mostrava foi tirado (o teste confere peça por peça). Só mudou de lugar. Uma faixa no alto da Mesa lista as cinco partes com a contagem de cada uma; um clique leva até a parte.

## Mesa por função

Regra em `components/painel/mesa-funcoes.ts` (sem React, testável no Node); desenho em `components/painel/MesaOrganizada.tsx`; `Painel.tsx` só junta as peças que já existiam (`Mesa`).

Sete funções mais a Geral (quem ainda não tem função):

| Mesa | Papéis do banco | Começa por | Atalhos de função |
|---|---|---|---|
| Coordenação | coordenação, vice, supervisão | avisos de segurança, depois pendências, casa | pessoas, departamentos, supervisão, interdição, site, estatísticas, registro, avisos |
| Revisão | revisão, tradução | pendências (fila de revisão primeiro) | fila, traduções, juntas, escrever, fontes, biblioteca |
| Comunicação | jornalismo, marketing, porta-voz, design | pendências (posts para sair primeiro), atalhos | divulgação, estúdio, pautas, podcast, ao vivo, materiais |
| UI/UX e Desenvolvimento | desenvolvimento | saúde da casa, depois segurança | erros, técnico, site, estúdio, estatísticas, registro |
| Curadoria | curadoria | pendências (triagem, gaveta) | Vale o Escrito, acervo por dentro, triagem, gaveta, fontes, biblioteca |
| Moderação | mediação, saúde | avisos de segurança (denúncias, retidas) | comunidade, mural, saúde, reforço, gaveta, triagem |
| Educador | educação, educação secundária, mentoria | pendências (reforço primeiro) | escrever, videoaulas, exercícios, reforço, currículo, aulas a escrever |
| Geral | sem função, representante | pendências, recados | escrever, minhas, tarefas, caderno, conversas |

Decisões:

- Design vai para a Mesa de Comunicação (a arte é do Marketing, B10). O nome "UI/UX e Desenvolvimento" já aparece na Mesa; o pacote `departamentos-termos` faz a fusão no resto do painel.
- Supervisão usa a Mesa da Coordenação (acompanha equipe e segurança). Se a coordenação preferir uma Mesa própria, basta uma entrada nova em `FUNCOES_DA_MESA`.
- A ordem muda, a soma não: a prioridade só decide o que sobe. Nenhuma pendência some por causa da função (teste).
- Quem tem mais de uma função abre na de maior responsabilidade e troca em "Trocar de Mesa". A escolha fica só neste aparelho (`localStorage`, com `try/catch`). A coordenação pode ver a Mesa de qualquer função, só para conhecer o que cada equipe enxerga: as pendências continuam as da própria pessoa e só aparecem as seções que ela pode abrir.
- Os atalhos e as pendências só levam a seções que a pessoa já tem. A Mesa não dá acesso novo.
- O bloco de segurança fica visível mesmo vazio ("Nenhum aviso de segurança") nas Mesas de Coordenação, Desenvolvimento e Moderação; nas outras só aparece quando há aviso.

### Sem banco

A Mesa por função é regra no código: não há SQL nem tabela neste pacote. O item do plano "Mesa por função" na lista dos 18 itens de back-end (guardar a escolha no banco, ajustar por função sem publicar de novo) continua para o pacote `backend-1` ou `backend-2`; a regra de hoje fica pronta para ser trocada por uma leitura do banco sem mexer na tela.

## Departamentos com pouca gente (B14)

Em Pessoas, o quarto quadro do alto ("departamentos com pouca gente") agora é botão. Clicar abre a lista dos departamentos com uma pessoa na equipe ou nenhuma (`LIMITE_DE_POUCA_GENTE`, em `mesa-funcoes.ts`), cada um com a contagem ("1 pessoa", "ninguém ainda"). Clicar num departamento filtra a lista abaixo por ele. O botão tem `aria-expanded` e `aria-controls`. Quando nenhum departamento está com pouca gente, o quadro segue como número simples. A lista de departamentos e a regra de contagem são as de antes; só ganhou o clique.

## Visual

Só classes `pn-*` e tokens do tema novo (nenhuma cor escrita à mão), botões e abas dos componentes de `ui/`. As peças antigas (Recados, Situação, Termômetro e outras) mantêm o visual delas, que o tema novo já reveste.

## Lateral direita e recados agrupados (T27, 06/11/2026)

O pedido: "essa parte aqui do painel interno vc poderia colocar tipo na lateral direita da Mesa, pq aí fica mais limpo lá embaixo, e os recados deixa mais organizado, tá um monte de informação jogada".

- **Lateral direita.** Quando a Mesa tem 960 px ou mais de largura (medida com `ResizeObserver` na própria Mesa, não na janela, porque o menu lateral ocupa parte dela), a parte **Recados** (os recados e os agradecimentos da equipe) sai do fluxo e vai para uma coluna à direita (`.pn-mesa-grade`, `.pn-mesa-lateral`, 17 a 22 rem, com um fio à esquerda). As outras partes seguem na coluna principal, na ordem da função. Em telas menores, nada muda: os recados ficam no lugar da ordem da função. O primeiro desenho é sempre o do fluxo (igual no servidor e no navegador); a ordem de leitura e de foco segue a ordem da tela. Os quadros de número do alto continuam levando até `#mesa-recados`.
- **Recados agrupados** (`components/painel/recados-grupos.ts`, função pura): grupos por assunto, nesta ordem: Acessos e aparelhos, Equipe e funções, Contribuições e publicação, Rede, Outros recados. Cada grupo tem o nome em mono e o número de não lidos; dentro dele, os não lidos primeiro; recados de texto igual viram uma linha só ("2 vezes"); três por grupo e o resto em "Ver mais". Sem nada novo, os já lidos ficam recolhidos em "Ver os recados já lidos". Acabou a frase repetida "Nenhum recado novo" em cima da lista de recados lidos.
- **Banco:** a migração `supabase/migracoes/20261106-painel-recados.sql` faz `avisos_meus()` devolver também a `categoria` do recado (já existia na tabela). Sem ela, o agrupamento é feito só pelo texto; nada quebra. Mesma regra de privacidade de antes: só os recados da própria pessoa (LGPD, art. 6º, III).

## Teste

`npm run testar:mesa` (scripts/testar-mesa.mjs): as 7 funções e a Geral, as cinco partes por função, todo papel do banco com uma Mesa, a ordem de cada função, nenhuma pendência perdida, segurança separada de pendência, todo campo conferido contra o `Resumo` do painel, destinos e atalhos existentes no mapa de seções, tela sem cor à mão, todas as peças antigas ainda na Mesa, B14, a palavra proibida e (T27) o agrupamento dos recados, a lateral direita e a migração.

## Pendências

- Conferência visual no navegador (computador e celular, claro e escuro) não foi feita: foram conferidos `tsc`, `eslint` e o teste.
- O botão "Menu" do topo no celular (duplicado com o "Mais" da barra de baixo) não foi tocado, porque está no cabeçalho de `Painel.tsx`, fora da Mesa.
- Os recados mostram o título da parte. Desde a T27, a peça `Recados` ganhou a prop `naMesa` (sem título próprio); o CSS `[&_#recados]:hidden` ficou só como rede de segurança.
