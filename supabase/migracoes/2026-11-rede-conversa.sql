-- ───────────────────────────── Rede Lúcia v2: pacote conversa (Etapa 7, R4, itens 24 a 28) ─────────────────────────────
-- Migração acrescentável: roda DEPOIS de 2026-11-rede-fundacao.sql (e dos pacotes consertos, perfil e publicar, na ordem de
-- docs/rede/V2.md) e pode rodar mais de uma vez. Não apaga nada, não redefine nenhuma função da fundação.
--
-- O que este arquivo faz, e só isto:
--   1. A árvore da conversa com ordem escolhida (rede_conv_arvore): mais úteis, mais antigas, mais novas; até 6 níveis (a
--      partir do post aberto: do 6º em diante vira "continuar conversa", em página própria).
--   2. Menções: sugestão enquanto se digita (rede_conv_sugerir) e o aviso ao mencionado, por gatilho em rede_posts (assim vale
--      para qualquer versão de rede_publicar), respeitando bloqueio, perfil invisível, a matriz de visibilidade e silenciados.
--   3. "Resposta que resolveu" (rede_conv_aceitar): só quem fez a dúvida ou a moderação.
--   4. Síntese fixada no alto da conversa, com histórico (rede_conv_sintese, rede_conv_sintese_historico): só quem abriu a
--      conversa ou a moderação.
--   5. Citar post (rede_conv_citar): publica e liga a citação; quem não pode ver o original vê "conteúdo restrito".
--
-- Ordem "mais úteis" (fórmula pública, escrita também nos textos da tela): 1º a resposta que resolveu a dúvida; depois quem
-- tem mais marcações de "útil"; empate: a mais antiga. Só entram "útil" (que é público); o número de apoios NUNCA entra, porque
-- só o autor pode vê-lo (decisão 3 da ESPEC: apoio pode revelar adesão política, dado sensível, LGPD art. 5º, II e art. 11).
--
-- Dado de pessoa: a síntese é texto da moderação ou de quem abriu a conversa, com o codinome de quem escreveu (nunca o nome do
-- painel); passa pela mesma recusa de dado pessoal (CPF, telefone, e-mail) e pelo mesmo veredito automático dos posts. A menção
-- guarda só "este post mencionou esta pessoa" (para não avisar duas vezes) e some com o post. Sem rastreamento, sem contagem
-- pública. Leis: LGPD (13.709/2018) arts. 5º II, 6º III (minimização) e 11; Marco Civil (12.965/2014) art. 19 (a moderação age
-- sobre o conteúdo e registra); Código Penal 138 a 140 (a síntese não é lugar para acusação a pessoa: vai pelo veredito).

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Cada síntese é uma versão; a atual é a que não foi retirada. Quem escreve outra retira a anterior (fica no histórico).
create table if not exists interno.rede_sinteses (
  id uuid primary key default gen_random_uuid(),
  raiz uuid not null references interno.rede_posts (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 1500),
  autor uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  retirada_em timestamptz
);
create unique index if not exists rede_sinteses_atual on interno.rede_sinteses (raiz) where retirada_em is null;
create index if not exists rede_sinteses_raiz on interno.rede_sinteses (raiz, criado_em);
alter table interno.rede_sinteses enable row level security;

-- Quem já foi avisado de ser mencionado em qual post (evita aviso repetido quando um post retido é liberado).
create table if not exists interno.rede_mencoes (
  post uuid not null references interno.rede_posts (id) on delete cascade,
  mencionado uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (post, mencionado)
);
create index if not exists rede_mencoes_mencionado on interno.rede_mencoes (mencionado, criado_em desc);
alter table interno.rede_mencoes enable row level security;

-- ── 2. Auxiliares internos ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Esta pessoa cuida deste post? A equipe de mediação (interno.cuida(), que lê a sessão), quem modera a comunidade dele ou a
 * mediação do núcleo dele. É a "moderação" de que a ESPEC fala para aceitar resposta e escrever síntese.
 */
