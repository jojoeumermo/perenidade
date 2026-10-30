# Rede Lúcia v2: inventário (Fase 0)

Levantado em 29/10/2026 no código do `master` (depois do commit 8ccbe84). Nesta fase só mudou o **bloco urgente** (item 1). Tudo o
mais é retrato do que existe, com as lacunas em relação ao pedido "Rede Lúcia v2" e uma proposta de deduplicação das comunidades,
que espera aprovação.

## 1. Bloco urgente (feito, commit 8ccbe84)

| Pedido | O que foi feito |
| --- | --- |
| Tirar o nome civil da Rede | Codinome à parte do nome do painel (`interno.perfis.rede_codinome`), único sem contar acento e caixa. Quem já tinha perfil recebeu um codinome uma vez: a equipe, um sorteado (o nome do painel é o civil); o resto, o apelido público que já usava. Antes de postar, cada pessoa confirma ou troca (`rede_codinome_ok`; o banco recusa com `confirme_codinome`). |
| Regras do codinome | `rede_codinome_definir`: 3 a 30 caracteres, sem @ nem endereço. Na equipe não vale o nome civil, o primeiro nome nem começar por ele. Ninguém usa o nome civil de alguém da equipe nem o do instituto ("codinome_reservado"). |
| "Postando como", avatar, perfil | "Postando como" mostra o codinome; o rosto padrão sai das iniciais do codinome; o perfil da Rede mostra o codinome e o selo "equipe do instituto", sem cargo, sem a bio do painel e sem o ícone do painel (que pode ser foto de rosto). Bio própria da Rede: coluna `rede_bio` (a tela de editar entra na Fase 3). |
| **Fórum também** (achado no inventário) | `topicos_listar` e `topico_ver` devolviam o nome inteiro do painel a qualquer visitante, sem login. Agora saem pelo codinome. |
| Avisos administrativos na Rede | `interno.avisos` ganhou `categoria` (`equipe`, `rede`, `conta`). A Rede lê `rede_avisos`: só respostas, moderação do que a pessoa escreveu e alertas de segurança da própria conta. O sino da equipe (login de outras contas, fotos para aprovar, currículos) continua só no painel. |
| Mensagem individual ou público de uma pessoa só | Não existe na Rede. Os alcances são `publico`, `seguidores` e `equipe`; os "núcleos fechados" são espaços de grupo. As conversas privadas que existem são as do **painel da equipe** (fora da Rede, como manda o pedido). Nada a desligar. |
| Banco ainda antigo | Se a resposta não marcar `codinome: true` (produção antes do `install.sql`), a tela mostra "Pessoa sem codinome" em vez de arriscar o nome civil. |
| Data do registro de moderação | Passou a sair no idioma da página (antes, `toLocaleDateString()` sem idioma dava 10/12/2026 em navegador em inglês). |

**Passo manual:** rodar o `supabase/install.sql` atualizado no Supabase de produção (SQL Editor). Até lá, a Rede no ar mostra
"Pessoa sem codinome" para todo mundo e ninguém vê nome civil. `npm run testar:banco` passou com 1.737 conferências (12 novas).

## 2. Rotas e telas

| Endereço | O que é | Observação |
| --- | --- | --- |
| `/[lang]/comunidade` | Rede (linha do tempo) e Fórum de dúvidas na mesma página | As vistas (Seguindo, Comunidades, Chamados, Núcleos fechados, Avisos, Meu perfil, Fórum) trocam por estado interno. Só `?post=`, `?t=`, `?sala=`, `?alvo=` e `?nova=` entram no endereço. Sem link compartilhável de comunidade, perfil ou aviso; o "voltar" do navegador não volta de vista. |
| `/[lang]/nucleos` | Página pública dos núcleos de estudo (cidade, forma de encontro, contato, kit) | Cadastro só pela equipe (`nucleo_salvar`). Sem ligação com os "núcleos fechados" da Rede. |
| `/[lang]/turmas` | Turma do mês (inscrição, sala sorteada só para quem entrou) | Tabelas `turmas_mes` e `turmas_salas`. Também separada da Rede. |
| `/[lang]/trilhas/[trilha]/nucleo` | Kit do núcleo de uma trilha | Material impresso; não fala com a Rede. |
| `/[lang]/denunciar`, `/conduta`, `/uso`, `/privacidade`, `/meus-dados`, `/seguranca-digital`, `/reforco` | Páginas que a Rede precisa respeitar | Existem; a Rede só aponta para algumas delas. |

Componentes: `components/comunidade/Rede.tsx` (≈1.200 linhas, tudo numa peça), `ComunidadeComRede.tsx` (troca Rede e Fórum),
`components/Forum.tsx` (≈900 linhas), `NucleosPublicos.tsx`, `TurmaDoMes.tsx`. No painel: a fila da mediação
(`comunidade_retidos`, `comunidade_cuidar`, `comunidade_editar`), as denúncias e os controles da comunidade.

