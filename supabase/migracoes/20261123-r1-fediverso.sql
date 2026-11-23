-- ───────────────────────── Alumia no Fediverso: o que a prova com servidores de verdade mostrou (r1) ─────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Fica no fim do install.sql. Pode rodar mais de uma vez: só redefine funções (inteiras, com o corpo que o banco montado tinha
-- antes dela mais o que vem aqui) e termina passando a porta em tudo. Nenhuma tabela nova, nenhum dado apagado (a lista de bloqueios passa a aceitar o IPv6). Teste:
-- scripts/testar-fediverso-banco.mjs (seção "r1").
--
-- Lei e regra da casa atendidas: LGPD art. 18, VI (eliminação: quem desliga a federação some também do cache das instâncias que
-- a conheciam) e a mediação (o bloqueio de servidor vale para o servidor de verdade, não para um jeito de escrever o nome dele).
--
-- O que entra, e só isto:
--   1. interno.rede_fed_dominio tira o ponto do fim do nome ("bloqueada.org." é bloqueada.org para a rede). O site já recusa
--      endereço de nome disfarçado (lib/rede/fediverso/enderecos.ts, hostCanonico); aqui é a segunda tranca. Servidor num
--      endereço IPv6 sai inteiro, entre colchetes ("[2001:db8::1]"), e não cortado no primeiro dois-pontos; interno.rede_fed_bloqueado
--      lê o nome do mesmo jeito.
--   2. public.rede_fed_bloquear (a mediação e o painel único): o domínio digitado com ponto no fim, com "https://" ou com
--      rótulo vazio ("a..b", ".a.b") era gravado como veio e não bloqueava nada. Agora o ponto do fim sai e o formato é o de um
--      nome de servidor de verdade, ou de um servidor num endereço de rede público: IPv4 (cada parte de 0 a 255) ou IPv6 entre
--      colchetes, escrito como o endereço da caixa de entrada o escreve. Desbloquear não confere o formato: um bloqueio antigo,
--      gravado de qualquer jeito, sempre pode ser desfeito.
--   3. interno.rede_fed_desligar: quem desliga a federação manda também o Delete do próprio ator (Person) aos servidores que a
--      conheciam (de quem a seguia e de quem ela seguia). Antes saíam só os Delete dos posts e o Reject: o Mastodon 4.5 de teste
--      tirou os posts e o seguir, mas continuou mostrando o perfil (codinome e bio) guardado. A entrega monta o Delete(Person)
--      pelo objeto "ator:<handle>" (lib/rede/fediverso/entrega.ts), com a chave da pessoa, que o banco ainda entrega enquanto
--      há retiradas na fila (estado "saindo").
--   4. A porta em tudo (interno.alumia_trancar).
-- Nenhuma função recebe linha de tabela com valor padrão. Endereço de rede de pessoa: nada daqui lê ou guarda (o endereço que entra na
-- lista de bloqueios é o de um servidor, digitado pela mediação, como já era na versão 13).

-- ── 1. O domínio de um endereço, sem o ponto do fim ─────────────────────────────────────────────────────────────────────────

create or replace function interno.rede_fed_dominio(p_url text) returns text language sql immutable as $$
  select rtrim(lower(substring(coalesce(p_url, '') from '^https://(\[[0-9A-Fa-f:.]+\]|[^/:?#\[\]]+)')), '.')
$$;

revoke all on function interno.rede_fed_dominio(text) from public, anon, authenticated;

/**
 * A instância deste endereço está bloqueada (ela ou um subdomínio dela)? Igual à de 2026-11-alumia.sql, mas sem deixar passar o
 * mesmo domínio escrito de outro jeito: com ponto no fim (https://threads.net./...) ou com usuário (e senha) na frente (https://x@threads.net/...).
 * (r1) O servidor num endereço IPv6 é lido inteiro, entre colchetes, como rede_fed_bloquear o grava.
 */
create or replace function interno.rede_fed_bloqueado(p_url text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_fed_bloqueados b, lateral (select rtrim(lower(substring(coalesce(p_url, '') from '^https://(?:[^/?#]*@)?(\[[0-9A-Fa-f:.]+\]|[^/:?#\[\]]+)')), '.') as d) x
                 where x.d = b.dominio or x.d like '%.' || b.dominio)
