-- ──────────────────────── Menção: @nome@servidor é gente de fora, não o @nome daqui nem um e-mail ────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Fica no fim do install.sql (depois da espera do chat da equipe, antes do fim da integração). Pode rodar mais de uma vez.
-- Teste: npm run testar:alumia-integracao (a parte "menção de fora").
--
-- O problema (lista do que falta, 17/11): interno.rede3_conv_mencionar achava "@tiao" dentro de "@tiao@mastodon.social" e avisava
-- o @tiao DAQUI, que não foi mencionado (a conta é outra, de outro servidor). Um aviso para a pessoa errada, e um jeito de
-- incomodar alguém daqui escrevendo um endereço de fora. O conserto é só o fim da expressão: depois do nome não pode vir "@".
-- Corpo inteiro (igual ao de 2026-11-rede-conversa.sql com o nome "Alumia" da 20261109-fediverso, só a expressão muda). Sem valor padrão no parâmetro do tipo linha.
--
-- E o mesmo endereço nem chegava a ser publicado: interno.rede3_pub_dado_pessoal tomava "@tiao@mastodon.social" por um e-mail
-- ("tiao@mastodon.social") e rede_publicar recusava com dado_pessoal. Agora, antes da conferência do e-mail, sai do texto o
-- "@nome@servidor" de conta de fora JÁ CONHECIDA (interno.rede_fed_remotos, que a busca do Fediverso preenche). Um endereço que
-- ninguém buscou continua recusado: não há como saber se é conta de fora ou o e-mail de alguém. CPF, telefone, endereço com número
-- e e-mail continuam como antes. A função passa de sql immutable para plpgsql stable (lê a tabela); quem a chama é security
-- definer, então lê com o dono. A triagem da Alumia (interno.rede_triagem) fazia o mesmo engano ("contato") e mandava o post para
-- a revisão: ela também passa a tirar do texto, antes do veredito, só as contas de fora conhecidas (interno.rede_fed_sem_handles).

create or replace function interno.rede3_conv_mencionar(p interno.rede_posts) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_texto text; v_handle text; f perfis;
begin
  if p.autor is null or p.oculto or p.retido or p.apagado_em is not null then return; end if;
  v_texto := lower(coalesce(p.titulo, '') || ' ' || coalesce(p.texto, '') || ' ' || coalesce(p.corpo, ''));
  if position('@' in v_texto) = 0 then return; end if;
  for v_handle in select distinct m[1] from regexp_matches(v_texto, '(?:^|[^a-z0-9_@])@([a-z0-9_]{3,20})(?![a-z0-9_@])', 'g') as m limit 5 loop
    select * into f from perfis where rede_handle = v_handle;
    continue when not found or f.id = p.autor;
    continue when f.rede_modo = 'invisivel' or f.rede_invisivel or f.suspenso;
    continue when not interno.rede2_membro(f.id);
    continue when interno.rede_bloqueado(p.autor, f.id);
    continue when not interno.rede_ve(p, f.id);
    continue when interno.rede_silenciado(p, f.id);
    insert into rede_mencoes (post, mencionado) values (p.id, f.id) on conflict do nothing;
    if found then
      perform interno.rede3_conv_avisar(f.id, 'mencao', p.id, p.id, p.autor, format('%s mencionou você na Alumia: “%s”', interno.rede_nome(p.autor), left(coalesce(p.titulo, p.texto), 100)));
    end if;
  end loop;
end $$;

revoke all on function interno.rede3_conv_mencionar(interno.rede_posts) from public;
revoke all on function interno.rede3_conv_mencionar(interno.rede_posts) from anon, authenticated;

/** O texto sem o "@nome@servidor" das contas de fora já conhecidas (interno.rede_fed_remotos): elas não são e-mail nem contato. */
create or replace function interno.rede_fed_sem_handles(p_texto text) returns text language plpgsql stable set search_path = interno, pg_temp as $$
declare v text := coalesce(p_texto, ''); m text[];
begin
  if position('@' in v) = 0 or to_regclass('interno.rede_fed_remotos') is null then return v; end if;
  for m in select regexp_matches(v, '(?:^|[^A-Za-z0-9_.@-])@([A-Za-z0-9_.-]{1,100}@[A-Za-z0-9.-]{1,200}\.[A-Za-z]{2,})', 'g') loop
    if exists (select 1 from rede_fed_remotos r where lower(r.handle) = lower(m[1])) then
      v := replace(v, '@' || m[1], ' ');
    end if;
  end loop;
  return v;
end $$;

revoke all on function interno.rede_fed_sem_handles(text) from public;
revoke all on function interno.rede_fed_sem_handles(text) from anon, authenticated;

/** Dado pessoal que não vai para a Rede: CPF, telefone e e-mail (a mesma conferência da fundação), mais o endereço com número.
 *  O "@nome@servidor" de conta de fora já conhecida não conta como e-mail. */
create or replace function interno.rede3_pub_dado_pessoal(p_texto text) returns boolean language plpgsql stable set search_path = interno, pg_temp as $$
declare v text := interno.rede_fed_sem_handles(p_texto);
begin
  return v ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}' or v ~ '\(?\d{2}\)?\s?9\d{4}[-\s]?\d{4}'
      or v ~* '[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z.]{2,}' or interno.rede3_pub_tem_endereco(v);
end $$;

revoke all on function interno.rede3_pub_dado_pessoal(text) from public;
revoke all on function interno.rede3_pub_dado_pessoal(text) from anon, authenticated;

/**
 * A triagem de um texto da Alumia antes de aparecer: o veredito automático (interno.veredito) e o modo de segurança (aprovação
 * manual). A segunda avaliação (feita fora, por outra empresa) não entra mais, ligada ou não: "externa" é sempre false.
 * O "@nome@servidor" de conta de fora já conhecida não é "contato": sai do texto antes do veredito (corpo da onda 6, só isso muda).
 */
create or replace function interno.rede_triagem(p_texto text, p_autor uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_av jsonb := interno.veredito(interno.rede_fed_sem_handles(p_texto), interno.cuida(), p_autor); v_ver text := v_av ->> 'veredito'; v_motivo text := coalesce(v_av ->> 'motivo', '');
begin
  if v_ver = 'publicar' and interno.aprovacao_manual() and not interno.cuida() then
    v_ver := 'revisar'; v_motivo := 'modo_seguranca';
  end if;
  return jsonb_build_object('veredito', v_ver, 'motivo', v_motivo, 'externa', false);
end $$;

revoke all on function interno.rede_triagem(text, uuid) from public;
revoke all on function interno.rede_triagem(text, uuid) from anon, authenticated;

select interno.alumia_trancar();
