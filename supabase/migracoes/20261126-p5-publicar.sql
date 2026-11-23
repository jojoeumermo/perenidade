-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════ Alumia · Prompt 5 · Publicar: um envio, um post; apagar o próprio post; moderar sem aviso repetido (26/11/2026) ═══════════════════════
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Roda depois de 20261125-r3-fim.sql (banco na versão 16).
-- Teste: scripts/testar-p5-publicar.mjs (a migração duas vezes sobre o install.sql do ramo).
--
-- O que muda:
-- 1. CHAVE DO ENVIO (idempotência). O aparelho gera uma chave (uuid) por envio e manda no cabeçalho "x-alumia-envio" do pedido
--    (lib/backend.ts tira o campo chave_envio do pedido e põe no cabeçalho). Um gatilho antes de gravar em interno.rede_posts,
--    interno.rede_stories e interno.rede_agendados anota (autora, chave) numa tabela com chave primária: a mesma chave chegando de
--    novo, noutro pedido, é recusada com "envio_repetido" (a transação inteira volta, e o limite de posts não é gasto). Dentro do
--    mesmo pedido (o fio, que grava vários blocos de uma vez) a chave vale para todos. Assim, toda função que publica (post,
--    resposta, enquete, aviso, texto longo, fio, compositor, vida do post, ato, story, agendamento) fica protegida sem redefinir
--    nenhuma delas. public.rede_envio_achar(chave) devolve à autora o que aquela chave já publicou (o aparelho mostra o post em
--    vez de um erro). As anotações somem sozinhas depois de 2 dias (só servem para o reenvio do mesmo aparelho).
-- 2. APAGAR O PRÓPRIO POST: public.rede_pub_apagar(p_post). Só a autora; o post sai como na "vida do post" (interno.rede_vida_apagar:
--    sai de vez, ou fica "[post apagado]" quando alguém respondeu ou citou); o chamado do ato sai junto. Sem aviso de moderação.
-- 3. MODERAR (public.rede_mod_agir, redefinida a partir do corpo final da R2): "remover" no próprio post é apagar (sem aviso nem
--    registro de moderação); repetir a mesma ação num post que já está assim (remover o já removido, reter o já retido, travar o já
--    travado) não grava de novo nem avisa de novo; o mesmo "avisar" da mesma pessoa em 2 minutos também não. A moderação agindo
--    sobre post de outra pessoa continua avisando, uma vez.
-- 4. "Posts de hoje" do painel (public.alumia_painel_geral, redefinida): conta só posts de conta da Alumia, não apagados, e não
--    conta a cópia (mesma autora, mesmo tipo, mesmo texto, mesma resposta, a menos de 2 minutos de outra): os repetidos de antes
--    deixam de inflar o número sem que nada seja apagado.
-- Endereço de rede: nada daqui lê ou guarda (do cabeçalho do pedido, só a chave do envio). Nenhuma lista de pessoas sai daqui.
-- Lei: LGPD art. 6º, III (necessidade: a anotação do envio guarda só autora, chave e o id do que nasceu, por 2 dias) e art. 18, VI
-- (eliminação: a autora apaga o próprio post).

-- ── 1. A chave do envio ─────────────────────────────────────────────────────────────────────────────────────────────────────

-- A chave de cada envio: a autora, a chave sorteada pelo aparelho, o que nasceu dela (post, story ou agendamento) e o número da
-- transação. Nada do texto, nenhum endereço de rede. Passados 2 dias, sai na limpeza que roda junto com os envios novos (só serve
-- para o reenvio do mesmo aparelho).
create table if not exists interno.rede_envios (
  autor uuid not null,
  chave uuid not null,
  alvo text not null check (alvo in ('post', 'story', 'agendado')),
  objeto uuid not null,
  tx bigint not null,
  criado_em timestamptz not null default now(),
  primary key (autor, chave)
);
create index if not exists rede_envios_tempo on interno.rede_envios (criado_em);
alter table interno.rede_envios enable row level security;
revoke all on interno.rede_envios from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.rede_envios from anon, authenticated;
  end if;
end $$;

/** A chave do envio que veio no cabeçalho "x-alumia-envio" deste pedido (uuid), ou nulo. */
create or replace function interno.rede_envio_chave() returns uuid language plpgsql stable set search_path = interno, pg_temp as $$
declare v text;
begin
  begin
    v := nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-alumia-envio';
  exception when others then return null;
  end;
  if v is null or v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
  return v::uuid;
end $$;

