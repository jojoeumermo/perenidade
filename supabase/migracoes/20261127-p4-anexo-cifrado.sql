-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · itens 137 e 138: o depósito do anexo cifrado do chat (áudio e vídeo curto, na conversa a dois e no grupo).
--
-- O arquivo é cifrado NO APARELHO (AES-256-GCM, uma chave sorteada por arquivo: lib/rede/chat/anexo-cifrado.ts) e só o cifrado
-- sobe, pela rota app/api/alumia/anexo, SEM a sessão da conta e com um passe anônimo (Privacy Pass, o mesmo da criação de caixa):
-- o servidor não sabe de quem é o arquivo. A chave, o tamanho de verdade e o endereço vão dentro da mensagem do chat, que já é
-- cifrada; o banco nunca vê a chave nem o conteúdo.
--
-- O que fica no banco, por arquivo (interno.alumia_anexos): o RESUMO do endereço (SHA-256 com rótulo; o endereço de verdade, 128 bits
-- sorteados pela rota, só passa pela memória da rota e vai dentro da mensagem cifrada), o tamanho do cifrado (arredondado a 64 KiB
-- pelo aparelho) e o DIA em que vence (1, 7 ou 30 dias, sem hora). Nenhuma conta, nenhum endereço de rede, nenhuma hora de envio,
-- nenhum tipo de arquivo, nem se é "ver uma vez" (quem abre um desses pede para apagar, e o servidor não precisa saber antes).
-- O depósito "alumia-anexos" é privado e não tem regra para anon nem authenticated: só o servidor do site lê e grava (chave de
-- serviço). A linha que sai (venceu, "ver uma vez" aberto, quem mandou apagou) põe o arquivo na fila que o servidor esvazia
-- (interno.alumia_arquivos_a_apagar, a mesma das contas apagadas).
-- Ligado só com "alumia-p4-anexo-cifrado" ligado no painel (só pelo nome; desligado por padrão).
--
-- Funções que ESTA migração redefine: nenhuma. Muda a regra de interno.alumia_arquivos_a_apagar (aceita o depósito "alumia-anexos"),
-- como 20261118-alumia-o12-midia.sql fez para o "rede-video".
-- Roda depois de 20261126-p5-fim.sql (banco na versão 17). Não mexe na versão nem na lista da porta: o 20261127-p4-fim.sql faz isso.
-- Pode rodar mais de uma vez. Endereço de rede: nada daqui lê ou guarda.
-- Teste: npm run testar:p4-anexo-cifrado.
-- Lei: LGPD art. 46 (segurança: o servidor não lê o arquivo), art. 6º, III (necessidade: só o resumo do endereço, o tamanho
-- arredondado e o dia do vencimento) e art. 16 (eliminação ao fim do prazo escolhido).

-- ── 1. O registro dos arquivos ──────────────────────────────────────────────────────────────────────────────────────────────
-- Os anexos cifrados do chat no depósito: só o resumo do endereço, o tamanho arredondado e o dia do vencimento. Sem conta, sem hora.
create table if not exists interno.alumia_anexos (
  -- SHA-256 de "alumia/p4/anexo" + os 16 bytes do endereço, em hexadecimal.
  id_h text primary key check (id_h ~ '^[0-9a-f]{64}$'),
  -- O cifrado: um múltiplo de 64 KiB mais os 16 bytes da marca do GCM, até 159 degraus (9,9 MiB) + 16.
  tamanho integer not null check (tamanho > 16 and tamanho <= 10420240 and (tamanho - 16) % 65536 = 0),
  vence date not null
);

alter table interno.alumia_anexos enable row level security;
revoke all on table interno.alumia_anexos from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.alumia_anexos from anon, authenticated;
  end if;
end $$;

-- ── 2. A fila de arquivos aceita o depósito novo ────────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  if to_regclass('interno.alumia_arquivos_a_apagar') is null then return; end if;
  if exists (select 1 from pg_constraint where conrelid = 'interno.alumia_arquivos_a_apagar'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ~ 'deposito' and pg_get_constraintdef(oid) ~ 'alumia-anexos') then
    return;
  end if;
  for r in select conname from pg_constraint where conrelid = 'interno.alumia_arquivos_a_apagar'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ 'deposito' loop
    execute format('alter table interno.alumia_arquivos_a_apagar drop constraint %I', r.conname);
  end loop;
  alter table interno.alumia_arquivos_a_apagar add constraint alumia_arquivos_a_apagar_deposito_check
    check (deposito in ('rede-midia', 'rede-stories', 'rede-album', 'rede-video', 'alumia-anexos'));
end $$;

-- ── 3. As peças de dentro ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Ligado? Só com decisão explícita do painel (interno.recursos_vivos) e sem a Alumia nova desligada lá. */
create or replace function interno.alumia_anexo_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-p4-anexo-cifrado'), false);
end $$;