## 3. Banco (schema `interno`, só por funções)

O cliente nunca toca nas tabelas: `anon` e `authenticated` não têm permissão no schema `interno`, e tudo passa por funções
`security definer` que conferem quem pede (`interno.rede_ve` decide quem vê cada post). É controle por função, não por RLS de
tabela: mais estrito contra acesso direto, mas a "matriz de visibilidade" do pedido ainda não tem teste automático completo.

| Tabela | Para quê |
| --- | --- |
| `rede_posts` | Post, resposta (`resposta_a`, um nível), repost (`repost_de`), citação (`cita`), chamado (`chamado`), alcance, aviso de conteúdo, posição de debate, oculto/retido |
| `rede_seguindo`, `rede_bloqueios` | Seguir e bloquear (bloqueio vale nos dois sentidos em `rede_bloqueado`) |
| `rede_apoios`, `rede_vou` | Apoio e "eu vou" |
| `rede_espacos`, `rede_espaco_membros` | Núcleos fechados da Rede (slug `fechado-…`, código de convite em texto) |
| `rede_comunidades_seguidas`, `rede_moderadores` | Comunidades que a pessoa segue; moderação por comunidade |
| `topicos`, `respostas`, `votos` | Fórum: tópico (dúvida ou conversa, resposta aceita), respostas (com `pai`), voto útil |
| `denuncias`, `banimentos` | Denúncia (inclusive urgente, que retém o post) e banimento |
| `nucleos`, `turmas_mes`, `turmas_salas` | Núcleos públicos e Turma do mês |
| `avisos` (+ `categoria`), `avisos_gerais` | Sino de cada pessoa; avisos da coordenação à equipe |
| `perfis` | `rede_invisivel`, `rede_16`, e agora `rede_codinome`, `rede_codinome_ok`, `rede_bio` |

Funções públicas: `rede_eu`, `rede_postar`, `rede_linha`, `rede_post_ver`, `rede_novos`, `rede_apagar`, `rede_apoiar`, `rede_vou`,
`rede_seguir`, `rede_bloquear`, `rede_perfil`, `rede_config`, `rede_confirmar_idade`, `rede_buscar`, `rede_meus_posts`,
`rede_moderacao_publica`, `rede_espaco_criar/entrar/cuidar`, `rede_meus_espacos`, `rede_comunidade_seguir`,
`rede_comunidades_minhas`, `rede_moderador_definir`, `rede_moderar`, `rede_codinome_definir` (nova), `rede_avisos` (nova);
fórum `topicos_listar`, `topico_ver`, `topico_criar`, `resposta_aceitar`, `comunidade_*`; `denunciar`, `denuncias_listar`,
`denuncia_resolver`; `nucleos_publicos`, `nucleos_listar`, `nucleo_salvar`; `turma_mes`, `turma_mes_entrar`.

Moderação que já existe: veredito automático antes de publicar (`interno.veredito`: filtro de palavras, dado pessoal, modo de
segurança com aprovação manual), fila única da mediação para fórum e Rede, ocultar com aviso ao autor, moderadores por
comunidade, banimento, denúncia urgente que retém o post e registro público semanal (ocultados e banimentos). Contas novas
(menos de 7 dias) postam até 8 vezes por dia. Segundo fator obrigatório para coordenação, vice, supervisão, curadoria e
mediação quando a coordenação liga a exigência (`interno.exige_2fa`).

## 4. Lacunas em relação ao pedido

| Tema | Hoje | Pedido |
| --- | --- | --- |
| Endereços | Uma página com estado interno | Uma URL por comunidade, post, perfil, chamado, núcleo, busca, tag, avisos, salvos, config, regras, moderação |
| Tipos de post | Post curto (500) na Rede; discussão e dúvida só no fórum, em outro sistema | Um sistema só: post, discussão, dúvida, chamado, enquete, aviso da coordenação |
| Conversa | Resposta de um nível na Rede; árvore com `pai` no fórum | Árvore até 6 níveis, recolher ramo, "continuar conversa", fio do autor |
| Edição | Não há | 15 min sem marca, depois "editado" com histórico |
| Mídia | Não há | Até 4 imagens, EXIF/GPS fora no cliente e no servidor, desfoque de rosto antes do envio |
| Contagens | **Apoios e "vou" aparecem para todo mundo** (`rede_post_json`) | Só o autor vê os apoios; só quem organizou vê o "vou" |
| Perfil | Codinome (novo), invisível | `@handle`, trancado (aprova seguidores), invisível, bio, post fixado, selos |
| Idade | 16 anos, autodeclaração | `IDADE_MINIMA_REDE = 18`, aferição proporcional ao risco (ECA Digital) |
| Comunidades | 9 de luta + 87 de disciplinas, lista plana, sem página, regras, flairs, fixados nem moderação visível | Taxonomia Lutas · Disciplinas · Instituto, página com regras, flairs, fixados, moderação por codinome, criação por proposta |
| Núcleos | Três coisas soltas: página pública, núcleos fechados da Rede, kit da trilha | Um núcleo só, com espaço fechado, trilha, agenda, convites com validade e limite (hash), papéis |
| Chamados | Tipo, quando e onde | Ponto público obrigatório (há aviso, não trava), fim, cidade, .ics, lembrete, aviso de alteração |
| Avisos | Lista sem agrupamento nem preferências | Agrupados, preferências por tipo, push opcional sem o texto |
| Busca | Texto do post e #hashtag por `position()` | Full-text por idioma com `unaccent`, filtros, sem vazar restrito |
| Salvos, silenciar | Silenciar palavras só no aparelho; salvar e seguir sala do fórum só no aparelho | No servidor, com opção de manter só no aparelho |
| Moderação | Ocultar, banir, fila, registro semanal | Motivo ligado a regra, recurso revisto por outra pessoa, modo lento, travar, automod por comunidade, protocolos documentados, relatório semestral |
| Novos posts | `rede_novos` por consulta | Faixa "N novos posts" por Realtime com payload só de IDs |
| Raspagem | Linha "tudo" pública sem login | Login para "Membros da Rede", limite de leitura por conta |

