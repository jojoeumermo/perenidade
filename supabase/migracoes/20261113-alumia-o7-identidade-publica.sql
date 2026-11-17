-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · Identidade pública opcional (13/11/2026) ═══════════════════════════
-- Decisão da coordenação (12/11/2026): codinome e rosto em mosaico deixam de ser a única forma de aparecer. Quem quiser pode
-- aparecer com nome e foto de verdade. O padrão continua protegido (codinome); ser público é escolha consciente, nunca empurrada,
-- e dá para voltar a qualquer hora.
--
-- Como funciona:
--   1. perfis.rede_identidade: 'codinome' (como nasce) ou 'publica'. Em 'publica', o nome que a pessoa escreveu passa a ser o nome
--      mostrado (perfis.rede_codinome, que TODA função da rede já lê: linha, post, perfil, busca, menção, aviso, conversa, story)
--      e o codinome de antes fica guardado em perfis.rede_codinome_reserva, à espera da volta. Ninguém pega o codinome guardado.
--   2. A foto é a "foto enviada" do perfil que a rede já tem (perfis.rede_avatar = 'envio', rede_avatar_dados): WebP reencodado no
--      navegador, conferido byte a byte no banco (interno.rede3_perfil_webp_ok: sem EXIF, XMP, perfil de cor nem animação) e só
--      mostrada aos outros depois que a mediação aceita (a mesma fila de rede_perfil_imagens_fila). Só quem tem conta vê.
--   3. Voltar ao codinome (rede_identidade_codinome): devolve o codinome guardado, APAGA a foto do banco e troca o nome nas cópias
--      que o servidor guarda (o texto dos avisos que a pessoa gerou). Não depende do interruptor nem de ser membro: voltar é sempre
--      possível. Quem viu "Nome (@fulana)" sabe para sempre que @fulana é aquele nome: por isso a volta pode trocar o @ também
--      (p_novo_handle), sem a espera de 30 dias da troca comum. A tela oferece isso, marcado, a quem não federa.
--   4. Interruptor no banco (interno.configuracoes, chave 'alumia_identidade_publica'): nasce DESLIGADO. Desligado, ninguém passa a
--      público nem envia foto, e as fotos de quem está em público param de ser entregues por TODOS os caminhos
--      (rede_identidade_foto, rede_identidade_de e as funções antigas do rosto, rede_perfil_imagem e rede_perfil_avatares, que esta
--      migração refaz); quem já é público pode voltar. Liga com
--        select interno.alumia_identidade_publica_ligar(true);
--      ou, pela coordenação com sessão, public.alumia_identidade_publica_ligar(true). Não há chave em lib/recursos.ts: a tela pergunta
--      ao banco (public.identidade_publica_aberta) e, desligada, não oferece nada nem busca foto.
--
-- Idade: só membro da rede muda a identidade (interno.rede3_perfil_exige_membro: 18 anos ou mais, consentimento em vigor), a
-- regra mais restrita que a rede já tem. Conta de organização não usa isto (o nome dela já é público).
--
-- Leis (conferidas no texto):
--  - LGPD (Lei 13.709/2018) art. 6º, I e III (finalidade e necessidade): nome e foto só existem aqui porque a pessoa escreveu e
--    enviou; nada é copiado do cadastro, do painel ou de outro serviço. Art. 8º, § 5º, e art. 18, VI e IX: a escolha é revogável a
--    qualquer momento, por procedimento gratuito e fácil, e o que foi enviado é eliminado na volta.
--  - LGPD art. 46: RLS ligada, nenhuma permissão direta nas tabelas; acesso só por função security definer.
--  - ECA Digital (Lei 15.211/2025) art. 9º, § 1º: a rede é para maiores de 18; perfil público segue a mesma trava.
--
-- Idempotente (scripts/testar-alumia-identidade.mjs roda duas vezes no banco local). Roda DEPOIS de 20261112-alumia-portas.sql.
-- NÃO rodar em produção sem o Jonathan.