create or replace function interno.rede3_conv_modera(p interno.rede_posts, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and (
    (p_quem = auth.uid() and interno.cuida())
    or (p.comunidade is not null and exists (select 1 from rede_comunidade_membros m where m.comunidade = p.comunidade and m.usuario = p_quem and m.papel = 'moderacao' and m.situacao = 'ativo'))
    or (p.nucleo is not null and exists (select 1 from rede_nucleo_membros n where n.nucleo = p.nucleo and n.usuario = p_quem and n.papel = 'mediacao')))
$$;

/** A raiz da conversa de um post (o próprio post, se ele é a raiz). */
create or replace function interno.rede3_conv_raiz(p interno.rede_posts) returns interno.rede_posts language sql stable security definer set search_path = interno, pg_temp as $$
  select r.* from rede_posts r where r.id = coalesce(p.root_id, p.id)
$$;

/** Recusa dado pessoal (CPF, telefone, e-mail) e o que o veredito automático não deixaria publicar. Mesma régua dos posts. */
create or replace function interno.rede3_conv_texto_ok(p_texto text, p_autor uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if p_texto ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}' or p_texto ~ '\(?\d{2}\)?\s?9\d{4}[-\s]?\d{4}' or p_texto ~* '[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z.]{2,}' then
    perform interno.erro('dado_pessoal');
  end if;
  if (interno.veredito(p_texto, interno.cuida(), p_autor) ->> 'veredito') is distinct from 'publicar' then
    perform interno.erro('invalido:sintese');
  end if;
end $$;

-- ── 3. Menções: o aviso ao mencionado ────────────────────────────────────────────────────────────────────────────────

/**
 * Grava um aviso da Rede. Se o pacote avisos já está instalado (interno.rede3_aviso_criar), o aviso nasce com tipo, post, alvo e
 * ator, para ser agrupado e para respeitar as preferências de quem recebe; se não, é um aviso simples da Rede (avisar_em).
 * Escolhido na hora de avisar, para este arquivo valer antes ou depois dele na ordem das migrações.
 */
create or replace function interno.rede3_conv_avisar(p_para uuid, p_tipo text, p_post uuid, p_alvo uuid, p_ator uuid, p_texto text) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if to_regprocedure('interno.rede3_aviso_criar(uuid,text,uuid,uuid,uuid,text)') is not null then
    execute 'select interno.rede3_aviso_criar($1, $2, $3, $4, $5, $6)' using p_para, p_tipo, p_post, p_alvo, p_ator, p_texto;
  else
    perform interno.avisar_em(p_para, p_texto, 'rede');
  end if;
end $$;

/**
 * Avisa quem foi mencionado (@handle) neste post. No máximo 5 por post. Não avisa: o próprio autor, perfil invisível, conta
 * suspensa ou fora da Rede, quem bloqueou ou foi bloqueado pelo autor, quem não pode ver o post pela matriz e quem silenciou o
 * autor, a comunidade ou a conversa. Post retido ou removido não avisa (avisa quando for liberado: ver o gatilho abaixo).
 * O aviso leva o codinome e um trecho curto, nunca o nome do painel.
 */
create or replace function interno.rede3_conv_mencionar(p interno.rede_posts) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_texto text; v_handle text; f perfis;
begin
  if p.autor is null or p.oculto or p.retido or p.apagado_em is not null then return; end if;
  v_texto := lower(coalesce(p.titulo, '') || ' ' || coalesce(p.texto, '') || ' ' || coalesce(p.corpo, ''));
  if position('@' in v_texto) = 0 then return; end if;
  for v_handle in select distinct m[1] from regexp_matches(v_texto, '(?:^|[^a-z0-9_@])@([a-z0-9_]{3,20})(?![a-z0-9_])', 'g') as m limit 5 loop
    select * into f from perfis where rede_handle = v_handle;
    continue when not found or f.id = p.autor;
    continue when f.rede_modo = 'invisivel' or f.rede_invisivel or f.suspenso;
    continue when not interno.rede2_membro(f.id);
    continue when interno.rede_bloqueado(p.autor, f.id);
    continue when not interno.rede_ve(p, f.id);
    continue when interno.rede_silenciado(p, f.id);
    insert into rede_mencoes (post, mencionado) values (p.id, f.id) on conflict do nothing;
    if found then
      perform interno.rede3_conv_avisar(f.id, 'mencao', p.id, p.id, p.autor, format('%s mencionou você na Rede Lúcia: “%s”', interno.rede_nome(p.autor), left(coalesce(p.titulo, p.texto), 100)));
    end if;
  end loop;
end $$;

create or replace function interno.rede3_conv_gatilho_mencao() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  -- Nunca derruba a publicação: se avisar falhar, o post continua valendo.
  begin
    if tg_op = 'INSERT' then
      -- Posts antigos trazidos pela migração do Fórum não avisam ninguém agora.
      if new.criado_em > now() - interval '1 hour' then perform interno.rede3_conv_mencionar(new); end if;
    elsif tg_op = 'UPDATE' then
      -- Um post retido que a mediação libera avisa agora (rede_mencoes impede o aviso repetido).
      if (old.oculto or old.retido) and not (new.oculto or new.retido) then perform interno.rede3_conv_mencionar(new); end if;
    end if;
  exception when others then
    null;
  end;
  return new;
end $$;
drop trigger if exists rede3_conv_mencao on interno.rede_posts;
create trigger rede3_conv_mencao after insert or update of oculto, retido on interno.rede_posts for each row execute function interno.rede3_conv_gatilho_mencao();

/**
 * Sugestões de @ enquanto a pessoa digita. Só gente que está na Rede, tem @handle, não está invisível nem suspensa e não tem
 * bloqueio com quem pede. Com p_post, só quem poderia ver o post (mencionar quem não vê não adianta, e não deve revelar o
 * post). Primeiro quem já está na conversa, depois quem a pessoa segue, depois por ordem alfabética. No máximo 8.
 */
create or replace function public.rede_conv_sugerir(p_prefixo text, p_post uuid default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_pre text := lower(btrim(coalesce(p_prefixo, ''), ' @')); x rede_posts; v_raiz uuid; v_r jsonb;
begin
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if v_pre !~ '^[a-z0-9_]{0,20}$' then return '[]'::jsonb; end if;
  if p_post is not null then
    select * into x from rede_posts where id = p_post;
    if not found or not interno.rede_ve(x, v) then perform interno.erro('nao_encontrado'); end if;
    v_raiz := coalesce(x.root_id, x.id);
  elsif v_pre = '' then
    return '[]'::jsonb;
  else
    select * into x from rede_posts where false;
  end if;
  perform interno.rede2_limite('buscar');
  select coalesce(jsonb_agg(jsonb_build_object('handle', z.rede_handle, 'codinome', z.rede_codinome, 'equipe', z.equipe) order by z.ordem, z.rede_handle), '[]'::jsonb) into v_r
  from (
    select f.rede_handle, f.rede_codinome, interno.voluntario_e(f.id) as equipe,
      case when v_raiz is not null and exists (select 1 from rede_posts r where (r.id = v_raiz or r.root_id = v_raiz) and r.autor = f.id) then 0
           when exists (select 1 from rede_seguindo s where s.quem = v and s.segue = f.id and not s.pendente) then 1 else 2 end as ordem
    from perfis f
    where f.rede_handle is not null and f.id <> v
      and (v_pre = '' or f.rede_handle like v_pre || '%' or interno.normal(coalesce(f.rede_codinome, '')) like interno.normal(v_pre) || '%')
      and not (f.rede_modo = 'invisivel' or f.rede_invisivel) and not f.suspenso
      and interno.rede2_membro(f.id) and not interno.rede_bloqueado(v, f.id)
      and (p_post is null or interno.rede_ve(x, f.id))
    order by 4, f.rede_handle limit 8) z;
  return v_r;
end $$;

-- ── 4. A árvore da conversa ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * A página de um post com a conversa em árvore, já na ordem de leitura (cada resposta logo depois do que ela responde). Mostra
 * até 6 níveis contando o post aberto como nível 1; uma resposta do 6º nível que tem filhas é aberta em página própria
 * ("continuar conversa": o cliente liga para /comunidade/p/<id>). Ordem de cada grupo de irmãs: 'uteis' (resolveu, depois mais
 * "útil", empate a mais antiga), 'antigas' ou 'novas'. Tudo passa por interno.rede_ve: o que a pessoa não pode ver nem entra na
 * conta de respostas, e a conversa abaixo de um post invisível some junto. Resposta de pessoa silenciada vem sem o texto.
 * Devolve {post, acima, respostas, sintese, ordem, pode_aceitar, pode_sintese, mais}: "mais" avisa que a lista foi cortada em 400.
 */
create or replace function public.rede_conv_arvore(p_id uuid, p_ordem text default 'uteis') returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v_quem uuid := auth.uid(); v_ordem text := coalesce(nullif(btrim(p_ordem), ''), 'uteis');
  x rede_posts; v_raiz rede_posts; v_resp jsonb; v_cima jsonb; v_sint jsonb; v_n integer;
  v_aceita uuid;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  if v_ordem not in ('uteis', 'antigas', 'novas') then perform interno.erro('invalido:ordem'); end if;
  select * into x from rede_posts where id = p_id;
  if not found or not interno.rede_ve(x, v_quem) then perform interno.erro('nao_encontrado'); end if;
  v_raiz := interno.rede3_conv_raiz(x);
  v_aceita := case when v_raiz.tipo = 'duvida' then v_raiz.aceita end;

  with recursive cand as (
    select r.id, r.resposta_a, r.criado_em, 1 as n from rede_posts r where r.resposta_a = x.id and interno.rede_ve(r, v_quem)
    union all
    select r.id, r.resposta_a, r.criado_em, c.n + 1 from rede_posts r join cand c on r.resposta_a = c.id where c.n < 5 and interno.rede_ve(r, v_quem)),
  pontos as (
    select c.*, (c.id = v_aceita) as resolveu, (select count(*)::integer from rede_reacoes u where u.post = c.id and u.tipo = 'util') as util
    from cand c),
  irmas as (
    select p.*, row_number() over (partition by p.resposta_a order by
      case when v_ordem = 'uteis' and p.resolveu then 0 else 1 end,
      case when v_ordem = 'uteis' then -p.util else 0 end,
      case when v_ordem = 'novas' then -extract(epoch from p.criado_em) else extract(epoch from p.criado_em) end, p.id) as pos
    from pontos p),
  ord as (
    select i.id, array[i.pos::integer] as caminho from irmas i where i.resposta_a = x.id
    union all
    select i.id, o.caminho || i.pos::integer from irmas i join ord o on i.resposta_a = o.id)
  select coalesce(jsonb_agg(
           case when interno.rede_silenciado(r, v_quem)
                then interno.rede_post_v2(r, v_quem) || jsonb_build_object('texto', '', 'titulo', null, 'corpo', null, 'longo', false, 'midia', '[]'::jsonb, 'citado', null, 'silenciada', true)
                else interno.rede_post_v2(r, v_quem) end
           order by z.caminho), '[]'::jsonb), count(*)::integer
    into v_resp, v_n
  from (select o.id, o.caminho from ord o order by o.caminho limit 400) z join rede_posts r on r.id = z.id;

  with recursive cima(id, n) as (
    select x.resposta_a, 1 where x.resposta_a is not null
    union all
    select r.resposta_a, c.n + 1 from rede_posts r join cima c on r.id = c.id where r.resposta_a is not null and c.n < 10)
  select coalesce(jsonb_agg(interno.rede_post_v2(r, v_quem) order by r.profundidade), '[]'::jsonb) into v_cima
  from rede_posts r where r.id in (select cima.id from cima) and interno.rede_ve(r, v_quem);

  if interno.rede_ve(v_raiz, v_quem) then
    select jsonb_build_object('id', s.id, 'texto', s.texto, 'autor', interno.rede_nome(s.autor), 'criado_em', s.criado_em, 'versoes', (select count(*)::integer from rede_sinteses h where h.raiz = s.raiz))
      into v_sint from rede_sinteses s where s.raiz = v_raiz.id and s.retirada_em is null;
  end if;

  return jsonb_build_object(
    'post', interno.rede_post_v2(x, v_quem, true), 'acima', v_cima, 'respostas', v_resp, 'sintese', v_sint, 'ordem', v_ordem,
    'raiz', v_raiz.id,
    'pode_aceitar', v_quem is not null and v_raiz.tipo = 'duvida' and (v_raiz.autor = v_quem or interno.rede3_conv_modera(v_raiz, v_quem)),
    'pode_sintese', v_quem is not null and interno.rede2_membro(v_quem) and (v_raiz.autor = v_quem or interno.rede3_conv_modera(v_raiz, v_quem)),
    'mais', jsonb_array_length(v_resp) >= 400);
end $$;

-- ── 5. A resposta que resolveu ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Marca (ou desmarca) uma resposta como a que resolveu a dúvida. Só em conversa de dúvida; só quem fez a dúvida ou a moderação
 * (da comunidade, do núcleo ou a equipe). Uma por dúvida: marcar outra troca a marca. A conversa travada também pode ser
 * resolvida (travar impede responder, não fechar a dúvida). Avisa quem escreveu a resposta (sem avisar quem marcou nem quem
 * bloqueou). Devolve {aceita}: o id da resposta marcada, ou nulo.
 */
create or replace function public.rede_conv_aceitar(p_resposta uuid, p_sim boolean default true) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r rede_posts; raiz rede_posts; v_antes uuid;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into r from rede_posts where id = p_resposta;
  if not found or r.resposta_a is null or not interno.rede_ve(r, v) or r.oculto or r.retido or r.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  raiz := interno.rede3_conv_raiz(r);
  if raiz.tipo <> 'duvida' then perform interno.erro('invalido:tipo'); end if;
  if not interno.rede_ve(raiz, v) then perform interno.erro('nao_encontrado'); end if;
  if raiz.autor is distinct from v and not interno.rede3_conv_modera(raiz, v) then perform interno.erro('sem_permissao'); end if;
  perform interno.rede2_limite('reagir');
  v_antes := raiz.aceita;
  if coalesce(p_sim, true) then
    update rede_posts set aceita = r.id where id = raiz.id;
    if v_antes is distinct from r.id then
      perform interno.registrar('rede_resolveu', raiz.id::text, jsonb_build_object('resposta', r.id));
      if r.autor is not null and r.autor <> v and not interno.rede_bloqueado(v, r.autor) then
        perform interno.avisar_em(r.autor, format('Sua resposta foi marcada como a que resolveu a dúvida “%s” na Rede Lúcia.', left(coalesce(raiz.titulo, raiz.texto), 80)), 'rede');
      end if;
    end if;
    return jsonb_build_object('aceita', r.id);
  end if;
  if raiz.aceita = r.id then
    update rede_posts set aceita = null where id = raiz.id;
    perform interno.registrar('rede_resolveu_desfeito', raiz.id::text, jsonb_build_object('resposta', r.id));
  end if;
  return jsonb_build_object('aceita', (select aceita from rede_posts where id = raiz.id));
end $$;

-- ── 6. A síntese fixada ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Escreve a síntese da conversa (até 1.500 caracteres), que fica fixada no alto dela. Só quem abriu a conversa ou a moderação.
 * Cada texto novo vira uma versão nova e retira a anterior, que continua no histórico. Texto vazio retira a síntese atual sem
 * apagá-la do histórico. Devolve {id, texto, autor, criado_em, versoes} ou nulo (quando retirou).
 */
create or replace function public.rede_conv_sintese(p_raiz uuid, p_texto text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); pr rede_posts; v_texto text; s rede_sinteses;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into pr from rede_posts where id = p_raiz;
  if not found or pr.resposta_a is not null or not interno.rede_ve(pr, v) then perform interno.erro('nao_encontrado'); end if;
  if pr.autor is distinct from v and not interno.rede3_conv_modera(pr, v) then perform interno.erro('sem_permissao'); end if;
  perform interno.rede2_limite('editar');
  if btrim(coalesce(p_texto, '')) = '' then
    update rede_sinteses set retirada_em = now() where raiz = pr.id and retirada_em is null;
    perform interno.registrar('rede_sintese_retirada', pr.id::text);
    return null;
  end if;
  v_texto := interno.txt(p_texto, 'sintese', 1, 1500);
  perform interno.rede3_conv_texto_ok(v_texto, v);
  update rede_sinteses set retirada_em = now() where raiz = pr.id and retirada_em is null;
  insert into rede_sinteses (raiz, texto, autor) values (pr.id, v_texto, v) returning * into s;
  perform interno.registrar('rede_sintese', pr.id::text, jsonb_build_object('sintese', s.id));
  return jsonb_build_object('id', s.id, 'texto', s.texto, 'autor', interno.rede_nome(s.autor), 'criado_em', s.criado_em,
    'versoes', (select count(*)::integer from rede_sinteses h where h.raiz = pr.id));
end $$;

/** As versões da síntese de uma conversa, da mais nova para a mais antiga. Só para quem pode ver a conversa. */
create or replace function public.rede_conv_sintese_historico(p_raiz uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); raiz rede_posts;
begin
  perform interno.aberta('comunidade');
  select * into raiz from rede_posts where id = p_raiz;
  if not found or raiz.resposta_a is not null or not interno.rede_ve(raiz, v) then perform interno.erro('nao_encontrado'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'texto', s.texto, 'autor', interno.rede_nome(s.autor), 'criado_em', s.criado_em, 'atual', s.retirada_em is null)
    order by s.criado_em desc, s.id), '[]'::jsonb) from rede_sinteses s where s.raiz = raiz.id);
