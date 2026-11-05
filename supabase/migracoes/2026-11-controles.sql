-- ───────────────────────── Controles do coordenador, novembro de 2026 (Etapa 8, pacote controles) ─────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Ainda NÃO está no install.sql (a integração junta).
-- Texto do pacote: docs/PAINEL-CONTROLES.md.
--
-- Os sete controles "só falta tela" já tinham função no banco (canais_salvar, equipe_sala_salvar, radio_*, rede_moderador_definir,
-- rede_com_nucleo_abrir, arquivo_bloquear, curriculo_publicar_agora). Aqui só entram as funções de LEITURA que faltavam para a tela
-- mostrar o que já está valendo, "publicar agora" para quem não decide o currículo e o resumo do Centro de controle.
-- Nada daqui guarda dado novo de pessoa: moderadores são pessoas da própria equipe (nome já visível a quem cuida) e o resto é contagem.
--
-- Nenhuma tabela no esquema public; acesso só pelas funções public.* (security definer, search_path = interno, pg_temp).
-- Nenhuma função do esquema interno é liberada a anon/authenticated por este arquivo.

-- Quem modera cada comunidade da Rede (a mediação nomeia; pôr e tirar usam rede_moderador_definir, que já existe).
create or replace function public.rede_moderadores_listar() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'comunidades', (select coalesce(jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome, 'categoria', c.categoria, 'tipo', c.tipo) order by c.categoria, c.nome), '[]'::jsonb) from rede_comunidades c),
    'moderadores', (select coalesce(jsonb_agg(jsonb_build_object('comunidade', m.comunidade, 'usuario', m.usuario, 'nome', interno.nome_visto(f.nome)) order by m.comunidade, f.nome), '[]'::jsonb)
                    from rede_moderadores m join perfis f on f.id = m.usuario));
end $$;
revoke all on function public.rede_moderadores_listar() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.rede_moderadores_listar() to authenticated; end if;
end $$;

-- Núcleos de estudo ativos e se já têm o espaço fechado da Rede (só a contagem de gente; nunca quem é).
create or replace function public.rede_nucleos_fechados_listar() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'nucleo', n.id, 'nome', n.nome, 'cidade', n.cidade, 'uf', n.uf,
      'acompanha', coalesce((select interno.nome_visto(p.nome) from perfis p where p.id = n.acompanha), ''),
      'aberto', r.id is not null,
      'rede', r.id,
      'pessoas', case when r.id is null then 0 else (select count(*) from rede_nucleo_membros m where m.nucleo = r.id) end) order by n.uf, n.cidade, n.nome)
    from nucleos n left join rede_nucleos r on r.nucleo = n.id where n.ativo), '[]'::jsonb);
end $$;
revoke all on function public.rede_nucleos_fechados_listar() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.rede_nucleos_fechados_listar() to authenticated; end if;
end $$;

-- Arquivos bloqueados: a lista (impressão digital, motivo, data) para a curadoria ver e, se foi engano, desfazer.
-- A função arquivos_bloqueados() que já existe é só da rotina de publicação (chave de serviço).
create or replace function public.arquivos_bloqueados_ver() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('sha256', b.sha256, 'motivo', b.motivo, 'criado_em', b.criado_em) order by b.criado_em desc), '[]'::jsonb)
          from (select * from arquivos_bloqueados order by criado_em desc limit 300) b);
end $$;

create or replace function public.arquivo_desbloquear(p_sha256 text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_sha256, '') !~ '^[a-f0-9]{64}$' then perform interno.erro('invalido:sha256'); end if;
  delete from arquivos_bloqueados where sha256 = p_sha256;
  if found then perform interno.registrar('arquivo_desbloqueado', p_sha256); end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.arquivos_bloqueados_ver() from public;
revoke all on function public.arquivo_desbloquear(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.arquivos_bloqueados_ver() to authenticated;
    grant execute on function public.arquivo_desbloquear(text) to authenticated;
  end if;
end $$;

-- "Publicar agora" para quem cuida do site (coordenação, vice, curadoria, desenvolvimento, quem decide o currículo).
-- Divide o limite de 6 por hora com curriculo_publicar_agora. A rota /api/painel/publicar-agora chama esta e, se o banco
-- ainda não a tiver, cai na antiga.
create or replace function public.publicar_agora_pedir() returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.coord() or interno.curador() or interno.tem('desenvolvimento') or interno.curriculo_decide()) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('publicar_agora', 6, 60);
  perform interno.registrar('publicar_agora', '', '{}'::jsonb);
  return true;
end $$;
revoke all on function public.publicar_agora_pedir() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.publicar_agora_pedir() to authenticated; end if;
end $$;

-- O Centro de controle: uma olhada em tudo (só contagens e liga/desliga; nenhum endereço, nenhuma pessoa).
create or replace function public.controles_resumo() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  c jsonb := coalesce((select valor from configuracoes where chave = 'canais'), '{}'::jsonb);
  r jsonb := coalesce((select valor from configuracoes where chave = 'radio'), '{}'::jsonb);
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'whatsapp', coalesce(c ->> 'whatsapp', '') <> '',
    'telegram', coalesce(c ->> 'telegram', '') <> '',
    'sala', coalesce((select valor ->> 'sala' from configuracoes where chave = 'equipe'), '') <> '',
    'radio_no_ar', coalesce((r ->> 'no_ar')::boolean, false),
    'radio_canais', (select count(*) from radio_canais),
    'radio_faixas', (select count(*) from radio_faixas),
    'moderadores', (select count(*) from rede_moderadores),
    'nucleos_fechados', (select count(*) from rede_nucleos),
    'arquivos_bloqueados', (select count(*) from arquivos_bloqueados));
end $$;
revoke all on function public.controles_resumo() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.controles_resumo() to authenticated; end if;
end $$;
