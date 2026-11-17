-- ───────────────────────────── Alumia no Fediverso: perfil atualizado lá fora e conta que muda de servidor (B6) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez. Roda DEPOIS de 20261110-fediverso-privacidade.sql. O mesmo bloco está no fim do
-- install.sql. Documento: docs/rede/FEDIVERSO.md ("Sotaques por software"). Teste: scripts/testar-fediverso-banco.mjs (seção "Perfil e
-- mudança") e scripts/testar-fediverso-saida.mjs / -entrada.mjs.
--
-- 1. Update(Person) SAINDO: quando muda o que sai no ator da pessoa (codinome conferido, bio, rosto ou capa da galeria), os
--    seguidores de fora recebem um Update com o documento novo (Mastodon, Misskey e os outros mostram o nome e a bio de agora).
--    Usa o tipo "update" da fila de sempre, com o objeto "ator:<@nome>" (não um id de post): nenhum tipo novo na regra da tabela,
--    que 20261109-fediverso-total.sql recria. No máximo um pendente por pessoa: várias edições seguidas saem como uma só.
-- 2. Move ENTRANDO: quando uma conta de fora que alguém daqui segue muda de servidor (Move, com o ator novo declarando o antigo em
--    alsoKnownAs), o site segue a conta nova e deixa a antiga, pelas ações de sempre (bloqueios valem). Aqui só a pergunta que
--    falta: quem daqui segue aquele ator (rede_fed_mudanca_servidor, ação "quem_segue", com o segredo).

-- 1. O perfil mudou ──────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function interno.rede_fed_perfil_atualizado() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare a rede_fed_atores; v_objeto text;
begin
  if new.rede_codinome is not distinct from old.rede_codinome and new.rede_codinome_ok is not distinct from old.rede_codinome_ok
     and new.rede_bio is not distinct from old.rede_bio and new.rede_avatar is not distinct from old.rede_avatar
     and new.rede_capa is not distinct from old.rede_capa then
    return null;
  end if;
  select * into a from rede_fed_atores where perfil = new.id and ligado;
  if not found or interno.rede_fed_impedimento(new.id) is not null then return null; end if;
  v_objeto := 'ator:' || a.handle;
  -- Uma edição já está esperando na fila: a entrega monta o documento na hora, então ela já leva o que mudou agora.
  if exists (select 1 from rede_fed_fila q where q.perfil = new.id and q.tipo = 'update' and q.objeto = v_objeto and q.feito_em is null) then return null; end if;
  perform interno.rede_fed_espalhar(new.id, 'update', v_objeto);
  return null;
end $$;
drop trigger if exists rede_fed_perfil_atualizado on interno.perfis;
create trigger rede_fed_perfil_atualizado after update of rede_codinome, rede_codinome_ok, rede_bio, rede_avatar, rede_capa on interno.perfis
  for each row execute function interno.rede_fed_perfil_atualizado();

-- 2. Quem segue um ator (para o Move) ─────────────────────────────────────────────────────────────────────────────────────────
/** Ações (pedem o segredo da federação): quem_segue {ator} → as pessoas daqui que seguem aquele ator (até 2000). */
create or replace function public.rede_fed_mudanca_servidor(p_segredo text, p_acao text, p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_ator text := left(coalesce(p ->> 'ator', ''), 500);
begin
  perform interno.rede_fed_segredo(p_segredo);
  if p_acao <> 'quem_segue' then perform interno.erro('invalido:acao'); end if;
  if v_ator !~ '^https://[^\s]+$' then perform interno.erro('invalido:ator'); end if;
  return coalesce((select jsonb_agg(s.perfil) from (select perfil from rede_fed_seguindo where ator = v_ator order by criado_em limit 2000) s), '[]'::jsonb);
end $$;

-- 3. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_fed_perfil_atualizado() from public;
revoke all on function public.rede_fed_mudanca_servidor(text, text, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_fed_perfil_atualizado() from anon, authenticated;
    -- Como public.rede_fed_servidor: o site chama com a chave pública e o segredo (sem o segredo, a função recusa).
    grant execute on function public.rede_fed_mudanca_servidor(text, text, jsonb) to anon, authenticated, service_role;
  end if;
end $$;