-- ── 1. Colunas ────────────────────────────────────────────────────────────────────────────────────────────────────────────
alter table interno.perfis add column if not exists rede_identidade text not null default 'codinome';
alter table interno.perfis add column if not exists rede_codinome_reserva text;
-- Só o dia em que a pessoa passou a aparecer com o nome (para ela mesma ver); nada de hora.
alter table interno.perfis add column if not exists rede_identidade_dia date;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfis_rede_identidade_valor') then
    alter table interno.perfis add constraint perfis_rede_identidade_valor check (rede_identidade in ('codinome', 'publica'));
  end if;
  -- Pública tem sempre um codinome guardado para a volta; em codinome não sobra nada guardado.
  if not exists (select 1 from pg_constraint where conname = 'perfis_rede_identidade_reserva') then
    alter table interno.perfis add constraint perfis_rede_identidade_reserva check ((rede_identidade = 'publica') = (rede_codinome_reserva is not null));
  end if;
  -- Codinome continua único entre codinomes. Nome de verdade pode repetir (há mais de uma Maria Silva): o @nome é que distingue.
  if not exists (select 1 from pg_indexes where schemaname = 'interno' and indexname = 'perfis_rede_codinome_unico' and indexdef like '%rede_identidade%') then
    drop index if exists interno.perfis_rede_codinome_unico;
    create unique index perfis_rede_codinome_unico on interno.perfis (interno.rede_chave(rede_codinome)) where rede_codinome is not null and rede_identidade = 'codinome';
  end if;
end $$;
create unique index if not exists perfis_rede_codinome_reserva_unico on interno.perfis (interno.rede_chave(rede_codinome_reserva)) where rede_codinome_reserva is not null;

-- ── 2. O interruptor ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** A identidade pública está ligada? Nasce desligada. */
create or replace function interno.alumia_identidade_publica_ligada() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select (valor ->> 'ligada')::boolean from configuracoes where chave = 'alumia_identidade_publica'), false)
$$;

/** Liga ou desliga (SQL Editor). Desligar não muda o perfil de ninguém: só fecha a porta para novas escolhas e para as fotos. */
create or replace function interno.alumia_identidade_publica_ligar(p_ligar boolean default true) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  insert into configuracoes (chave, valor) values ('alumia_identidade_publica', jsonb_build_object('ligada', coalesce(p_ligar, false)))
  on conflict (chave) do update set valor = excluded.valor;
  if auth.uid() is not null then
    perform interno.registrar('alumia_identidade_publica', '', jsonb_build_object('ligada', coalesce(p_ligar, false)));
  end if;
  return jsonb_build_object('ligada', coalesce(p_ligar, false), 'publicas', (select count(*) from perfis where rede_identidade = 'publica'));
end $$;

