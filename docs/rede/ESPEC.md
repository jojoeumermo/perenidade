# Rede Lúcia v2: especificação (Fase 1)

Base: o prompt "Rede Lúcia v2" (29/10/2026) e o inventário em `docs/rede/INVENTARIO.md`. **Nada daqui vai para o código antes da
aprovação.** As decisões em que escolhi o lado mais conservador estão marcadas com **(c)**.

## 0. Decisões que pedem um sim ou um não

**Aprovadas todas as 7 em 30/10/2026.**

1. Idade mínima **18** (hoje 16). Conta abaixo disso fica fora só da Rede, com mensagem gentil; o resto do site continua aberto. **(c)**
2. A linha **Tudo** e as comunidades de luta ficam para **membros logados**; só as comunidades das disciplinas (o fórum de
   dúvidas de hoje) continuam abertas a quem não tem conta, sem indexação por padrão. **(c)**
3. Apoios: o número só para o autor. "Eu vou": só quem organizou vê o total. Ninguém vê lista de nomes. **(c)**
4. Comunidades novas só por proposta aprovada pela coordenação.
5. Mídia: só imagem (JPG, PNG, WebP), até 4 por post, reencodada no servidor, EXIF/GPS tirado no navegador **e** no servidor,
   desfoque de rostos no navegador antes do envio. Vídeo fica fora desta versão (link vira cartão). **(c)**
6. E-mail de notificação desligado por padrão; push só se a pessoa ligar, sem o texto do post. **(c)**
7. O mapa de deduplicação do inventário (seção 6).

## 1. Modelo de dados

Reaproveita o que existe (schema `interno`, só por funções `security definer`, `anon` e `authenticated` sem acesso às tabelas).
Onde o prompt fala em RLS, a regra mora na função de visibilidade (`interno.rede_ve`), testada pela matriz da seção 2; as
tabelas novas também ganham RLS ligada e sem política para os papéis do cliente, como segunda tranca. **(c)**

| Tabela | Colunas principais | Nota |
| --- | --- | --- |
| `perfis` (existente) | `rede_codinome`, `rede_codinome_ok`, `rede_bio` (160), **novas**: `rede_handle` (3–20, `[a-z0-9_]`, único), `rede_modo` (`aberto`, `trancado`, `invisivel`), `rede_fixado` (post), `rede_18`, `rede_consentimento` (versão), `rede_selos` (lista) | O nome do painel nunca sai pela Rede |
| `rede_posts` (existente, ampliada) | + `tipo` (`post`, `discussao`, `duvida`, `chamado`, `enquete`, `aviso`), `titulo` (140), `corpo` (10.000), `root_id`, `profundidade` (≤6), `quote_of`, `flair`, `nucleo`, `aceita`, `verificada`, `travado`, `fixado`, `editado_em`, `apagado_em`, `busca` (tsvector) | O fórum migra para cá (seção 6) |
| `rede_post_edicoes` | post, texto anterior, quando | Histórico visível depois de 15 min |
| `rede_midia` | post, caminho aleatório, tipo, largura, altura, `blurhash`, texto alternativo | Mídia restrita só por URL assinada que expira |
| `rede_reacoes` | post, usuário, tipo (`apoio`, `util`), única por trio | Substitui `rede_apoios`; contagem sem condição de corrida |
| `rede_enquetes`, `rede_opcoes`, `rede_votos` | voto secreto, prazo | Só totais |
| `rede_chamados` | post, início, fim, cidade, ponto público (obrigatório), tipo, link | Hoje é um JSON no post; vira tabela |
| `rede_vou` (existente) | post, usuário | Total só para quem organizou |
| `rede_comunidades` | slug, nome, descrição, categoria (`lutas`, `disciplinas`, `instituto`), tipo (`aberta`, `restrita`, `fechada`), público padrão, ícone, cor, aulas e trilhas ligadas, apelidos | Hoje as comunidades são só texto no post |
| `rede_comunidade_membros` | comunidade, usuário, papel (`membro`, `moderacao`), situação, banimento até | Substitui `rede_comunidades_seguidas` e `rede_moderadores` |
| `rede_comunidade_regras`, `rede_comunidade_flairs`, `rede_propostas` | regras numeradas; flairs; proposta com objetivo, regras e 2 moderadores | |
| `rede_nucleos` | liga `nucleos` (página pública) a um espaço fechado, trilha, agenda | Junta núcleos públicos e fechados |
| `rede_nucleo_membros`, `rede_convites` | papel (`mediacao`, `membro`); convite com **hash** do token, escopo, validade, usos, revogação, quem convidou | Hoje o código do convite fica em texto |
| `rede_encontros` | núcleo, data, hora, tipo de local público, lembrete | Sem lista nominal de presença; no máximo a contagem |
| `rede_seguindo` (existente) | + `pendente` | Perfil trancado aprova seguidor |
| `rede_bloqueios` (existente), `rede_silenciados` | pessoa, comunidade ou palavra | Silenciar sincroniza na conta, com opção de ficar só no aparelho |
| `rede_salvos` | post, usuário | Privado, no servidor |
| `rede_avisos_prefs` | tipo de aviso, canal | Os avisos continuam em `avisos` com `categoria = 'rede'`/`'conta'` (já feito) |
| `rede_denuncias` | alvo, categoria, texto, status, quem cuida | Liga com `denuncias` e com a página Denunciar (visitante também denuncia) |
| `rede_moderacao` | ação, regra, motivo, quem, quando | **Só inserção** (sem `update`/`delete` para ninguém) |
| `rede_recursos` | ação contestada, texto, quem revisou (outra pessoa) | |
| `rede_regras` | versão, texto | As Normas da Rede versionadas |
| `rede_consentimentos` | usuário, versão, quando, revogado em | Dado sensível com consentimento destacado |

