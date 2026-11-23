-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · lote "perto": o canal de aviso da organização (item 22). Atrás do interruptor "alumia-p4-perto" (só pelo nome).
--
-- Os outros itens do lote não têm banco: a localização (2), o pedido de ajuda (7) e a volta para casa (8) vão só DENTRO do cifrado
-- do chat (o servidor só entrega; nenhuma posição em claro, nunca) e o cronômetro fica no aparelho; o palco (23), o estudo em grupo
-- (24) e a sala de espera com senha (25) vão só dentro do canal cifrado da sala de voz.
--
-- Item 22. O "sino" da organização (interno.rede_org_sinos, onda F4) já avisava quem ligou a cada post novo da organização. Agora:
--   1. Só os avisos           quem ligou o sino escolhe "tudo" (como antes) ou "só os avisos" (os posts do tipo "aviso", o canal de
--                             aviso da organização): a coluna rede_org_sinos.so_avisos, desligada por padrão (nada muda para quem
--                             já tinha o sino ligado).
--   2. O número a partir de 3 quem gere a organização vê quantas pessoas ligaram o sino, só a partir de 3 (abaixo disso, "menos de
--                             3"). Ninguém vê QUEM ligou: nenhuma função devolve a lista, nem para a organização, nem para a coordenação.
--   3. O aviso                interno.alumia_org_postou (redefinida, a definição inteira do banco montado) respeita a escolha e diz
--                             "publicou um aviso" quando é aviso. Sem trecho do texto, como antes.
-- Roda depois de 20261126-p5-fim.sql (banco na versão 17); quem junta põe antes do 20261127-p4-fim.sql. Não mexe na versão nem na
-- lista da porta. Função existente redefinida: interno.alumia_org_postou(). Pode rodar mais de uma vez. Nada daqui lê ou guarda
-- endereço de rede.
-- Lei: LGPD art. 6º, III (necessidade: o número, nunca a lista) e art. 11 (a inscrição no canal de uma organização política pode
-- revelar opinião política: ninguém vê quem se inscreveu).

-- ── 0. O interruptor ──────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-perto', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

/** Ligado só com o interruptor ligado no painel (a variável de montagem mostra a tela; quem libera é o banco). */
create or replace function interno.rede_p4_perto_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-p4-perto'), false);
end $$;

-- ── 1. A escolha "só os avisos" ───────────────────────────────────────────────────────────────────────────────────────────────
alter table interno.rede_org_sinos add column if not exists so_avisos boolean not null default false;

/**
 * O canal de aviso de uma organização, para mim: "nada" (sino desligado), "tudo" (todo post novo) ou "avisos" (só os avisos).
 * Ligar ou trocar exige o interruptor; desligar sempre funciona (é o mesmo que desligar o sino).
 */
create or replace function public.rede_p4_canal_escolher(p_handle text, p_modo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_org uuid;
begin
  perform interno.rede3_perfil_exige_membro(v);
  if p_modo is null or p_modo not in ('nada', 'tudo', 'avisos') then perform interno.erro('invalido:modo'); end if;
  v_org := interno.alumia_org_de(p_handle);
  if v_org is null or interno.rede_bloqueado(v, v_org) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_org_sino', 60, 60);
  if p_modo = 'nada' then
    delete from rede_org_sinos where org = v_org and usuario = v;
  else
    if not interno.rede_p4_perto_ligado() then perform interno.erro('desligado'); end if;
    insert into rede_org_sinos (org, usuario, so_avisos) values (v_org, v, p_modo = 'avisos')
      on conflict (org, usuario) do update set so_avisos = excluded.so_avisos;
  end if;
  return public.rede_p4_canal_meu(p_handle);
end $$;

/** A minha escolha no canal de uma organização (só a minha; nunca a de outra pessoa). */
create or replace function public.rede_p4_canal_meu(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_org uuid; v_avisos boolean;
begin
  v_org := interno.alumia_org_de(p_handle);
  if v_org is null or interno.rede_bloqueado(v, v_org) then perform interno.erro('nao_encontrado'); end if;
  select so_avisos into v_avisos from rede_org_sinos where org = v_org and usuario = v;
  return jsonb_build_object('modo', case when v_avisos is null then 'nada' when v_avisos then 'avisos' else 'tudo' end);
end $$;

/**
 * Quantas pessoas ligaram o sino da organização: só para quem gere a organização, e só a partir de 3 (abaixo disso, null e
 * "menos de 3"). Nunca quem são. Contam só membros da Rede ativos (a conta suspensa não conta).
 */
create or replace function public.rede_p4_canal_contagem(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_org uuid; v_n integer; v_avisos integer;
begin
  v_org := interno.alumia_org_de(p_handle);
  if v_org is null then perform interno.erro('nao_encontrado'); end if;
  if not interno.alumia_org_gere(v, v_org) then perform interno.erro('sem_permissao'); end if;
  if not interno.rede_p4_perto_ligado() then perform interno.erro('desligado'); end if;
  perform interno.limite('rede_p4_canal_contagem', 60, 60);
  select count(*), count(*) filter (where s.so_avisos) into v_n, v_avisos
    from rede_org_sinos s join perfis f on f.id = s.usuario
   where s.org = v_org and not f.suspenso;
  -- Os dois números só a partir de 3: "só os avisos" com 1 ou 2 pessoas apontaria quem são, se o total andasse junto.
  return jsonb_build_object(
    'inscritas', case when v_n >= 3 then v_n end,
    'so_avisos', case when v_avisos >= 3 and v_n - v_avisos >= 3 then v_avisos end,
    'minimo', 3);
end $$;

-- ── 2. O aviso respeita a escolha (redefinida: a definição inteira, tirada do banco montado) ──────────────────────────────────
/** Post novo (não resposta) de uma organização: avisa quem ligou o sino e pode ver o post (sem trecho do texto). Quem escolheu
 *  "só os avisos" (Prompt 4, item 22) recebe só os posts do tipo "aviso". */
create or replace function interno.alumia_org_postou() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare s record; v_nome text; v_aviso boolean;
begin
  if new.resposta_a is not null or new.autor is null or not exists (select 1 from rede_orgs where perfil = new.autor) then return new; end if;
  v_nome := interno.rede_nome(new.autor);
  v_aviso := new.tipo is not distinct from 'aviso';
  for s in select usuario, so_avisos from rede_org_sinos where org = new.autor limit 5000 loop
    if (v_aviso or not s.so_avisos)
       and interno.rede2_membro(s.usuario) and not interno.rede_bloqueado(s.usuario, new.autor) and interno.rede2_pode_ver(new, s.usuario)
       and interno.rede3_aviso_pref(s.usuario, 'org_postou', 'site') then
      perform interno.avisar_em(s.usuario, format(case when v_aviso then '“%s” publicou um aviso na Alumia.' else '“%s” publicou na Alumia.' end, v_nome), 'rede');
    end if;
  end loop;
  return new;
exception when others then
  return new;
end $$;
revoke all on function interno.alumia_org_postou() from public;

-- ── 3. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_p4_perto_ligado() from public;
revoke all on function public.rede_p4_canal_escolher(text, text), public.rede_p4_canal_meu(text), public.rede_p4_canal_contagem(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_p4_perto_ligado(), interno.alumia_org_postou() from anon, authenticated;
    revoke all on function public.rede_p4_canal_escolher(text, text), public.rede_p4_canal_meu(text), public.rede_p4_canal_contagem(text) from anon;
    grant execute on function public.rede_p4_canal_escolher(text, text), public.rede_p4_canal_meu(text), public.rede_p4_canal_contagem(text) to authenticated;
  end if;
end $$;

select interno.alumia_trancar();