/** O mesmo interruptor para o painel: só a coordenação (e a vice), com sessão. */
create or replace function public.alumia_identidade_publica_ligar(p_ligar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return interno.alumia_identidade_publica_ligar(p_ligar);
end $$;

/**
 * Só o sim ou não do interruptor, para a tela saber se oferece a escolha. Responde também a quem ainda não tem conta (o cadastro
 * pergunta antes de mostrar a opção) e, por isso, fica fora do prefixo que a porta da entrada tranca: não devolve dado de ninguém.
 */
create or replace function public.identidade_publica_aberta() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.alumia_identidade_publica_ligada()
$$;

-- ── 3. O codinome guardado é de quem guardou ──────────────────────────────────────────────────────────────────────────────

/** Um codinome livre (troca a da fundação): além dos codinomes em uso, não devolve um que esteja guardado por quem está em público. */
create or replace function interno.rede_codinome_livre(p_pedido text default null) returns text language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v text := interno.codinome(p_pedido); i integer;
begin
  for i in 1..80 loop
    exit when not exists (select 1 from perfis where interno.rede_chave(rede_codinome) = interno.rede_chave(v) or interno.rede_chave(rede_codinome_reserva) = interno.rede_chave(v));
    v := interno.codinome(null);
  end loop;
  return v;
end $$;

/**
 * Ninguém passa a usar, como codinome, o codinome que outra pessoa guardou para a volta (qualquer caminho que grave o codinome).
 * E quem está em público só troca o nome mostrado pela porta da identidade (rede_identidade_publicar, que marca a transação):
 * a troca de codinome de sempre (rede_codinome_definir) não vale enquanto o nome é o de verdade.
 */
create or replace function interno.alumia_identidade_guarda() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if tg_op = 'UPDATE' and old.rede_identidade = 'publica' and new.rede_identidade = 'publica' and new.rede_codinome is distinct from old.rede_codinome
     and coalesce(current_setting('alumia.identidade_troca', true), '') <> '1' then
    perform interno.erro('identidade_nome_travado');
  end if;
  if new.rede_codinome is not null and new.rede_identidade = 'codinome'
     and (tg_op = 'INSERT' or new.rede_codinome is distinct from old.rede_codinome or new.rede_identidade is distinct from old.rede_identidade)
     and exists (select 1 from perfis o where o.id <> new.id and o.rede_codinome_reserva is not null
                 and interno.rede_chave(o.rede_codinome_reserva) = interno.rede_chave(new.rede_codinome)) then
    perform interno.erro('codinome_usado');
  end if;
  return new;
end $$;
drop trigger if exists alumia_identidade_guarda on interno.perfis;
create trigger alumia_identidade_guarda before insert or update of rede_codinome, rede_identidade on interno.perfis
  for each row execute function interno.alumia_identidade_guarda();

-- ── 4. Ler a minha identidade ─────────────────────────────────────────────────────────────────────────────────────────────

/** A pessoa ligou o Fediverso? (lê a tabela da federação só se ela existir; quem cuida dela é a outra frente.) */
create or replace function interno.alumia_identidade_federa(p_id uuid) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v boolean := false;
begin
  if to_regclass('interno.rede_fed_atores') is null then return false; end if;
  begin
    execute 'select exists (select 1 from interno.rede_fed_atores where perfil = $1 and ligado)' into v using p_id;
  exception when others then v := false;
  end;
  return coalesce(v, false);
end $$;

/** O que a própria pessoa vê da sua identidade (só ela): modo, nome, codinome (o em uso ou o guardado), foto e o interruptor. */
create or replace function interno.alumia_identidade_minha(p_id uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'modo', f.rede_identidade,
    'nome', case when f.rede_identidade = 'publica' then f.rede_codinome end,
    'codinome', case when f.rede_identidade = 'publica' then f.rede_codinome_reserva else f.rede_codinome end,
    'foto', case when f.rede_identidade = 'publica' and f.rede_avatar = 'envio' and f.rede_avatar_dados is not null
                 then jsonb_build_object('dados', f.rede_avatar_dados, 'pendente', not f.rede_avatar_ok) end,
    'desde', f.rede_identidade_dia,
    'disponivel', interno.alumia_identidade_publica_ligada() and not exists (select 1 from rede_orgs o where o.perfil = f.id),
    'federa', interno.alumia_identidade_federa(f.id))
  from perfis f where f.id = p_id
$$;

create or replace function public.rede_identidade_minha() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return interno.alumia_identidade_minha(v);
end $$;

-- ── 5. Passar a público, trocar o nome, voltar ────────────────────────────────────────────────────────────────────────────

/** Troca o nome no começo dos avisos que esta pessoa gerou ("Fulana respondeu…"): a cópia do nome que o servidor guarda. */
create or replace function interno.alumia_identidade_trocar_nome(p_quem uuid, p_antes text, p_novo text) returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare n integer := 0;
begin
  if p_quem is null or coalesce(p_antes, '') = '' or coalesce(p_novo, '') = '' or p_antes = p_novo then return 0; end if;
  update avisos set texto = left(p_novo || substr(texto, char_length(p_antes) + 1), 500)
   where ator = p_quem and categoria = 'rede' and left(texto, char_length(p_antes) + 1) = p_antes || ' ';
  get diagnostics n = row_count;
  return n;
end $$;

/**
 * Passar a aparecer com nome de verdade (ou trocar esse nome, se já é pública). p_ciente tem de vir verdadeiro: a tela mostra o
 * que muda e quem passa a ver antes de mandar. O nome: 2 a 60 caracteres, letras, espaço, ponto, apóstrofo e hífen; sem endereço
 * nem @; não pode se passar pelo Instituto nem pela equipe (a lista de nomes reservados); não pode ser o codinome em uso de outra
 * pessoa; e passa pela mesma triagem de abuso da bio. Nomes de verdade podem repetir entre si. A resposta nunca diz se um nome
 * é o nome da conta de alguém nem se é o codinome que alguém guardou (seria um oráculo de quem é quem): o codinome guardado
 * recebe o mesmo "invalido:nome" de um nome torto.
 */
create or replace function public.rede_identidade_publicar(p_nome text, p_ciente boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); f perfis;
  v_nome text := btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'));
  v_chave text;
begin
  perform interno.aberta('comunidade');
  perform interno.rede3_perfil_exige_membro(v);
  if not interno.alumia_identidade_publica_ligada() then perform interno.erro('identidade_desligada'); end if;
  if exists (select 1 from rede_orgs o where o.perfil = v) then perform interno.erro('identidade_org'); end if;
  if not coalesce(p_ciente, false) then perform interno.erro('confirme_ciencia'); end if;
  perform interno.limite('alumia_identidade', 8, 1440);
  if char_length(v_nome) < 2 or char_length(v_nome) > 60 or v_nome !~ '^[[:alpha:]][[:alpha:] .''’-]*[[:alpha:].]$' or v_nome ~* '(https?|www\.)' then
    perform interno.erro('invalido:nome');
  end if;
  v_chave := interno.rede_chave(v_nome);
  if v_chave ~ '(instituto lucia|alumia|moderac|mediac|coordenac|administra|equipe oficial|suporte)' then perform interno.erro('nome_reservado'); end if;
  -- O codinome em uso é público (aparece em todo post): dizer que está em uso não revela nada.
  if exists (select 1 from perfis o where o.id <> v and o.rede_identidade = 'codinome' and interno.rede_chave(o.rede_codinome) = v_chave) then
    perform interno.erro('nome_usado');
  end if;
  if exists (select 1 from perfis o where o.id <> v and interno.rede_chave(o.rede_codinome_reserva) = v_chave) then
    perform interno.erro('invalido:nome');
  end if;
  if (interno.veredito(v_nome, false, v) ->> 'veredito') <> 'publicar' then perform interno.erro('invalido:nome'); end if;

  select * into f from perfis where id = v for update;
  -- Marca a transação: só daqui o nome de quem está em público muda (interno.alumia_identidade_guarda).
  perform set_config('alumia.identidade_troca', '1', true);
  if f.rede_identidade = 'publica' then
    update perfis set rede_codinome = v_nome where id = v;
  else
    update perfis set rede_identidade = 'publica', rede_codinome_reserva = f.rede_codinome, rede_codinome = v_nome, rede_identidade_dia = current_date where id = v;
  end if;
  perform set_config('alumia.identidade_troca', '', true);
  perform interno.alumia_identidade_trocar_nome(v, f.rede_codinome, v_nome);
  -- O registro guarda só que a escolha mudou, nunca o nome.
  perform interno.registrar('rede_identidade', '', jsonb_build_object('modo', 'publica'));
  return interno.alumia_identidade_minha(v);
end $$;

/**
 * Voltar ao codinome, a qualquer hora: não pede ser membro nem o interruptor ligado. O codinome guardado volta (se, por acidente,
 * estiver em uso, vem um novo e a resposta avisa em `codinome_trocado`), a foto enviada é APAGADA do banco e o nome sai dos
 * avisos que a pessoa gerou. Daí em diante toda leitura da rede devolve o codinome e o rosto em mosaico.
 * p_novo_handle (opcional): troca o @ junto, para desfazer a ligação entre o nome e o @ que ficou na memória de quem viu. Segue as
 * regras do @ (3 a 20 de [a-z0-9_], único, sem imitar a equipe), mas sem a espera de 30 dias. Não vale para quem federa (trocar
 * o @ seria trocar o endereço do ator no Fediverso: "handle_federado").
 */
drop function if exists public.rede_identidade_codinome();
create or replace function public.rede_identidade_codinome(p_novo_handle text default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis; v_cod text; v_trocado boolean := false; h text := nullif(lower(btrim(coalesce(p_novo_handle, ''), ' @')), '');
begin
  perform interno.limite('alumia_identidade_voltar', 20, 60);
  select * into f from perfis where id = v for update;
  if f.rede_identidade is distinct from 'publica' then return interno.alumia_identidade_minha(v); end if;
  if h is not null and h is distinct from f.rede_handle then
    if interno.alumia_identidade_federa(v) then perform interno.erro('handle_federado'); end if;
    if h !~ '^[a-z0-9_]{3,20}$' then perform interno.erro('invalido:handle'); end if;
    if h ~ '(instituto|lucia|equipe|coordena|modera|admin|suporte|oficial)' then perform interno.erro('handle_reservado'); end if;
    if exists (select 1 from perfis o where o.rede_handle = h and o.id <> v) then perform interno.erro('handle_usado'); end if;
    update perfis set rede_handle = h, rede_handle_em = now() where id = v;
  end if;
  v_cod := f.rede_codinome_reserva;
  if v_cod is null or exists (select 1 from perfis o where o.id <> v and o.rede_identidade = 'codinome' and interno.rede_chave(o.rede_codinome) = interno.rede_chave(v_cod)) then
    v_cod := interno.rede_codinome_livre(null);
    v_trocado := true;
  end if;
  update perfis set rede_identidade = 'codinome', rede_codinome = v_cod, rede_codinome_reserva = null, rede_identidade_dia = null,
    rede_avatar = case when rede_avatar = 'envio' then null else rede_avatar end, rede_avatar_dados = null, rede_avatar_ok = false
   where id = v;
  perform interno.alumia_identidade_trocar_nome(v, f.rede_codinome, v_cod);
  perform interno.registrar('rede_identidade', '', jsonb_build_object('modo', 'codinome'));
  return interno.alumia_identidade_minha(v) || jsonb_build_object('codinome_trocado', v_trocado, 'handle', (select rede_handle from perfis where id = v));
end $$;

-- ── 6. A foto ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Envia (ou troca) a foto de quem está em público. p_dados: data URL WebP já recortada e reencodada no navegador (o canvas não leva
 * EXIF, GPS, modelo da câmera nem data). O banco confere os bytes de novo: só WebP simples, sem EXIF, XMP, perfil de cor nem
 * animação, até 40 mil caracteres. Fica pendente até a mediação aceitar (a mesma fila das outras imagens de perfil); até lá só a
 * própria pessoa vê. Dez envios por dia (o mesmo contador das imagens de perfil).
 */
create or replace function public.rede_identidade_foto_enviar(p_dados text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  perform interno.rede3_perfil_exige_membro(v);
  if not interno.alumia_identidade_publica_ligada() then perform interno.erro('identidade_desligada'); end if;
  if not exists (select 1 from perfis where id = v and rede_identidade = 'publica') then perform interno.erro('identidade_codinome'); end if;
  perform interno.limite('rede_perfil_imagem', 10, 1440);
  if not interno.rede3_perfil_webp_ok(p_dados, 40000) then perform interno.erro('invalido:imagem'); end if;
  update perfis set rede_avatar = 'envio', rede_avatar_dados = p_dados, rede_avatar_ok = interno.cuida() where id = v;
  return interno.alumia_identidade_minha(v);
end $$;

/** Apaga a foto (some do banco na hora). Sempre possível. O rosto volta a ser o mosaico. */
create or replace function public.rede_identidade_foto_remover() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update perfis set rede_avatar = case when rede_avatar = 'envio' then null else rede_avatar end, rede_avatar_dados = null, rede_avatar_ok = false where id = v;
  return interno.alumia_identidade_minha(v);
end $$;

-- ── 7. O que os outros veem ───────────────────────────────────────────────────────────────────────────────────────────────

/** Quem chama pode ver a identidade pública desta pessoa? (a matriz do perfil: suspensa, invisível e bloqueio = não.) */
create or replace function interno.alumia_identidade_visivel(f interno.perfis, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select f.rede_identidade = 'publica' and not f.suspenso
     and (f.id = p_quem or not (f.rede_modo = 'invisivel' or f.rede_invisivel))
     and not interno.rede_bloqueado(p_quem, f.id)
$$;

/**
 * Dos @nomes pedidos (até 60), quais estão em identidade pública, e o carimbo da foto de cada um ({"foto": "ab12cd34"} ou nulo).
 * O carimbo muda quando a foto muda: a tela busca a foto uma vez por carimbo. Foto pendente só para a própria pessoa. Com o
 * interruptor desligado nenhuma foto é anunciada. Só para quem tem conta.
 */
create or replace function public.rede_identidade_de(p_handles text[]) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_ligada boolean := interno.alumia_identidade_publica_ligada();
begin
  if v is null then return '{}'::jsonb; end if;
  return coalesce((
    select jsonb_object_agg(f.rede_handle, jsonb_build_object('foto',
      case when v_ligada and f.rede_avatar = 'envio' and f.rede_avatar_dados is not null and (f.rede_avatar_ok or f.id = v) then left(md5(f.rede_avatar_dados), 8) end))
    from perfis f
    where f.rede_handle in (select lower(btrim(h, ' @')) from unnest((coalesce(p_handles, '{}'::text[]))[1:60]) h)
      and interno.alumia_identidade_visivel(f, v)), '{}'::jsonb);
end $$;

/** A foto pública de um @nome, em data URL; nula se não houver, não estiver aceita, a pessoa não estiver em público ou quem chama não puder ver. */
create or replace function public.rede_identidade_foto(p_handle text) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); f perfis;
begin
  if v is null or not interno.alumia_identidade_publica_ligada() then return null; end if;
  select * into f from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if not found or not interno.alumia_identidade_visivel(f, v) then return null; end if;
  return case when f.rede_avatar = 'envio' and (f.rede_avatar_ok or f.id = v) then f.rede_avatar_dados end;
end $$;

/**
 * As funções antigas do rosto (o perfil da rede, de antes desta onda) entregavam a foto enviada sem olhar o interruptor. Refeitas
 * aqui com a mesma regra de antes e uma a mais: de quem está em identidade pública, com o interruptor desligado, a foto não sai
 * (o rosto volta ao mosaico; nem a própria pessoa recebe, como em rede_identidade_foto). O resto (galeria, capa, quem não é
 * público) fica como era.
 */
create or replace function public.rede_perfil_avatares(p_usuarios uuid[]) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_object_agg(f.id::text, to_jsonb(f.rede_avatar)), '{}'::jsonb)
  from perfis f
  where f.id = any ((coalesce(p_usuarios, '{}'::uuid[]))[1:60])
    and not f.suspenso
    and (f.id = auth.uid() or not (f.rede_modo = 'invisivel' or f.rede_invisivel))
    and not interno.rede_bloqueado(auth.uid(), f.id)
    and (f.rede_avatar ~ '^a[0-9]{2}$'
         or (f.rede_avatar = 'envio' and f.rede_avatar_dados is not null and auth.uid() is not null and (f.rede_avatar_ok or f.id = auth.uid())
             and (f.rede_identidade is distinct from 'publica' or interno.alumia_identidade_publica_ligada())))
$$;

create or replace function public.rede_perfil_imagem(p_usuario uuid, p_tipo text default 'avatar') returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); f perfis;
begin
  if v is null or p_tipo not in ('avatar', 'capa') then return null; end if;
  select * into f from perfis where id = p_usuario;
  if not found or f.suspenso or (f.id <> v and (f.rede_modo = 'invisivel' or f.rede_invisivel or interno.rede_bloqueado(v, f.id))) then return null; end if;
  if p_tipo = 'avatar' then
    if f.rede_identidade = 'publica' and not interno.alumia_identidade_publica_ligada() then return null; end if;
    return case when f.rede_avatar = 'envio' and (f.rede_avatar_ok or f.id = v) then f.rede_avatar_dados end;
  else
    return case when f.rede_capa = 'envio' and (f.rede_capa_ok or f.id = v) then f.rede_capa_dados end;
  end if;
end $$;

-- ── 8. Permissões e a porta da entrada ────────────────────────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['interno.alumia_identidade_publica_ligada()', 'interno.alumia_identidade_publica_ligar(boolean)', 'interno.alumia_identidade_guarda()',
    'interno.alumia_identidade_federa(uuid)', 'interno.alumia_identidade_minha(uuid)', 'interno.alumia_identidade_trocar_nome(uuid, text, text)',
    'interno.alumia_identidade_visivel(interno.perfis, uuid)',
    'public.alumia_identidade_publica_ligar(boolean)', 'public.rede_identidade_minha()', 'public.rede_identidade_publicar(text, boolean)',
    'public.rede_identidade_codinome(text)', 'public.rede_identidade_foto_enviar(text)', 'public.rede_identidade_foto_remover()',
    'public.rede_identidade_de(text[])', 'public.rede_identidade_foto(text)', 'public.identidade_publica_aberta()'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.alumia_identidade_publica_ligar(boolean), public.rede_identidade_minha(), public.rede_identidade_publicar(text, boolean),
      public.rede_identidade_codinome(text), public.rede_identidade_foto_enviar(text), public.rede_identidade_foto_remover(),
      public.rede_identidade_de(text[]), public.rede_identidade_foto(text) to authenticated, service_role;
    grant execute on function public.identidade_publica_aberta() to anon, authenticated, service_role;
  end if;
  -- Função nova nasce sem a porta da entrada: a regra de 20261112-alumia-portas.sql tranca as daqui (e qualquer outra que falte).
  if to_regprocedure('interno.alumia_trancar()') is not null then
    perform interno.alumia_trancar();
  end if;
end $$;
