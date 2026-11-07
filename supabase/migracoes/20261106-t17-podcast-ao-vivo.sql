-- ───────────────────────── Podcast ao vivo (T17, 06/11/2026) ─────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Rode depois do install.sql (usa
-- interno.podcaster(), interno.eu(), interno.limite() e interno.erro() de lá). Explicação: docs/PODCAST-AO-VIVO.md.
--
-- Quem faz o podcast (interno.podcaster(): coordenação, comunicação/jornalismo e quem tem função no podcast) pode pôr no ar
-- uma transmissão com vídeo que todo mundo vê na página /podcasts. Uma transmissão por vez, numa linha só.
--
-- O que fica guardado, e só enquanto está no ar: título, modo, endereço da transmissão aberta (se houver), a sala sorteada
-- do WebRTC, a chave pública da aba de quem transmite e quem começou (para só essa pessoa ou a coordenação encerrar).
-- Ao encerrar, a sala, a chave e o endereço são apagados. Nada de quem assiste é guardado, e o site não grava a
-- transmissão (LGPD, Lei 13.709/2018, art. 6º, III: necessidade).
--
-- Consentimento de imagem e voz: começar exige confirmar que todas as pessoas que aparecem ou falam concordaram, e que
-- ninguém menor de 18 anos aparece sem autorização de quem responde por ela (LGPD, art. 7º, I, e art. 14; ECA,
-- Lei 8.069/1990, art. 17). O banco guarda só a hora dessa confirmação, como registro de que ela foi feita.

create table if not exists interno.podcast_ao_vivo (
  id boolean primary key default true check (id),
  no_ar boolean not null default false,
  titulo text not null default '',
  modo text not null default 'navegador' check (modo in ('navegador', 'link')),
  endereco text not null default '',
  sala uuid,
  chave_publica text not null default '',
  iniciado_por uuid references interno.perfis (id) on delete set null,
  iniciado_em timestamptz,
  consentimento_em timestamptz,
  visto_em timestamptz
);
alter table interno.podcast_ao_vivo enable row level security;
revoke all on interno.podcast_ao_vivo from public, anon, authenticated;
insert into interno.podcast_ao_vivo (id) values (true) on conflict do nothing;

/**
 * Está no ar? Pelo navegador, só enquanto quem transmite dá sinal de vida (podcast_ao_vivo_pulso, a cada minuto; três
 * minutos sem sinal = encerrada); por link, até 12 horas depois de começar (esqueceram de encerrar).
 */
create or replace function interno.podcast_ao_vivo_no_ar(r interno.podcast_ao_vivo) returns boolean language sql stable set search_path = interno, pg_temp as $$
  select r.no_ar and case when r.modo = 'navegador' then coalesce(r.visto_em, r.iniciado_em) > now() - interval '3 minutes'
                          else r.iniciado_em > now() - interval '12 hours' end
$$;

/** O que a página do podcast mostra. Sem dizer quem começou; "pode" e "minha" só dizem respeito a quem pergunta. */
create or replace function public.podcast_ao_vivo_estado() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select case when interno.podcast_ao_vivo_no_ar(r) then
           jsonb_build_object('no_ar', true, 'titulo', r.titulo, 'modo', r.modo, 'endereco', r.endereco, 'sala', r.sala,
             'chaves', case when r.chave_publica = '' then '[]'::jsonb else jsonb_build_array(r.chave_publica) end,
             'desde', r.iniciado_em, 'pode', interno.podcaster(), 'minha', auth.uid() is not null and r.iniciado_por = auth.uid())
         else jsonb_build_object('no_ar', false, 'pode', interno.podcaster()) end
  from podcast_ao_vivo r where r.id
$$;

/** Começa (ou recomeça, para quem já transmitia) a transmissão. */
create or replace function public.podcast_ao_vivo_iniciar(p_titulo text, p_modo text, p_endereco text, p_consentimento boolean) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r podcast_ao_vivo; v_sala uuid := gen_random_uuid(); v_endereco text := btrim(coalesce(p_endereco, ''));
begin
  if not interno.podcaster() then perform interno.erro('sem_permissao'); end if;
  if p_consentimento is not true then perform interno.erro('consentimento'); end if;
  if p_modo not in ('navegador', 'link') then perform interno.erro('invalido:modo'); end if;
  if v_endereco <> '' and (length(v_endereco) > 500 or v_endereco !~ '^https://[^\s/@]+(/\S*)?$') then perform interno.erro('invalido:endereco'); end if;
  if p_modo = 'link' and v_endereco = '' then perform interno.erro('invalido:endereco'); end if;
  perform interno.limite('podcast_ao_vivo', 30, 1440);
  select * into r from podcast_ao_vivo where id for update;
  -- Uma transmissão por vez: outra pessoa só toma o lugar quando a de agora já caiu (ou pela coordenação).
  if interno.podcast_ao_vivo_no_ar(r) and r.iniciado_por is distinct from v and not interno.coord() then perform interno.erro('ocupado'); end if;
  update podcast_ao_vivo set no_ar = true, titulo = left(btrim(coalesce(p_titulo, '')), 120), modo = p_modo, endereco = v_endereco,
    sala = v_sala, chave_publica = '', iniciado_por = v, iniciado_em = now(), consentimento_em = now(), visto_em = now()
  where id;
  return jsonb_build_object('ok', true, 'sala', v_sala);
end $$;

/** A chave pública da aba de quem transmite pelo navegador (quem assiste só aceita vídeo assinado por ela). */
create or replace function public.podcast_ao_vivo_chave(p_sala uuid, p_publica text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if coalesce(p_publica, '') !~ '^B[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:publica'); end if;
  perform interno.limite('podcast_ao_vivo_chave', 60, 60);
  update podcast_ao_vivo set chave_publica = p_publica, visto_em = now() where id and no_ar and sala = p_sala and iniciado_por = v and interno.podcaster();
  if not found then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** Sinal de vida de quem transmite pelo navegador (a cada minuto). */
create or replace function public.podcast_ao_vivo_pulso(p_sala uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update podcast_ao_vivo set visto_em = now() where id and no_ar and sala = p_sala and iniciado_por = v and interno.podcaster();
  return jsonb_build_object('ok', found);
end $$;

/** Encerra: quem começou ou a coordenação. Apaga a sala, a chave e o endereço. */
create or replace function public.podcast_ao_vivo_encerrar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.podcaster() then perform interno.erro('sem_permissao'); end if;
  update podcast_ao_vivo set no_ar = false, sala = null, chave_publica = '', endereco = '', visto_em = null
  where id and (iniciado_por = v or interno.coord() or not interno.podcast_ao_vivo_no_ar(podcast_ao_vivo));
  if not found then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function interno.podcast_ao_vivo_no_ar(interno.podcast_ao_vivo) from public, anon, authenticated;
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('podcast_ao_vivo_estado', 'podcast_ao_vivo_iniciar', 'podcast_ao_vivo_chave', 'podcast_ao_vivo_pulso', 'podcast_ao_vivo_encerrar') loop
    execute format('revoke all on function %s from public', f.assinatura);
    execute format('grant execute on function %s to anon, authenticated, service_role', f.assinatura);
  end loop;
end $$;
