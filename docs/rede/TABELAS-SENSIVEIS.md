<!-- Levantamento de 12/11/2026 (C1), feito por leitura do install.sql no ramo faixa2-fediverso-cripto. As linhas citadas mudam com o arquivo. -->

# Tabelas sensíveis em texto aberto no banco (levantamento C1)

## Como o acesso funciona hoje

- Todas as tabelas de `interno` têm RLS ligada e nenhuma política, e o `public` perdeu as permissões (`install.sql:1036-1044`). O
  cliente só chega aos dados pelas funções `public.*` `security definer`, e cada uma confere o papel de quem chama.
- O "servidor curioso" lê tudo: a `service_role`, o dono do projeto Supabase, quem tem um backup ou um dump, e qualquer função
  `security definer` com erro. RLS não protege contra nenhum deles.
- Já cifrados de ponta a ponta:
  - `conversa_mensagens` (`:680`) e `conversa_anexos.cifrado` (`:845`).
  - `equipe_mensagens.corpo`, cifrado com a chave do departamento (`:3745-3796`).
  - `rede_dm_mensagens`, que recusa texto aberto pelo check `c2.`/`c3.`.
  - `chat_recuperacoes.copia` (`:790`) e `progresso_qr.blob`.
  - A chave privada do Fediverso é cifrada no servidor com `ALUMIA_FEDIVERSO_SEGREDO`. É um bom modelo para o que este documento
    chama de "cifrar no servidor".
  - Os posts restritos têm a cifra pronta (`docs/rede/POSTS-RESTRITOS.md`), mas ela ainda não está ligada nas telas (P21).
- **Não existem neste ramo:** caronas (`rede_ato_caronas`, da Faixa 1), petições, eleições, Ata Viva e caixa. Ocupação aparece
  apenas como texto livre em `rede_correntes.texto`.
- **Os rascunhos da Rede não são cifrados.** O chat guarda o rascunho só na memória, mas `rede_rascunhos.pedido` e
  `interno.rascunhos.dados` ficam em texto aberto.

## 1. Rede: posts de público restrito, comunidades, núcleos

| Tabela / colunas | Que dado é | Quem lê hoje | Recomendação |
|---|---|---|---|
| `rede_posts.texto/titulo/corpo/aviso/posicao/cita/chamado` (`:15009`, `:15824-15838`) com público de núcleo, comunidade, equipe ou seguidores, ou comunidade `fechado-*` | Conteúdo privado de grupo e opinião política | `rede2_pode_ver` (`:16199`); a mediação pela fila de retidos; a moderação geral em núcleo só por quebra-vidro registrado (`:22394`) | **E2E com chave de grupo** para núcleo e comunidade fechada (pronto, falta P21). A moderação passa a funcionar por denúncia com o trecho decifrado. Para seguidores e membros: cifrar no servidor |
| `rede_posts.busca` (tsvector gerado, `:15861`) | Índice com as palavras de todo post, inclusive os restritos | Funções de busca; qualquer leitura do banco | **Guardar menos**: gerar só para os públicos abertos |
| `rede_post_edicoes.texto_anterior` (`:15886`) | Versões antigas de posts restritos, guardadas sem prazo | Funções de histórico de edição | **Apagar mais cedo** (30 dias) e seguir a regra do post |
| `rede_sinteses.texto` (`:19812`) | Síntese de fio, que pode ser de núcleo | Quem pode ver a raiz | Mesma cifra do post-raiz |
| `rede_rascunhos.pedido` (`:31256`), `rede_agendados.pedido` (`:19243`), `interno.rascunhos.dados` (`:9218`) | Texto ainda não publicado | O dono, pela função | `rede_agendados` não tem faxina: **apagar** depois de publicar ou cancelar. Rascunho: cifrar no aparelho |
| `rede_comunidade_membros` (`:15967`), `rede_espaco_membros` (`:15329`) | Quem pertence a comunidade ou espaço fechado: filiação política | Moderação da comunidade, coordenação | **Cifrar no servidor** a lista de membros das comunidades fechadas |
| `nucleos` (`:14744`: cidade, encontros, ponto) | Localização de núcleo de formação militante, "alvo de perseguição" (`:14740`) | Equipe | Deixar `ponto` só quando público |
| `rede_nucleo_membros` (`:16020`), `rede_encontros.quando/local_texto` (`:16042`) | Membros do núcleo, e quando e onde ele se encontra | Mediação do núcleo, gestores | `local_texto` e `quando`: **E2E com a chave do núcleo**. Encontro passado: **apagar** |
| `rede_seguindo` (`:15031`), `rede_desc_interesses` (`:20218`: "lutas" escolhidas) | Grafo social e interesses políticos | Funções de linha e descoberta | `rede_desc_interesses`: **apagar** depois de montar a primeira linha |

