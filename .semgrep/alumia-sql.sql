-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Arquivo de TESTE das regras de alumia-sql.yml (semgrep --test). Não é migração (não roda em banco nenhum): por isso as marcas
-- "ruleid"/"ok" vêm com // (o --test do Semgrep, no modo generic, não reconhece o -- do SQL como comentário).

// ruleid: alumia-definer-com-search-path
create or replace function public.ruim(p_x text) returns text language plpgsql security definer as $$
begin
  return p_x;
end $$;

// ok: alumia-definer-com-search-path
create or replace function public.boa(p_x text) returns text language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  // ruleid: alumia-sem-raise-com-dado
  raise notice 'chegou %', p_x;
  return p_x;
end $$;

// ok: alumia-definer-com-search-path
create or replace function public.invoker(p_x text) returns text language sql stable as $$ select p_x $$;

// ruleid: alumia-interno-sem-grant-para-fora
grant execute on function interno.qualquer(uuid) to authenticated;
// ok: alumia-interno-sem-grant-para-fora
grant execute on function public.boa(text) to authenticated;
