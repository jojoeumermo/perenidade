-- ─────────────── Alumia: pedidos P18, P19 e P20 da Faixa 2 em arquivo da Faixa 1 (acabamento, 13/11/2026) ───────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- O que a revisão da privacidade do Fediverso e do chat achou em funções da Alumia:
--
--   P18  public.conta_meus_dados: o "baixar meus dados" deixa de levar o endereço de quem curtiu ou impulsionou (ator_remoto e
--        atores_remotos nos avisos fed_curtida e fed_impulso). É dado de terceiro.
--   P19  public.rede_avisos e public.avisos_meus deixam de fora fed_curtida e fed_impulso (uma linha por curtida, com a hora de
--        cada uma, dizia o número exato); a tela da Alumia usa rede_aviso_listar, que já junta e aplica o piso. O resumo semanal
--        (interno.rede3_aviso_resumo) passa a aplicar o piso: abaixo de 3, conta 1.
--   P20  interno.rede_ato_caronas_json: a lista só tira a carona quando a DONA bloqueou quem lê (antes tirava também quando quem lê
--        bloqueava a dona, e bloquear virava um teste de "fulana vai ao ato?"). public.rede_bloquear ganha freio (20 por hora) e
--        um bloqueio só se desfaz depois de 3 horas. As caronas somem um dia depois do ato (ou na hora, se ele foi cancelado),
--        na faxina interno.rede_ato_caronas_faxina (pg_cron, todo dia).
--
-- Pode rodar mais de uma vez, sem apagar dado nenhum (a faxina só apaga carona de ato que já passou ou foi cancelado). Roda
-- DEPOIS de 20261112-alumia-portas.sql; no fim chama interno.alumia_trancar() para as funções public.rede_* recriadas aqui
-- voltarem a passar pela porta da entrada. Teste: npm run testar:alumia-o7.

-- ── P18 · baixar meus dados sem o endereço de quem curtiu ──────────────────────────────────────────────────────────────────────
create or replace function public.conta_meus_dados() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_saida jsonb; v_dados jsonb; r record;
begin
  perform interno.limite('meus_dados', 3, 60);
  v_saida := jsonb_build_object(
    'gerado_em', now(),
    'conta', jsonb_build_object('id', v, 'email', interno.email_da_conta(v)),
    'perfil', (select to_jsonb(p) - 'avatar' from perfis p where p.id = v));
  for r in
    select c.table_name, c.column_name from information_schema.columns c
    where c.table_schema = 'interno' and c.data_type = 'uuid' and c.column_name in ('autor', 'usuario', 'quem', 'para', 'criado_por', 'pessoa', 'responsavel')
      and c.table_name not in ('codigos_recuperacao', 'limites', 'perfis')
    order by c.table_name, c.column_name
  loop
    -- P18: nos avisos de curtida e impulso de fora, o endereço de quem curtiu ou impulsionou é dado de TERCEIRO (a tela de avisos
    -- esconde de propósito): sai da cópia. O resto da linha (o aviso, o post, a hora) continua.
    execute format('select coalesce(jsonb_agg(case when %L = ''avisos'' and to_jsonb(t) ->> ''tipo'' in (''fed_curtida'', ''fed_impulso'') then to_jsonb(t) - ''ator_remoto'' - ''atores_remotos'' else to_jsonb(t) end), ''[]''::jsonb) from (select * from interno.%I where %I = $1 limit 1000) t', r.table_name, r.table_name, r.column_name) into v_dados using v;
    if v_dados <> '[]'::jsonb then v_saida := v_saida || jsonb_build_object(r.table_name || '.' || r.column_name, v_dados); end if;
  end loop;
  perform interno.registrar('meus_dados_baixados', v::text, '{}'::jsonb);
  return v_saida;
end $$;

-- ── P19 · as listas antigas de avisos sem curtida e impulso de fora, e o piso no resumo semanal ──────────────────────────────────
/** Os recados da pessoa (o sino do site). Curtida e impulso de fora ficam de fora: na Alumia eles chegam juntos e com piso. */
create or replace function public.avisos_meus() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'texto', a.texto, 'lido', a.lido, 'criado_em', a.criado_em, 'categoria', a.categoria) order by a.criado_em desc), '[]'::jsonb)
  from (select * from avisos where para = auth.uid() and auth.uid() is not null and coalesce(tipo, '') not in ('fed_curtida', 'fed_impulso')
        order by criado_em desc limit 40) a
$$;

/** Os avisos que a Rede mostra: só o que é da própria pessoa, nunca o sino da equipe; sem curtida e impulso de fora (P19). */
create or replace function public.rede_avisos() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'texto', a.texto, 'lido', a.lido, 'criado_em', a.criado_em, 'categoria', a.categoria) order by a.criado_em desc), '[]'::jsonb)
  from (select * from avisos where para = auth.uid() and auth.uid() is not null and categoria in ('rede', 'conta') and coalesce(tipo, '') not in ('fed_curtida', 'fed_impulso')
        order by criado_em desc limit 40) a
$$;