## 2. Atos e presença

| Tabela / colunas | Que dado é | Quem lê hoje | Recomendação |
|---|---|---|---|
| `rede_vou(post, usuario)` (`:15033`) | **Presença em ato** (LGPD art. 11) | As funções devolvem só contagem, mas o banco liga a pessoa ao ato | **Apagar** algumas horas depois do ato, guardando só o total. Hoje não há faxina |
| `rede_chamados.cidade/ponto/inicio` (`:15936`) | Local e hora do ato | Segue o post | Com post restrito: E2E com a chave do grupo |
| `rede_corrente_vou` (`:34759`), `rede_correntes.texto/cidade/quando` (`:34746`) | "Vou" para ocupação ou ato | Só proporção (a partir de 3) | **Apagar** `rede_corrente_vou` quando a corrente fecha |
| `reunioes_presencas` (`:9637`) | Presença em reunião da equipe | Coordenação | **Apagar** depois de N dias |

## 3. Votos (ponto crítico)

| Tabela / colunas | Que dado é | Recomendação |
|---|---|---|
| `rede_consulta_votantes` + `rede_consulta_cedulas` (`:32273`, `:32279`) | **Voto** em consulta de organização política | **Sigilo quebrado no banco.** As duas linhas entram na mesma transação (`:32639`, `:32641`): mesmo `xmin` e lado a lado no disco. Um dump religa voto e pessoa. Desacoplar: fila gravada em lote embaralhado por um job, em outra transação |
| `votacao_presencas.marca` + `votacao_votos` (`:14500`, `:14505`) | Voto secreto da equipe | O mesmo problema de transação. E `marca = md5(sal, votacao, usuario)` com o sal em `configuracoes` (`:14035`): quem tem o banco reidentifica cada marca. **Sal fora do banco** (variável do servidor, HMAC) |
| `rede_votos(opcao, usuario)` (`:15930`), `rede_story_votos` (`:33184`) | Voto em enquete, que pode ser política | O banco guarda a pessoa junto da opção. **Guardar menos**: separar quem votou do voto |

## 4. Denúncias e moderação

| Tabela / colunas | Que dado é | Recomendação |
|---|---|---|
| `conversa_relatos.mensagens/motivo` (`:896`) | Trechos **decifrados** de conversa da equipe | **Cifrar no servidor**. Hoje fica 365 dias depois de resolvido (`:4548`): 90 bastam |
| `rede_denuncias.texto` (`:16084`) | Denúncia; no chat privado leva os trechos decifrados | **Cifrar no servidor** e **apagar** quando resolvida. Hoje não há faxina |
| `denuncias.detalhes`, `fediverso_denuncias.conteudo`, `rede_recursos.texto` | Denúncia e contestação | Como `rede_denuncias` |
| `rede_moderacao.motivo` (`:16100`, imutável por gatilho) | Motivo de remoção ou bloqueio, ligado ao perfil | Definir prazo (por exemplo, 2 anos) com purga por papel separado |

## 5. Perfis e identidades