$$;

-- ── 2. Bloquear um servidor: o nome como a rede o vê ────────────────────────────────────────────────────────────────────────

-- A lista aceita também o IPv6 entre colchetes ("[2001:db8::1]"); o resto do formato continua o da versão 13 (o que já está
-- gravado passa). A trava antiga, de nome dado pelo Postgres, sai pelo que ela confere, e entra uma com nome fixo.
do $$
declare c text;
begin
  for c in select con.conname from pg_constraint con
           where con.conrelid = 'interno.rede_fed_bloqueados'::regclass and con.contype = 'c'
             and pg_get_constraintdef(con.oid) like '%dominio%' and con.conname <> 'rede_fed_bloqueados_dominio_formato' loop
    execute format('alter table interno.rede_fed_bloqueados drop constraint %I', c);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_fed_bloqueados'::regclass and conname = 'rede_fed_bloqueados_dominio_formato') then
    alter table interno.rede_fed_bloqueados add constraint rede_fed_bloqueados_dominio_formato
      check (dominio ~ '^[a-z0-9.-]{3,253}$' or dominio ~ '^\[[0-9a-f:.]{2,45}\]$');
  end if;
end $$;

create or replace function public.rede_fed_bloquear(p_dominio text, p_sim boolean, p_motivo text default '') returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  -- O que a pessoa digitou: sem espaço, minúsculo, sem "https://", sem caminho e sem o ponto do fim.
  v_d text := rtrim(regexp_replace(regexp_replace(lower(btrim(coalesce(p_dominio, ''))), '^https?://', ''), '/.*$', ''), '.');
  v_ip inet;
begin
  if not (interno.media() or interno.cuida()) then perform interno.erro('sem_permissao'); end if;
  if v_d = '' and p_sim is null then
    return coalesce((select jsonb_agg(jsonb_build_object('dominio', dominio, 'motivo', motivo, 'desde', criado_em, 'fixo', fixo) order by dominio) from rede_fed_bloqueados), '[]'::jsonb);
  end if;
  -- IPv6 entre colchetes: escrito do jeito curto, como o endereço da caixa de entrada o traz ("[2001:db8::1]").
  if v_d ~ '^\[[0-9a-f:.]+\]$' then
    begin
      v_ip := btrim(v_d, '[]')::inet;
    exception when others then
      v_ip := null;
    end;
    if v_ip is not null and family(v_ip) = 6 and masklen(v_ip) = 128 then v_d := '[' || host(v_ip) || ']'; else v_ip := null; end if;
  end if;
  -- Bloquear confere o formato; desbloquear não (um bloqueio antigo, de qualquer jeito, sempre sai).
  if coalesce(p_sim, true) and v_ip is null and (
       char_length(v_d) > 253
       -- IPv4: quatro partes de 0 a 255, sem zero na frente.
       or (v_d ~ '^[0-9.]+$' and v_d !~ '^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])$')
       -- Nome: rótulos de 1 a 63 letras, números ou hífen (sem hífen nas pontas), pelo menos dois, o último com letra.
       or (v_d !~ '^[0-9.]+$' and v_d !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]*[a-z][a-z0-9-]*$')) then
    perform interno.erro('invalido:dominio');
  end if;
  if exists (select 1 from rede_fed_bloqueados where dominio = v_d and fixo) then perform interno.erro('bloqueio_fixo'); end if;
  if coalesce(p_sim, true) then
    insert into rede_fed_bloqueados (dominio, motivo, por) values (v_d, left(coalesce(p_motivo, ''), 300), v)
    on conflict (dominio) do update set motivo = excluded.motivo, por = excluded.por, criado_em = now();
    perform interno.rede_fed_bloqueio_faxina();
    perform interno.registrar('rede_fed_instancia_bloqueada', v_d);
  else
    delete from rede_fed_bloqueados where dominio = v_d;
    if found then perform interno.registrar('rede_fed_instancia_desbloqueada', v_d); end if;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('dominio', dominio, 'motivo', motivo, 'desde', criado_em, 'fixo', fixo) order by dominio) from rede_fed_bloqueados), '[]'::jsonb);
