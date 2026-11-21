-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · item 136: o post cifrado da comunidade fechada não leva anexo aberto.
--
-- O que estava errado: no post cifrado (P21), só o texto era cifrado no aparelho. A imagem e o áudio anexados iam abertos para o
-- depósito, e public.rede_publicar recusava só a descrição da imagem. Quem tivesse acesso ao depósito ouvia o áudio e via a imagem
-- de um post que a autora achava cifrado.
--
-- O que muda:
--   1. public.rede_publicar recusa ('invalido:grupo') o post cifrado com qualquer imagem ou áudio, antes de gravar.
--   2. Uma regra nas próprias tabelas dos anexos (interno.rede_midia, interno.rede_audios, interno.rede_post_videos e
--      interno.rede_audio_transcricoes): nenhuma linha liga um anexo a um post cifrado, venha de qual função vier (as que embrulham o
--      rede_publicar, o vídeo que se liga depois de publicar, a transcrição aprovada depois).
-- O que já estava no banco antes (anexo aberto de post cifrado) não é apagado aqui: a contagem vai para a coordenação decidir.
-- Roda depois de 20261126-p5-fim.sql (banco na versão 17). Não mexe na versão nem na lista da porta: o 20261127-p4-fim.sql faz isso.
-- Pode rodar mais de uma vez. Endereço de rede: nada daqui lê ou guarda.
-- Lei: LGPD art. 46 (segurança: o que a pessoa escolheu cifrar não fica aberto no servidor) e art. 6º, VII (prevenção).

-- ── 1. A conferência do rede_publicar ──────────────────────────────────────────────────────────────────────────────────────
do $$
declare v_def text; v_novo text;
  v_marca constant text := 'or (p ? ''previa'' and jsonb_typeof(p -> ''previa'') = ''object'')';
begin
  v_def := pg_get_functiondef('public.rede_publicar(jsonb)'::regprocedure);
  if position('-- p4-136: sem anexo aberto' in v_def) > 0 then return; end if;
  v_novo := replace(v_def, v_marca, v_marca || E'\n       -- p4-136: sem anexo aberto\n       or jsonb_array_length(v_midia) > 0 or v_audio is not null');
  if v_novo = v_def then
    raise exception 'public.rede_publicar mudou de forma: a conferência do post cifrado não foi achada';
  end if;
  execute v_novo;
end $$;

-- ── 2. A regra nas tabelas dos anexos ──────────────────────────────────────────────────────────────────────────────────────
create or replace function interno.rede_p4_anexo_sem_cifra() returns trigger language plpgsql
set search_path = interno, pg_temp as $$
begin
  if new.post is not null and exists (select 1 from interno.rede_posts p where p.id = new.post and p.corpo_grupo is not null) then
    perform interno.erro('invalido:grupo');
  end if;
  return new;
end $$;
revoke all on function interno.rede_p4_anexo_sem_cifra() from public;

do $$
declare t text;
begin
  foreach t in array array['rede_midia', 'rede_audios', 'rede_post_videos', 'rede_audio_transcricoes'] loop
    if to_regclass('interno.' || t) is not null then
      execute format('drop trigger if exists p4_anexo_sem_cifra on interno.%I', t);
      execute format('create trigger p4_anexo_sem_cifra before insert or update of post on interno.%I
                      for each row execute function interno.rede_p4_anexo_sem_cifra()', t);
    end if;
  end loop;
end $$;

-- ── 3. O que já estava aberto (só a contagem, para a coordenação) ──────────────────────────────────────────────────────────
/** Quantos anexos abertos já estavam ligados a posts cifrados antes desta migração. Só números, nenhum caminho nem autor. */
create or replace function interno.rede_p4_anexos_abertos_antigos() returns jsonb language sql stable
set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'imagens', (select count(*) from interno.rede_midia m join interno.rede_posts p on p.id = m.post where p.corpo_grupo is not null),
    'audios', (select count(*) from interno.rede_audios a join interno.rede_posts p on p.id = a.post where p.corpo_grupo is not null),
    'videos', (select count(*) from interno.rede_post_videos v join interno.rede_posts p on p.id = v.post where p.corpo_grupo is not null))
$$;
revoke all on function interno.rede_p4_anexos_abertos_antigos() from public;

select interno.alumia_trancar();
