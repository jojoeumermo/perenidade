-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Rede Lúcia v2, pacote "perfil" (Etapa 7, R4 itens 10 a 14). Idempotente: roda por cima do install.sql e da
-- 2026-11-rede-fundacao.sql, quantas vezes for preciso. Nenhuma tabela nova; só colunas em interno.perfis e funções.
--
-- O que este arquivo faz, e só isto:
--   1. Colunas do perfil: avatar (galeria de 24 SVGs próprios, ou foto enviada), capa (8 padrões, ou imagem enviada),
--      "estudando agora" (opt-in), troca de @handle com limite, selos de trajetória e a escolha de mostrá-los.
--   2. Foto enviada: o navegador reencoda em WebP (isso já tira EXIF/GPS) e o BANCO confere os bytes: só um WebP simples
--      (sem EXIF, XMP, perfil de cor nem animação), pequeno. Imagem enviada só aparece para os outros depois que a
--      mediação a aceita (rede_perfil_imagens_fila / rede_perfil_imagem_decidir); a própria pessoa a vê desde já.
--   3. @handle (3 a 20, [a-z0-9_], único, sem imitar a equipe; depois da primeira vez, uma troca a cada 30 dias).
--   4. Perfil: rede_perfil_de (superconjunto da fundação), rede_perfil_meu, rede_perfil_editar, post fixado, seguir com
--      perfil trancado (pedido pendente, aprovado pela pessoa) e perfil invisível. Sem contagem pública de seguidores.
--   5. Corrige a rede_seguir da Rede de hoje: ela ignorava o perfil trancado (quem pedia entrava direto).
--
-- Privacidade: nada do nome civil (só codinome); selo "equipe", "educador" e "moderação" sai do papel e a pessoa pode
-- escondê-los; selo de trilha é declarado pela pessoa a partir do progresso do aparelho (o servidor não o verifica e a tela
-- diz isso); selos de papel são de catálogo fechado; o de trilha é texto livre [a-z0-9-] declarado pela pessoa (passa pela triagem de abuso, mas o servidor não o confere com o catálogo): a tela só oferece as trilhas do progresso do aparelho (LGPD, art. 5º, II, e art. 11, I).
-- Leis conferidas em 04/11/2026: LGPD (13.709/2018) arts. 6º (minimização), 11, 14 (a Rede é só 18+), 18 (corrigir, apagar);
-- Marco Civil (12.965/2014) art. 19 (a retirada de imagem de perfil segue o fluxo da moderação); Código Penal 138 a 140.

-- ── 1. Colunas ──────────────────────────────────────────────────────────────────────────────────────────────────────────

alter table interno.perfis add column if not exists rede_avatar text;
alter table interno.perfis add column if not exists rede_avatar_dados text;
alter table interno.perfis add column if not exists rede_avatar_ok boolean not null default false;
alter table interno.perfis add column if not exists rede_capa text;
alter table interno.perfis add column if not exists rede_capa_dados text;
alter table interno.perfis add column if not exists rede_capa_ok boolean not null default false;
alter table interno.perfis add column if not exists rede_estudando jsonb;
alter table interno.perfis add column if not exists rede_estudando_em timestamptz;
alter table interno.perfis add column if not exists rede_handle_em timestamptz;
alter table interno.perfis add column if not exists rede_selos_mostrar boolean not null default true;

