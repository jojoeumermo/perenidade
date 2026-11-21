# Varredura de segurança de novembro de 2026: registro e propostas

Resultado da varredura autenticada de 20/11/2026 (fase 2, com a conta de teste `@sentinelaf2`, aprovada pela coordenação). Dos cinco achados, três estão fechados; este documento registra a proposta dos dois que ficaram para decisão da coordenação.

## Fechados

1. **Turnstile sem segredo no servidor** — o servidor aceitava entrada sem conferir o desafio da Cloudflare porque `TURNSTILE_SECRET_KEY` não estava no ambiente. A coordenação configurou a chave na madrugada de 21/11. Na mesma noite, com a Cloudflare degradada, o widget parou de renderizar e o cliente travava o botão de entrada sem o token: ninguém entrava. Correção no commit `72af74c`: o desafio falhando, o formulário para de esperar e o servidor decide (com a chave, recusa com `captcha`; sem ela, passa). A porta não trava mais no navegador.
2. **502 com HTML da borda nas rotas de voto** — consulta ou votação inexistente respondia 502 e a Cloudflare trocava o corpo pelo HTML de erro dela. Corrigido no commit `677f889`: passou a responder 404 JSON `{ok:false, motivo:"nao_encontrado"}`. Verificado ao vivo.
3. **`conta_apagar` sem segundo fator** — falso positivo. O banco (v13) exige sessão aal2 antes de checar a senha; confirmado ao vivo.

## Proposta 3: erros crus do Postgres nas chamadas RPC (aceitar como cosmético)

Chamar o PostgREST direto (fora do aplicativo) com um parâmetro que não é UUID devolve o erro cru `22P02 invalid input syntax for type uuid`, que revela o tipo do parâmetro. A conversão acontece antes de a função rodar, então não há como capturar dentro do SQL, e o Supabase hospedado não tem configuração para mascarar esses erros.

- **O aplicativo já protege o usuário real:** o cliente (`lib/backend.ts`, `codeOf`) só repassa códigos conhecidos e mostra `falha` genérico para todo o resto. O erro cru só aparece para quem chama a API diretamente.
- **Correção completa da classe:** converter os parâmetros `uuid` das funções públicas para `text`/`jsonb` com validação interna. São 692 funções no `install.sql`: migração mecânica grande, com bateria de testes nova, aplicada manualmente no banco. Risco de quebra maior que o ganho (o que vaza é só "este parâmetro é uuid").

**Proposta registrada: aceitar como cosmético (wontfix).** Se a coordenação quiser mesmo assim, o caminho é começar pelas ~30 funções de escrita que membros chamam, com calma e testes. *Decisão da coordenação: pendente.*

## Proposta 4: UUID do autor exposto (roadmap)

O id cru do `auth.users` aparece nos JSONs públicos de post e perfil (`AutorDoPost.id`), amarra o chat de ponta a ponta (chaves e mensagens endereçadas por id de usuário), aparece nos caminhos de mídia do storage (`rede-midia/<uuid>/...`) e em ~56 comparações "sou eu?" no cliente. O ganho de fechar é dificultar a correlação codinome↔conta; não é um vazamento ativo.

Desenho proposto: o perfil ganha um `id_publico` opaco (aleatório, único, rotacionável); os JSONs públicos passam a expor só ele; o uuid real só volta na própria sessão; chat e storage migram para o id público (o storage pede rewrite de policy e mover objetos, ou manter o prefixo antigo só para leitura). Estimativa honesta: migração de dados + mudança de cliente, trabalho de dias, com janela de quebra do chat.

**Proposta registrada: roadmap** (encaixa no bloco de correções e redesign), não fazer de uma noite. *Decisão da coordenação: pendente.*

## Conta de teste

A conta `@sentinelaf2` fica mantida para futuras verificações, sem sessões ativas (todas desconectadas em 21/11, ao fechar a fase). Credenciais e segundo fator com a coordenação.
