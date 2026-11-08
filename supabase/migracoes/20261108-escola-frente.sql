-- ───────────────────────────── Escola de Formação (F6): a frente de atuação de cada militante, novembro de 2026 ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Precisa da migração da F1
-- (20261108-escola-formacao-base.sql: interno.e_militante e interno.escola_militancia). Quem junta cola este bloco no fim do
-- install.sql, por último na ordem da Escola (F1, F4, F5, F3, F6). Plano: docs/plano-2026-11/PLANO-ESCOLA.md, seção 4.6.
-- Teste: npm run testar:escola-frente (Postgres de verdade dentro do Node, com o install.sql, a F1 e esta migração).
--
-- O que nasce aqui (nenhuma tabela nova; a coluna escola_militancia.frente já existe desde a F1):
--  1. public.escola_frente_escolher(p_frente): o militante escolhe (ou tira) a própria frente de atuação, entre as 7
--     confirmadas em 07/11. Só a própria: ninguém escolhe pelo outro aqui (a coordenação ajusta pelo painel, F4).
--  2. public.escola_frentes_somadas(): só a CONTAGEM de militantes por frente, para a página A Frente. Nunca nomes.
--     Frente com menos de 3 pessoas não aparece: número muito pequeno ajuda a descobrir quem é (ser militante revela
--     opinião política, dado sensível, LGPD art. 5º, II e art. 11).
--
-- Segurança (mesma regra das outras migrações da Escola): security definer, search_path fixo, entrada por interno.eu(),
-- freio por interno.limite. Quem não é militante recebe "sem_permissao" e não aprende nada.

-- 1. Escolher a frente ───────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * O militante escolhe a frente em que atua (ou null, para tirar). Valores: os mesmos do check de
 * interno.escola_militancia.frente (lib/escola/contratos.ts, FRENTES_DE_ATUACAO). Quem representa o departamento e ainda
 * não tinha a linha de militância ganha a linha aqui, como em escola_eu. A coordenação que não é do departamento não tem
 * frente própria (não é militante de base): recebe "sem_militancia".
 */
create or replace function public.escola_frente_escolher(p_frente text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  f text := nullif(btrim(coalesce(p_frente, '')), '');
begin
  if not interno.e_militante(v) then perform interno.erro('sem_permissao'); end if;
  if f is not null and f not in ('estudantil', 'bairros', 'trabalho', 'agitprop', 'atos', 'cultura', 'solidariedade') then
    perform interno.erro('invalido:frente');
  end if;
  perform interno.limite('escola_frente_escolher', 20, 60);
  if interno.membro_direto(v, 'revolucionarios') then perform interno.escola_militancia_criar(v); end if;
  update escola_militancia set frente = f where usuario = v;
  if not found then perform interno.erro('sem_militancia'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- 2. Quantos em cada frente ──────────────────────────────────────────────────────────────────────────────────────────────
/**
 * {frente: quantos}, só de militantes de verdade (do departamento, conta ativa). Frente com menos de 3 fica de fora.
 * Só militante (ou a coordenação) pergunta; o resto recebe "sem_permissao".
 */
create or replace function public.escola_frentes_somadas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  r jsonb;
begin
  if not interno.e_militante(v) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('escola_frentes_somadas', 60, 1);
  select coalesce(jsonb_object_agg(s.frente, s.n), '{}'::jsonb) into r
  from (
    select m.frente, count(*)::int as n
    from escola_militancia m
    join perfis p on p.id = m.usuario and not p.suspenso
    where m.frente is not null and interno.membro_direto(m.usuario, 'revolucionarios')
    group by m.frente
    having count(*) >= 3
  ) s;
  return r;
end $$;

-- 3. Permissões ──────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Só os papéis da API chamam (a própria função recusa quem não é militante); "public" não herda execute.
revoke all on function public.escola_frente_escolher(text), public.escola_frentes_somadas() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.escola_frente_escolher(text), public.escola_frentes_somadas() to anon, authenticated, service_role;
  end if;
end $$;
