-- ───────────────────────────── Rede Lúcia v2: pacote comunidades (Etapa 7, R4, itens 36 a 40) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS da fundação
-- (2026-11-rede-fundacao.sql). Contrato: docs/rede/V2.md. Especificação: docs/rede/ESPEC.md. Teste: npm run testar:rede-comunidades.
--
-- O que este arquivo faz, e só isto:
--   1. A taxonomia Lutas · Disciplinas · Instituto (INVENTARIO, seção 6, decisão 7 da ESPEC): semeia as comunidades, com regras e
--      etiquetas padrão, junta as disciplinas repetidas às lutas (o slug antigo vira apelido e os posts mudam de lugar, com o
--      mapa em rede_migracao) e separa "Educação para o trabalho" ("trabalho") de "Trabalho e sindicato" (também "trabalho").
--   2. A página da comunidade: entrar e sair (aberta entra na hora; restrita pede aprovação da moderação; fechada só por
--      convite, núcleo ou turma), regras numeradas, etiquetas, moderadores por codinome, posts fixados.
--   3. Comunidade nova só por proposta (objetivo, regras, 2 moderadores) decidida pela coordenação (ESPEC, decisão 4).
--   4. "Discutir esta aula": o post se liga a uma aula (citação) e a linha da aula mostra só esses posts.
--   5. Núcleo (espaço fechado ligado a um núcleo público, com encontros em local público) e turma do mês (comunidade fechada
--      de quem se inscreveu na turma).
--
-- Dado de pessoa: nenhum novo, nenhuma tabela nova. Nada de contagem de membros (adesão a uma luta pode revelar opinião política:
-- LGPD art. 5º, II e art. 11); a lista de quem é de uma comunidade nunca sai, só os codinomes de quem modera. Toda leitura de post
-- passa por interno.rede_ve.
--
-- Leis: LGPD (13.709/2018) arts. 5º, II, 7º e 11 (adesão a comunidade política é dado sensível; a conversa é por consentimento
-- específico, dado em rede_aderir) e art. 18 (sair a qualquer hora, sem lista pública); Marco Civil (12.965/2014) arts. 19 e 21
-- (a moderação da comunidade só age registrando regra e motivo em rede_moderacao); Código Penal arts. 138 a 140 (as regras
-- padrão proíbem calúnia, difamação e injúria).

-- ── 1. Quem modera, regras e etiquetas padrão ────────────────────────────────────────────────────────────────────────────