end $$;

-- ── 7. Citar um post ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Publica (com todas as conferências de rede_publicar, seja qual for a versão dela) e liga a citação a outro post. Só se cita o
 * que se pode ver e que não foi removido; o que nenhuma citação faz é ampliar o alcance: quem não pode ver o original vê só
 * "conteúdo restrito" (rede_post_v2 decide por quem lê). Não se cita a si mesmo nem um post de si para si em laço.
 * p é o mesmo objeto de rede_publicar, mais "citar": o id do post citado.
 */
create or replace function public.rede_conv_citar(p jsonb) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_alvo uuid; o rede_posts; v_pub jsonb; v_id uuid; x rede_posts;
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:post'); end if;
  begin
    v_alvo := nullif(p ->> 'citar', '')::uuid;
  exception when others then perform interno.erro('invalido:citar');
  end;
  if v_alvo is null then perform interno.erro('invalido:citar'); end if;
  select * into o from rede_posts where id = v_alvo;
  if not found or not interno.rede_ve(o, v) or o.oculto or o.retido or o.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  v_pub := public.rede_publicar(p - 'citar');
  v_id := (v_pub ->> 'id')::uuid;
  if v_id = v_alvo then perform interno.erro('invalido:citar'); end if;
  update rede_posts set quote_of = v_alvo where id = v_id and autor = v;
  select * into x from rede_posts where id = v_id;
  -- Quem foi citado é avisado (sem o texto da citação para quem não pode ver, mas o autor sempre vê o próprio post).
  if o.autor is not null and o.autor <> v and not x.oculto and not x.retido and not interno.rede_bloqueado(v, o.autor) and interno.rede_ve(x, o.autor) then
    perform interno.rede3_conv_avisar(o.autor, 'citacao', o.id, x.id, v, format('%s citou o seu post na Rede Lúcia: “%s”', interno.rede_nome(v), left(x.texto, 100)));
  end if;
  return interno.rede_post_v2(x, v, true) || jsonb_build_object('avaliar', coalesce((v_pub ->> 'avaliar')::boolean, false));
