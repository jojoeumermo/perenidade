-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Alumia, onda 7: as funções que o servidor do site chama sem sessão, com o segredo da federação, saem da porta da entrada.
-- Com a porta, assim que a trava da entrada fosse ligada, o Fediverso parava (aviso da Faixa 2 em docs/rede/PEDIDOS-ENTRE-FAIXAS.md).
--
--   1. interno.alumia_porta_aberta passa a listar rede_fed_servidor, rede_fed_midia_servidor e rede_fed_mudanca_servidor (a mesma
--      definição de 20261112-alumia-portas.sql, que foi corrigida junto: rodar uma ou outra de novo dá a mesma lista).
--   2. interno.alumia_destrancar(nome) tira a porta que interno.alumia_trancar já tinha posto numa função (em produção,
--      rede_fed_servidor foi trancada quando a onda 6 rodou). Devolve quantas versões destrancou.
--
-- Idempotente. Teste: npm run testar:alumia-entrada.

create or replace function interno.alumia_porta_aberta(p_nome text, p_argumentos text) returns boolean language sql immutable as $$
  select p_nome in ('alumia_entrada_eu', 'alumia_entrada_pedir', 'alumia_triagem_contagem', 'alumia_triagem_fila', 'alumia_triagem_decidir',
                    'rede_situacao', 'rede_aderir', 'rede_codinome_definir', 'rede_confirmar_idade', 'rede_eu', 'rede_alumia_versao',
                    'rede_fed_situacao', 'rede_antigo',
                    -- Chamadas pelo servidor do site sem sessão, com o segredo da federação (Faixa 2): com a porta, o Fediverso para.
                    'rede_fed_servidor', 'rede_fed_midia_servidor', 'rede_fed_mudanca_servidor')
      or (p_nome in ('rede_linha', 'rede_novos') and coalesce(p_argumentos, '') like 'p_aba text%')
$$;

/**
 * Desfaz o que interno.alumia_trancar fez numa função public.<p_nome>: em plpgsql, o corpo volta a ser o de dentro do bloco
 * "begin perform interno.alumia_porta(); … ; end"; a de SQL que virou plpgsql volta a ser SQL. Função que não foi trancada pela
 * regra fica como está.
 */
create or replace function interno.alumia_destrancar(p_nome text) returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v_def text; v_corpo text; v_n integer := 0;
  c_pl constant text := 'begin perform interno.alumia_porta(); ';
  c_sql constant text := E'\nbegin perform interno.alumia_porta(); return (';
begin
  for r in
    select p.oid, l.lanname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
    where n.nspname = 'public' and p.proname = p_nome and p.prokind = 'f'
  loop
    v_def := pg_get_functiondef(r.oid);
    v_corpo := null;
    if r.lanname = 'plpgsql' and left(r.prosrc, length(c_sql)) = c_sql and right(r.prosrc, 8) = E'\n); end ' then
      v_corpo := E'\n' || substr(r.prosrc, length(c_sql) + 1, length(r.prosrc) - length(c_sql) - 8) || E'\n';
      v_def := regexp_replace(v_def, '\n LANGUAGE plpgsql\n', E'\n LANGUAGE sql\n');
    elsif r.lanname = 'plpgsql' and left(r.prosrc, length(c_pl)) = c_pl and right(r.prosrc, 7) = E'\n; end ' then
      v_corpo := substr(r.prosrc, length(c_pl) + 1, length(r.prosrc) - length(c_pl) - 7);
    end if;
    if v_corpo is not null and position(r.prosrc in v_def) > 0 then
      execute replace(v_def, r.prosrc, v_corpo);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

revoke all on function interno.alumia_destrancar(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function interno.alumia_destrancar(text) from anon, authenticated';
  end if;
end $$;

select interno.alumia_destrancar(f) from unnest(array['rede_fed_servidor', 'rede_fed_midia_servidor', 'rede_fed_mudanca_servidor']) f;
