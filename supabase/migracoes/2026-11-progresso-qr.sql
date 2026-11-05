-- ───────────────────────────── Progresso por QR (Etapa 3, pacote progresso-qr) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. O mesmo bloco está no fim do install.sql.
-- Texto e regras: docs/PROGRESSO-QR.md e a página de privacidade (parágrafo "Levar o progresso para outro aparelho (por QR)").
--
-- Para levar o progresso e as anotações de um aparelho a outro SEM conta, o aparelho de origem monta o pacote, cifra com uma
-- chave aleatória (AES-GCM, no próprio aparelho) e, quando o pacote cabe no QR, o QR leva o pacote e a chave e o servidor não
-- participa. Quando não cabe, o pacote JÁ CIFRADO vem para cá, e o QR leva só o código do pacote e a chave. A chave nunca
-- chega ao servidor: aqui só existe um texto cifrado que ninguém daqui consegue abrir.
--
-- Regras do banco:
--   * só guarda o texto cifrado, até 400 mil caracteres (uns 300 KB), e no máximo 100 pacotes guardados ao mesmo tempo;
--   * quem guarda: no máximo 6 pedidos por hora por origem; quem lê: no máximo 30 por 10 minutos por origem (interno.limite);
--   * o pacote some assim que é lido (a leitura já o apaga) ou em até 1 dia, o que vier primeiro; a limpeza roda a cada
--     chamada e, quando existe pg_cron, também de hora em hora;
--   * a tabela do pacote não guarda quem enviou, nem endereço, nem data de leitura: só o código, o texto cifrado e o prazo. O limite de
--     pedidos usa o contador comum do projeto (interno.limite), que guarda só um hash da origem e some em até 2 dias.
--
-- Nenhuma tabela no esquema public (trava do projeto: npm run testar:banco); a tabela fica em interno e só as duas funções
-- public.* (security definer, search_path = interno, pg_temp) abrem. Teste: npm run testar:progresso-qr.

create table if not exists interno.progresso_qr (
  id text primary key check (id ~ '^[A-HJ-NP-Z2-9]{10}$'),
  blob text not null check (char_length(blob) between 40 and 400000 and blob ~ '^[A-Za-z0-9_-]+$'),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '1 day'
);
create index if not exists progresso_qr_expira_idx on interno.progresso_qr (expira_em);
alter table interno.progresso_qr enable row level security;
revoke all on interno.progresso_qr from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.progresso_qr from anon, authenticated; end if;
end $$;

/** Apaga os pacotes vencidos. Só o banco chama (função interna, sem permissão para anon nem authenticated). */
create or replace function interno.progresso_qr_limpar() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare n integer;
begin
  delete from interno.progresso_qr where expira_em <= now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function interno.progresso_qr_limpar() from public;

/**
 * Guarda um pacote JÁ CIFRADO no aparelho de origem. O código (p_id) é sorteado pelo aparelho: 10 letras e números sem 0, 1, I e O.
 * Devolve {ok, expira_em}. Erros: invalido:id, invalido:pacote, pacote_grande, servico_cheio, id_em_uso, muitos_pedidos.
 */
create or replace function public.progresso_qr_guardar(p_id text, p_blob text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_expira timestamptz;
begin
  perform interno.limite('progresso_qr_guardar', 6, 60);
  if p_id is null or p_id !~ '^[A-HJ-NP-Z2-9]{10}$' then perform interno.erro('invalido:id'); end if;
  if p_blob is null or char_length(p_blob) < 40 then perform interno.erro('invalido:pacote'); end if;
  if char_length(p_blob) > 400000 then perform interno.erro('pacote_grande'); end if;
  if p_blob !~ '^[A-Za-z0-9_-]+$' then perform interno.erro('invalido:pacote'); end if;
  perform interno.progresso_qr_limpar();
  if (select count(*) from interno.progresso_qr) >= 100 then perform interno.erro('servico_cheio'); end if;
  insert into interno.progresso_qr (id, blob) values (p_id, p_blob) on conflict (id) do nothing returning expira_em into v_expira;
  if v_expira is null then perform interno.erro('id_em_uso'); end if;
  return jsonb_build_object('ok', true, 'expira_em', v_expira);
end $$;

/**
 * Entrega o pacote cifrado e o apaga NA MESMA HORA: quem lê primeiro leva, ninguém lê duas vezes. Devolve {achou: false}
 * para código errado, já lido ou vencido (sem distinguir, para não dar pista). Erro: muitos_pedidos.
 */
create or replace function public.progresso_qr_buscar(p_id text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_blob text;
begin
  perform interno.limite('progresso_qr_buscar', 30, 10);
  if p_id is null or p_id !~ '^[A-HJ-NP-Z2-9]{10}$' then return jsonb_build_object('achou', false); end if;
  perform interno.progresso_qr_limpar();
  delete from interno.progresso_qr where id = p_id returning blob into v_blob;
  if v_blob is null then return jsonb_build_object('achou', false); end if;
  return jsonb_build_object('achou', true, 'blob', v_blob);
end $$;

revoke all on function public.progresso_qr_guardar(text, text) from public;
revoke all on function public.progresso_qr_buscar(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.progresso_qr_guardar(text, text) from anon, authenticated;
    revoke all on function public.progresso_qr_buscar(text) from anon, authenticated;
    revoke all on function interno.progresso_qr_limpar() from anon, authenticated;
    grant execute on function public.progresso_qr_guardar(text, text) to anon, authenticated, service_role;
    grant execute on function public.progresso_qr_buscar(text) to anon, authenticated, service_role;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lucia-progresso-qr-limpar', '17 * * * *', 'select interno.progresso_qr_limpar()');
  end if;
exception when others then null;
end $$;
