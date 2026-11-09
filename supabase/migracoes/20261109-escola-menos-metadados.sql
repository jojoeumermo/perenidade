-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Escola com menos metadados (docs/auditoria/ESCOLA-2026-11-09.md). Pode rodar sozinho no SQL Editor; o install.sql já traz o mesmo.

-- 9. Menos metadados da Escola (09/11/2026) ───────────────────────────────────────────────────────────────────────────
/**
 * Apaga o bate-papo das aulas da Escola encerradas (ou canceladas, ou abandonadas sem encerrar) há mais de 30 dias.
 * Desde 09/11/2026 (docs/auditoria/ESCOLA-2026-11-09.md, menos metadados), também some, 1 dia depois do fim da aula da
 * Escola, quem se inscreveu nela e as chaves de sala de cada um; e, todo dia, as contagens de pedidos da Escola
 * (interno.limites, que guardam a conta e a hora) da véspera para trás. O mapa "quem foi a qual aula" não fica.
 */
create or replace function interno.escola_aovivo_faxina() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare n integer; m integer;
begin
  delete from aulas_chat c using aulas_ao_vivo a
  where a.id = c.aula and a.publico = 'escola'
    and ((a.status = 'encerrada' and coalesce(a.encerrada_em, a.inicio) < now() - interval '30 days')
      or (a.status = 'cancelada' and a.atualizado_em < now() - interval '30 days')
      or (a.status in ('agendada', 'ao_vivo') and a.inicio + make_interval(mins => a.duracao) < now() - interval '30 days'));
  get diagnostics n = row_count;
  delete from aulas_inscricoes i using aulas_ao_vivo a
  where a.id = i.aula and a.publico = 'escola'
    and ((a.status = 'encerrada' and coalesce(a.encerrada_em, a.inicio) < now() - interval '1 day')
      or (a.status = 'cancelada' and a.atualizado_em < now() - interval '1 day')
      or (a.status in ('agendada', 'ao_vivo') and a.inicio + make_interval(mins => a.duracao) < now() - interval '1 day'));
  get diagnostics m = row_count; n := n + m;
  delete from aulas_sala_chaves k using aulas_ao_vivo a
  where a.id = k.aula and a.publico = 'escola'
    and (a.status in ('encerrada', 'cancelada') or a.inicio + make_interval(mins => a.duracao) < now() - interval '1 day');
  get diagnostics m = row_count; n := n + m;
  delete from limites where janela < now() - interval '1 day' and (chave like 'escola%' or chave like 'aula_sala_chave:%' or chave like 'aula_inscrever:%');
  return n;
end $$;
