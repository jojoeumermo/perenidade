-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Prompt 5 (correções e redesign), Escola: a tag de revolucionária(o) (B3) e a frente de atuação na Alumia (B5).
-- Roda depois de 20261125-r3-fim.sql (banco na versão 16). Precisa das migrações da Escola de Formação (F1:
-- 20261108-escola-formacao-base.sql, F5: 20261108-escola-conquistas.sql, F6: 20261108-escola-frente.sql). Acrescentável: pode
-- rodar mais de uma vez, sem apagar dado nenhum. Não mexe em rede_alumia_versao nem na lista da porta (é do 20261126-p5-fim.sql).
-- Teste: npm run testar:escola-tag (Postgres de verdade dentro do Node, com o install.sql e esta migração).
--
-- O que muda:
--  1. perfis.escola_tag: a pessoa escolhe se a tag aparece (padrão: não). Só liga com o público das conquistas da Escola já
--     escolhido (a tela de consentimento da F5 vem antes); voltar o público para 'ninguem' desliga a tag junto (gatilho).
--  2. interno.escola_conquistas_visiveis (REDEFINIDA, corpo inteiro tirado do banco montado com o install.sql deste ramo):
--     acrescenta, ANTES dos outros selos, 'escola:revolucionario' e 'escola:frente-<frente>', só com a tag ligada e só para
--     quem está no departamento Revolucionários (a Frente). O resto do corpo é o mesmo.
--  3. public.escola_tag_definir(p_mostrar) e public.escola_tag_minha(): ligar e desligar, e o estado de quem chama.
--
-- Quem tem a tag: quem está na Frente Revolucionária, conferido NO BANCO (interno.membro_direto(..., 'revolucionarios')). Entra
-- na Frente quem tem a inscrição militante aprovada pela coordenação; a Escola de hoje só recebe militante, então quem conclui a
-- Escola (o degrau 3 aprovado na banca) já está na Frente. Sair do departamento tira a tag na hora (a F5 já volta o público para
-- 'ninguem', e o gatilho daqui desliga a tag).
--
-- Privacidade (a tag revela opinião política, dado sensível: LGPD art. 5º, II, e art. 11):
--  - a tag NUNCA vira lista: nenhuma função devolve quem tem a tag ou quem está numa frente. Ela só sai dentro do perfil de UMA
--    pessoa (rede_perfil_de, pelo rede3_perfil_selos), para o público que ela escolheu, e respeitando o "Mostrar meus selos";
--  - nenhum número: não há contagem de tags. A contagem por frente continua só a da F6 (escola_frentes_somadas, só para
--    militante, e frente com menos de 3 não aparece);
--  - a busca e o Explorar da Alumia não leem selos (o teste confere que nenhuma função além das do perfil chama o filtro);
--  - nada de nome civil.

-- 1. A escolha da pessoa ────────────────────────────────────────────────────────────────────────────────────────────────────
alter table interno.perfis add column if not exists escola_tag boolean not null default false;

/** Público das conquistas voltou para 'ninguem' (pela pessoa ou por ter saído da Frente): a tag desliga junto. */
create or replace function interno.escola_tag_ao_esconder() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.escola_tag and coalesce(new.escola_publico, 'ninguem') = 'ninguem' then new.escola_tag := false; end if;
  return new;
end $$;
drop trigger if exists lucia_escola_tag on interno.perfis;
create trigger lucia_escola_tag before insert or update of escola_publico, escola_tag on interno.perfis
  for each row execute function interno.escola_tag_ao_esconder();

-- 2. Os selos da Escola que quem pede pode ver: com a tag e a frente ─────────────────────────────────────────────────────────
/**
 * Os selos da Escola de `p_dono` que `p_quem` pode ver, na ordem: a tag de revolucionária(o) e a frente (P5, só com a tag
 * ligada e só para quem está na Frente), a carteirinha, o maior degrau verificado, os cadernos declarados e a contagem de
 * aulas declaradas. Lista vazia quando não pode ver.
 */
