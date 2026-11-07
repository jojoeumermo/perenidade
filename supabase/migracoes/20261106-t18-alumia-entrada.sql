-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- T18 (Alumia): a primeira entrada fica curta. O essencial continua obrigatório e gravado como antes, em rede_aderir:
-- consentimento destacado para dado sensível (LGPD, art. 11, I, com a versão das regras), a declaração de 18 anos ou mais
-- (LGPD, art. 14; ECA Digital, Lei 15.211/2025) e o codinome. As 3 lutas + 3 trilhas e o guia de segurança passam a ser
-- OPCIONAIS: a pessoa pode deixar para depois (Explorar) e entra na Alumia na hora.
--
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 2026-11-rede-descoberta.sql.
-- O mesmo bloco está no fim do install.sql.

alter table interno.rede_desc_entrada add column if not exists escolhas_adiadas_em timestamptz;

/**
 * Em que passo a pessoa está: entrar (sem conta), regras (consentimento, 18+ e regras: tudo isso grava em rede_aderir),
 * codinome, escolhas (opcional: some quando a pessoa escolhe ou deixa para depois), guia (opcional) ou pronto.
 */
create or replace function public.rede_desc_entrada_estado() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); f perfis; e rede_desc_entrada; v_passo text; v_regras integer := coalesce((select max(versao) from rede_regras), 1);
begin
  if v is null then return jsonb_build_object('passo', 'entrar', 'regras_versao', v_regras); end if;
  select * into f from perfis where id = v;
  if not found then return jsonb_build_object('passo', 'entrar', 'regras_versao', v_regras); end if;
  select * into e from rede_desc_entrada where usuario = v;
  v_passo := case
    when f.suspenso then 'suspensa'
    when not interno.rede2_membro(v) then 'regras'
    when not (f.rede_codinome_ok and f.rede_codinome is not null) then 'codinome'
    when e.escolhas_adiadas_em is not null then 'pronto'
    when e.escolhas_em is null then 'escolhas'
    when e.guia_em is null and not coalesce(e.guia_pulado, false) then 'guia'
    else 'pronto' end;
  return jsonb_build_object(
    'passo', v_passo, 'regras_versao', v_regras, 'codinome', f.rede_codinome,
    'escolhas', e.escolhas_em is not null, 'guia', e.guia_em is not null or coalesce(e.guia_pulado, false),
    'adiou', e.escolhas_adiadas_em is not null,
    'aparece', coalesce(e.aparece, false),
    'lutas', (select coalesce(jsonb_agg(i.chave order by i.chave), '[]'::jsonb) from rede_desc_interesses i where i.usuario = v and i.tipo = 'luta'),
    'trilhas', (select coalesce(jsonb_agg(i.chave order by i.chave), '[]'::jsonb) from rede_desc_interesses i where i.usuario = v and i.tipo = 'trilha'));
end $$;

/**
 * "Agora não": as escolhas (lutas e trilhas) e o guia ficam para depois. Só quem já entrou na Alumia (consentimento, 18+ e
 * codinome continuam obrigatórios). Não apaga escolha nenhuma; a pessoa escolhe quando quiser em Explorar.
 */
create or replace function public.rede_desc_entrada_adiar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  insert into rede_desc_entrada (usuario, escolhas_adiadas_em, guia_pulado) values (v, now(), true)
    on conflict (usuario) do update set escolhas_adiadas_em = coalesce(rede_desc_entrada.escolhas_adiadas_em, now()),
                                        guia_pulado = rede_desc_entrada.guia_em is null or coalesce(rede_desc_entrada.guia_pulado, false);
  return public.rede_desc_entrada_estado();
end $$;

revoke all on function public.rede_desc_entrada_adiar() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_desc_entrada_adiar() from anon;
    grant execute on function public.rede_desc_entrada_estado() to anon, authenticated, service_role;
    grant execute on function public.rede_desc_entrada_adiar() to authenticated, service_role;
  end if;
end $$;
