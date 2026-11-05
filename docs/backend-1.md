# Back-end novo, parte 1 (Etapa 8)

Pacote `backend-1` do painel novo. SQL em `supabase/migracoes/2026-11-backend-1.sql` (rodar DEPOIS do `install.sql`; a integração junta), telas em `components/painel/BackendUm.tsx`, teste em `scripts/testar-backend-1.mjs` (`npm run testar:backend-1`).

Duas seções novas no painel:

- **Site e operação › Controles avançados** (coordenação, vice, curadoria e desenvolvimento; as abas de recursos, constantes e limites só para coordenação e vice).
- **Segurança › Confirmações de segunda pessoa** (coordenação e vice).

Nenhuma tabela no esquema `public`: tudo em `interno.*`, acesso só por funções `public.*` (`security definer`, `search_path = interno, pg_temp`). As funções de `interno.*` não são executáveis por `anon` nem `authenticated`. Só quatro leituras são públicas (`recursos_lidos`, `site_constantes_ler`, `destaques_ler`, `trilha_apresentacao_ler`).

## Os itens, cada um com função, tela e teste

| Item | Funções SQL | Tela (aba) |
|---|---|---|
| Recursos ligados sem publicar de novo | `recursos_lidos`, `recursos_estado`, `recurso_ajustar` | Recursos |
| Confirmação de segunda pessoa | `confirmacoes_listar`, `confirmacao_decidir`, `confirmacao_cancelar` | Confirmações |
| Zerar 2FA e aparelhos | `zerar_2fa_pedir`, `zerar_aparelhos_pedir`, `zerar_pessoas` | Confirmações |
| Segunda avaliação externa | `avaliacao_externa_estado`, `avaliacao_externa_pedir` | Confirmações |
| Limites ajustáveis | `limites_listar`, `limite_ajustar`, `limite_restaurar` (e `interno.limite` que lê o ajuste) | Limites |
| Constantes do site no banco | `site_constantes_ler`, `site_constantes_listar`, `site_constante_gravar` | Constantes do site |
| Aula da semana e destaques da home | `destaques_ler`, `destaques_listar`, `destaque_salvar`, `destaque_remover`, `aula_semana_definir`, `aula_semana_limpar` | Home e aula da semana |
| Texto de apresentação da trilha | `trilha_apresentacao_ler`, `trilhas_apresentacao_listar`, `trilha_apresentacao_salvar` | Apresentação das trilhas |
| Editar conteúdo em arquivo (PR) | `conteudo_pode_editar`, `conteudo_pr_registrar`, `conteudo_prs_listar` + `app/api/painel/conteudo` | Conteúdo e correções |
| Correções aprovadas aplicadas por PR | `correcao_propor`, `correcoes_listar`, `correcao_decidir`, `correcao_para_aplicar`, `correcao_aplicada` + `app/api/painel/correcoes` | Conteúdo e correções |

## Recursos ligados sem publicar de novo

- Catálogo em `interno.recursos_catalogo` (mesma lista de `lib/recursos.ts`; o teste confere nomes e `so_pelo_nome`). Decisão da coordenação em `interno.recursos_vivos` (linha existe = decisão explícita).
- `lib/recursos-vivos.ts` lê `public.recursos_lidos()` em tempo de execução com cache de 60 s e soma ao `NEXT_PUBLIC_RECURSOS`. `lib/recursos.ts` ganhou `definirVivos()` e `ligado()` sem lista passa a consultar a decisão: **desligado no banco desliga sempre** (interruptor de emergência); **ligado no banco liga**; banco fora do ar: vale só a variável. `ligado(recurso, lista)` com lista explícita continua exatamente como era (os testes antigos não mudam).
- `SO_PELO_NOME` (`escola`, `vale-o-escrito`, `rede-v2`): `recurso_ajustar(…, true)` não liga; abre um pedido que outra pessoa da coordenação confirma (e o motivo é obrigatório). Desligar é imediato. "Apagar decisão" volta à variável.
- Uso: servidor/rota dinâmica `await recursoLigado("x")`; componente do navegador `useRecurso("x")` (`lib/use-recursos-vivos.ts`, lê `/api/recursos`, cache de borda de 60 s).
- **Limite honesto:** página gerada na montagem (estática) só muda quando for gerada de novo. Os 147 usos atuais de `ligado()` continuam lendo a variável de montagem em páginas estáticas; cada porta passa a respeitar o painel quando virar rota dinâmica ou usar `useRecurso`. Não troquei esses usos aqui (arquivos de outras frentes).

## Confirmação de segunda pessoa

`interno.confirmacoes` (tipo, alvo, motivo, quem pediu, vencimento em 48 h). Regra: **quem pediu não confirma o próprio pedido** (`segunda_pessoa`), só coordenação e vice decidem, só quem pediu cancela. Um pedido igual aberto não se repete. Tipos: `recurso`, `zerar_2fa`, `zerar_aparelhos`, `avaliacao_externa`. A liderança é avisada ao abrir.

- **Zerar 2FA:** apaga os fatores em `auth.mfa_factors` e as sessões em `auth.sessions` da conta (a senha roubada perde o acesso junto) e avisa a pessoa. Com a exigência de 2FA ligada, quem tem coordenação/vice/curadoria/mediação cadastra de novo no próximo acesso. Conta com coordenação ou vice só é pedida pela coordenação (quem lidera). Motivo de 10 a 500 caracteres.
- **Zerar aparelhos:** apaga só `interno.aparelhos` (a lista de acessos). **Não** toca nas chaves das conversas cifradas (`chat_aparelhos`): apagar chave de ponta a ponta faria a pessoa perder conversas.
- **Segunda avaliação externa:** desligar é imediato; ligar exige a caixa "página de privacidade atualizada" e a segunda pessoa. O texto de cada mensagem da Comunidade vai a uma empresa de fora do país: transferência internacional de dados, que a LGPD só permite nas hipóteses do art. 33 da Lei 13.709/2018 (aqui, as garantias do inciso II e o consentimento específico e destacado do inciso VIII, ver `docs/privacidade-avaliacao-automatica.md`); os princípios de finalidade e necessidade são o art. 6º, I e III, e a segurança, o art. 6º, VII. Conferido em planalto.gov.br em 05/11/2026. A função antiga `public.comunidade_avaliacao_externa` (só pelo SQL Editor) continua existindo.