create or replace function interno.escola_conquistas_visiveis(p_dono uuid, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select case when not interno.escola_pode_ver(p_dono, p_quem) then '[]'::jsonb else coalesce((
    select jsonb_agg(x.s order by x.o, x.s)
    from (
      select 'escola:revolucionario' as s, -2 as o from perfis f
        where f.id = p_dono and f.escola_tag and interno.membro_direto(p_dono, 'revolucionarios')
      union all
      select 'escola:frente-' || m.frente, -1 from perfis f join escola_militancia m on m.usuario = f.id
        where f.id = p_dono and f.escola_tag and m.frente is not null and interno.membro_direto(p_dono, 'revolucionarios')
      union all
      select 'escola:carteirinha' as s, 1 as o from escola_conquistas c
        where c.usuario = p_dono and c.tipo = 'carteirinha' and c.alvo = 'carteirinha' and c.verificada
      union all
      select 'escola:' || max(c.alvo), 2 from escola_conquistas c
        where c.usuario = p_dono and c.tipo = 'degrau' and c.verificada and c.alvo ~ '^degrau-[1-3]$' having count(*) > 0
      union all
      select 'escola:' || c.alvo, 3 from escola_conquistas c
        where c.usuario = p_dono and c.tipo = 'caderno' and c.alvo ~ '^caderno-(0[1-9]|1[01])$'
      union all
      select 'escola:aulas-' || count(*), 4 from escola_conquistas c
        where c.usuario = p_dono and c.tipo = 'aula' having count(*) > 0
    ) x), '[]'::jsonb) end
$$;

-- 3. Funções públicas ────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Liga (true) ou desliga (false) a tag de revolucionária(o) e a frente no perfil da Alumia. Só militante (com a linha da
 * militância). Ligar exige o público das conquistas já escolhido (diferente de 'ninguem'): a tela de consentimento da F5 vem
 * antes. Quem ainda não está na Frente pode deixar ligado: a tag só aparece quando entrar.
 */
create or replace function public.escola_tag_definir(p_mostrar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.escola_exige_militancia();
begin
  if p_mostrar is null then perform interno.erro('invalido:mostrar'); end if;
  perform interno.limite('escola_tag', 30, 10);
  if p_mostrar and coalesce((select escola_publico from perfis where id = v), 'ninguem') = 'ninguem' then perform interno.erro('invalido:publico'); end if;
  update perfis set escola_tag = p_mostrar where id = v;
  return jsonb_build_object('ok', true);
end $$;

/**
 * O estado da tag de quem chama: se está ligada, o público das conquistas, se a pessoa está na Frente e a frente escolhida.
 * Só da própria pessoa; nada de outra conta. Volátil (sem "stable") de propósito: o freio (interno.limite) grava, e função
 * "stable" roda em transação só de leitura na API.
 */
create or replace function public.escola_tag_minha() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.escola_exige_militancia();
begin
  perform interno.limite('escola_tag_minha', 60, 1);
  return (
    select jsonb_build_object('mostrar', f.escola_tag, 'publico', f.escola_publico, 'na_frente', interno.membro_direto(v, 'revolucionarios'), 'frente', m.frente)
    from perfis f left join escola_militancia m on m.usuario = f.id
    where f.id = v);
end $$;

-- 4. Permissões ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.escola_tag_ao_esconder(), interno.escola_conquistas_visiveis(uuid, uuid) from public;
revoke all on function public.escola_tag_definir(boolean), public.escola_tag_minha() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.escola_tag_ao_esconder(), interno.escola_conquistas_visiveis(uuid, uuid) from anon, authenticated;
    revoke all on function public.escola_tag_definir(boolean), public.escola_tag_minha() from anon;
    grant execute on function public.escola_tag_definir(boolean), public.escola_tag_minha() to authenticated, service_role;
  end if;
end $$;