create or replace function interno.rede3_aviso_resumo(p_usuario uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  r record; v_n integer := 0; v_linhas text := ''; v_titulos text := ''; v_lista text[] := '{}'; v_t text;
begin
  -- P19: curtida e impulso de fora abaixo de 3 contam 1 (o mesmo piso de rede_aviso_listar: "alguém", nunca o número exato).
  for r in
    select q.tipo, case when q.tipo in ('fed_curtida', 'fed_impulso') and q.n < 3 then 1 else q.n end as n
    from (select g.tipo, sum(g.total)::integer as n from interno.rede3_aviso_grupos(p_usuario, now() - interval '7 days') g where not g.lido group by g.tipo) q
    order by 2 desc loop
    v_n := v_n + r.n;
    v_linhas := v_linhas || format(E'- %s %s\n', r.n, case coalesce(r.tipo, '')
      when 'resposta' then case when r.n = 1 then 'resposta' else 'respostas' end
      when 'mencao' then case when r.n = 1 then 'menção' else 'menções' end
      when 'citacao' then case when r.n = 1 then 'citação' else 'citações' end
      when 'seguidor' then case when r.n = 1 then 'novo seguidor' else 'novos seguidores' end
      when 'apoio' then case when r.n = 1 then 'apoio' else 'apoios' end
      when 'chamado' then case when r.n = 1 then 'novidade em chamado' else 'novidades em chamados' end
      when 'nucleo' then case when r.n = 1 then 'novidade em núcleo' else 'novidades em núcleos' end
      when 'moderacao' then case when r.n = 1 then 'aviso da moderação' else 'avisos da moderação' end
      else case when r.n = 1 then 'aviso da conta' else 'avisos da conta' end end);
  end loop;
  if v_n = 0 then return null; end if;
  for r in
    select distinct on (g.post) g.post, g.titulo from interno.rede3_aviso_grupos(p_usuario, now() - interval '7 days') g
    join rede_posts p on p.id = g.post
    where not g.lido and g.tipo in ('resposta', 'mencao', 'citacao') and g.titulo is not null
      and interno.rede2_publico(p) = 'internet' and not p.oculto and not p.retido and p.apagado_em is null
    order by g.post limit 5 loop
    v_t := left(interno.sem_link(r.titulo), 80);
    if v_t <> '' then v_lista := v_lista || v_t; end if;
  end loop;
  if cardinality(v_lista) > 0 then
    v_titulos := E'\n\nConversas públicas com novidade:\n' || (select string_agg('- ' || t, E'\n') from unnest(v_lista) t);
  end if;
  return jsonb_build_object('n', v_n, 'assunto', 'Seu resumo da semana na Alumia',
    'texto', format(E'Nesta semana você teve %s %s na Alumia:\n%s%s\n\nAbrir os avisos:\n\n%s\n\nVocê recebe este resumo porque ligou, em Avisos → Preferências, a opção "Resumo semanal por e-mail". Ele leva só contagens e títulos de conversas públicas, nunca o texto de um post. Para desligar, entre em Avisos → Preferências.',
      v_n, case when v_n = 1 then 'aviso novo' else 'avisos novos' end, v_linhas, v_titulos, interno.endereco() || '/pt/alumia/avisos'));
end $$;

-- ── P20 · caronas que não denunciam a dona, freio no bloquear e faxina das caronas ──────────────────────────────────────────────
/**
 * As caronas do ato, sem quem: `minha` diz só se é desta pessoa; `apagar` se ela pode tirar (a dona ou quem organiza). No máximo
 * 200 (o mesmo teto da criação), as da pessoa primeiro. Some só a carona cuja DONA bloqueou quem lê: o bloqueio feito por quem
 * lê não muda a lista (senão bloquear e recarregar dizia quais caronas eram de quem).
 */
create or replace function interno.rede_ato_caronas_json(p_ato uuid, p_quem uuid, p_organiza boolean) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', k.id, 'tipo', k.tipo, 'meio', k.meio, 'saida', k.saida_publica, 'vagas', k.vagas, 'sai_em', k.sai_em,
      'minha', k.quem = p_quem, 'apagar', k.quem = p_quem or p_organiza
    ) order by k.tipo, k.sai_em nulls last, k.criado_em, k.id), '[]'::jsonb)
    from (select * from rede_ato_caronas x
           where x.ato = p_ato and not exists (select 1 from rede_bloqueios b where b.quem = x.quem and b.bloqueado = p_quem)
           order by (x.quem = p_quem) desc, x.criado_em, x.id limit 200) k
$$;

/**
 * Bloquear: some da linha dos dois, desfaz o seguir nos dois sentidos e ninguém responde a ninguém. Com freio (20 por hora) e,
 * para desfazer, 3 horas de espera: bloquear e desbloquear em sequência não serve para testar suspeitos.
 */
create or replace function public.rede_bloquear(p_usuario uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if p_usuario is null or p_usuario = v then perform interno.erro('invalido:usuario'); end if;
  perform interno.limite('rede_bloquear', 20, 60);
  if coalesce(p_sim, true) then
    insert into rede_bloqueios (quem, bloqueado) values (v, p_usuario) on conflict do nothing;
    delete from rede_seguindo where (quem = v and segue = p_usuario) or (quem = p_usuario and segue = v);
  else
    if exists (select 1 from rede_bloqueios where quem = v and bloqueado = p_usuario and criado_em > now() - interval '3 hours') then
      perform interno.erro('muitos_pedidos');
    end if;
    delete from rede_bloqueios where quem = v and bloqueado = p_usuario;
  end if;
  return jsonb_build_object('ok', true);
end $$;

/** A faxina das caronas: a ligação "esta pessoa ia a este ato" não fica no banco depois do ato. Devolve quantas apagou. */
create or replace function interno.rede_ato_caronas_faxina() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_n integer;
begin
  delete from rede_ato_caronas k using rede_chamados c
   where c.post = k.ato and (c.cancelado or coalesce(c.fim, c.inicio) < now() - interval '1 day');
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function interno.rede_ato_caronas_faxina() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-caronas-faxina', '41 4 * * *', 'select interno.rede_ato_caronas_faxina()');
  end if;
exception when others then null;
end $$;

-- ── As portas: as funções public.rede_* recriadas aqui voltam a passar pela entrada da Alumia ─────────────────────────────────────
select interno.alumia_trancar();
