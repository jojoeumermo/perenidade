# Vale o Escrito: a teia do poder no Brasil (especificação)

> Nota de 04/11/2026: a ESPEC original (seções 1 a 12, escritas por cada pacote) foi sobrescrita por engano na integração e
> reescrita aqui, de forma consolidada, a partir do código, das migrações e dos relatórios dos pacotes. O que manda é o código;
> onde este texto divergir de `lib/vale-o-escrito/`, vale o código.

## 1. O que é (e o que não é)
Observatório de crimes de interesse público que JÁ estão em fonte pública (processo, investigação oficial, relatório de
organização, reportagem), com visão ampla do Brasil. Não é investigação própria nem plantão policial. Brasil primeiro; o modelo
(país, região, município) está pronto para outros países. É o único lugar do site fora da identidade do instituto: visual neon
sobre fundo preto, inspirado em bl00d.money, sem copiar código.

Regras de conteúdo: toda entrada tem fonte, data e trecho (até 400 caracteres, nunca a página); a situação jurídica vem sempre
escrita (suspeito, denunciado, investigado, réu, condenado em 1ª instância, condenado com trânsito em julgado, absolvido,
arquivado), com "supostamente" ou "segundo [fonte]"; dois níveis de confiança (confirmado por fonte primária, reportado); pessoas só
quando já públicas no caso; nunca vítimas, crianças ou testemunhas; absolvições e arquivamentos são atualizados; toda ficha tem
correção e direito de resposta; a curadoria é anônima ao público; a fonte é arquivada no Internet Archive na aprovação.

## 2. Arquitetura
Robô agendado (GitHub Actions, `scripts/vale-o-escrito/coletar.mjs`) lê feeds e APIs, filtra por tema e município do IBGE, pede
resumo a IA gratuita em rodízio (sem cota, segue sem resumo) e grava sugestões pela função `vale_robo_sugerir`. A curadoria (painel,
função "Vale o Escrito: curadoria") revisa, aprova e arquiva a fonte; as entradas aprovadas ficam em `interno.vale_entradas` e o site acompanha ao vivo por Broadcast do banco;
`scripts/vale-o-escrito/exportar.mjs` gera os arquivos `content/vale-o-escrito/entradas/*.json`. Custo zero: GitHub Actions,
Supabase gratuito, MapLibre com malhas do IBGE (sem tiles de terceiros), d3-force só na visão Teia.

## 3. Modelo de dados
`lib/vale-o-escrito/tipos.ts` (Entrada, Fonte, PessoaPublica, Organizacao, Ligacao, Lugar, Correcao, EnvioDoPublico,
MudancaDeSituacao, RespostaPublicada). Regras puras e sem `@/` em `regras.ts`; catálogo de 48 fontes (49 desde 08/11/2026, com a Agência Brasil) e 6 slugs em `catalogo.ts`.

## 4. Dados publicados em arquivo
`content/vale-o-escrito/`: `dossies.json`, `apresentacoes.json`, `fontes.json` (contrato do robô), `entradas/<dossiê>.json`.
`dados.ts` lê com pasta literal, descarta o que não passa nas regras, e nunca publica entrada `pendente-curadoria`.

## 5. Regras jurídicas (artigos conferidos em planalto.gov.br)
LGPD (13.709/2018) arts. 4º II a, 7º, 11, 14; ECA (8.069/1990) arts. 17, 143, 247; Lei 13.188/2015 arts. 2º, 3º, 5º, 7º (direito de
resposta; meta de 7 dias); Código Penal arts. 138 a 140; Marco Civil (12.965/2014) arts. 15, 19, 21; LAI (12.527/2011) arts. 3º, 8º,
31. Não conferidos: Lei 9.610 (art. 8º IV, 46), Lei 12.737. A Lei 13.188 não lista dados de identificação de quem pede resposta;
nome, qualidade e contato são escolha de prudência.

## 6. Fluxo
Robô, fila, curadoria (guardar, aprovar, devolver, recusar, mesclar), arquivo no Internet Archive (`app/api/vale-o-escrito/arquivar`),
publicação, atualização de situação com fonte (histórico visível), correções e respostas com prazo.