do $$ begin
  alter table interno.perfis add constraint perfis_rede_avatar_formato check (rede_avatar is null or rede_avatar ~ '^(a(0[1-9]|1[0-9]|2[0-4])|envio)$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table interno.perfis add constraint perfis_rede_capa_formato check (rede_capa is null or rede_capa ~ '^(c0[1-8]|envio)$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table interno.perfis add constraint perfis_rede_avatar_tamanho check (rede_avatar_dados is null or char_length(rede_avatar_dados) <= 40000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table interno.perfis add constraint perfis_rede_capa_tamanho check (rede_capa_dados is null or char_length(rede_capa_dados) <= 90000);
exception when duplicate_object then null; end $$;

-- ── 2. Auxiliares internos ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * É um WebP simples, pequeno e sem metadados? Confere os bytes de verdade (não confia no navegador): cabeçalho RIFF/WEBP, o
 * tamanho que o arquivo declara, e a lista de pedaços. Recusa EXIF, XMP, perfil de cor (ICCP) e animação, que são o
 * caminho de GPS, modelo de câmera e outros rastros. O navegador já reencoda (canvas não carrega EXIF); isto é a segunda tranca.
 */
create or replace function interno.rede3_perfil_webp_ok(p_dados text, p_max integer) returns boolean language plpgsql immutable set search_path = interno, pg_temp as $$
declare
  b bytea; n integer; pos integer; tam bigint; quatro text; riff bigint; viu boolean := false;
begin
  if p_dados is null or char_length(p_dados) > p_max or p_dados !~ '^data:image/webp;base64,[A-Za-z0-9+/]+={0,2}$' then return false; end if;
  begin
    b := decode(substr(p_dados, 24), 'base64');
  exception when others then return false;
  end;
  n := length(b);
  if n < 20 or substring(b from 1 for 4) <> '\x52494646'::bytea or substring(b from 9 for 4) <> '\x57454250'::bytea then return false; end if;
  riff := get_byte(b, 4) + get_byte(b, 5) * 256::bigint + get_byte(b, 6) * 65536::bigint + get_byte(b, 7) * 16777216::bigint;
  if riff + 8 <> n then return false; end if;
  pos := 12;
  while pos + 8 <= n loop
    quatro := convert_from(substring(b from pos + 1 for 4), 'LATIN1');
    tam := get_byte(b, pos + 4) + get_byte(b, pos + 5) * 256::bigint + get_byte(b, pos + 6) * 65536::bigint + get_byte(b, pos + 7) * 16777216::bigint;
    if tam > n then return false; end if;
    if quatro in ('EXIF', 'XMP ', 'ICCP', 'ANIM', 'ANMF') then return false; end if;
    if quatro = 'VP8X' then
      if tam < 10 or pos + 9 > n then return false; end if;
      -- bits do VP8X: 0x20 perfil de cor, 0x08 EXIF, 0x04 XMP, 0x02 animação
      if (get_byte(b, pos + 8) & (32 | 8 | 4 | 2)) <> 0 then return false; end if;
    end if;
    if quatro in ('VP8 ', 'VP8L') then viu := true; end if;
    pos := pos + 8 + tam::integer + (tam % 2)::integer;
  end loop;
  return viu and pos = n;
end $$;

/** Os selos de trajetória de uma pessoa, como texto: 'equipe', 'educador', 'moderacao' (do papel) e 'trilha:<slug>' (declarado). */
create or replace function interno.rede3_perfil_selos(p_id uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(x.s order by x.o, x.s), '[]'::jsonb)
  from (
    select 'equipe' as s, 1 as o where interno.voluntario_e(p_id)
    union all
    select 'educador', 2 where exists (select 1 from papeis q where q.usuario = p_id and q.papel in ('educacao', 'educacao_secundaria'))
    union all
    select 'moderacao', 3 where exists (select 1 from papeis q where q.usuario = p_id and q.papel = 'mediacao')
      or exists (select 1 from rede_comunidade_membros m where m.usuario = p_id and m.papel = 'moderacao' and m.situacao = 'ativo')
    union all
    select t, 4 from perfis f, unnest(f.rede_selos) t where f.id = p_id and t ~ '^trilha:[a-z0-9-]{2,80}$'
  ) x
$$;

/** A imagem de perfil (avatar ou capa) como o dono de `f` quer que `p_quem` a veja: galeria, enviada (só depois de aceita) ou nenhuma. */
create or replace function interno.rede3_perfil_imagem(f interno.perfis, p_tipo text, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select case
    when p_tipo = 'avatar' then
      case when f.rede_avatar ~ '^a[0-9]{2}$' then jsonb_build_object('tipo', 'galeria', 'id', f.rede_avatar)
           when f.rede_avatar = 'envio' and f.rede_avatar_dados is not null and (f.rede_avatar_ok or f.id = p_quem)
             then jsonb_build_object('tipo', 'envio', 'dados', f.rede_avatar_dados, 'pendente', not f.rede_avatar_ok)
           else jsonb_build_object('tipo', null) end
    else
      case when f.rede_capa ~ '^c[0-9]{2}$' then jsonb_build_object('tipo', 'galeria', 'id', f.rede_capa)
           when f.rede_capa = 'envio' and f.rede_capa_dados is not null and (f.rede_capa_ok or f.id = p_quem)
             then jsonb_build_object('tipo', 'envio', 'dados', f.rede_capa_dados, 'pendente', not f.rede_capa_ok)
           else jsonb_build_object('tipo', null) end
  end
$$;

/** O que a pessoa pode editar no próprio perfil (e só ela vê isto). */
create or replace function interno.rede3_perfil_meu(p_id uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', f.id, 'codinome', f.rede_codinome, 'handle', f.rede_handle, 'bio', f.rede_bio, 'modo', f.rede_modo,
    'avatar', interno.rede3_perfil_imagem(f, 'avatar', f.id), 'capa', interno.rede3_perfil_imagem(f, 'capa', f.id),
    'estudando', f.rede_estudando,
    'selos_trilhas', coalesce((select jsonb_agg(substr(t, 8)) from unnest(f.rede_selos) t where t ~ '^trilha:'), '[]'::jsonb),
    'selos_mostrar', f.rede_selos_mostrar,
    'selos', interno.rede3_perfil_selos(f.id),
    'handle_troca_em', case when f.rede_handle is not null and f.rede_handle_em is not null and f.rede_handle_em > now() - interval '30 days'
                            then f.rede_handle_em + interval '30 days' end,
    'pedidos', (select count(*) from rede_seguindo s where s.segue = f.id and s.pendente),
    'fixado', f.rede_fixado)
  from perfis f where f.id = p_id
$$;

/** Esta pessoa é membro da Rede (18+, consentimento em vigor, codinome confirmado)? Senão, o motivo sai como erro. */
create or replace function interno.rede3_perfil_exige_membro(p_quem uuid) returns void language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not coalesce((select rede_18 from perfis where id = p_quem), false) then perform interno.erro('confirme_idade'); end if;
  if not interno.rede2_membro(p_quem) then perform interno.erro('consentimento'); end if;
  if not coalesce((select rede_codinome_ok and rede_codinome is not null from perfis where id = p_quem), false) then perform interno.erro('confirme_codinome'); end if;
end $$;

-- ── 3. O perfil de uma pessoa (superconjunto da fundação) ─────────────────────────────────────────────────────────────

/**
 * O alto da página de um perfil, pelo @handle. Perfil invisível, conta suspensa ou bloqueio (em qualquer lado) = não existe.
 * Traz o que a fundação trazia, mais avatar, capa, "estudando agora" (só se a pessoa ligou e atualizou nos últimos 14 dias) e
 * os selos (se a pessoa os mostra). Sem contagem de seguidores, de seguidos ou de apoios. Só codinome: nunca o nome do painel.
 */
create or replace function public.rede_perfil_de(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); f perfis; v_handle text := lower(btrim(coalesce(p_handle, ''), ' @'));
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  select * into f from perfis where rede_handle = v_handle;
  if not found or (f.id <> v and (f.rede_modo = 'invisivel' or f.rede_invisivel or f.suspenso or interno.rede_bloqueado(v, f.id))) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object(
    'id', f.id, 'codinome', f.rede_codinome, 'handle', f.rede_handle, 'bio', f.rede_bio, 'modo', f.rede_modo,
    'selos', case when f.rede_selos_mostrar or f.id = v then interno.rede3_perfil_selos(f.id) else '[]'::jsonb end,
    'equipe', interno.voluntario_e(f.id), 'meu', f.id = v,
    'sigo', exists (select 1 from rede_seguindo s where s.quem = v and s.segue = f.id and not s.pendente),
    'pendente', exists (select 1 from rede_seguindo s where s.quem = v and s.segue = f.id and s.pendente),
    'fixado', case when f.rede_fixado is not null then (select interno.rede_post_v2(o, v) from rede_posts o where o.id = f.rede_fixado and o.autor = f.id and interno.rede_ve(o, v)) end,
    'avatar', interno.rede3_perfil_imagem(f, 'avatar', v),
    'capa', interno.rede3_perfil_imagem(f, 'capa', v),
    'estudando', case when f.rede_estudando is not null and f.rede_estudando ->> 'aula' is not null and f.rede_estudando_em > now() - interval '14 days'
                      then f.rede_estudando - 'ligado' end,
    'pedidos', case when f.id = v then (select count(*) from rede_seguindo s where s.segue = f.id and s.pendente) end);
end $$;

/** O meu perfil, para editar. Funciona antes de ter @handle (é daqui que se escolhe o primeiro). */
create or replace function public.rede_perfil_meu() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return interno.rede3_perfil_meu(v);
end $$;

/**
 * Edita o perfil. Só vale o que vier em p (o resto fica como está): bio (até 160, sem CPF, telefone ou e-mail, e sem passar na
 * triagem de abuso), modo ('aberto', 'trancado', 'invisivel'), avatar ('a01' a 'a24', 'envio' para a foto já enviada, nulo para
 * as iniciais), capa ('c01' a 'c08', 'envio' ou nulo), estudando ({ligado, trilha, aula, titulo} ou nulo para desligar),
 * selos_trilhas (até 12 trilhas que a pessoa declara ter concluído) e selos_mostrar.
 * Trancar o perfil não desfaz quem já segue; abrir aprova os pedidos pendentes; ficar invisível apaga os pedidos pendentes.
 */
create or replace function public.rede_perfil_editar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); f perfis;
  v_bio text; v_modo text; v_av text; v_capa text; v_est jsonb; v_titulo text; v_selos text[]; v_slug text;
begin
  perform interno.aberta('comunidade');
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:perfil'); end if;
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('rede_perfil_editar', 60, 60);
  select * into f from perfis where id = v;

  if p ? 'bio' then
    v_bio := interno.txt(p ->> 'bio', 'bio', 0, 160);
    if v_bio ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}' or v_bio ~ '\(?\d{2}\)?\s?9\d{4}[-\s]?\d{4}' or v_bio ~* '[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z.]{2,}' then perform interno.erro('dado_pessoal'); end if;
    if v_bio <> '' and (interno.veredito(v_bio, false, v) ->> 'veredito') <> 'publicar' then perform interno.erro('invalido:bio'); end if;
    update perfis set rede_bio = v_bio where id = v;
  end if;

  if p ? 'modo' then
    v_modo := p ->> 'modo';
    if v_modo is null or v_modo not in ('aberto', 'trancado', 'invisivel') then perform interno.erro('invalido:modo'); end if;
    update perfis set rede_modo = v_modo, rede_invisivel = (v_modo = 'invisivel') where id = v;
    if v_modo = 'aberto' then update rede_seguindo set pendente = false where segue = v and pendente;
    elsif v_modo = 'invisivel' then delete from rede_seguindo where segue = v and pendente;
    end if;
  end if;

  if p ? 'avatar' then
    v_av := nullif(btrim(coalesce(p ->> 'avatar', '')), '');
    if v_av is not null and v_av !~ '^(a(0[1-9]|1[0-9]|2[0-4])|envio)$' then perform interno.erro('invalido:avatar'); end if;
    if v_av = 'envio' and f.rede_avatar_dados is null then perform interno.erro('invalido:avatar'); end if;
    update perfis set rede_avatar = v_av where id = v;
  end if;

  if p ? 'capa' then
    v_capa := nullif(btrim(coalesce(p ->> 'capa', '')), '');
    if v_capa is not null and v_capa !~ '^(c0[1-8]|envio)$' then perform interno.erro('invalido:capa'); end if;
    if v_capa = 'envio' and f.rede_capa_dados is null then perform interno.erro('invalido:capa'); end if;
    update perfis set rede_capa = v_capa where id = v;
  end if;

  if p ? 'estudando' then
    v_est := p -> 'estudando';
    if v_est is null or jsonb_typeof(v_est) = 'null' or v_est = 'false'::jsonb then
      update perfis set rede_estudando = null, rede_estudando_em = null where id = v;
    elsif jsonb_typeof(v_est) = 'object' then
      v_titulo := interno.txt(v_est ->> 'titulo', 'estudando', 0, 120);
      if v_titulo ~* '(https?://|www\.|@)' then perform interno.erro('invalido:estudando'); end if;
      if v_titulo <> '' and (interno.veredito(v_titulo, false, v) ->> 'veredito') <> 'publicar' then perform interno.erro('invalido:estudando'); end if;
      if coalesce(v_est ->> 'trilha', '') <> '' and (v_est ->> 'trilha') !~ '^[a-z0-9-]{2,80}$' then perform interno.erro('invalido:estudando'); end if;
      if coalesce(v_est ->> 'aula', '') <> '' and (v_est ->> 'aula') !~ '^/trilhas/[a-z0-9-]{2,80}(/[a-z0-9-]{1,100}){0,2}$' then perform interno.erro('invalido:estudando'); end if;
      update perfis set
        rede_estudando = jsonb_strip_nulls(jsonb_build_object('ligado', true, 'trilha', nullif(v_est ->> 'trilha', ''), 'aula', nullif(v_est ->> 'aula', ''), 'titulo', nullif(v_titulo, ''))),
        rede_estudando_em = now()
      where id = v;
    else
      perform interno.erro('invalido:estudando');
    end if;
  end if;

  if p ? 'selos_trilhas' then
    if jsonb_typeof(p -> 'selos_trilhas') is distinct from 'array' or jsonb_array_length(p -> 'selos_trilhas') > 12 then perform interno.erro('invalido:selos'); end if;
    v_selos := '{}';
    for v_slug in select jsonb_array_elements_text(p -> 'selos_trilhas') loop
      if v_slug !~ '^[a-z0-9-]{2,80}$' then perform interno.erro('invalido:selos'); end if;
      -- O servidor não conhece o catálogo de trilhas: o texto do selo passa ao menos pela triagem de abuso (é público).
      if (interno.veredito(replace(v_slug, '-', ' '), false, v) ->> 'veredito') <> 'publicar' then perform interno.erro('invalido:selos'); end if;
      if not ('trilha:' || v_slug = any (v_selos)) then v_selos := v_selos || ('trilha:' || v_slug); end if;
    end loop;
    update perfis set rede_selos = v_selos where id = v;
  end if;

  if p ? 'selos_mostrar' then
    if jsonb_typeof(p -> 'selos_mostrar') is distinct from 'boolean' then perform interno.erro('invalido:selos'); end if;
    update perfis set rede_selos_mostrar = (p ->> 'selos_mostrar')::boolean where id = v;
  end if;

  return interno.rede3_perfil_meu(v);
end $$;

-- ── 4. @handle ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Escolhe ou troca o @handle. 3 a 20 caracteres [a-z0-9_], único, sem imitar o instituto ou a equipe. A primeira escolha é livre;
 * depois, uma troca a cada 30 dias (para o nome não virar disfarce). Erros: invalido:handle, handle_reservado, handle_usado, handle_recente.
 */
create or replace function public.rede_perfil_handle_definir(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis; h text := lower(btrim(coalesce(p_handle, ''), ' @'));
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('rede_perfil_handle', 20, 1440);
  if h !~ '^[a-z0-9_]{3,20}$' then perform interno.erro('invalido:handle'); end if;
  select * into f from perfis where id = v;
  if f.rede_handle = h then return jsonb_build_object('handle', h); end if;
  if h ~ '(instituto|lucia|equipe|coordena|modera|admin|suporte|oficial)' and not interno.voluntario_e(v) then perform interno.erro('handle_reservado'); end if;
  if exists (select 1 from perfis o where o.rede_handle = h and o.id <> v) then perform interno.erro('handle_usado'); end if;
  if f.rede_handle is not null and f.rede_handle_em is not null and f.rede_handle_em > now() - interval '30 days' then perform interno.erro('handle_recente'); end if;
  update perfis set rede_handle = h, rede_handle_em = now() where id = v;
  return jsonb_build_object('handle', h);
exception when unique_violation then perform interno.erro('handle_usado');
end $$;

-- ── 5. Post fixado ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Fixa um post MEU no alto do perfil (nulo desafixa). Só post publicado, que não esteja retido, oculto ou apagado. */
create or replace function public.rede_perfil_fixar(p_post uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts;
begin
  perform interno.rede3_perfil_exige_membro(v);
  if p_post is null then
    update perfis set rede_fixado = null where id = v;
    return jsonb_build_object('fixado', null);
  end if;
  select * into x from rede_posts where id = p_post and autor = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if x.oculto or x.retido or x.apagado_em is not null then perform interno.erro('sem_permissao'); end if;
  update perfis set rede_fixado = p_post where id = v;
  return jsonb_build_object('fixado', interno.rede_post_v2(x, v));
end $$;

-- ── 6. Seguir, perfil trancado e pedidos ──────────────────────────────────────────────────────────────────────────────────

/**
 * Seguir (ou deixar de seguir) pelo @handle. Perfil aberto: segue na hora. Perfil trancado: vira pedido pendente, que a pessoa
 * aprova ou recusa (rede_perfil_decidir); o que é só "para quem me segue" só chega a quem foi aprovado. Perfil invisível, bloqueio
 * e conta suspensa: não existe. Devolve {sigo, pendente}; nunca revela quantas pessoas seguem.
 */
create or replace function public.rede_perfil_seguir(p_handle text, p_sim boolean default true) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis; v_linhas integer := 0; v_pendente boolean;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into f from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if not found or f.id = v or f.rede_modo = 'invisivel' or f.rede_invisivel or f.suspenso or interno.rede_bloqueado(v, f.id) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_sim, true) then
    perform interno.limite('rede_seguir', 200, 1440);
    v_pendente := f.rede_modo = 'trancado';
    insert into rede_seguindo (quem, segue, pendente) values (v, f.id, v_pendente) on conflict do nothing;
    get diagnostics v_linhas = row_count;
    if v_linhas > 0 and v_pendente then
      perform interno.avisar_em(f.id, 'Uma pessoa pediu para seguir você na Rede Lúcia. Veja os pedidos em Editar perfil.', 'rede');
    end if;
  else
    delete from rede_seguindo where quem = v and segue = f.id;
  end if;
  return jsonb_build_object(
    'sigo', exists (select 1 from rede_seguindo s where s.quem = v and s.segue = f.id and not s.pendente),
    'pendente', exists (select 1 from rede_seguindo s where s.quem = v and s.segue = f.id and s.pendente));
end $$;

/** Quem pediu para me seguir (perfil trancado): só o codinome e o @handle. */
create or replace function public.rede_perfil_pedidos() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', f.id, 'codinome', f.rede_codinome,
                                        'handle', case when not (f.rede_modo = 'invisivel' or f.rede_invisivel) then f.rede_handle end,
                                        'quando', s.criado_em) order by s.criado_em)
    from (select * from rede_seguindo where segue = v and pendente order by criado_em limit 50) s
    join perfis f on f.id = s.quem
    where not f.suspenso and not interno.rede_bloqueado(v, f.id)), '[]'::jsonb);