end $$;

revoke all on function public.rede_fed_bloquear(text, boolean, text) from public, anon;
grant execute on function public.rede_fed_bloquear(text, boolean, text) to authenticated, service_role;

-- ── 3. Desligar a federação: o ator também sai ──────────────────────────────────────────────────────────────────────────────

/**
 * Desliga a federação de uma pessoa: Delete de cada post que saiu, Reject para quem seguia, Undo do que ela seguia, curtiu e
 * impulsionou lá fora, e (r1) o Delete do próprio ator a cada servidor que a conhecia, para o perfil guardado lá sumir também.
 */
create or replace function interno.rede_fed_desligar(p_perfil uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare e record; v_p rede_posts; v_handle text;
begin
  if not exists (select 1 from rede_fed_atores where perfil = p_perfil and ligado) then return; end if;
  for e in select post from rede_fed_enviados where perfil = p_perfil and apagado_em is null loop
    perform interno.rede_fed_espalhar(p_perfil, 'delete', e.post::text);
    -- Quem foi mencionado lá fora (modo total) recebeu o Create; recebe também a retirada.
    select * into v_p from rede_posts where id = e.post;
    if found then perform interno.rede_fed_entregar_mencionados(v_p, 'delete', p_perfil, null); end if;
  end loop;
  update rede_fed_enviados set apagado_em = now() where perfil = p_perfil and apagado_em is null;
  insert into rede_fed_fila (perfil, tipo, objeto, destino, extra)
  select p_perfil, 'reject', s.ator, s.inbox, jsonb_build_object('pedido', s.pedido) from rede_fed_seguidores s
  where s.perfil = p_perfil and s.pedido <> '' and not interno.rede_fed_bloqueado(s.inbox);
  insert into rede_fed_fila (perfil, tipo, objeto, destino, extra)
  select p_perfil, 'undo-follow', s.ator, coalesce(r.inbox, s.ator), jsonb_build_object('pedido', s.pedido)
  from rede_fed_seguindo s join rede_fed_remotos r on r.ator = s.ator
  where s.perfil = p_perfil and r.inbox is not null and not interno.rede_fed_bloqueado(r.inbox);
  insert into rede_fed_fila (perfil, tipo, objeto, destino, extra)
  select p_perfil, 'undo-' || i.tipo, i.objeto_remoto, r.inbox, jsonb_build_object('atividade', i.atividade_id, 'ator_objeto', i.ator)
  from fediverso_interacoes i join rede_fed_remotos r on r.ator = i.ator
  where i.direcao = 'saida' and i.perfil = p_perfil and r.inbox is not null and not interno.rede_fed_bloqueado(r.inbox);
  -- O Delete do ator, por último na fila: uma vez por servidor (a caixa compartilhada, quando há), aos que a seguiam e aos que
  -- ela seguia. Vai antes de apagar essas listas, que são a única memória de quem a conhecia.
  select handle into v_handle from rede_fed_atores where perfil = p_perfil;
  if v_handle is not null then
    insert into rede_fed_fila (perfil, tipo, objeto, destino)
    select p_perfil, 'delete', 'ator:' || v_handle, d.destino from (
      select coalesce(s.inbox_compartilhada, s.inbox) as destino from rede_fed_seguidores s where s.perfil = p_perfil
      union
      select coalesce(r.inbox_compartilhada, r.inbox) from rede_fed_seguindo s join rede_fed_remotos r on r.ator = s.ator
      where s.perfil = p_perfil and r.inbox is not null
    ) d
    where d.destino ~ '^https://' and not interno.rede_fed_bloqueado(d.destino);
  end if;
  delete from fediverso_interacoes where direcao = 'saida' and perfil = p_perfil;
  delete from rede_fed_seguidores where perfil = p_perfil;
  delete from rede_fed_seguindo where perfil = p_perfil;
  update rede_fed_atores set ligado = false, desligado_em = now() where perfil = p_perfil;
end $$;

revoke all on function interno.rede_fed_desligar(uuid) from public, anon, authenticated;

-- ── 4. A porta em tudo ──────────────────────────────────────────────────────────────────────────────────────────────────────

select interno.alumia_trancar();