Índices: `(autor, criado_em desc)`, `(comunidade, criado_em desc)`, `(root_id, criado_em)`, GIN em `busca`,
`(para, lido, criado_em desc)` nos avisos. Busca com `unaccent` e configuração por idioma.

## 2. Matriz de visibilidade

Linhas: o público do post. Colunas: quem tenta ver. "Sim" vale para linha, busca, aviso, prévia (OG), exportação e contagem;
"não" vale para todos eles, inclusive o número de respostas.

| Público \ quem vê | Visitante | Membro | Seguidor | Membro da comunidade | Membro do núcleo | Equipe | Autor | Bloqueado (qualquer lado) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Internet (só disciplinas) | sim | sim | sim | sim | sim | sim | sim | não |
| Membros da Rede | não | sim | sim | sim | sim | sim | sim | não |
| Quem me segue | não | não | sim (trancado: só aprovados) | não | não | não | sim | não |
| Comunidade X (restrita/fechada) | não | só restrita lê | não | sim | não | não | sim | não |
| Núcleo X | não | não | não | não | sim | não* | sim | não |
| Equipe do instituto | não | não | não | não | não | sim | sim | não |

\* Moderação geral só entra em núcleo a partir de denúncia ou com justificativa registrada ("quebra-vidro"), com aviso à
mediação do núcleo.

Regras transversais: post removido some para todos menos o autor (que vê o motivo); perfil invisível não aparece em busca,
menção nem lista e seus posts não levam ao perfil; conta suspensa não posta nem reage; citação de post restrito aparece como
"conteúdo restrito" para quem não pode ver; nada amplia o alcance de um post restrito.

## 3. Fluxos

1. **Primeira entrada**: regras da Rede (resumo + link) → consentimento destacado para dado sensível (opinião política, filiação
   sindical), com versão → idade (18+) → codinome (com o aviso de não usar o nome civil) → escolher comunidades → guia rápido de
   segurança (4 cartões). Dá para pular só o guia.
2. **Postar**: tipo (post, discussão, dúvida, chamado, enquete; aviso só para a equipe) → texto → anexos (imagem passa pelo
   desfoque e pela limpeza de EXIF) → público e comunidade, cada um com uma linha de explicação → checagem automática (dado
   pessoal, endereço com número, ódio) → publicado, retido para revisão ou recusado com o motivo.
3. **Responder**: na árvore; no 6º nível vira "continuar conversa" em página própria.
4. **Denunciar**: botão em post, perfil e comunidade → categoria → texto opcional → protocolo; quem denunciou acompanha o status
   e nunca é revelado. Visitante denuncia conteúdo público pela página Denunciar.
5. **Moderar**: fila por prioridade (abuso de menores, ameaça, exposição de dados, incitação à violência e autolesão primeiro) →
   ação com regra e motivo → aviso ao autor com o caminho do recurso → registro só de inserção.
6. **Recorrer**: o autor contesta em até 30 dias → outra pessoa da moderação revê → decisão final registrada.
7. **Convite de núcleo**: a mediação gera link com validade e limite de usos (o banco guarda só o hash) → quem recebe entra com o
   próprio codinome → a mediação pode revogar a qualquer hora; sair ou ser removida corta o acesso na hora, inclusive mídia.
8. **Chamado**: tipo, início e fim, cidade, ponto público (obrigatório; endereço residencial bloqueado), público → "vou" privado
   → .ics → mudança ou cancelamento avisa quem marcou "vou".

## 4. Telas (em texto)