## Limites ajustáveis

`interno.limites_config` (ação, máximo de 1 a 5000, janela de 1 a 1440 min). A migração troca `interno.limite()` por uma versão idêntica à do `install.sql` que primeiro procura a ação em `limites_config`. Sem linha: vale o número do código. A tela mostra as ações vistas nos últimos 2 dias só com contagem de pessoas e maior número (nada identifica ninguém). Cuidado: como `interno.limite` é redefinida aqui, rode esta migração depois do `install.sql` (e, quando a integração juntar, deixe esta versão no lugar da antiga).

## Constantes do site

`interno.site_constantes`, só as chaves de `interno.site_constantes_modelo()`: `apoio_url` (https), `instagram_usuario`, `contato_email`, `historico_desde` (data). O formato é conferido no banco. Valor vazio apaga e o site volta ao valor de `lib/site.ts`. **Ligação com o site:** `site_constantes_ler()` é público e pronto; trocar `lib/site.ts` por esta leitura fica pendente (arquivo compartilhado, usado em muitas páginas estáticas).

## Aula da semana e destaques da home

`interno.destaques_home` (6 posições, caminho do próprio site, título, resumo, data de fim opcional) e `interno.aula_semana` (número da semana igual ao de `lib/lambe-do-dia.ts`: `(dia + 3) / 7`, em Brasília). Edita coordenação, vice, curadoria e desenvolvimento. `destaques_ler()` é público e só devolve destaques vigentes e semanas de agora em diante. Ligação com a home (`app/[lang]/page.tsx`, `lib/aula-da-semana.ts`) pendente pelo mesmo motivo.

## Texto de apresentação da trilha

`interno.trilhas_apresentacao` (slug, idioma pt/en/es/fr/ru/zh, texto de 10 a 1200). pt é o texto principal; en/es/fr/ru/zh entram como rascunho (a tela marca). `trilha_apresentacao_ler(slug, idioma)` é público. Ligação com a página da trilha pendente.

## Editar conteúdo em arquivo (PR) e correções aprovadas

- Variável de segredo no servidor: `GITHUB_CONTEUDO_TOKEN` (token com permissão **Contents** e **Pull requests** de escrita, só neste repositório). Opcionais: `GITHUB_PUBLICAR_REPO` (padrão `jojoeumermo/perenidade`) e `GITHUB_CONTEUDO_BASE` (padrão `master`). Sem o token, as rotas respondem 503 e nada muda. O token nunca vai ao navegador (o teste confere).
- `GET/POST /api/painel/conteudo`: a pessoa manda o token da sessão; o banco confere o papel e o ritmo (20 por hora, `conteudo_pode_editar`). `GET ?caminho=` devolve o texto atual; `POST` cria o branch `painel/<arquivo>-<data>-<sufixo>` a partir do base, grava o arquivo e abre o PR. **Nunca junta o PR**: revisão humana antes de publicar; a publicação segue a rotina de sempre.
- Só arquivos `.md` das pastas `trilhas`, `paginas`, `glossario`, `professores`, `contribuir`, `falacias`, `debates` e `memorial`, sem `..`, até 200 mil caracteres. Fora disso (saúde, Vale o Escrito, JSON de dados): recusado.
- O PR e o commit **não levam o nome de quem pediu** (LGPD, art. 6º, III: só o necessário); quem pediu fica no banco (`interno.conteudo_prs`) e no registro de atividades.
- **Correções aprovadas:** quem edita propõe uma troca de trecho exato (`correcao_propor`); outra pessoa da curadoria ou coordenação aprova (`correcao_decidir`; quem propôs não aprova). Ao aprovar, a tela chama `POST /api/painel/correcoes`, que confere no banco que está aprovada (`correcao_para_aplicar`), lê o arquivo, troca o trecho só se ele aparecer uma vez (senão devolve 409 e pede nova proposta) e abre o PR pelo mesmo caminho. Falha do GitHub deixa a correção aprovada e o botão "Abrir o PR de novo".
- Direito autoral (Lei 9.610/1998): o painel só edita texto que já é do instituto, sob a licença do repositório; não traz texto de terceiros.

## Para ligar em produção

1. Rodar `supabase/migracoes/2026-11-backend-1.sql` no Supabase (depois do `install.sql`).
2. Criar o token do GitHub e pôr `GITHUB_CONTEUDO_TOKEN` na Vercel (segredo).
3. Publicar o site. As abas de recursos, constantes, limites, home, trilhas e confirmações já funcionam sem o token; só "Conteúdo e correções" (PR) precisa dele.

## Pendências

- Ligar os leitores ao site: `ligado()` em páginas estáticas, `site_constantes_ler` em `lib/site.ts`, `destaques_ler` na home e `trilha_apresentacao_ler` na página da trilha (arquivos compartilhados).
- Sem conferência visual no navegador nem `next build`; sem teste contra um Supabase real (o SQL foi conferido como texto pelo teste).
- A integração precisa juntar este SQL ao `install.sql` mantendo `interno.limite` desta versão.