/**
 * O gatilho: anota (autora, chave) antes de gravar. A mesma chave de outro pedido (outra transação) é recusada com "envio_repetido";
 * se o primeiro pedido ainda está gravando, este espera por ele (a chave primária) e só então decide.
 */
create or replace function interno.rede_envio_confere() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_chave uuid := interno.rede_envio_chave(); v_tx bigint;
begin
  if v_chave is null or new.autor is null then return new; end if;
  insert into rede_envios (autor, chave, alvo, objeto, tx) values (new.autor, v_chave, tg_argv[0], new.id, txid_current())
  on conflict (autor, chave) do nothing;
  if not found then
    select tx into v_tx from rede_envios where autor = new.autor and chave = v_chave;
    if v_tx is distinct from txid_current() then perform interno.erro('envio_repetido'); end if;
  end if;
  if random() < 0.02 then delete from rede_envios where criado_em < now() - interval '2 days'; end if;
  return new;
end $$;
revoke all on function interno.rede_envio_chave(), interno.rede_envio_confere() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_envio_chave(), interno.rede_envio_confere() from anon, authenticated;
  end if;
end $$;

drop trigger if exists rede_envio_confere on interno.rede_posts;
create trigger rede_envio_confere before insert on interno.rede_posts for each row execute function interno.rede_envio_confere('post');
drop trigger if exists rede_envio_confere on interno.rede_stories;
create trigger rede_envio_confere before insert on interno.rede_stories for each row execute function interno.rede_envio_confere('story');
drop trigger if exists rede_envio_confere on interno.rede_agendados;
create trigger rede_envio_confere before insert on interno.rede_agendados for each row execute function interno.rede_envio_confere('agendado');

/**
 * O que esta chave de envio já publicou, para a autora: o post (como a linha mostra), o story ({id, expira_em}) ou o agendamento
 * ({id, quando}). Nulo quando a chave não é dela, já sumiu ou o que nasceu foi apagado.
 */
create or replace function public.rede_envio_achar(p_chave uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); e rede_envios; x rede_posts; s rede_stories; a rede_agendados;
begin
  if v is null or p_chave is null then return null; end if;
  select * into e from rede_envios where chave = p_chave and autor = v;
  if not found then
    -- Publicado como identidade (a autora do post é a identidade): a chave ainda é de quem chama, se a identidade é dela.
    select n.* into e from rede_envios n where n.chave = p_chave
      and exists (select 1 from rede_identidades i where i.dono = v and i.identidade = n.autor) limit 1;
    if not found then return null; end if;
  end if;
  if e.alvo = 'post' then
    select * into x from rede_posts where id = e.objeto and apagado_em is null;
    if not found then return null; end if;
    return interno.rede_post_v2(x, v, true);
  elsif e.alvo = 'story' then
    select * into s from rede_stories where id = e.objeto;
    if not found then return null; end if;
    return jsonb_build_object('id', s.id, 'expira_em', s.expira_em);
  end if;
  select * into a from rede_agendados where id = e.objeto;
  if not found then return null; end if;
  return jsonb_build_object('id', a.id, 'quando', a.quando);
end $$;

-- ── 2. Apagar o próprio post ────────────────────────────────────────────────────────────────────────────────────────────────