| Tabela / colunas | Que dado é | Recomendação |
|---|---|---|
| `perfis.nome` (civil) na mesma linha de `rede_codinome` e `rede_handle` | Liga nome civil e codinome | **Cifrar no servidor** o nome civil e só abrir no painel |
| `rede_identidades(dono, identidade)` (`:30989`), `rede_org_gestores` (`:32177`) | Quem está por trás de um pseudônimo ou de uma conta de organização | **Cifrar no servidor**, com chave fora do banco e índice HMAC para as buscas |
| `perfis.rede_menor_em` (`:18010`) | Menor de idade declarado | **Guardar menos**: um booleano sem a data |
| `departamento_membros` (`:25639`) com o departamento `revolucionarios` | Militância | **Cifrar no servidor** a lista desse departamento |

## 6. Saúde e cuidado com a equipe

| Tabela / colunas | Que dado é | Recomendação |
|---|---|---|
| `bem_estar(semana, marca, nivel)` (`:14046`) | **Bem-estar semanal, saúde mental** | A anonimização é reversível: `marca = md5(sal, usuario, semana)` com o sal no banco. **Sal fora do banco** ou nenhuma marca |
| `auditoria.detalhes` e `avisos.texto` do **pânico** (`:14186-14192`) | Pessoa "em risco", com motivo | **Apagar mais cedo** e não gravar o motivo |
| `saude_perfis` (`:12999`) | Dado profissional da vitrine de psicólogos (não de paciente) | Deixar |

## 7. Escola de formação

| Tabela / colunas | Que dado é | Recomendação |
|---|---|---|
| `escola_militancia` (`:27584`) | **Ficha de militante**: filiação e opinião política | **Cifrar no servidor** ou guardar menos. É a tabela mais "fichável" do banco |
| `escola_bancas.balanco`, `escola_encontros.pauta/balanco` | Avaliação individual e atas de núcleo | E2E com a chave do núcleo; banca: cifrar no servidor |

## 8. Organizações, stories, territórios

| Tabela / colunas | Que dado é | Recomendação |
|---|---|---|
| `rede_plenaria_perguntas.autor` (`:32302`) | Pergunta "anônima" ligada à pessoa no banco | **Apagar** o autor quando a plenária encerra |
| `rede_story_respostas.texto/quem` (`:33163`) | **Mensagem privada** para a autora do story | **E2E** com as chaves do chat privado; hoje é mensagem direta em texto aberto |
| `territorio_parceiros(territorio, usuario)` (`:35400`) | Liga pessoa a território e coletivo | **Cifrar no servidor** a pessoa |
| `reunioes.ata` (`:9606`), `conversas.nome/descricao` (`:665`, `:882`) | Ata da coordenação; **nome e descrição dos grupos cifrados** em texto aberto | Nome e descrição para dentro do cifrado; ata: cifrar no servidor |

## As 5 prioridades

1. **Voto secreto só de fachada no banco** (`rede_consulta_cedulas`/`votantes`, `votacao_votos`/`presencas`, `rede_votos`). Quem
   votou e o que votou entram na mesma transação; a marca usa um sal guardado no próprio banco. Um dump reconstrói o voto de cada
   pessoa sobre partido, mandato e assembleia. Conserto: o voto entra numa fila e é gravado em lote embaralhado, em outra
   transação; sal ou HMAC fora do banco; tirar a pessoa de `rede_votos`.
2. **Posts de núcleo e comunidade fechada em texto aberto**, também no índice de busca, no histórico de edição e nos rascunhos.
   A cifra está pronta (P21); falta ligar e parar de indexar o que é restrito.
3. **Presença em ato guardada para sempre** (`rede_vou` sem faxina, `rede_corrente_vou`). "Fulano foi ao ato X" é a lista mais
   perigosa num vazamento. Conserto barato: apagar algumas horas depois do ato, guardando só o total.
4. **O elo pessoa, pseudônimo, organização e militância** (nome civil ao lado do codinome, `rede_identidades`,
   `rede_org_gestores`, `escola_militancia`, `departamento_membros`, `territorio_parceiros`): cifrar no servidor, com chave fora do
   Postgres e índice HMAC.
5. **Denúncias e anonimatos reversíveis** (`rede_denuncias.texto`, `conversa_relatos.mensagens`, `bem_estar.marca`, o motivo do
   pânico): cifrar no servidor, apagar 90 dias depois de resolvido, levar o sal para fora do banco.