/** O caminho no depósito: o resumo do endereço em forma de pasta e arquivo ("<8-4-4-4-12>/<32>"), o formato que a fila aceita. */
create or replace function interno.alumia_anexo_caminho(p_id_h text) returns text language sql immutable set search_path = interno, pg_temp as $$
  select substr(p_id_h, 1, 8) || '-' || substr(p_id_h, 9, 4) || '-' || substr(p_id_h, 13, 4) || '-' || substr(p_id_h, 17, 4) || '-'
         || substr(p_id_h, 21, 12) || '/' || substr(p_id_h, 33, 32)
$$;

/** A linha saiu (venceu, foi aberta uma vez, quem mandou apagou): o arquivo vai na hora para a fila do servidor. */
create or replace function interno.alumia_anexo_para_a_fila() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.alumia_arquivos_a_apagar') is not null then
    insert into alumia_arquivos_a_apagar (deposito, caminho) values ('alumia-anexos', interno.alumia_anexo_caminho(old.id_h)) on conflict do nothing;
  end if;
  return old;
end $$;

drop trigger if exists alumia_anexos_para_a_fila on interno.alumia_anexos;
create trigger alumia_anexos_para_a_fila after delete on interno.alumia_anexos for each row execute function interno.alumia_anexo_para_a_fila();

/** A faxina diária: tira os vencidos (e a fila leva os arquivos). Devolve só quantos. */
create or replace function interno.alumia_anexos_faxina() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_n integer;
begin
  delete from alumia_anexos where vence < current_date;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ── 4. O que o servidor do site chama (só com a chave de serviço) ───────────────────────────────────────────────────────────

/**
 * Registra um arquivo que a rota vai guardar: gasta o passe anônimo (repetido é recusado) e grava o resumo do endereço, o tamanho e
 * o dia do vencimento. Devolve o caminho no depósito. Erros: sem_permissao, desligado, invalido, passe_usado.
 */
create or replace function public.alumia_anexo_reservar(p_id_h text, p_tamanho integer, p_dias integer, p_passe bytea)
returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if not interno.alumia_anexo_ligado() then perform interno.erro('desligado'); end if;
  if coalesce(p_id_h, '') !~ '^[0-9a-f]{64}$' or p_dias is null or p_dias not in (1, 7, 30)
     or p_tamanho is null or p_tamanho <= 16 or p_tamanho > 10420240 or (p_tamanho - 16) % 65536 <> 0 then
    perform interno.erro('invalido');
  end if;
  if not interno.caixa_gastar(p_passe) then perform interno.erro('passe_usado'); end if;
  insert into alumia_anexos (id_h, tamanho, vence) values (p_id_h, p_tamanho, current_date + p_dias);
  return jsonb_build_object('caminho', interno.alumia_anexo_caminho(p_id_h));
end $$;

/** O arquivo ainda vale? Devolve o caminho e o tamanho, ou nulo (não existe, venceu, desligado). Não diz nada além disso. */
create or replace function public.alumia_anexo_ver(p_id_h text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare a alumia_anexos;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if not interno.alumia_anexo_ligado() or coalesce(p_id_h, '') !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into a from alumia_anexos where id_h = p_id_h and vence >= current_date;
  if not found then return null; end if;
  return jsonb_build_object('caminho', interno.alumia_anexo_caminho(a.id_h), 'tamanho', a.tamanho);
end $$;

/**
 * Tira o arquivo do registro (quem mandou apagou para todos, ou "ver uma vez" foi aberto). Quem pede prova só que sabe o endereço:
 * o endereço só existe dentro da conversa cifrada. Devolve o caminho (para a rota apagar na hora; a fila garante depois) ou nulo.
 */
create or replace function public.alumia_anexo_tirar(p_id_h text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id text;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_id_h, '') !~ '^[0-9a-f]{64}$' then return null; end if;
  delete from alumia_anexos where id_h = p_id_h returning id_h into v_id;
  if v_id is null then return null; end if;
  return jsonb_build_object('caminho', interno.alumia_anexo_caminho(v_id));
end $$;

-- ── 5. Permissões: as públicas, só a chave de serviço; as de dentro, ninguém ──────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.alumia_anexo_reservar(text, integer, integer, bytea)', 'public.alumia_anexo_ver(text)', 'public.alumia_anexo_tirar(text)',
                           'interno.alumia_anexo_ligado()', 'interno.alumia_anexo_caminho(text)', 'interno.alumia_anexo_para_a_fila()', 'interno.alumia_anexos_faxina()'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon, authenticated', f); end if;
    if f like 'public.%' and exists (select 1 from pg_roles where rolname = 'service_role') then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end $$;

-- ── 6. O depósito (Storage) ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Privado, até 9,9 MiB + 16 (o maior cifrado), só "application/octet-stream" (o cifrado não tem tipo). Sem regra de leitura, envio
-- nem remoção para quem tem conta: só a chave de serviço passa. Sem Storage (teste local), nada.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') and to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('alumia-anexos', 'alumia-anexos', false, 10420240, array['application/octet-stream'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

-- ── 7. A faxina diária e o interruptor ───────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-anexos-faxina', '29 3 * * *', 'select interno.alumia_anexos_faxina()');
  end if;
exception when others then
  raise warning 'alumia-anexos-faxina: a rotina não foi agendada (%).', sqlerrm;
end $$;

do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-anexo-cifrado', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

select interno.alumia_trancar();