**Computador**, três colunas (como hoje): à esquerda a marca "Rede Lúcia", o menu (Início, Comunidades, Chamados, Núcleos,
Avisos, Salvos, Perfil) e o botão Escrever; no meio, 640 px de leitura com as abas Seguindo · Minhas comunidades · Tudo · Linha
geral e, acima da linha, a faixa "N novos posts, mostrar"; à direita, a busca, as comunidades de luta, os próximos chamados da
cidade escolhida e o cartão de segurança. **Celular**: barra de baixo com Início, Comunidades, Escrever, Avisos, Perfil; busca
no alto; escrever em tela cheia.

- **Cartão de post**: rosto (iniciais do codinome), codinome, selo (equipe, educador, moderação), comunidade e flair, tempo;
  texto com aviso de conteúdo recolhido; até 4 imagens; cartão de aula citada; ações Responder · Citar · Apoiar · Salvar ·
  Mais (denunciar, silenciar conversa). Discussão e dúvida mostram título e "útil".
- **Comunidade**: cabeçalho com ícone, nome, descrição, tipo, botão Entrar; abas Posts · Sobre (regras, moderação por codinome,
  aulas ligadas); ordenação Novos | Mais úteis | Sem resposta | Em debate, com a fórmula explicada num "por que esta ordem?".
- **Perfil**: rosto, codinome, `@handle`, selos, bio, post fixado; Seguir (ou Pedir para seguir); sem contagens públicas.
- **Núcleo**: nome, cidade, trilha com o progresso do grupo, próximos encontros em local público, mural do núcleo, materiais.
- **Estados vazios** que orientam (escolher comunidades, ler as regras, começar uma trilha); skeletons; confirmações dentro da
  página, nunca `alert`/`confirm` do navegador.

## 5. Textos da interface (PT, principais)

- "Postando como **{codinome}**" · "Quem pode ver: {público}" · "Por que esta ordem?"
- Públicos: "Internet (qualquer pessoa, sem conta)", "Membros da Rede", "Quem me segue", "Só esta comunidade", "Só este núcleo",
  "Só a equipe do instituto".
- Codinome: "Na Rede, ninguém aparece com o nome de verdade, nem a equipe." (já no ar)
- Chamado: "Ponto de encontro público (praça, biblioteca, sindicato, escola). Nunca um endereço de casa."
- Denúncia: "Quem denuncia nunca é revelado. Você acompanha o andamento em Avisos."
- Saída rápida: "Sair rápido" → página neutra e limpeza dos dados da Rede neste aparelho.

## 6. Migração e volta atrás

1. **Tudo atrás de chave** (`NEXT_PUBLIC_RECURSOS`, recurso `rede-v2`): equipe → beta → todos. A Rede de hoje continua até a
   chave virar para todos.
2. **Banco**: só acréscimos (`add column if not exists`, tabelas novas). Nenhum `drop` até a v2 estar no ar há 30 dias.
3. **Fórum → Rede**: `topicos` viram `rede_posts` do tipo `duvida`/`discussao` (título, corpo, autor, disciplina → comunidade,
   aceita, criado_em); `respostas` viram respostas na árvore (`pai` → `resposta_a`, `root_id`); `votos` viram `util`. As
   tabelas antigas ficam intactas e um mapa `id antigo → id novo` permite voltar.
4. **Comunidades**: cada slug antigo vira apelido do novo; os posts mudam de slug numa transação com o mapa guardado.
5. **Núcleos**: os núcleos públicos e os espaços fechados se ligam por `rede_nucleos`; os códigos de convite em texto são
   trocados por convites com hash (os antigos expiram em 30 dias, avisando a mediação).
6. **Endereços antigos**: `?t=` e `?sala=` redirecionam (301) para `/comunidade/p/[id]` e `/comunidade/c/[slug]`.
7. **Volta atrás**: desligar a chave devolve a Rede de hoje; o banco antigo segue íntegro durante os 30 dias.

## 7. Fases seguintes (depois do sim)

Fase 2 fundação (tabelas, funções, matriz de visibilidade automatizada, limites) · Fase 3 rede (tipos, árvore, comunidades,
feeds, perfis, busca) · Fase 4 formação e organização (citar aula, dúvidas verificadas, chamados, núcleos, convites) · Fase 5
segurança e moderação · Fase 6 polimento (celular, acessibilidade, 6 idiomas, desempenho) · Fase 7 lançamento. Os entregáveis
`MODERACAO.md`, `PRIVACIDADE.md` e `LANCAMENTO.md` saem nas fases 5 e 7. O Mural da equipe do painel recebe a mesma tecnologia
depois da Fase 3.

**Ponto de revisão jurídica** (não é parecer): aferição de idade (ECA Digital, Lei 15.211/2025), retenção de registros de acesso
(Marco Civil), consentimento para dado sensível (LGPD art. 11) e o fluxo de notificação após a decisão do STF sobre o art. 19
do Marco Civil (Temas 533 e 987).