end $$;

/** Aprova ou recusa um pedido para me seguir. Recusar apaga o pedido, sem avisar a pessoa. */
create or replace function public.rede_perfil_decidir(p_quem uuid, p_aceitar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_linhas integer;
begin
  perform interno.rede3_perfil_exige_membro(v);
  if p_quem is null then perform interno.erro('invalido:pedido'); end if;
  if coalesce(p_aceitar, false) then
    update rede_seguindo set pendente = false where quem = p_quem and segue = v and pendente;
  else
    delete from rede_seguindo where quem = p_quem and segue = v and pendente;
  end if;
  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true, 'pedidos', (select count(*) from rede_seguindo where segue = v and pendente));
end $$;

/**
 * Quem pediu para seguir um perfil trancado (pendente) NÃO é seguidor: a regra de leitura da Rede de hoje (um argumento) tratava
 * qualquer linha de rede_seguindo como seguidor e entregaria o post "só para seguidores" a quem só pediu. Mesma regra do
 * install.sql, mais `not s.pendente`.
 */
create or replace function interno.rede_ve(p interno.rede_posts) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select (not p.oculto or p.autor = auth.uid())
    and not interno.rede_bloqueado(auth.uid(), p.autor)
    and interno.rede_espaco_entra(p.comunidade)
    and (p.alcance = 'publico' or p.autor = auth.uid()
         or (p.alcance = 'seguidores' and exists (select 1 from rede_seguindo s where s.quem = auth.uid() and s.segue = p.autor and not s.pendente))
         or (p.alcance = 'equipe' and interno.voluntario()))