## 7. Banco
`supabase/migracoes/2026-11-vale-o-escrito.sql`, repetido no fim de `supabase/install.sql` (um teste confere). Tabelas `interno.vale_*`
(inclusive `interno.vale_entradas`; **nenhuma tabela no esquema public**, trava do projeto conferida por `npm run testar:banco`:
todo dado fica em `interno` e o público só lê por funções `security definer`). Leitura pública: `public.vale_publicadas(p_dossie)` e
`public.vale_publicada(p_id)` (só entradas não retiradas). Ao vivo: trigger em `interno.vale_entradas` chama `realtime.send` (Broadcast
do banco, tópico público `vale-o-escrito`, evento `mudou`, carga só `{id, acao}` com acao publicada, atualizada ou retirada; sem
este esquema, como no teste local, o trigger não faz nada). O cliente (`components/vale-o-escrito/useAoVivo.ts`) busca a entrada
com `vale_publicada` e a revalida; em `retirada` tira a ficha da tela (o Realtime de linhas não entregava a retirada, pela RLS).
A versão anterior desta migração criava `public.vale_entradas` com RLS e Realtime; a migração move essa tabela para `interno`
se ela existir. Funções `vale_enviar`, `vale_corrigir` (público, limite e hash
com sal diário, isca e tempo mínimo), `vale_robo_sugerir` (só serviço), funções da curadoria (conferem `interno.curador()`),
`vale_limpeza`. Histórico só de acréscimo. Nunca IP cru.

## 8. Rotas, recurso e menu
Recurso `vale-o-escrito` em `lib/recursos.ts`, SO_PELO_NOME (`todos` não liga). Desligado, o layout dá 404 sem ler disco. Rotas em
`app/[lang]/vale-o-escrito/`: raiz, `caso/[id]`, `pessoa/[id]`, `organizacao/[id]`, `sobre`, `enviar`, `correcao`, `correcao/[id]`.
Menu principal e "Mais" só com o recurso ligado.

## 9. Pacotes
visual (observatório, teia, órbita, grupos, fluxo, linha do tempo, fichas), mapa (MapLibre, malhas do IBGE), robo (coletar.mjs,
workflow, fontes.json), curadoria (painel, `curadoria.ts`, arquivar, exportar), publico (sobre, enviar, correção, privacidade),
fontes-e-dossies (fontes.json conferido, apresentações, 18 casos pendentes, cadastros).

## 10. Como testar
`npm run testar:vale-o-escrito`, `-visual`, `-mapa`, `-robo`, `-curadoria`, `-publico`; `node scripts/conferir-rastreio.mjs`.

## 11. Pacote publico
Formulários sem conta nem CAPTCHA de terceiros: campo-isca, tempo mínimo de 3 s (só barra robô simples; quem chama a função direto
passa e encontra o limite por origem). Direito de resposta pede nome, qualidade e contato. Textos en/es/fr/ru/zh são rascunho.

## 12. Pacote visual
Escopo CSS `.ve` em `styles/vale-o-escrito.css`; d3-force só em `Teia.tsx`; leitura de disco só em `consulta.ts`/`dados.ts` (servidor);
Realtime em `useAoVivo.ts` com cada linha revalidada por `regras.ts`; acessibilidade com lista textual equivalente e reduced-motion.
Textos da seção "visual" nos 6 idiomas (pt final, demais rascunho).

## 13. Estado final da integração (04/11/2026)

Todos os pacotes (fundação, visual, mapa, robô, curadoria, público, fontes-e-dossiês) estão no repositório e se encaixam:
`tsc --noEmit -p .` limpo no projeto inteiro, `npm run lint` sem erros, e os seis testes (`testar:vale-o-escrito`, `-visual`, `-mapa`,
`-robo`, `-curadoria`, `-publico`) passam. `next build` não foi rodado neste passo.

Nomes reais das rotas (valem sobre a tabela da seção 8): `/vale-o-escrito` (observatório), `caso/[id]` (ficha), `pessoa/[id]`,
`organizacao/[id]`, `sobre`, `enviar`, `correcao` e `correcao/[id]` (a ficha manda `?tipo=correcao|direito_de_resposta`, que a página lê).
Arquivos reais do mapa: `components/vale-o-escrito/Mapa.tsx`, `lib/vale-o-escrito/geo.ts`, `scripts/vale-o-escrito/gerar-malhas.mjs`,
`gerar-municipios.mjs`. Exportação para arquivos: `scripts/vale-o-escrito/exportar.mjs` (`npm run vale-o-escrito:exportar`).

