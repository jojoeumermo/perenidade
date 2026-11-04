-- ───────────────────────────── Rede Lúcia v2: integração ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de todas as outras migrações rede
-- (fundacao, consertos, perfil, publicar, conversa, descoberta, comunidades, avisos, moderacao). Só amarra pontas soltas que os
-- pacotes deixaram entre si; nenhuma tabela nova. Documento: docs/rede/V2.md (seção "Pendências para a coordenação").
--
-- 1. Idade mínima (18) também em seguir, bloquear e seguir comunidade, na Rede de hoje e na v2: os pacotes que redefinem
--    rede_seguir, rede_bloquear e rede_comunidade_seguir não receberam interno.rede_fix_idade; o gatilho vale para qualquer
--    versão dessas funções. Quem declarou menos de 18 anos não grava nada na Rede (LGPD art. 14; ECA Digital art. 9º).
--    Visitante (sem conta) e gravação feita pelo banco (migração, serviço) passam: interno.rede_fix_idade deixa passar
--    quando não há sessão.

create or replace function interno.rede_int_idade() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.rede_fix_idade(false);
  return new;
end $$;
revoke all on function interno.rede_int_idade() from public, anon, authenticated;

do $$ begin
  if to_regprocedure('interno.rede_fix_idade(boolean)') is not null then
    drop trigger if exists rede_int_idade on interno.rede_seguindo;
    create trigger rede_int_idade before insert on interno.rede_seguindo for each row execute function interno.rede_int_idade();
    drop trigger if exists rede_int_idade on interno.rede_bloqueios;
    create trigger rede_int_idade before insert on interno.rede_bloqueios for each row execute function interno.rede_int_idade();
    drop trigger if exists rede_int_idade on interno.rede_comunidades_seguidas;
    create trigger rede_int_idade before insert on interno.rede_comunidades_seguidas for each row execute function interno.rede_int_idade();
  end if;
end $$;