/** Esta pessoa modera esta comunidade (moderação dela) ou cuida da comunidade em geral (coordenação, curadoria, mediação, educação)? */
create or replace function interno.rede3_com_modera(p_slug text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and (
    exists (select 1 from rede_comunidade_membros m where m.comunidade = p_slug and m.usuario = p_quem and m.papel = 'moderacao' and m.situacao = 'ativo')
    or (p_quem = auth.uid() and interno.cuida()))
$$;

/** A comunidade pelo slug ou por um apelido antigo (o slug novo ganha). */
create or replace function interno.rede3_com_achar(p_slug text) returns interno.rede_comunidades language sql stable security definer set search_path = interno, pg_temp as $$
  select k from rede_comunidades k where k.slug = coalesce(p_slug, '') or coalesce(p_slug, '') = any (k.apelidos) order by (k.slug = coalesce(p_slug, '')) desc limit 1
$$;

/** Regras e etiquetas padrão, só onde a comunidade ainda não tem nenhuma (a moderação troca depois). */
create or replace function interno.rede3_com_padroes(p_slug text) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare c rede_comunidades;
begin
  select * into c from rede_comunidades where slug = p_slug;
  if not found then return; end if;
  if not exists (select 1 from rede_comunidade_regras where comunidade = p_slug) then
    insert into rede_comunidade_regras (comunidade, numero, titulo, texto) values
      (p_slug, 1, 'Fale com respeito', 'Critique ideias, não pessoas. Nada de xingamento, humilhação, calúnia ou perseguição.'),
      (p_slug, 2, 'Nada de dados pessoais', 'Não publique CPF, telefone, e-mail nem endereço de casa, seu ou de outra pessoa.'),
      (p_slug, 3, case c.categoria when 'disciplinas' then 'Pergunte com o contexto' else 'Diga de onde vem' end,
        case c.categoria when 'disciplinas' then 'Conte o que você já tentou ou leu. Quem responde dá o caminho, não só o resultado.' else 'Ao afirmar um fato, diga a fonte. Boato não circula aqui.' end);
  end if;
  if not exists (select 1 from rede_comunidade_flairs where comunidade = p_slug) then
    insert into rede_comunidade_flairs (comunidade, nome)
    select p_slug, e from unnest(case c.categoria
      when 'lutas' then array['Notícia', 'Organização', 'Pedido de ajuda', 'Debate']
      when 'disciplinas' then array['Dúvida', 'Material', 'Experiência', 'Debate']
      else array['Ideia', 'Problema', 'Pergunta'] end) as e;
  end if;
end $$;

-- ── 2. A semente da taxonomia ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Cria (ou completa) as comunidades da taxonomia. Idempotente: roda de novo sem estrago. Uma comunidade que a fundação criou
 * sozinha (disciplina com tópico no Fórum, sem descrição) recebe nome e descrição de verdade; uma que a coordenação já editou
 * (descrição preenchida) não é sobrescrita. As disciplinas repetidas viram apelido da luta: posts, adesões e etiquetas passam para a
 * luta, e o mapa antigo → novo fica em rede_migracao (nada se perde, e ?sala= continua levando ao lugar certo).
 */
create or replace function interno.rede3_com_semear() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  s jsonb; v_slug text; v_antigo text; k rede_comunidades; v_novas integer := 0; v_juntas integer := 0;
  v_semente jsonb := $sem$[{"slug":"moradia","nome":"Moradia e ocupações","descricao":"Casa digna, aluguel, despejo, ocupação e direito à cidade.","categoria":"lutas","tipo":"aberta","publico":"membros","apelidos":[]},{"slug":"trabalho","nome":"Trabalho e sindicato","descricao":"Salário, jornada, carteira assinada, organização no local de trabalho e sindicalismo.","categoria":"lutas","tipo":"aberta","publico":"membros","apelidos":["sindicalismo"]},{"slug":"antirracismo","nome":"Luta antirracista","descricao":"Contra o racismo e pela memória, a cultura e os direitos do povo negro.","categoria":"lutas","tipo":"aberta","publico":"membros","apelidos":["luta-negra"]},{"slug":"feminismo","nome":"Feminismo de classe","descricao":"A luta das mulheres trabalhadoras: violência, trabalho, cuidado e direitos.","categoria":"lutas","tipo":"aberta","publico":"membros","apelidos":[]},{"slug":"lgbt","nome":"LGBTQIA+","descricao":"Direitos, acolhimento e organização da população LGBTQIA+.","categoria":"lutas","tipo":"aberta","publico":"membros","apelidos":["lgbtqia"]},{"slug":"terra","nome":"Luta pela terra","descricao":"Reforma agrária, quilombos, povos do campo, das águas e da floresta.","categoria":"lutas","tipo":"aberta","publico":"membros","apelidos":["luta-pela-terra"]},{"slug":"meio-ambiente","nome":"Meio ambiente e ecossocialismo","descricao":"Crise climática, território e o projeto de uma sociedade que cuide da natureza.","categoria":"lutas","tipo":"aberta","publico":"membros","apelidos":["ecossocialismo"]},{"slug":"quebrada","nome":"Favela e quebrada","descricao":"Cultura, território e organização das favelas, periferias e quebradas.","categoria":"lutas","tipo":"aberta","publico":"membros","apelidos":["favelas"]},{"slug":"educacao-publica","nome":"Educação pública","descricao":"A escola e a universidade públicas: professoras, professores, estudantes e famílias.","categoria":"lutas","tipo":"aberta","publico":"membros","apelidos":["luta-dos-professores","movimento-estudantil"]},{"slug":"saude-publica","nome":"Saúde pública","descricao":"SUS, saúde mental, cuidado e acesso a atendimento.","categoria":"lutas","tipo":"aberta","publico":"membros","apelidos":[]},{"slug":"portugues","nome":"Português","descricao":"Ler, escrever e interpretar: da alfabetização à redação.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"literatura","nome":"Literatura","descricao":"Dos clássicos em domínio público à literatura que nasce do povo.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"ingles","nome":"Inglês","descricao":"Do zero à leitura de textos, sem pagar curso.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"espanhol","nome":"Espanhol","descricao":"A língua dos nossos vizinhos da América Latina.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"chines","nome":"Chinês (mandarim)","descricao":"Tons, pinyin e os primeiros caracteres.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"russo","nome":"Russo","descricao":"Língua russa do zero: o alfabeto cirílico, a comunicação do dia a dia, o sistema de casos e a leitura de textos.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"artes","nome":"Artes","descricao":"História da arte, artes visuais, teatro, cinema e cultura popular.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"musica","nome":"Música","descricao":"Do som à partitura: teoria, leitura e prática.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"matematica","nome":"Matemática","descricao":"Da tabuada ao cálculo, um passo de cada vez.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"fisica","nome":"Física","descricao":"Movimento, energia, eletricidade e a estrutura da matéria.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"quimica","nome":"Química","descricao":"Do átomo às reações que movem o cotidiano e a indústria.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"biologia","nome":"Biologia","descricao":"A vida, da célula aos ecossistemas, e a saúde do povo.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"astronomia","nome":"Astronomia e astronáutica","descricao":"O céu, o Sistema Solar e a corrida espacial.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"informatica","nome":"Informática","descricao":"Do primeiro contato com o computador à segurança digital.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"programacao","nome":"Programação","descricao":"Primeiro a lógica; depois, Python e PHP.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"inteligencia-artificial","nome":"Inteligência artificial","descricao":"Como as máquinas aprendem, o que conseguem fazer e a quem servem.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"historia","nome":"História","descricao":"A história contada do ponto de vista de quem trabalha.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"geografia","nome":"Geografia","descricao":"Território, população, cidade e campo.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"sociologia","nome":"Sociologia","descricao":"Classes, trabalho, cultura e desigualdade.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"filosofia","nome":"Filosofia","descricao":"Dos gregos ao materialismo: aprender a pensar por conta própria.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"economia","nome":"Economia","descricao":"Trabalho, salário, preço, dívida e crise, sem economês.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"politica","nome":"Política e cidadania","descricao":"Estado, direitos, eleições e participação popular.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"educacao-popular","nome":"Educação popular e pedagogia","descricao":"Paulo Freire, pedagogia histórico-crítica e a escola como lugar de quem ensina aprendendo.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"midia","nome":"Mídia e comunicação","descricao":"Ler a notícia com olho crítico e fazer a própria comunicação.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"marxismo","nome":"Marxismo","descricao":"Marx e Engels do começo: classes, mais-valia e materialismo histórico.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"socialismo","nome":"Socialismo","descricao":"Das utopias às revoluções: experiências, conquistas e debates.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"comunismo","nome":"Comunismo","descricao":"A ideia de uma sociedade sem classes e a história de quem lutou por ela.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"ideologia-e-politica","nome":"Ideologia e política","descricao":"Moral, direito, Estado e sociedade: como se forma a consciência política, no Brasil, na América Latina e no mundo.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"deficiencia","nome":"Pessoas com deficiência","descricao":"Direitos, acessibilidade e a luta contra o capacitismo.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"povos-indigenas","nome":"Povos indígenas","descricao":"História, terra e resistência dos povos originários.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"danca","nome":"Dança","descricao":"O corpo que se expressa: história social da dança e as danças do povo brasileiro.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"primeiros-socorros","nome":"Saúde e primeiros socorros","descricao":"Cuidar da saúde, conhecer o SUS e saber o que fazer até o socorro chegar.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"educacao-sexual","nome":"Educação sexual","descricao":"O corpo, o consentimento e a prevenção de abusos; cuidados com a saúde, ISTs, gravidez e métodos de proteção, com informação séria e sem tabu.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"psicologia","nome":"Psicologia","descricao":"Noções fundamentais e o sofrimento psíquico ligado ao trabalho e à vida social.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"direito","nome":"Direito e Constituição","descricao":"A Constituição de 1988, os direitos de quem trabalha, o direito de greve e de manifestação.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"teologia","nome":"Teologia e religiões","descricao":"História das religiões, cristianismo primitivo e Teologia da Libertação.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"pessoas-idosas","nome":"Luta das pessoas idosas","descricao":"Previdência, Estatuto da Pessoa Idosa e o direito de envelhecer com dignidade.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"desenho","nome":"Desenho","descricao":"Do traço à perspectiva: observação, proporção, luz e sombra, com lápis e papel.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"design","nome":"Design","descricao":"Cartaz, tipografia e desenho de objetos: a forma a serviço de quem usa.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"teatro","nome":"Teatro e artes cênicas","descricao":"Do jogo teatral ao Teatro do Oprimido: o palco como lugar de pensar e agir.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"cinema","nome":"Cinema e audiovisual","descricao":"Como um filme é feito e lido; o cinema brasileiro e o cinema de luta.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"edicao-de-video","nome":"Edição de vídeo","descricao":"Cortar, montar, legendar e finalizar vídeos para aulas, jornal e redes, com programas livres.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"edicao-de-foto","nome":"Edição de foto","descricao":"Tratar, recortar, corrigir cor e montar imagens para cartazes, jornal e redes, do celular aos programas profissionais.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"modelagem-3d","nome":"Modelagem 3D","descricao":"Criar objetos, personagens e cenários em três dimensões, com programas livres como o Blender, da primeira forma à animação e à impressão 3D.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"educacao-fisica","nome":"Educação física","descricao":"Corpo, jogo, esporte e saúde: movimento como direito, não como mercadoria.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"defesa-pessoal","nome":"Defesa pessoal","descricao":"Prevenir, sair de uma situação de risco e se proteger junto: técnicas simples, capoeira e outras artes de luta do povo.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"alfabetizacao","nome":"Alfabetização","descricao":"Ler e escrever em qualquer idade, partindo das palavras da vida de quem aprende.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"enem","nome":"ENEM","descricao":"Como a prova funciona, como estudar cada área e como escrever a redação.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"manutencao","nome":"Eletrônica","descricao":"Circuitos, componentes, solda e reparo de placas, e montagem e manutenção de computadores e notebooks.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"capitalismo","nome":"O que é o capitalismo","descricao":"Mercadoria, salário, lucro e crise: como funciona o sistema em que vivemos, visto de baixo.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"antropologia","nome":"Antropologia","descricao":"Cultura, parentesco, rito e diferença: o estudo dos modos de viver.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"servico-social","nome":"Serviço social","descricao":"Questão social, políticas públicas e o trabalho de quem atende o povo.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"arquitetura","nome":"Arquitetura e urbanismo","descricao":"A casa, a rua e a cidade: como o espaço é construído, e para quem.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"arquivologia","nome":"Bibliotecas, arquivos e museus","descricao":"Guardar, organizar e abrir a memória: biblioteconomia, arquivologia e museologia.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"dependencia","nome":"Teoria da Dependência e América Latina","descricao":"Por que a América Latina continua pobre mesmo crescendo: Marini, Bambirra, Theotonio dos Santos e a superexploração do trabalho.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"imperialismo","nome":"Imperialismo e Geopolítica Contemporânea","descricao":"Quem manda no mundo e como: capital financeiro, guerras, sanções, dívida e a disputa entre potências hoje.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"frances","nome":"Francês","descricao":"Língua francesa do zero: comunicação do dia a dia, leitura e a francofonia.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"ingles-infantil","nome":"Inglês infantil","descricao":"Primeiros passos em inglês para crianças: palavras do dia a dia, músicas e brincadeiras.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"redes-e-seguranca","nome":"Redes e segurança da informação","descricao":"Como as redes funcionam por dentro e como proteger sistemas e pessoas, com ênfase em hacking ético: sempre com autorização e dentro da lei.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"trancista","nome":"Trancista","descricao":"Tranças afro: cuidados com o cabelo, técnicas, história e como transformar o ofício em renda.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"costureira","nome":"Costura e crochê","descricao":"Costura do básico ao conserto e à confecção de peças, e crochê do primeiro ponto às peças para vender, com segurança no trabalho e caminhos para gerar renda.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"engenharia-de-sistemas","nome":"Engenharia de Sistemas","descricao":"Como os sistemas de software funcionam por dentro e como projetá-los para serem eficientes, confiáveis e escaláveis: do processador aos sistemas distribuídos.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"estado","nome":"O que é e como funciona o Estado?","descricao":"Política básica para quem nunca teve aula de política: o que é o Estado, quem manda, de onde vem o dinheiro e por que isso importa para o povo.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"instituicoes","nome":"Congresso, STF, PGR: as instituições","descricao":"Como funcionam o Congresso, o Supremo, a Procuradoria-Geral, os ministérios e as prefeituras, e como o povo pressiona cada um.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"eleicoes","nome":"Eleições, partidos e voto","descricao":"Como se vota e como se conta o voto, o que é um partido, quem financia as campanhas e como fiscalizar quem foi eleito.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"neurodiversidade","nome":"Neurodiversidade e psicanálise","descricao":"Autismo, TDAH, dislexia e outras formas de ser e aprender, sem patologizar, e uma introdução à psicanálise para entender a si e aos outros.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"barbeiro","nome":"Barbeiro","descricao":"Corte masculino e barba: ferramentas, higiene e biossegurança, técnicas e como montar o próprio trabalho.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"oratoria-e-lideranca","nome":"Oratória e liderança","descricao":"Falar em público com clareza, preparar uma fala, conduzir reuniões e assembleias e liderar coletivamente.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"samba-e-cultura","nome":"Samba e cultura","descricao":"O samba da roda à avenida: história, ritmo, cultura negra e brasileira, o morro, a malandragem e quem fez o samba.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"eletricista","nome":"Eletricista","descricao":"Eletricidade do básico à instalação de uma casa, com segurança em primeiro lugar: multímetro, quadro, tomadas, chuveiro e o ofício como renda.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"fotografia","nome":"Fotografia","descricao":"Luz, composição e técnica para fotografar com o celular, documentar a luta e proteger quem aparece na imagem.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"web-design","nome":"Web design","descricao":"HTML, CSS e acessibilidade para fazer sites leves, livres e publicados de graça.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"alemao","nome":"Alemão","descricao":"Do zero à leitura de notícias e de Brecht no original, sem pagar curso.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"ciencias-sociais","nome":"Ciências sociais","descricao":"Sociologia, antropologia e ciência política juntas, com métodos para pesquisar junto com a comunidade.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"ciencia-politica","nome":"Ciência política","descricao":"Estado, poder, partidos e movimentos, da teoria clássica e marxista ao imperialismo na América Latina.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"formacao-militante","nome":"Formação militante","descricao":"Teoria revolucionária e prática de organização para quem quer se formar como sujeito da luta.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"oficios-e-trabalho","nome":"Ofícios e trabalho","descricao":"Aprender um ofício e ganhar a vida com ele: trançaria, costura, elétrica, barbearia e o que mais a gente ensina.","categoria":"disciplinas","tipo":"aberta","publico":"internet","apelidos":[]},{"slug":"avisos-da-coordenacao","nome":"Avisos da coordenação","descricao":"Os recados oficiais do instituto. Só a equipe escreve aqui; todo mundo da Rede lê.","categoria":"instituto","tipo":"restrita","publico":"membros","apelidos":[]},{"slug":"sugestoes","nome":"Sugestões","descricao":"Ideias para o instituto e para a Rede: o que falta, o que melhorar.","categoria":"instituto","tipo":"aberta","publico":"membros","apelidos":[]},{"slug":"ajuda","nome":"Ajuda","descricao":"Dúvidas sobre como usar o site e a Rede. A equipe e quem já aprendeu respondem.","categoria":"instituto","tipo":"aberta","publico":"membros","apelidos":[]}]$sem$::jsonb;
begin
  -- "Educação para o trabalho" (disciplina "trabalho") sai do caminho da luta "Trabalho e sindicato": os tópicos do Fórum que a
  -- fundação levou para "trabalho" vão para "oficios-e-trabalho" antes de "trabalho" virar luta. Posts da Rede de hoje ficam na luta.
  if exists (select 1 from rede_comunidades where slug = 'trabalho' and categoria = 'disciplinas') then
    insert into rede_comunidades (slug, nome, descricao, categoria, tipo, publico_padrao)
    values ('oficios-e-trabalho', 'Ofícios e trabalho', 'Aprender um ofício e ganhar a vida com ele: trançaria, costura, elétrica, barbearia e o que mais a gente ensina.', 'disciplinas', 'aberta', 'internet')
    on conflict (slug) do nothing;
    update rede_posts p set comunidade = 'oficios-e-trabalho'
    where p.comunidade = 'trabalho' and p.id::text in (select novo from rede_migracao where tipo in ('topico', 'resposta'));
    insert into rede_migracao (tipo, antigo, novo) values ('comunidade', 'trabalho', 'oficios-e-trabalho')
    on conflict (tipo, antigo) do update set novo = excluded.novo;
  end if;

  for s in select * from jsonb_array_elements(v_semente) loop
    v_slug := s ->> 'slug';
    select * into k from rede_comunidades where slug = v_slug;
    if not found then
      insert into rede_comunidades (slug, nome, descricao, categoria, tipo, publico_padrao, apelidos)
      values (v_slug, s ->> 'nome', s ->> 'descricao', s ->> 'categoria', s ->> 'tipo', s ->> 'publico', array(select jsonb_array_elements_text(s -> 'apelidos')));
      v_novas := v_novas + 1;
    elsif k.descricao = '' then
      -- Criada sozinha pela fundação: ganha a identidade da taxonomia (a categoria muda junto com o público, que a regra da tabela exige).
      update rede_comunidades set nome = s ->> 'nome', descricao = s ->> 'descricao', categoria = s ->> 'categoria', tipo = s ->> 'tipo',
        publico_padrao = s ->> 'publico'
      where slug = v_slug;
    end if;
    -- Os apelidos (slugs antigos) entram sem tirar os que já havia.
    update rede_comunidades c set apelidos = (select coalesce(array_agg(distinct a), '{}') from unnest(c.apelidos || array(select jsonb_array_elements_text(s -> 'apelidos'))) a)
    where c.slug = v_slug;
    for v_antigo in select jsonb_array_elements_text(s -> 'apelidos') loop
      if v_antigo <> v_slug and exists (select 1 from rede_comunidades where slug = v_antigo) then
        update rede_posts set comunidade = v_slug where comunidade = v_antigo;
        -- Quem silenciou a comunidade antiga continua com ela silenciada na nova (sem chave estrangeira: não some sozinho, mas ficaria solto).
        update rede_silenciados set comunidade = v_slug where comunidade = v_antigo;
        insert into rede_comunidade_membros (comunidade, usuario, papel, situacao, banido_ate, entrou_em)
        select v_slug, m.usuario, m.papel, m.situacao, m.banido_ate, m.entrou_em from rede_comunidade_membros m where m.comunidade = v_antigo
        on conflict (comunidade, usuario) do nothing;
        delete from rede_comunidades where slug = v_antigo;
        v_juntas := v_juntas + 1;
      end if;
      insert into rede_migracao (tipo, antigo, novo) values ('comunidade', v_antigo, v_slug) on conflict (tipo, antigo) do nothing;
    end loop;
    perform interno.rede3_com_padroes(v_slug);
  end loop;
  return jsonb_build_object('novas', v_novas, 'juntas', v_juntas, 'total', jsonb_array_length(v_semente));
end $$;

-- ── 3. Ver, entrar e sair ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A situação de uma pessoa numa comunidade: 'membro', 'pendente', 'banido' ou nulo. */
create or replace function interno.rede3_com_situacao(p_slug text, p_quem uuid) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select case when p_quem is null then null else (
    select case when m.situacao = 'banido' or m.banido_ate > now() then 'banido' when m.situacao = 'pendente' then 'pendente' else 'membro' end
    from rede_comunidade_membros m where m.comunidade = p_slug and m.usuario = p_quem) end
$$;

/**
 * As comunidades que esta pessoa pode ver, por categoria. Visitante: só as das disciplinas (decisão 2). Conta: também as lutas e o
 * Instituto (abertas e restritas); comunidade fechada só para quem é dela. Sem contagem de membros.
 */
create or replace function public.rede_com_lista() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  perform interno.aberta('comunidade');
  return jsonb_build_object('itens', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'slug', c.slug, 'nome', c.nome, 'descricao', c.descricao, 'categoria', c.categoria, 'tipo', c.tipo, 'icone', c.icone, 'cor', c.cor,
      'situacao', interno.rede3_com_situacao(c.slug, v)) order by case c.categoria when 'lutas' then 1 when 'disciplinas' then 2 else 3 end, c.nome), '[]'::jsonb)
    from rede_comunidades c
    where c.slug not like 'fechado-%'
      and (c.tipo <> 'fechada' or interno.rede2_na_comunidade(c.slug, v))
      and (c.categoria = 'disciplinas' or v is not null)));