Integração feita neste passo:
- Sitemap (`app/sitemap.ts`): `/vale-o-escrito` e `/vale-o-escrito/sobre` só entram com o recurso ligado; `enviar` e `correcao` ficam fora (noindex).
- Busca: o observatório entra pela lista de seções (`lib/secoes-do-site.ts`, só com o recurso ligado); não foi criada intenção em `busca-intencoes.json`.
- Menu principal e "Mais": só com o recurso ligado (`NavLinks.tsx`).
- i18n: 249 chaves idênticas nos 6 idiomas (conferido no teste). pt é final; en/es/fr/ru/zh são rascunho sem revisão de nativo.
- Formulário de correção lê `?tipo=`; `fontes.json` corrigido para `almapreta.com.br`.
- `package-lock.json` já registra d3-force, @types/d3-force e maplibre-gl.

## 14. Pendências para a coordenação

Decisões:
1. Liberar o recurso em produção (`NEXT_PUBLIC_RECURSOS=todos,vale-o-escrito`) só depois da revisão da curadoria (18 casos estão `pendente-curadoria`, nenhum publicado) e da assessoria jurídica.
2. CSP (`next.config.ts`): `img-src` só permite 'self', data:, blob: e o serviço, então foto externa de licença livre (Wikimedia) será bloqueada. Opção recomendada: copiar as fotos livres para `public/vale-o-escrito/` com crédito; liberar domínios abriria vazamento de IP do visitante.
3. Papel próprio `curadoria_vale` (hoje usa `interno.curador()`): exige mexer nos check de papéis em `supabase/install.sql`.
4. Degrau "condenado em 2ª instância" no modelo (SITUACOES, ROTULO_SITUACAO, regras.ts, SQL, i18n).
5. Catálogo tem 48 fontes (o pedido dizia 47): decidir se tira uma.
6. Assessoria: LGPD art. 4º II a (o Instituto não é veículo registrado), Lei 13.188 (aplicabilidade), Lei 9.610 (art. 8º IV, 46) e CC BY-ND (gov.br, Agência Pública: resumo conta como derivação?).

Riscos técnicos abertos:
- Nenhum SQL (migração inteira, `vale_limpeza`, `vale_fila_salvar`, Realtime) rodou em Postgres: testar em projeto Supabase de teste antes de produção.
- Retirada de entrada não chega ao vivo (RLS só mostra `retirado_em` nulo): a ficha retirada fica na tela até recarregar. Sugestão: linha-tombstone visível ao Realtime.
- Aceitar correção faz duas chamadas (`vale_entrada_atualizar`, `vale_correcao_decidir`); falha na segunda pode duplicar a resposta. Pedir função SQL atômica.
- Mesclar duplicata recusa a outra sugestão antes de a curadoria guardar o rascunho.
- Recusar/devolver exigir nota só na tela; a função SQL aceita nota vazia.
- Mapa: MapLibre no Turbopack dev registrou "Worker failed to load"; conferir no build real e no navegador (zoom, cliques). Malhas em qualidade mínima.
- Robô: feeds RSS (`feedConfirmado: false`) e API do Querido Diário não testados com rede; modelos de IA gratuitos podem ter mudado de nome.
- `vale_limpeza` não apaga pedidos nunca decididos; a curadoria deve decidir todos. `interno.limite` grava md5 do IP sem sal por até 2 dias (a privacidade fala em sal diário só para o hash do Vale o Escrito).
- Nó de pessoa na teia não mostra a situação jurídica ao lado do nome (aparece na ficha, lista textual e arestas); seletor de visões usa role=tab sem tabpanel.
- Não testados: celular, leitor de tela, grafo grande, Realtime real.
- Link de fonte do caso Umbaúba (MPF-SE) traz o nome da vítima no endereço: curadoria decide se mantém.
- Falta ligar `exportar.mjs` a um fluxo agendado e a ficha pública mostrar `doc.historico` e `doc.respostas` (conferir com o pacote visual).