## 5. Riscos

1. **Exposição de adesão política**: as contagens públicas de "vou" e de apoios, e a lista de comunidades seguidas, revelam opinião
   política e filiação (dado sensível, LGPD art. 5º, II e art. 11). Prioridade alta na Fase 2.
2. **Menores**: a Rede aceita 16 anos por autodeclaração. O ECA Digital (Lei 15.211/2025) pede conta vinculada a responsável
   abaixo de 16 e não aceita só autodeclaração para conteúdo impróprio. Subir para 18 diminui o risco; a aferição é ponto de
   revisão jurídica.
3. **Colisão de endereços**: `trabalho` e `feminismo` são, ao mesmo tempo, comunidade de luta e comunidade de disciplina. Os posts
   das duas caem no mesmo lugar.
4. **Dois sistemas de conversa** (Rede e fórum), com regras, mediação e avisos parecidos mas não iguais: risco de uma regra valer
   num e não no outro.
5. **Fórum público com nome civil**: corrigido no bloco urgente, mas outras páginas abertas usam o nome do painel (comentários de
   aula, mural, reforço, jornal). Entra na auditoria de segurança desta rodada.
6. **Produção desatualizada**: o `install.sql` acumula mudanças que ainda não rodaram em produção.

## 6. Mapa de deduplicação das comunidades (proposta; aguarda aprovação)

| Fica | Junta | Por quê |
| --- | --- | --- |
| **Trabalho e sindicato** (luta) | luta `trabalho` + disciplina `sindicalismo` | Mesmo assunto. A disciplina "Educação para o trabalho" (slug `trabalho`) vira comunidade **Ofícios e trabalho** (slug novo), para acabar a colisão. |
| **Feminismo de classe** (luta) | luta `feminismo` + disciplina `feminismo` | Mesmo slug hoje: uma só, com a disciplina ligada. |
| **Luta antirracista** (luta) | luta `antirracismo` + disciplina `luta-negra` | A disciplina continua com as aulas, ligada à comunidade. |
| **LGBTQIA+** (luta) | luta `lgbt` + disciplina `lgbtqia` | Repetida. |
| **Luta pela terra** (luta) | luta `terra` + disciplina `luta-pela-terra` | "Terra e meio ambiente" misturava duas lutas. |
| **Meio ambiente e ecossocialismo** (luta) | disciplinas `meio-ambiente` + `ecossocialismo` | A outra metade de "Terra e meio ambiente". |
| **Favela e quebrada** (luta) | luta `quebrada` + disciplina `favelas` | Mesmo território. |
| **Educação pública** (luta) | luta `educacao-publica` + disciplinas `luta-dos-professores` + `movimento-estudantil` | A luta pela escola e pela universidade; "Educação popular e pedagogia" segue como disciplina. |
| **Saúde pública** (luta) | só a luta | "Saúde e primeiros socorros" é disciplina, não luta. |
| Disciplinas de teoria | `marxismo`, `socialismo`, `comunismo`, `capitalismo`, `ideologia-e-politica`, `dependencia`, `imperialismo` | Ficam como estão (são matérias), agrupadas na categoria "Teoria revolucionária" das Disciplinas. |
| **Instituto** (nova categoria) | Avisos da coordenação, Sugestões, Ajuda | Para não misturar recado oficial com debate. |

Cada slug antigo vira apelido e redireciona para o novo (nenhum post se perde). Ordem de decisão pedida: confirmar os nomes, a
separação de "Terra e meio ambiente" e o nome da categoria "Teoria revolucionária".