end $$;

/**
 * A página inteira de uma comunidade: o que rede_comunidade já devolve (regras, etiquetas, moderação por codinome), mais a situação
 * de quem pergunta, os posts fixados (só os que ela pode ver), as aulas ligadas e, para a moderação, quantos pedidos esperam.
 */
create or replace function public.rede_com_pagina(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades; v_base jsonb; v_modero boolean;
begin
  perform interno.aberta('comunidade');
  v_base := public.rede_comunidade(p_slug);
  c := interno.rede3_com_achar(p_slug);
  v_modero := interno.rede3_com_modera(c.slug, v);
  return jsonb_build_object(
    'comunidade', v_base,
    'situacao', interno.rede3_com_situacao(c.slug, v),
    'modero', v_modero,
    'pedidos', case when v_modero then (select count(*)::integer from rede_comunidade_membros m where m.comunidade = c.slug and m.situacao = 'pendente') end,
    'fixados', (select coalesce(jsonb_agg(interno.rede_post_v2(r, v) order by r.criado_em desc), '[]'::jsonb) from (
      select p.* from rede_posts p
      where p.comunidade = c.slug and p.fixado and p.resposta_a is null and interno.rede_ve(p, v) and not interno.rede_silenciado(p, v)
      order by p.criado_em desc limit 3) r));
end $$;

/** Entrar: aberta entra na hora; restrita fica pendente até a moderação aceitar; fechada só por convite, núcleo ou turma. */
create or replace function public.rede_com_entrar(p_slug text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; v_atual text; v_situacao text;
begin
  perform interno.aberta('comunidade');
  if not coalesce((select rede_18 from perfis where id = v), false) then perform interno.erro('confirme_idade'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede2_limite('seguir');
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null then perform interno.erro('nao_encontrado'); end if;
  v_atual := interno.rede3_com_situacao(c.slug, v);
  if v_atual = 'banido' then perform interno.erro('sem_permissao'); end if;
  if v_atual is not null then return jsonb_build_object('situacao', v_atual); end if;
  if c.tipo = 'fechada' then perform interno.erro('nao_encontrado'); end if;
  v_situacao := case when c.tipo = 'aberta' then 'ativo' else 'pendente' end;
  insert into rede_comunidade_membros (comunidade, usuario, papel, situacao) values (c.slug, v, 'membro', v_situacao)
  on conflict (comunidade, usuario) do nothing;
  if v_situacao = 'pendente' then
    insert into avisos (para, texto, categoria)
    select m.usuario, format('Há um pedido para entrar em “%s” esperando a moderação.', c.nome), 'rede'
    from rede_comunidade_membros m where m.comunidade = c.slug and m.papel = 'moderacao' and m.situacao = 'ativo';
  end if;
  return jsonb_build_object('situacao', case when v_situacao = 'ativo' then 'membro' else 'pendente' end);
end $$;

/** Sair (ou desistir do pedido). Quem foi banido continua banido: a linha do banimento fica. */
create or replace function public.rede_com_sair(p_slug text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null then perform interno.erro('nao_encontrado'); end if;
  delete from rede_comunidade_membros where comunidade = c.slug and usuario = v and situacao <> 'banido' and (banido_ate is null or banido_ate < now());
  return jsonb_build_object('situacao', interno.rede3_com_situacao(c.slug, v));
end $$;

/** Quem pediu para entrar (só a moderação da comunidade): o codinome e um código para decidir. */
create or replace function public.rede_com_pedidos(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object('itens', (
    select coalesce(jsonb_agg(jsonb_build_object('usuario', m.usuario, 'codinome', interno.rede_nome(m.usuario), 'quando', m.entrou_em) order by m.entrou_em), '[]'::jsonb)
    from (select * from rede_comunidade_membros where comunidade = c.slug and situacao = 'pendente' order by entrou_em limit 50) m));
end $$;

create or replace function public.rede_com_decidir_pedido(p_slug text, p_usuario uuid, p_aceita boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  if not exists (select 1 from rede_comunidade_membros where comunidade = c.slug and usuario = p_usuario and situacao = 'pendente') then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_aceita, false) then
    update rede_comunidade_membros set situacao = 'ativo', entrou_em = now() where comunidade = c.slug and usuario = p_usuario;
    perform interno.avisar_em(p_usuario, format('Você entrou em “%s”.', c.nome), 'rede');
  else
    delete from rede_comunidade_membros where comunidade = c.slug and usuario = p_usuario and situacao = 'pendente';
    perform interno.avisar_em(p_usuario, format('O pedido para entrar em “%s” não foi aceito.', c.nome), 'rede');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── 4. Regras, etiquetas, fixados, moderadores ───────────────────────────────────────────────────────────────────────────────

/** Troca as regras numeradas (até 20, ao menos 1). Só a moderação da comunidade e quem cuida da comunidade. */
create or replace function public.rede_com_regras_salvar(p_slug text, p_regras jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; r jsonb; n integer := 0; v_titulo text; v_texto text;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  if p_regras is null or jsonb_typeof(p_regras) is distinct from 'array' or jsonb_array_length(p_regras) not between 1 and 20 then perform interno.erro('invalido:regras'); end if;
  for r in select * from jsonb_array_elements(p_regras) loop
    v_titulo := interno.txt(r ->> 'titulo', 'regras', 3, 80);
    v_texto := interno.txt(r ->> 'texto', 'regras', 0, 500);
  end loop;
  delete from rede_comunidade_regras where comunidade = c.slug;
  for r in select * from jsonb_array_elements(p_regras) loop
    n := n + 1;
    insert into rede_comunidade_regras (comunidade, numero, titulo, texto) values (c.slug, n, interno.txt(r ->> 'titulo', 'regras', 3, 80), interno.txt(r ->> 'texto', 'regras', 0, 500));
  end loop;
  perform interno.registrar('rede_com_regras', c.slug, jsonb_build_object('regras', n));
  return jsonb_build_object('regras', (select coalesce(jsonb_agg(jsonb_build_object('numero', g.numero, 'titulo', g.titulo, 'texto', g.texto) order by g.numero), '[]'::jsonb) from rede_comunidade_regras g where g.comunidade = c.slug));
end $$;

/** Troca as etiquetas (até 12). Post que já usa uma etiqueta tirada guarda o nome dela. */
create or replace function public.rede_com_etiquetas_salvar(p_slug text, p_etiquetas jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; e jsonb; v_nome text; v_cor text;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  if p_etiquetas is null or jsonb_typeof(p_etiquetas) is distinct from 'array' or jsonb_array_length(p_etiquetas) > 12 then perform interno.erro('invalido:etiquetas'); end if;
  for e in select * from jsonb_array_elements(p_etiquetas) loop
    v_nome := interno.txt(e ->> 'nome', 'etiquetas', 2, 40);
    v_cor := lower(coalesce(e ->> 'cor', ''));
    if v_cor <> '' and v_cor !~ '^#[0-9a-f]{6}$' then perform interno.erro('invalido:etiquetas'); end if;
  end loop;
  delete from rede_comunidade_flairs where comunidade = c.slug;
  for e in select * from jsonb_array_elements(p_etiquetas) loop
    insert into rede_comunidade_flairs (comunidade, nome, cor) values (c.slug, interno.txt(e ->> 'nome', 'etiquetas', 2, 40), lower(coalesce(e ->> 'cor', '')))
    on conflict (comunidade, nome) do nothing;
  end loop;
  perform interno.registrar('rede_com_etiquetas', c.slug, '{}'::jsonb);
  return jsonb_build_object('etiquetas', (select coalesce(jsonb_agg(jsonb_build_object('nome', f.nome, 'cor', f.cor) order by f.nome), '[]'::jsonb) from rede_comunidade_flairs f where f.comunidade = c.slug));
end $$;

/** Fixar (ou soltar) um post de primeiro nível no alto da comunidade, até 3. Fica no registro de moderação (só inserção). */
create or replace function public.rede_com_fixar(p_slug text, p_post uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; x rede_posts;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  select * into x from rede_posts where id = p_post and comunidade = c.slug and resposta_a is null;
  if not found or not interno.rede_ve(x, v) or x.oculto or x.retido or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_sim, true) then
    if not x.fixado and (select count(*) from rede_posts where comunidade = c.slug and fixado and resposta_a is null) >= 3 then perform interno.erro('invalido:limite_de_fixados'); end if;
    update rede_posts set fixado = true where id = x.id;
  else
    update rede_posts set fixado = false where id = x.id;
  end if;
  insert into rede_moderacao (acao, alvo_tipo, alvo, regra, motivo, quem)
  values ('fixar', 'post', x.id::text, '', case when coalesce(p_sim, true) then 'Fixado no alto da comunidade ' else 'Solto do alto da comunidade ' end || c.slug, v);
  return jsonb_build_object('fixado', coalesce(p_sim, true));
end $$;

/** Só a coordenação define quem modera (a proposta aprovada já traz dois). Aviso para a pessoa; ela pode sair a qualquer hora. */
create or replace function public.rede_com_moderacao_definir(p_slug text, p_usuario uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_sim, true) then
    if not interno.rede2_membro(p_usuario) then perform interno.erro('invalido:moderador'); end if;
    insert into rede_comunidade_membros (comunidade, usuario, papel, situacao) values (c.slug, p_usuario, 'moderacao', 'ativo')
    on conflict (comunidade, usuario) do update set papel = 'moderacao', situacao = 'ativo', banido_ate = null;
    perform interno.avisar_em(p_usuario, format('Você agora modera “%s” na Rede Lúcia. Leia as regras e, se não quiser, é só sair da comunidade.', c.nome), 'rede');
  else
    update rede_comunidade_membros set papel = 'membro' where comunidade = c.slug and usuario = p_usuario and papel = 'moderacao';
  end if;
  perform interno.registrar('rede_com_moderacao', c.slug, jsonb_build_object('sim', coalesce(p_sim, true)));
  return jsonb_build_object('ok', true);
end $$;

/** Liga trilhas e aulas à comunidade (para "Sobre" e para o botão "discutir esta aula"). Só quem cuida da comunidade em geral. */
create or replace function public.rede_com_trilhas_salvar(p_slug text, p_trilhas text[], p_aulas text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; t text;
begin
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null then perform interno.erro('nao_encontrado'); end if;
  if coalesce(cardinality(p_trilhas), 0) > 40 or coalesce(cardinality(p_aulas), 0) > 200 then perform interno.erro('invalido:trilhas'); end if;
  foreach t in array coalesce(p_trilhas, '{}') loop
    if t !~ '^[a-z0-9-]{2,80}$' then perform interno.erro('invalido:trilhas'); end if;
  end loop;
  foreach t in array coalesce(p_aulas, '{}') loop
    if t !~ '^[a-z0-9-]{2,80}/[a-z0-9-]{2,80}$' then perform interno.erro('invalido:trilhas'); end if;
  end loop;
  update rede_comunidades set trilhas = coalesce(p_trilhas, '{}'), aulas = coalesce(p_aulas, '{}') where slug = c.slug;
  perform interno.registrar('rede_com_trilhas', c.slug, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

-- ── 5. Comunidade nova só por proposta ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Propor uma comunidade: slug, nome, objetivo (20 a 1.000), regras (20 a 2.000, uma por linha) e ao menos 2 moderadores, por @nome.
 * Quem propõe pode ser um deles. Só membros da Rede propõem e só membros da Rede moderam. A coordenação decide
 * (rede_com_decidir). Limite de 3 propostas por dia.
 */
create or replace function public.rede_com_propor(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); v_slug text; v_nome text; v_objetivo text; v_regras text; v_mods uuid[] := '{}'; h text; v_id uuid; w uuid;
begin
  perform interno.aberta('comunidade');
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:proposta'); end if;
  if not coalesce((select rede_18 from perfis where id = v), false) then perform interno.erro('confirme_idade'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede2_limite('propor');
  v_slug := lower(btrim(coalesce(p ->> 'slug', '')));
  if v_slug !~ '^[a-z0-9-]{2,60}$' or v_slug like 'fechado-%' or v_slug like 'turma-%' then perform interno.erro('invalido:slug'); end if;
  if exists (select 1 from rede_comunidades k where k.slug = v_slug or v_slug = any (k.apelidos)) then perform interno.erro('invalido:slug'); end if;
  if exists (select 1 from rede_propostas x where x.slug = v_slug and x.situacao = 'aberta') then perform interno.erro('invalido:slug'); end if;
  v_nome := interno.txt(p ->> 'nome', 'nome', 3, 60);
  v_objetivo := interno.txt(p ->> 'objetivo', 'objetivo', 20, 1000);
  v_regras := interno.txt(p ->> 'regras', 'regras', 20, 2000);
  if jsonb_typeof(p -> 'moderadores') is distinct from 'array' or jsonb_array_length(p -> 'moderadores') > 5 then perform interno.erro('invalido:moderadores'); end if;
  for h in select lower(btrim(e, ' @')) from jsonb_array_elements_text(p -> 'moderadores') e loop
    w := null;
    select f.id into w from perfis f where f.rede_handle = h and not f.suspenso and f.rede_modo <> 'invisivel' and not f.rede_invisivel and interno.rede2_membro(f.id) and not interno.rede_bloqueado(v, f.id);
    if w is null then perform interno.erro('invalido:moderadores'); end if;
    if not (w = any (v_mods)) then v_mods := v_mods || w; end if;
  end loop;
  if cardinality(v_mods) < 2 then perform interno.erro('invalido:moderadores'); end if;
  insert into rede_propostas (autor, slug, nome, objetivo, regras, moderadores) values (v, v_slug, v_nome, v_objetivo, v_regras, v_mods) returning id into v_id;
  perform interno.avisar_lideranca(format('Nova proposta de comunidade na Rede Lúcia: “%s”. Ela espera a decisão da coordenação.', v_nome), v);
  return jsonb_build_object('id', v_id, 'situacao', 'aberta');
end $$;

/** As propostas desta pessoa, com o andamento e o motivo da decisão. */
create or replace function public.rede_com_minhas_propostas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return jsonb_build_object('itens', (
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'slug', x.slug, 'nome', x.nome, 'situacao', x.situacao, 'motivo', x.motivo, 'criado_em', x.criado_em) order by x.criado_em desc), '[]'::jsonb)
    from rede_propostas x where x.autor = v));
end $$;

/** A fila da coordenação: propostas abertas e as últimas decididas, com quem propôs e quem modera (só codinomes). */
create or replace function public.rede_com_propostas_fila() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object('itens', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'slug', x.slug, 'nome', x.nome, 'objetivo', x.objetivo, 'regras', x.regras, 'situacao', x.situacao, 'motivo', x.motivo, 'criado_em', x.criado_em,
      'autor', interno.rede_nome(x.autor),
      'moderadores', (select coalesce(jsonb_agg(interno.rede_nome(m)), '[]'::jsonb) from unnest(x.moderadores) m)) order by (x.situacao = 'aberta') desc, x.criado_em desc), '[]'::jsonb)
    from (select * from rede_propostas where situacao = 'aberta' or criado_em > now() - interval '60 days' order by criado_em desc limit 60) x));
end $$;

/** Aprovar cria a comunidade (aberta, entre as lutas, só para membros), com as regras da proposta e os moderadores; recusar pede o motivo. */
create or replace function public.rede_com_decidir(p_id uuid, p_aprova boolean, p_motivo text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); x rede_propostas; v_motivo text := left(btrim(coalesce(p_motivo, '')), 500); l text; n integer := 0; m uuid;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select * into x from rede_propostas where id = p_id for update;
  if not found or x.situacao <> 'aberta' then perform interno.erro('nao_encontrado'); end if;
  if not coalesce(p_aprova, false) then
    if char_length(v_motivo) < 10 then perform interno.erro('invalido:motivo'); end if;
    update rede_propostas set situacao = 'recusada', decidida_por = v, motivo = v_motivo where id = x.id;
    perform interno.avisar_em(x.autor, format('A proposta da comunidade “%s” não foi aprovada: %s', x.nome, v_motivo), 'rede');
    perform interno.registrar('rede_com_recusar', x.slug, '{}'::jsonb);
    return jsonb_build_object('situacao', 'recusada');
  end if;
  if exists (select 1 from rede_comunidades k where k.slug = x.slug or x.slug = any (k.apelidos)) then perform interno.erro('invalido:slug'); end if;
  insert into rede_comunidades (slug, nome, descricao, categoria, tipo, publico_padrao, criada_por)
  values (x.slug, x.nome, left(x.objetivo, 500), 'lutas', 'aberta', 'membros', x.autor);
  for l in select btrim(e) from unnest(string_to_array(x.regras, E'\n')) e loop
    if char_length(l) >= 3 and n < 20 then
      n := n + 1;
      insert into rede_comunidade_regras (comunidade, numero, titulo, texto) values (x.slug, n, left(l, 80), case when char_length(l) > 80 then left(l, 500) else '' end);
    end if;
  end loop;
  perform interno.rede3_com_padroes(x.slug);
  foreach m in array x.moderadores loop
    if interno.rede2_membro(m) then
      insert into rede_comunidade_membros (comunidade, usuario, papel, situacao) values (x.slug, m, 'moderacao', 'ativo')
      on conflict (comunidade, usuario) do update set papel = 'moderacao', situacao = 'ativo';
      perform interno.avisar_em(m, format('Você foi indicada ou indicado para moderar “%s”, aprovada agora. Leia as regras e, se não quiser, é só sair da comunidade.', x.nome), 'rede');
    end if;
  end loop;
  if x.autor is not null and interno.rede2_membro(x.autor) then
    insert into rede_comunidade_membros (comunidade, usuario, papel, situacao) values (x.slug, x.autor, 'membro', 'ativo') on conflict (comunidade, usuario) do nothing;
    perform interno.avisar_em(x.autor, format('A comunidade “%s” foi aprovada e já está no ar.', x.nome), 'rede');
  end if;
  update rede_propostas set situacao = 'aprovada', decidida_por = v, motivo = v_motivo where id = x.id;
  perform interno.registrar('rede_com_aprovar', x.slug, '{}'::jsonb);
  return jsonb_build_object('situacao', 'aprovada', 'slug', x.slug);
end $$;

-- ── 6. "Discutir esta aula" ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Liga um post meu (de primeiro nível, numa comunidade) a uma aula, como citação ("trilha/aula"). A linha da aula mostra só os posts
 * ligados. Só o autor liga; não troca uma citação que já existe.
 */
create or replace function public.rede_com_ligar_aula(p_post uuid, p_aula text, p_titulo text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts;
begin
  if coalesce(p_aula, '') !~ '^[a-z0-9-]{2,80}/[a-z0-9-]{2,80}$' then perform interno.erro('invalido:aula'); end if;
  select * into x from rede_posts where id = p_post and autor = v and resposta_a is null and comunidade is not null;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if x.cita is not null then perform interno.erro('invalido:aula'); end if;
  update rede_posts set cita = jsonb_build_object('tipo', 'aula', 'caminho', '/trilhas/' || p_aula, 'titulo', left(btrim(regexp_replace(coalesce(p_titulo, ''), '[\u0001-\u001F]', '', 'g')), 140)) where id = x.id;
  return jsonb_build_object('ok', true);
end $$;

/** A linha da aula numa comunidade: só posts ligados a ela, só o que a pessoa pode ver (matriz e silenciados), por cursor. */
create or replace function public.rede_com_aula_linha(p_comunidade text, p_aula text, p_cursor text default null, p_limite integer default 20) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := auth.uid(); c rede_comunidades; v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_t timestamptz; v_id uuid; v_itens jsonb; v_n integer; v_ultimo jsonb; v_proximo text;
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  if coalesce(p_aula, '') !~ '^[a-z0-9-]{2,80}/[a-z0-9-]{2,80}$' then perform interno.erro('invalido:aula'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  -- A mesma porta de rede_comunidade: fechada não existe para quem não é dela, lutas pedem conta.
  perform public.rede_comunidade(p_comunidade);
  c := interno.rede3_com_achar(p_comunidade);
  if nullif(p_cursor, '') is not null then
    begin
      v_t := split_part(p_cursor, '|', 1)::timestamptz; v_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then perform interno.erro('invalido:cursor');
    end;
  end if;
  select coalesce(jsonb_agg(interno.rede_post_v2(r, v) order by r.criado_em desc, r.id desc), '[]'::jsonb), count(*)::integer into v_itens, v_n
  from rede_posts r where r.id in (
    select p.id from rede_posts p
    where p.comunidade = c.slug and p.resposta_a is null and p.apagado_em is null
      and p.cita ->> 'tipo' = 'aula' and p.cita ->> 'caminho' = '/trilhas/' || p_aula
      and (v_t is null or (p.criado_em, p.id) < (v_t, v_id))
      and interno.rede_ve(p, v) and not interno.rede_silenciado(p, v)
    order by p.criado_em desc, p.id desc limit v_limite + 1);
  if v_n > v_limite then
    select coalesce(jsonb_agg(e.valor order by e.n), '[]'::jsonb) into v_itens from jsonb_array_elements(v_itens) with ordinality e(valor, n) where e.n <= v_limite;
    v_ultimo := v_itens -> (v_limite - 1);
    v_proximo := (v_ultimo ->> 'criado_em') || '|' || (v_ultimo ->> 'id');
  end if;
  return jsonb_build_object('itens', v_itens, 'proximo', v_proximo);
end $$;

-- ── 7. Núcleo e turma ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Abrir o espaço da Rede de um núcleo público (nucleos): coordenação ou quem acompanha o núcleo. Quem acompanha vira mediação do espaço. */
create or replace function public.rede_com_nucleo_abrir(p_nucleo uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n nucleos; v_id uuid;
begin
  select * into n from nucleos where id = p_nucleo and ativo;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (interno.coord() or (n.acompanha is not null and n.acompanha = v)) then perform interno.erro('sem_permissao'); end if;
  insert into rede_nucleos (nucleo, nome, cidade, criado_por) values (n.id, n.nome, n.cidade, v)
  on conflict (nucleo) do nothing;
  select id into v_id from rede_nucleos where nucleo = n.id;
  if n.acompanha is not null and interno.rede2_membro(n.acompanha) then
    insert into rede_nucleo_membros (nucleo, usuario, papel) values (v_id, n.acompanha, 'mediacao') on conflict (nucleo, usuario) do update set papel = 'mediacao';
  end if;
  perform interno.registrar('rede_com_nucleo_abrir', v_id::text, '{}'::jsonb);
  return jsonb_build_object('id', v_id);
end $$;

/** Os núcleos de que esta pessoa faz parte (só os dela). */
create or replace function public.rede_com_nucleos() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return jsonb_build_object('itens', (
    select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'nome', n.nome, 'cidade', n.cidade, 'trilha', n.trilha, 'papel', m.papel) order by n.nome), '[]'::jsonb)
    from rede_nucleo_membros m join rede_nucleos n on n.id = m.nucleo where m.usuario = v));
end $$;

/** A página de um núcleo: só para quem é dele. Nome, cidade, trilha, quem faz a mediação (codinome) e os próximos encontros em local público. */
create or replace function public.rede_com_nucleo(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n rede_nucleos; v_papel text;
begin
  select * into n from rede_nucleos where id = p_id;
  select papel into v_papel from rede_nucleo_membros where nucleo = p_id and usuario = v;
  if n.id is null or v_papel is null then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object(
    'id', n.id, 'nome', n.nome, 'cidade', n.cidade, 'trilha', n.trilha, 'papel', v_papel,
    'mediacao', (select coalesce(jsonb_agg(interno.rede_nome(m.usuario) order by m.entrou_em), '[]'::jsonb) from rede_nucleo_membros m where m.nucleo = n.id and m.papel = 'mediacao'),
    'encontros', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'quando', e.quando, 'local_tipo', e.local_tipo, 'local_texto', e.local_texto) order by e.quando), '[]'::jsonb)
      from rede_encontros e where e.nucleo = n.id and e.quando > now() - interval '3 hours'));