$$;

/**
 * Corrige a Rede de hoje: rede_seguir ignorava o perfil trancado (quem pedia entrava direto e passava a ler o que é só para
 * seguidores) e o invisível. Mesma assinatura e mesmo retorno; só acrescenta as duas conferências.
 */
create or replace function public.rede_seguir(p_usuario uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis;
begin
  select * into f from perfis where id = p_usuario;
  if p_usuario is null or p_usuario = v or not found or interno.rede_bloqueado(v, p_usuario) then perform interno.erro('invalido:usuario'); end if;
  if coalesce(p_sim, true) then
    if f.rede_modo = 'invisivel' or f.rede_invisivel or f.suspenso then perform interno.erro('invalido:usuario'); end if;
    perform interno.limite('rede_seguir', 200, 1440);
    insert into rede_seguindo (quem, segue, pendente) values (v, p_usuario, f.rede_modo = 'trancado') on conflict do nothing;
  else delete from rede_seguindo where quem = v and segue = p_usuario; end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── 7. Imagem enviada (avatar e capa) ────────────────────────────────────────────────────────────────────────────────────

/**
 * Envia a foto de perfil ou a capa. p_tipo: 'avatar' ou 'capa'; p_dados: data URL WebP já reencodada no navegador. O banco confere
 * os bytes (rede3_perfil_webp_ok): sem EXIF, XMP, perfil de cor nem animação. A imagem só aparece para os outros depois que a
 * mediação a aceita; a equipe que cuida da Rede tem a imagem aceita na hora. Dez envios por dia.
 */
create or replace function public.rede_perfil_imagem_enviar(p_tipo text, p_dados text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_ok boolean;
begin
  perform interno.rede3_perfil_exige_membro(v);
  if p_tipo not in ('avatar', 'capa') then perform interno.erro('invalido:tipo'); end if;
  perform interno.limite('rede_perfil_imagem', 10, 1440);
  if not interno.rede3_perfil_webp_ok(p_dados, case when p_tipo = 'avatar' then 40000 else 90000 end) then perform interno.erro('invalido:imagem'); end if;
  v_ok := interno.cuida();
  if p_tipo = 'avatar' then
    update perfis set rede_avatar = 'envio', rede_avatar_dados = p_dados, rede_avatar_ok = v_ok where id = v;
  else
    update perfis set rede_capa = 'envio', rede_capa_dados = p_dados, rede_capa_ok = v_ok where id = v;
  end if;
  return interno.rede3_perfil_meu(v);
end $$;

/** Tira a imagem enviada (some do banco) e volta para as iniciais (avatar) ou sem capa. */
create or replace function public.rede_perfil_imagem_remover(p_tipo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if p_tipo not in ('avatar', 'capa') then perform interno.erro('invalido:tipo'); end if;
  if p_tipo = 'avatar' then
    update perfis set rede_avatar = case when rede_avatar = 'envio' then null else rede_avatar end, rede_avatar_dados = null, rede_avatar_ok = false where id = v;
  else
    update perfis set rede_capa = case when rede_capa = 'envio' then null else rede_capa end, rede_capa_dados = null, rede_capa_ok = false where id = v;
  end if;
  return interno.rede3_perfil_meu(v);
end $$;

/** Imagens que esperam a mediação (avatar e capa enviados e ainda não aceitos). Só quem cuida da Rede. */
create or replace function public.rede_perfil_imagens_fila() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  return coalesce((
    select jsonb_agg(x.j order by x.t) from (
      select f.id as i, jsonb_build_object('usuario', f.id, 'codinome', f.rede_codinome, 'tipo', 'avatar', 'dados', f.rede_avatar_dados) as j, f.id::text || 'a' as t
        from perfis f where f.rede_avatar = 'envio' and f.rede_avatar_dados is not null and not f.rede_avatar_ok
      union all
      select f.id, jsonb_build_object('usuario', f.id, 'codinome', f.rede_codinome, 'tipo', 'capa', 'dados', f.rede_capa_dados), f.id::text || 'c'
        from perfis f where f.rede_capa = 'envio' and f.rede_capa_dados is not null and not f.rede_capa_ok
      limit 30) x), '[]'::jsonb);
end $$;

/** A mediação aceita ou recusa uma imagem. Recusar apaga a imagem e avisa a pessoa (sem dizer quem decidiu). Fica no registro. */
create or replace function public.rede_perfil_imagem_decidir(p_usuario uuid, p_tipo text, p_aceitar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  if p_tipo not in ('avatar', 'capa') or p_usuario is null then perform interno.erro('invalido:tipo'); end if;
  if not exists (select 1 from perfis where id = p_usuario and case p_tipo when 'avatar' then rede_avatar = 'envio' else rede_capa = 'envio' end) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_aceitar, false) then
    if p_tipo = 'avatar' then update perfis set rede_avatar_ok = true where id = p_usuario; else update perfis set rede_capa_ok = true where id = p_usuario; end if;
  else
    if p_tipo = 'avatar' then update perfis set rede_avatar = null, rede_avatar_dados = null, rede_avatar_ok = false where id = p_usuario;
    else update perfis set rede_capa = null, rede_capa_dados = null, rede_capa_ok = false where id = p_usuario; end if;
    perform interno.avisar_em(p_usuario, case p_tipo when 'avatar' then 'Sua foto de perfil não foi aceita na Rede Lúcia. Escolha um rosto da galeria ou envie outra imagem.'
                                                      else 'Sua capa não foi aceita na Rede Lúcia. Escolha um padrão da galeria ou envie outra imagem.' end, 'rede');
  end if;
  perform interno.registrar('rede_imagem_decidir', p_usuario::text, jsonb_build_object('tipo', p_tipo, 'aceita', coalesce(p_aceitar, false)));
  return jsonb_build_object('ok', true);
end $$;

-- ── 8. Rosto nos cartões (em lote, sem pesar) ──────────────────────────────────────────────────────────────────────────

/**
 * Os rostos de várias pessoas de uma vez (até 60), para os cartões de post: {id: 'a07'} para galeria, {id: 'envio'} para foto
 * enviada e aceita (a imagem vem por rede_perfil_imagem, só para quem tem conta). Perfil invisível, bloqueio e quem não escolheu
 * rosto ficam de fora (o cartão usa as iniciais). Visitante só recebe rosto de galeria.
 */
create or replace function public.rede_perfil_avatares(p_usuarios uuid[]) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_object_agg(f.id::text, to_jsonb(f.rede_avatar)), '{}'::jsonb)
  from perfis f
  where f.id = any ((coalesce(p_usuarios, '{}'::uuid[]))[1:60])
    and not f.suspenso
    and (f.id = auth.uid() or not (f.rede_modo = 'invisivel' or f.rede_invisivel))
    and not interno.rede_bloqueado(auth.uid(), f.id)
    and (f.rede_avatar ~ '^a[0-9]{2}$'
         or (f.rede_avatar = 'envio' and f.rede_avatar_dados is not null and auth.uid() is not null and (f.rede_avatar_ok or f.id = auth.uid())))
$$;

/** A imagem enviada (aceita) de uma pessoa, em data URL: só para quem tem conta, e só se a pessoa não estiver invisível nem bloqueada. */
create or replace function public.rede_perfil_imagem(p_usuario uuid, p_tipo text default 'avatar') returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); f perfis;
begin
  if v is null or p_tipo not in ('avatar', 'capa') then return null; end if;
  select * into f from perfis where id = p_usuario;
  if not found or f.suspenso or (f.id <> v and (f.rede_modo = 'invisivel' or f.rede_invisivel or interno.rede_bloqueado(v, f.id))) then return null; end if;
  if p_tipo = 'avatar' then return case when f.rede_avatar = 'envio' and (f.rede_avatar_ok or f.id = v) then f.rede_avatar_dados end;
  else return case when f.rede_capa = 'envio' and (f.rede_capa_ok or f.id = v) then f.rede_capa_dados end; end if;
end $$;

-- ── 9. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Nenhuma função interna é chamável de fora. As públicas: o rosto em lote vale também para visitante; o resto, só conta.
revoke all on function interno.rede3_perfil_webp_ok(text, integer), interno.rede3_perfil_selos(uuid), interno.rede3_perfil_imagem(interno.perfis, text, uuid),
  interno.rede3_perfil_meu(uuid), interno.rede3_perfil_exige_membro(uuid) from public;
revoke all on function public.rede_perfil_meu(), public.rede_perfil_editar(jsonb), public.rede_perfil_handle_definir(text), public.rede_perfil_fixar(uuid),
  public.rede_perfil_seguir(text, boolean), public.rede_perfil_pedidos(), public.rede_perfil_decidir(uuid, boolean), public.rede_perfil_imagem_enviar(text, text),
  public.rede_perfil_imagem_remover(text), public.rede_perfil_imagens_fila(), public.rede_perfil_imagem_decidir(uuid, text, boolean),
  public.rede_perfil_avatares(uuid[]), public.rede_perfil_imagem(uuid, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede3_perfil_webp_ok(text, integer), interno.rede3_perfil_selos(uuid), interno.rede3_perfil_imagem(interno.perfis, text, uuid),
      interno.rede3_perfil_meu(uuid), interno.rede3_perfil_exige_membro(uuid) from anon, authenticated;
    revoke all on function public.rede_perfil_meu(), public.rede_perfil_editar(jsonb), public.rede_perfil_handle_definir(text), public.rede_perfil_fixar(uuid),
      public.rede_perfil_seguir(text, boolean), public.rede_perfil_pedidos(), public.rede_perfil_decidir(uuid, boolean), public.rede_perfil_imagem_enviar(text, text),
      public.rede_perfil_imagem_remover(text), public.rede_perfil_imagens_fila(), public.rede_perfil_imagem_decidir(uuid, text, boolean),
      public.rede_perfil_imagem(uuid, text) from anon;
    grant execute on function public.rede_perfil_meu(), public.rede_perfil_editar(jsonb), public.rede_perfil_handle_definir(text), public.rede_perfil_fixar(uuid),
      public.rede_perfil_seguir(text, boolean), public.rede_perfil_pedidos(), public.rede_perfil_decidir(uuid, boolean), public.rede_perfil_imagem_enviar(text, text),
      public.rede_perfil_imagem_remover(text), public.rede_perfil_imagens_fila(), public.rede_perfil_imagem_decidir(uuid, text, boolean),
      public.rede_perfil_imagem(uuid, text) to authenticated, service_role;
    grant execute on function public.rede_perfil_avatares(uuid[]) to anon, authenticated, service_role;
    -- rede_perfil_de e rede_seguir mantêm as permissões que já tinham (create or replace não as muda).
  end if;
end $$;