end $$;

-- ── 8. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────
-- Nenhuma função interna é chamável de fora. A árvore e o histórico da síntese são de leitura aberta (a matriz decide o que sai,
-- como rede_post); o resto pede conta.
revoke all on function interno.rede3_conv_modera(interno.rede_posts, uuid), interno.rede3_conv_raiz(interno.rede_posts), interno.rede3_conv_texto_ok(text, uuid),
  interno.rede3_conv_mencionar(interno.rede_posts), interno.rede3_conv_gatilho_mencao(), interno.rede3_conv_avisar(uuid, text, uuid, uuid, uuid, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede3_conv_modera(interno.rede_posts, uuid), interno.rede3_conv_raiz(interno.rede_posts), interno.rede3_conv_texto_ok(text, uuid),
      interno.rede3_conv_mencionar(interno.rede_posts), interno.rede3_conv_gatilho_mencao(), interno.rede3_conv_avisar(uuid, text, uuid, uuid, uuid, text) from anon, authenticated;
    revoke all on function public.rede_conv_arvore(uuid, text), public.rede_conv_sugerir(text, uuid), public.rede_conv_aceitar(uuid, boolean),
      public.rede_conv_sintese(uuid, text), public.rede_conv_sintese_historico(uuid), public.rede_conv_citar(jsonb) from public;
    grant execute on function public.rede_conv_arvore(uuid, text), public.rede_conv_sintese_historico(uuid) to anon, authenticated, service_role;
    revoke all on function public.rede_conv_sugerir(text, uuid), public.rede_conv_aceitar(uuid, boolean), public.rede_conv_sintese(uuid, text), public.rede_conv_citar(jsonb) from anon;
    grant execute on function public.rede_conv_sugerir(text, uuid), public.rede_conv_aceitar(uuid, boolean), public.rede_conv_sintese(uuid, text), public.rede_conv_citar(jsonb) to authenticated, service_role;
  end if;
end $$;