end $$;

/** O mural do núcleo: posts de público "nucleo", só para quem é do núcleo (a matriz decide), por cursor. */
create or replace function public.rede_com_nucleo_linha(p_id uuid, p_cursor text default null, p_limite integer default 20) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_t timestamptz; v_id uuid; v_itens jsonb; v_n integer; v_ultimo jsonb; v_proximo text;
begin
  if not interno.rede2_no_nucleo(p_id, v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  if nullif(p_cursor, '') is not null then
    begin
      v_t := split_part(p_cursor, '|', 1)::timestamptz; v_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then perform interno.erro('invalido:cursor');
    end;
  end if;
  select coalesce(jsonb_agg(interno.rede_post_v2(r, v) order by r.criado_em desc, r.id desc), '[]'::jsonb), count(*)::integer into v_itens, v_n
  from rede_posts r where r.id in (
    select p.id from rede_posts p
    where p.nucleo = p_id and p.resposta_a is null and p.apagado_em is null
      and (v_t is null or (p.criado_em, p.id) < (v_t, v_id))
      and interno.rede_ve(p, v) and not interno.rede_silenciado(p, v)
    order by p.criado_em desc, p.id desc limit v_limite + 1);
  if v_n > v_limite then
    select coalesce(jsonb_agg(e.valor order by e.n), '[]'::jsonb) into v_itens from jsonb_array_elements(v_itens) with ordinality e(valor, n) where e.n <= v_limite;
    v_ultimo := v_itens -> (v_limite - 1);
    v_proximo := (v_ultimo ->> 'criado_em') || '|' || (v_ultimo ->> 'id');
  end if;
  return jsonb_build_object('itens', v_itens, 'proximo', v_proximo);
end $$;

/** Sair do núcleo: corta o acesso na hora (o mural e os encontros deixam de existir para quem saiu). */
create or replace function public.rede_com_nucleo_sair(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  delete from rede_nucleo_membros where nucleo = p_id and usuario = v;
  return jsonb_build_object('ok', true);
end $$;

/** Marcar um encontro (só a mediação do núcleo): tipo de local público obrigatório; endereço de casa não passa. */
create or replace function public.rede_com_encontro_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_nucleo uuid; v_quando timestamptz; v_tipo text := coalesce(p ->> 'local_tipo', ''); v_texto text; v_id uuid;
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:encontro'); end if;
  begin
    v_nucleo := (p ->> 'nucleo')::uuid; v_quando := (p ->> 'quando')::timestamptz;
  exception when others then perform interno.erro('invalido:encontro');
  end;
  if not exists (select 1 from rede_nucleo_membros where nucleo = v_nucleo and usuario = v and papel = 'mediacao') then perform interno.erro('sem_permissao'); end if;
  if v_quando < now() - interval '1 hour' or v_quando > now() + interval '1 year' then perform interno.erro('invalido:quando'); end if;
  if v_tipo not in ('praca', 'biblioteca', 'sindicato', 'escola', 'universidade', 'associacao', 'online', 'outro') then perform interno.erro('invalido:local'); end if;
  v_texto := interno.txt(p ->> 'local_texto', 'local', case when v_tipo = 'outro' then 3 else 0 end, 140);
  -- Ponto de encontro público, nunca endereço de casa: rua, avenida etc. com número, ou CEP, ficam de fora.
  if v_texto ~* '\m(rua|avenida|av\.?|travessa|alameda|estrada|rodovia)\M[^;]{0,60}\d' or v_texto ~ '\d{5}-?\d{3}' then perform interno.erro('dado_pessoal'); end if;
  insert into rede_encontros (nucleo, quando, local_tipo, local_texto) values (v_nucleo, v_quando, v_tipo, v_texto) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.rede_com_encontro_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  delete from rede_encontros e where e.id = p_id and exists (select 1 from rede_nucleo_membros m where m.nucleo = e.nucleo and m.usuario = v and m.papel = 'mediacao');
  return jsonb_build_object('ok', true);
end $$;

/** A turma do mês: se esta pessoa está inscrita (turmas_mes) e o endereço da comunidade da turma. */
create or replace function public.rede_com_turma(p_mes text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if coalesce(p_mes, '') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then perform interno.erro('invalido:mes'); end if;
  return jsonb_build_object('mes', p_mes, 'slug', 'turma-' || p_mes,
    'inscrito', exists (select 1 from turmas_mes t where t.mes = p_mes and t.usuario = v),
    'entrou', interno.rede2_na_comunidade('turma-' || p_mes, v));
end $$;

/** Entrar na comunidade da turma (fechada): só quem se inscreveu na turma daquele mês. A comunidade nasce na primeira entrada. */
create or replace function public.rede_com_turma_entrar(p_mes text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); v_slug text := 'turma-' || coalesce(p_mes, ''); v_nome text;
  v_meses text[] := array['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
begin
  if coalesce(p_mes, '') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then perform interno.erro('invalido:mes'); end if;
  if not coalesce((select rede_18 from perfis where id = v), false) then perform interno.erro('confirme_idade'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if not exists (select 1 from turmas_mes t where t.mes = p_mes and t.usuario = v) then perform interno.erro('sem_permissao'); end if;
  if interno.rede3_com_situacao(v_slug, v) = 'banido' then perform interno.erro('sem_permissao'); end if;
  v_nome := 'Turma de ' || v_meses[substr(p_mes, 6, 2)::integer] || ' de ' || substr(p_mes, 1, 4);
  insert into rede_comunidades (slug, nome, descricao, categoria, tipo, publico_padrao)
  values (v_slug, v_nome, 'A conversa de quem está na turma do mês. Só entra quem se inscreveu na turma.', 'instituto', 'fechada', 'comunidade')
  on conflict (slug) do nothing;
  perform interno.rede3_com_padroes(v_slug);
  insert into rede_comunidade_membros (comunidade, usuario, papel, situacao) values (v_slug, v, 'membro', 'ativo') on conflict (comunidade, usuario) do nothing;
  return jsonb_build_object('slug', v_slug);
end $$;

-- ── 8. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────────

revoke all on function interno.rede3_com_modera(text, uuid), interno.rede3_com_achar(text), interno.rede3_com_padroes(text), interno.rede3_com_semear(), interno.rede3_com_situacao(text, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede3_com_modera(text, uuid), interno.rede3_com_achar(text), interno.rede3_com_padroes(text), interno.rede3_com_semear(), interno.rede3_com_situacao(text, uuid) from anon, authenticated;
    revoke all on function public.rede_com_lista(), public.rede_com_pagina(text), public.rede_com_entrar(text), public.rede_com_sair(text), public.rede_com_pedidos(text),
      public.rede_com_decidir_pedido(text, uuid, boolean), public.rede_com_regras_salvar(text, jsonb), public.rede_com_etiquetas_salvar(text, jsonb),
      public.rede_com_fixar(text, uuid, boolean), public.rede_com_moderacao_definir(text, uuid, boolean), public.rede_com_trilhas_salvar(text, text[], text[]),
      public.rede_com_propor(jsonb), public.rede_com_minhas_propostas(), public.rede_com_propostas_fila(), public.rede_com_decidir(uuid, boolean, text),
      public.rede_com_ligar_aula(uuid, text, text), public.rede_com_aula_linha(text, text, text, integer), public.rede_com_nucleo_abrir(uuid), public.rede_com_nucleos(),
      public.rede_com_nucleo(uuid), public.rede_com_nucleo_linha(uuid, text, integer), public.rede_com_nucleo_sair(uuid), public.rede_com_encontro_salvar(jsonb),
      public.rede_com_encontro_remover(uuid), public.rede_com_turma(text), public.rede_com_turma_entrar(text) from public;
    -- Leitura aberta (a página decide o que sai: disciplinas abertas para visitante, o resto pede conta).
    grant execute on function public.rede_com_lista(), public.rede_com_pagina(text), public.rede_com_aula_linha(text, text, text, integer) to anon, authenticated, service_role;
    revoke all on function public.rede_com_entrar(text), public.rede_com_sair(text), public.rede_com_pedidos(text), public.rede_com_decidir_pedido(text, uuid, boolean),
      public.rede_com_regras_salvar(text, jsonb), public.rede_com_etiquetas_salvar(text, jsonb), public.rede_com_fixar(text, uuid, boolean),
      public.rede_com_moderacao_definir(text, uuid, boolean), public.rede_com_trilhas_salvar(text, text[], text[]), public.rede_com_propor(jsonb),
      public.rede_com_minhas_propostas(), public.rede_com_propostas_fila(), public.rede_com_decidir(uuid, boolean, text), public.rede_com_ligar_aula(uuid, text, text),
      public.rede_com_nucleo_abrir(uuid), public.rede_com_nucleos(), public.rede_com_nucleo(uuid), public.rede_com_nucleo_linha(uuid, text, integer),
      public.rede_com_nucleo_sair(uuid), public.rede_com_encontro_salvar(jsonb), public.rede_com_encontro_remover(uuid), public.rede_com_turma(text), public.rede_com_turma_entrar(text) from anon;
    grant execute on function public.rede_com_entrar(text), public.rede_com_sair(text), public.rede_com_pedidos(text), public.rede_com_decidir_pedido(text, uuid, boolean),
      public.rede_com_regras_salvar(text, jsonb), public.rede_com_etiquetas_salvar(text, jsonb), public.rede_com_fixar(text, uuid, boolean),
      public.rede_com_moderacao_definir(text, uuid, boolean), public.rede_com_trilhas_salvar(text, text[], text[]), public.rede_com_propor(jsonb),
      public.rede_com_minhas_propostas(), public.rede_com_propostas_fila(), public.rede_com_decidir(uuid, boolean, text), public.rede_com_ligar_aula(uuid, text, text),
      public.rede_com_nucleo_abrir(uuid), public.rede_com_nucleos(), public.rede_com_nucleo(uuid), public.rede_com_nucleo_linha(uuid, text, integer),
      public.rede_com_nucleo_sair(uuid), public.rede_com_encontro_salvar(jsonb), public.rede_com_encontro_remover(uuid), public.rede_com_turma(text), public.rede_com_turma_entrar(text) to authenticated, service_role;
  end if;
end $$;

-- Semeia agora (e de novo, sem estrago, a cada vez que este arquivo rodar).
select interno.rede3_com_semear();
