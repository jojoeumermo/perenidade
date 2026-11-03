-- ───────────────────────────── Acertos por aula, somados e anônimos (Etapa 3, R3) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. O mesmo bloco está no fim do install.sql.
--
-- Só leitura do que já existe. O teste do fim da aula (components/Quiz.tsx) já soma +1 em 'aula_teste' quando alguém
-- termina o teste e +1 em 'aula_acertou' quando acerta 70% ou mais, sem conta, nome nem identificador (função contar).
-- Esta função devolve esses totais por aula de UMA trilha, para o educador ver qual aula está difícil demais.
-- Dado de pessoa: nenhum (as linhas são totais por dia). Só a equipe lê, para os números não virarem ranking público.
create or replace function public.aula_acertos(p_trilha text, p_dias integer default 90) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if auth.uid() is null or not interno.da_equipe(auth.uid()) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_trilha, '') !~ '^[a-z0-9-]{1,80}$' then return '[]'::jsonb; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('alvo', alvo, 'testes', testes, 'acertos', acertos) order by alvo), '[]'::jsonb)
    from (
      select alvo,
             sum(total) filter (where tipo = 'aula_teste')::bigint as testes,
             sum(total) filter (where tipo = 'aula_acertou')::bigint as acertos
      from contagens
      where tipo in ('aula_teste', 'aula_acertou')
        and left(alvo, length(p_trilha) + 1) = p_trilha || '/'
        and dia > (now() at time zone 'America/Sao_Paulo')::date - least(greatest(coalesce(p_dias, 90), 1), 400)
      group by alvo
    ) x
  );
end $$;
revoke all on function public.aula_acertos(text, integer) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.aula_acertos(text, integer) from anon; grant execute on function public.aula_acertos(text, integer) to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function public.aula_acertos(text, integer) to service_role; end if;
end $$;
