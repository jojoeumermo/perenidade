# Público e vida do post

Migração: `supabase/migracoes/20261115-alumia-o9-publicar.sql`. Teste: `scripts/testar-alumia-o9-publicar.mjs`.

## O que a pessoa escolhe

| Escolha | Onde | O que acontece |
|---|---|---|
| Só a minha roda | Escrever → Quem vê | `publico = 'roda'`: só quem está na roda de confiança da autora (a mesma do story "Só para a roda"). A lista é só dela; ninguém é avisado de entrar ou sair. Respostas seguem a roda de quem abriu a conversa. Nunca federa. |
| Não listado | Escrever → Quem vê | `nao_listado`: vale dentro do público, mas fica fora de linha, abas, busca, perfil e aviso de menção. Quem tem o link abre. Com a trava da entrada ligada, o link só abre para conta aprovada. |
| Arquivar | Menu do cartão (só a autora) | `arquivado_em`: ninguém mais vê; a autora vê em Ajustes → Vida dos posts → Arquivados e desarquiva. Arquivar tira do Fediverso e não volta (`fora_do_fediverso`). |
| Some sozinho | Escrever → Some sozinho | `expira_em` (24 h ou 7 dias). Vencido, ninguém vê; o agendador apaga de verdade, com a mídia. |
| Apagar depois de X semanas | Ajustes → Vida dos posts | `interno.rede_vida_conta`: os posts mais velhos que X semanas (1, 2, 4, 8, 12, 26 ou 52) somem sozinhos. A tela mostra quantos sairiam antes de ligar. |
| Aviso antes de publicar ofensa | Escrever (só no aparelho) | Lista aberta de termos em `lib/rede/publicar/termos-ofensivos.ts`. Só avisa; o segundo toque publica. Nada sai do aparelho. Desliga em Ajustes. |
| Leia antes de repostar | Cartão (só no aparelho) | Se o post tem link e a pessoa não abriu o link neste aparelho, o Repostar pergunta antes. Desliga em Ajustes. |

Apagar de verdade: `interno.rede_vida_rodada()` (pg_cron `alumia-vida-dos-posts`, a cada 10 minutos) chama
`interno.rede_vida_apagar(ids)`. A mídia entra na fila `interno.alumia_arquivos_a_apagar` (onda 8), que o servidor do site esvazia
pela API do depósito (a rodada de hora em hora `alumia-meus-dados` chama a faxina quando a fila não está vazia). O que outra pessoa
respondeu ou citou fica como "[post apagado]", sem autora, sem texto, sem mídia e sem histórico, como no apagar a conta.

## Onde a regra vale

A regra de quem vê (`interno.rede_vida_ve`) entra na conferência de todo post; a de quem aparece em lista
(`interno.rede_vida_fora_da_lista`) entra no filtro de toda lista (linha, abas, busca, perfil, avisos): o não listado abre pelo
link e não aparece em lista; o arquivado não aparece em lista nem para a autora (ela o acha nos Arquivados). No Fediverso,
`interno.rede_fed_federavel` pergunta a `interno.rede_vida_federa`: o não listado, o arquivado, o que some sozinho e o da roda
nunca saem, e o arquivado que já tinha saído recebe a retirada.
