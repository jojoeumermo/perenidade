-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · a conversa (itens 13 a 21), atrás do interruptor "alumia-p4-conversa".
--
-- Roda depois de 20261126-p5-fim.sql (banco na versão 17), junto das outras 20261127-p4-*; quem junta põe esta antes do
-- 20261127-p4-fim.sql, que continua o último. Não mexe em rede_alumia_versao nem na lista de exceções da porta.
--
-- O que faz: quase nada no banco, de propósito. A foto de ver uma vez, o freio de encaminhamento, as notas para mim, as pastas, o
-- envio agendado, o "quem leva o quê" e os tópicos do grupo e a transcrição da nota de voz moram no APARELHO e viajam DENTRO do
-- cifrado do chat (o servidor não fica sabendo nem de que tipo é a mensagem). Aqui ficam só:
--   0   o interruptor, no catálogo (só pelo nome, desligado);
--   17  Não perturbe com horário só no aparelho: com o interruptor ligado, o servidor deixa de segurar o push pela janela guardada
--       (interno.alumia_em_silencio responde "não" sempre) e não aceita guardar janela nova (o gatilho barra inserir e mudar; tirar
--       continua valendo, e é o que a tela faz ao levar a janela antiga para o aparelho). A janela passa a ficar no aparelho
--       (lib/rede/avisos/silencio-no-aparelho.ts) e o service worker (public/sw.js) mostra o aviso sem som nem vibração dentro
--       dela. O push continua o de sempre: só o número e o idioma, nunca texto nem nome. Com o interruptor desligado, tudo como antes.
--
-- Função existente redefinida (corpo inteiro tirado do banco montado, versão 18; muda só a primeira condição):
--   interno.alumia_em_silencio(uuid, timestamptz).
-- Funções novas: interno.rede_p4_conversa_ligada() e interno.rede_p4_conversa_silencio_barrar() (do gatilho). Nenhuma pública.
--
-- Tabelas em interno, RLS ligada e sem política, nenhuma permissão direta. Nenhuma função devolve lista de pessoas. Endereço de
-- rede: nada daqui lê ou guarda. Pode rodar mais de uma vez, sem apagar dado nenhum.
-- Lei: LGPD art. 6º, III (necessidade: o servidor deixa de guardar o que o aparelho pode guardar sozinho).
-- Teste: npm run testar:p4-conversa.

-- ── 0. O interruptor ───────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-conversa', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

/** O lote da conversa do prompt 4 está ligado? Desligado com a Alumia (rede-v2, alumia-2) desligada; sem decisão no painel, desligado. */
create or replace function interno.rede_p4_conversa_ligada() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-p4-conversa'), false);
end $$;

-- ── 17. Não perturbe só no aparelho ────────────────────────────────────────────────────────────────────────────────────────

/**
 * A pessoa está no horário de silêncio neste momento? (Minutos do dia no horário universal.) Com o lote da conversa ligado, nunca:
 * a janela mora no aparelho e quem silencia é o próprio aparelho (o servidor manda o push de sempre, sem texto).
 */
create or replace function interno.alumia_em_silencio(p_usuario uuid, p_quando timestamptz default now()) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select not interno.rede_p4_conversa_ligada() and coalesce((
    select case when s.inicio < s.fim then m >= s.inicio and m < s.fim else m >= s.inicio or m < s.fim end
      from rede_avisos_silencio s,
           lateral (select (extract(hour from p_quando at time zone 'UTC') * 60 + extract(minute from p_quando at time zone 'UTC'))::integer as m) agora
     where s.usuario = p_usuario), false)
$$;

/** Com o lote da conversa ligado, o servidor não guarda janela nova (tirar a antiga continua valendo). */
create or replace function interno.rede_p4_conversa_silencio_barrar() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if interno.rede_p4_conversa_ligada() then perform interno.erro('silencio_no_aparelho'); end if;
  return new;
end $$;

drop trigger if exists rede_p4_conversa_silencio_no_aparelho on interno.rede_avisos_silencio;
create trigger rede_p4_conversa_silencio_no_aparelho before insert or update on interno.rede_avisos_silencio
  for each row execute function interno.rede_p4_conversa_silencio_barrar();

revoke all on function interno.rede_p4_conversa_ligada(), interno.rede_p4_conversa_silencio_barrar() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_p4_conversa_ligada(), interno.rede_p4_conversa_silencio_barrar() from anon, authenticated;
  end if;
end $$;

select interno.alumia_trancar();