/** O apagar de verdade de um post da própria autora (sem conferir quem chama: quem chama confere). O chamado do ato sai junto. */
create or replace function interno.rede_pub_apagar_post(p_post uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from rede_chamados where post = p_post;
  return interno.rede_vida_apagar(array[p_post]);
end $$;
revoke all on function interno.rede_pub_apagar_post(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_pub_apagar_post(uuid) from anon, authenticated;
  end if;
end $$;

/**
 * Apagar um post meu (ou de uma identidade minha). Sai de vez; se alguém respondeu ou citou, fica "[post apagado]", sem autora,
 * texto nem mídia. Nada de aviso de moderação: foi a própria autora.
 */
create or replace function public.rede_pub_apagar(p_post uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts;
begin
  perform interno.aberta('comunidade');
  if v is null then perform interno.erro('entre_primeiro'); end if;
  select * into x from rede_posts where id = p_post;
  if not found or x.apagado_em is not null
     or not (x.autor = v or exists (select 1 from rede_identidades i where i.dono = v and i.identidade = x.autor)) then
    perform interno.erro('nao_encontrado');
  end if;
  perform interno.limite('rede_pub_apagar', 60, 60);
  perform interno.rede_pub_apagar_post(x.id);
  return jsonb_build_object('apagado', true);
end $$;

-- ── 3. Moderar sem repetir e sem aviso no próprio post ──────────────────────────────────────────────────────────────────────

/**
 * Uma ação de moderação (o corpo final da R2, com a filiação a núcleo por interno.rede_nucleo_sem_membros()). Novo: "remover" no
 * PRÓPRIO post é apagar (sem registro nem aviso de moderação); nenhuma ação no próprio post avisa "uma pessoa da moderação"; a
 * mesma ação de novo num post que já está assim, ou o mesmo "avisar" em 2 minutos, devolve a ação de antes sem gravar nem avisar.
 */
create or replace function public.rede_mod_agir(p_denuncia uuid, p_alvo_tipo text, p_alvo text, p_acao text, p_regra text, p_motivo text, p_contexto text default null) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); d rede_denuncias; x rede_posts; f perfis;
  v_regra text := interno.txt(p_regra, 'regra', 3, 80); v_motivo text := interno.txt(p_motivo, 'motivo', 3, 1000);
  v_id uuid; v_afetado uuid; v_motivo_log text := interno.txt(p_motivo, 'motivo', 3, 1000); v_texto text; v_com text := nullif(btrim(coalesce(p_contexto, '')), '');
  v_meu boolean := false; v_igual uuid;
begin
  if p_acao is null or p_acao not in ('remover', 'restaurar', 'reter', 'travar', 'destravar', 'avisar', 'banir', 'desbanir') then perform interno.erro('invalido:acao'); end if;
  if p_denuncia is not null then
    select * into d from rede_denuncias where id = p_denuncia;
    if not found or not interno.rede3_mod_pode_denuncia(d) then perform interno.erro('nao_encontrado'); end if;
    -- A denúncia tem de ser sobre o alvo da ação: senão ela serviria de passe livre (quebra-vidro) para mexer em outro post.
    if d.alvo_tipo is distinct from p_alvo_tipo then perform interno.erro('invalido:alvo'); end if;
  end if;
  perform interno.limite('rede3_agir', 300, 60);

  if p_alvo_tipo = 'post' and p_acao in ('remover', 'restaurar', 'reter', 'travar', 'destravar', 'avisar') then
    begin select * into x from rede_posts where id = p_alvo::uuid; exception when others then perform interno.erro('invalido:alvo'); end;
    if p_denuncia is not null and d.alvo is distinct from x.id::text then perform interno.erro('invalido:alvo'); end if;
    if not found or not interno.rede3_mod_pode_post(x, p_denuncia is not null) then perform interno.erro('nao_encontrado'); end if;
    -- Equipe geral em post de núcleo: só depois de abrir a denúncia (rede_mod_abrir registra o quebra-vidro e avisa a mediação).
    if x.nucleo is not null and not exists (select 1 from interno.rede_nucleo_sem_membros() n where n.nucleo = x.nucleo and n.usuario = v and n.papel = 'mediacao')
       and not exists (select 1 from rede_moderacao m where m.acao = 'quebra_vidro' and m.denuncia = p_denuncia and m.quem = v) then
      perform interno.erro('sem_permissao');
    end if;
    v_meu := x.autor is not null and (x.autor = v or exists (select 1 from rede_identidades i where i.dono = v and i.identidade = x.autor));
    -- O próprio post: remover é apagar, como no menu do post. Sem registro de moderação e sem aviso.
    if v_meu and p_acao = 'remover' and p_denuncia is null then
      if x.apagado_em is null then perform interno.rede_pub_apagar_post(x.id); end if;
      return jsonb_build_object('acao', null, 'apagado', true);
    end if;
    -- A mesma ação de novo (dois cliques, a tela que voltou): devolve a de antes, sem gravar nem avisar outra vez.
    if (p_acao = 'remover' and x.oculto and not x.retido) or (p_acao = 'reter' and x.oculto and x.retido)
       or (p_acao = 'travar' and x.travado) or (p_acao = 'destravar' and not x.travado) or (p_acao = 'restaurar' and not x.oculto and not x.retido)
       or p_acao = 'avisar' then
      select m.id into v_igual from rede_moderacao m
       where m.alvo_tipo = 'post' and m.alvo = x.id::text and m.acao = p_acao
         and (p_acao <> 'avisar' or (m.quem = v and m.motivo = v_motivo_log and m.criado_em > now() - interval '2 minutes'))
       order by m.criado_em desc limit 1;
      if v_igual is not null then return jsonb_build_object('acao', v_igual, 'repetida', true); end if;
    end if;
    v_afetado := case when v_meu then null else x.autor end;
    if p_acao = 'remover' then update rede_posts set oculto = true, retido = false, motivo = left(v_motivo, 200) where id = x.id;
    elsif p_acao = 'restaurar' then update rede_posts set oculto = false, retido = false, motivo = '', avaliacao = 'revista' where id = x.id;
    elsif p_acao = 'reter' then update rede_posts set oculto = true, retido = true, motivo = left(v_motivo, 200) where id = x.id;
    elsif p_acao = 'travar' then update rede_posts set travado = true where id = x.id;
    elsif p_acao = 'destravar' then update rede_posts set travado = false where id = x.id;
    end if;
    v_id := interno.rede3_mod_registrar(p_acao, 'post', x.id::text, v_regra, v_motivo_log, p_denuncia);
  elsif p_alvo_tipo = 'perfil' and p_acao in ('avisar', 'banir', 'desbanir') then
    select * into f from perfis where rede_handle = lower(btrim(coalesce(p_alvo, ''), ' @'));
    if not found then
      begin select * into f from perfis where id = p_alvo::uuid; exception when others then null; end;
    end if;
    if f.id is null then perform interno.erro('nao_encontrado'); end if;
    if f.id = v or interno.voluntario_e(f.id) then perform interno.erro('sem_permissao'); end if;
    v_afetado := f.id;
    if p_acao in ('banir', 'desbanir') then
      if v_com is null or not exists (select 1 from rede_comunidades where slug = v_com) then perform interno.erro('invalido:contexto'); end if;
      if not interno.rede3_mod_modera(v_com, null) then perform interno.erro('sem_permissao'); end if;
      if p_acao = 'banir' then
        insert into rede_comunidade_membros (comunidade, usuario, situacao, papel) values (v_com, f.id, 'banido', 'membro')
        on conflict (comunidade, usuario) do update set situacao = 'banido', papel = 'membro', banido_ate = null;
      else
        delete from rede_comunidade_membros where comunidade = v_com and usuario = f.id and situacao = 'banido';
      end if;
      v_motivo_log := 'comunidade ' || v_com || ': ' || v_motivo;
    elsif not (interno.cuida() or (v_com is not null and interno.rede3_mod_modera(v_com, null))) then
      perform interno.erro('sem_permissao');
    end if;
    -- O mesmo "avisar" da mesma pessoa para o mesmo perfil em 2 minutos: um aviso só.
    if p_acao = 'avisar' then
      select m.id into v_igual from rede_moderacao m
       where m.alvo_tipo = 'perfil' and m.alvo = f.id::text and m.acao = 'avisar' and m.quem = v and m.motivo = left(v_motivo_log, 1000)
         and m.criado_em > now() - interval '2 minutes'
       order by m.criado_em desc limit 1;
      if v_igual is not null then return jsonb_build_object('acao', v_igual, 'repetida', true); end if;
    end if;
    v_id := interno.rede3_mod_registrar(p_acao, 'perfil', f.id::text, v_regra, left(v_motivo_log, 1000), p_denuncia);
  else
    perform interno.erro('invalido:alvo_tipo');
  end if;

  v_texto := case p_acao
    when 'remover' then 'Um post seu foi retirado da Rede'
    when 'reter' then 'Um post seu ficou retido para leitura da moderação'
    when 'travar' then 'Uma conversa sua foi travada'
    when 'banir' then 'Você não pode mais escrever numa comunidade da Rede'
    when 'avisar' then 'A moderação da Rede deixou um aviso para você'
    else null end;
  if v_texto is not null and v_afetado is not null and v_afetado is distinct from v then
    perform interno.rede3_mod_avisar_afetado(v_afetado, left(v_texto || ' (regra: ' || v_regra || '). Decisão de uma pessoa da moderação. Você pode recorrer em até 30 dias, em Denúncias e recursos. Motivo: ' || left(v_motivo, 200), 500));
  end if;
  if p_denuncia is not null and p_acao <> 'restaurar' then
    update rede_denuncias set situacao = 'resolvida', cuida = v where id = d.id;
    perform interno.avisar_em(d.quem, 'Sua denúncia ' || d.protocolo || ' foi analisada e a Rede tomou providências. Obrigada por cuidar da Rede.', 'rede');
  end if;
  return jsonb_build_object('acao', v_id);
end $$;

-- ── 4. "Posts de hoje" sem as cópias ────────────────────────────────────────────────────────────────────────────────────────

/** Os posts e respostas de hoje (fuso de São Paulo), de conta da Alumia, não apagados, sem contar a cópia de um envio repetido. */
create or replace function interno.alumia_posts_de_hoje(p_dia timestamptz) returns integer language sql stable security definer set search_path = interno, pg_temp as $$
  select count(*)::integer from rede_posts p
  where p.criado_em >= p_dia and p.apagado_em is null and p.autor is not null
    and not exists (
      select 1 from rede_posts q
      where q.autor = p.autor and q.apagado_em is null and q.id <> p.id
        and q.tipo = p.tipo and q.texto = p.texto and coalesce(q.titulo, '') = coalesce(p.titulo, '') and coalesce(q.corpo, '') = coalesce(p.corpo, '')
        and q.resposta_a is not distinct from p.resposta_a and coalesce(q.corpo_grupo, '') = coalesce(p.corpo_grupo, '')
        and (q.criado_em, q.id) < (p.criado_em, p.id) and q.criado_em > p.criado_em - interval '2 minutes')
$$;
revoke all on function interno.alumia_posts_de_hoje(timestamptz) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_posts_de_hoje(timestamptz) from anon, authenticated;
  end if;
end $$;

/** Os números e a saúde (o corpo de 20261113-alumia-o7-painel.sql; "posts de hoje" sem as cópias dos envios repetidos). */
create or replace function public.alumia_painel_geral() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_papel text := interno.alumia_painel_exige(); v_dia timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
begin
  perform interno.alumia_painel_faxina();
  return jsonb_build_object(
    'papel', v_papel,
    'numeros', jsonb_build_object(
      'contas', (select count(*) from perfis f where f.rede_18 and f.rede_consentimento is not null),
      'aprovadas', (select count(*) from alumia_entrada e where e.situacao = 'aprovada'),
      'fila', (select count(*) from alumia_entrada e join perfis f on f.id = e.usuario where e.situacao = 'em_analise' and not f.suspenso),
      'denuncias', (select count(*) from rede_denuncias d where d.situacao in ('aberta', 'em_analise')),
      'denuncias_urgentes', (select count(*) from rede_denuncias d where d.situacao in ('aberta', 'em_analise') and d.prioridade = 1),
      'posts_hoje', interno.alumia_posts_de_hoje(v_dia),
      'comunidades', (select count(*) from rede_comunidades),
      'organizacoes', (select count(*) from rede_orgs),
      'selos_esperando', (select count(*) from rede_org_pedidos x where x.situacao = 'esperando'),
      'sancoes', (select count(*) from alumia_sancoes s where s.encerrada_em is null),
      'redes_barradas', (select count(*) from alumia_impressao_banimentos b where b.encerrado_em is null),
      'lixeira', (select count(*) from alumia_painel_lixeira l where l.de_vez_em is null)),
    'saude', jsonb_build_object(
      'versao', public.rede_alumia_versao(),
      'painel', 1,
      'trava', interno.alumia_exigida(),
      'trava_desde', (select valor ->> 'ligada_em' from configuracoes where chave = 'alumia_entrada'),
      'agendador', exists (select 1 from pg_extension where extname = 'pg_cron'),
      'redes_vistas', (select count(distinct impressao) from alumia_impressoes),
      'admin', exists (select 1 from alumia_painel_admin),
      'mediadores', (select count(distinct pa.usuario) from papeis pa where pa.papel = 'mediacao'),
      'decisoes', coalesce((select jsonb_object_agg(v.nome, v.ligado) from recursos_vivos v
                            where v.nome like 'alumia-%' or v.nome in ('rede-v2', 'fediverso-total', 'fediverso-grupos')), '{}'::jsonb)),
    'ultimas', coalesce((select jsonb_agg(x.j order by x.id desc) from (
      select r.id, jsonb_build_object('id', r.id, 'quando', r.criado_em, 'quem', r.quem_nome, 'papel', r.papel, 'acao', r.acao, 'alvo', r.alvo_nome, 'motivo', r.motivo) as j
      from alumia_painel_registro r order by r.id desc limit 8) x), '[]'::jsonb));
end $$;

-- ── 5. Permissões e a porta ─────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function public.rede_envio_achar(uuid), public.rede_pub_apagar(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_envio_achar(uuid), public.rede_pub_apagar(uuid) from anon;
    grant execute on function public.rede_envio_achar(uuid), public.rede_pub_apagar(uuid) to authenticated, service_role;
  end if;
end $$;

select interno.alumia_trancar();
