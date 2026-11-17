-- ─────────────── Alumia · Onda 9 · 9F · o que a onda 8 deixou (15/11/2026) ───────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Cinco consertos, decididos pela coordenação no fim da onda 8:
--
--   1. A PORTA SEM TERCEIRO. Entrar, reenviar a confirmação e pedir a senha nova passam pelo servidor do site, com a prova de
--      trabalho e o freio da porta de entrada (20261114-alumia-o8-porta.sql). Aqui: o freio por rede desses dois momentos novos
--      ("entrar" e "aviso"), no mesmo banco de desafios gastos e no mesmo resumo por hora (nunca o endereço, nunca a impressão).
--      E o bloqueio por tentativas erradas na CONTA no banco (10 erros em 15 minutos), pelo site e, com o gancho do serviço de
--      contas ligado, também pelo caminho direto da API (que pula o site).
--   2. NENHUM ENDEREÇO DE REDE SAI. public.conta_atividade deixa de devolver o endereço que o serviço de contas anotou.
--   3. NADA DA ALUMIA VAI PARA AVALIAÇÃO DE FORA. A "segunda avaliação" (a função avaliar-comunidade, que manda o texto a um serviço
--      de outra empresa) não recebe post da Alumia, ligada ou não: a triagem nunca marca post para ela, a entrega do texto devolve
--      nada para o tipo 'rede' e a lista de pendentes não traz post. Post que já esperava por ela vai para a leitura da equipe.
--   4. SAIR SÓ DA ALUMIA. public.rede_meusdados_sair: com o segundo fator e o @ escrito, a pessoa sai da rede (perfil, posts,
--      stories, mídias, quem segue e quem é seguido, comunidades, chat, federação) com os mesmos 7 dias de arrependimento, e a conta
--      do Instituto fica. public.conta_apagar (apagar a conta do site inteiro) passa a deixar "[post apagado]" no lugar do que
--      outras pessoas responderam ou citaram, como o apagar da Alumia já fazia, em vez de levar as respostas delas junto.
--   5. VOTO, O PASSO SEGUINTE (docs/rede/VOTO-SECRETO.md):
--      · consulta à base: a cédula pode chegar CIFRADA no aparelho com a chave pública da consulta (ECDH P-256 + HKDF-SHA-256 +
--        AES-256-GCM da Web Crypto). A chave privada não mora no banco: o servidor do site a deriva do segredo dele, por consulta,
--        e só abre as cédulas com a consulta fechada, todas de uma vez (rede_consulta_cifradas → rede_consulta_cedulas);
--      · votação secreta da equipe: quem votou deixa de ficar às claras. O banco guarda só a marca HMAC (segredo do servidor) da
--        pessoa naquela votação, e o voto chega pelo servidor;
--      · enquete de post (rede_votos) e enquete de story (rede_story_votos): a pessoa sai da linha do voto. Para não votar duas
--        vezes, a marca HMAC do servidor (rede_voto_marcas, rede_story_voto_marcas); a linha do voto fica sem pessoa e entra na
--        urna (regravada junto com as outras, em ordem sorteada, como a 8F fez);
--      · o termômetro da equipe (bem_estar): a marca deixa de usar o sal guardado no banco; vem do servidor, com o segredo dele.
--      Nada disso é escrito com a pessoa e o voto na mesma linha. As funções de voto pelo servidor não gravam freio por conta (o
--      freio é do servidor, na memória): uma linha de freio com o id da pessoa na mesma transação do voto ligaria um ao outro.
--
-- Os votos que já existiam: quem votou numa enquete ou num story antes desta migração fica numa tabela à parte, só "votou" (sem
-- a opção), e a linha do voto perde a pessoa. Na votação da equipe, quem votou antes continua em votacao_votantes (o banco não tem
-- o segredo para refazer a marca). Nada se perde.
--
-- Tudo em interno, com RLS e sem política. As funções que o servidor do site chama só aceitam a chave de serviço; as de membro
-- passam pela porta (interno.alumia_trancar, no fim). Pode rodar mais de uma vez, sem apagar dado nenhum.
-- Roda DEPOIS das migrações da onda 8. Teste: npm run testar:alumia-o9-resto8 (ver o retorno da frente: o script ainda não está
-- no package.json).

-- ── 1. A porta sem terceiro: o freio de "entrar" e "aviso" ──────────────────────────────────────────────────────────────────

/** O teto por rede e por hora de cada momento novo (ajustável em interno.configuracoes 'alumia_cadastro'). */
create or replace function interno.alumia_porta_teto(p_momento text) returns integer language sql stable security definer set search_path = interno, pg_temp as $$
  select case p_momento when 'entrar' then interno.alumia_cadastro_numero('rede_entrar_hora', 20) else interno.alumia_cadastro_numero('rede_aviso_hora', 6) end
$$;

/** Quantas vezes esta rede já passou nesta hora, neste momento (para o servidor escolher a dificuldade). Não grava nada. */
create or replace function public.alumia_porta_pressao(p_chave text, p_momento text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_momento is null or p_momento not in ('entrar', 'aviso') then perform interno.erro('invalido:momento'); end if;
  return jsonb_build_object(
    'rede', coalesce((select f.total from alumia_cadastro_freio f where f.chave = p_chave and f.janela = interno.alumia_cadastro_hora()), 0),
    'rede_teto', interno.alumia_porta_teto(p_momento));
end $$;

/**
 * O servidor conferiu a prova de trabalho de "entrar" (a senha) ou de "aviso" (reenviar a confirmação, pedir a senha nova): o banco
 * gasta o desafio (vale uma vez), recusa a rede barrada pelo painel e conta o freio da rede nesta hora. Sem teto da casa: num
 * ataque, quem já tem conta continua entrando. Recusa com {ok: false, motivo}: desafio_usado, rede_barrada ou muitos_pedidos.
 * p_chave nula (o servidor não leu a rede): só o desafio e a rede barrada valem; o servidor dá o desafio mais difícil.
 */
create or replace function public.alumia_porta_passar(p_momento text, p_chave text, p_selo text, p_vence timestamptz, p_impressao text default null) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v_total integer;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_momento is null or p_momento not in ('entrar', 'aviso') then perform interno.erro('invalido:momento'); end if;
  if p_selo is null or p_selo !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:desafio'); end if;
  if p_chave is not null and p_chave !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:chave'); end if;
  if p_vence is null or p_vence < now() or p_vence > now() + interval '1 hour' then perform interno.erro('invalido:prazo'); end if;
  if random() < 0.05 then perform interno.alumia_cadastro_faxina(); end if;

  insert into alumia_cadastro_gastos (selo, vence_em) values (p_selo, p_vence) on conflict (selo) do nothing;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'desafio_usado'); end if;

  if p_impressao is not null and p_impressao ~ '^[0-9a-f]{64}$' and exists (
    select 1 from alumia_impressao_banidas i join alumia_impressao_banimentos b on b.id = i.banimento
    where i.impressao = p_impressao and b.encerrado_em is null and b.ate > now()) then
    return jsonb_build_object('ok', false, 'motivo', 'rede_barrada');
  end if;

  if p_chave is not null then
    insert into alumia_cadastro_freio (chave, janela, total) values (p_chave, interno.alumia_cadastro_hora(), 1)
    on conflict (chave, janela) do update set total = alumia_cadastro_freio.total + 1
    returning total into v_total;
    if v_total > interno.alumia_porta_teto(p_momento) then return jsonb_build_object('ok', false, 'motivo', 'muitos_pedidos'); end if;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- 1.1 O bloqueio por tentativas erradas na CONTA, valendo no banco para qualquer caminho.
--
-- A entrada pelo site já freava por rede, mas a chave pública do serviço de contas deixa qualquer um pedir a sessão direto
-- (/auth/v1/token), sem passar pelo site. Aqui o bloqueio é da conta, não da rede: 10 erros em 15 minutos fecham a entrada daquela
-- conta por 15 minutos, por qualquer caminho. Conta pelo servidor do site (public.alumia_porta_entrada, a cada erro na rota de
-- entrar) e, quando o Jonathan ligar o gancho do serviço de contas, também pelo caminho direto
-- (public.alumia_porta_gancho_senha, o "password verification attempt"). Só o resumo do e-mail (o mesmo da entrada de antes) e a
-- hora: nenhum endereço de rede, nenhum id. Troca consciente: quem souber o e-mail de alguém pode fechar a entrada dessa pessoa por
-- 15 minutos (a senha nova por e-mail continua funcionando).
create table if not exists interno.alumia_entrada_erros (
  conta text not null check (conta ~ '^[0-9a-f]{32}$'),
  quando timestamptz not null default now()
);
create index if not exists alumia_entrada_erros_conta on interno.alumia_entrada_erros (conta, quando);
do $$
begin
  alter table interno.alumia_entrada_erros enable row level security;
  revoke all on table interno.alumia_entrada_erros from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on table interno.alumia_entrada_erros from anon, authenticated; end if;
end $$;

/** O resumo da conta (o mesmo de public.entrada_situacao): o e-mail nunca é guardado. */
create or replace function interno.alumia_entrada_conta(p_email text) returns text language sql immutable as $$
  select md5('conta:' || lower(btrim(coalesce(p_email, ''))))
$$;

/** A conta está com a entrada fechada? {bloqueado, segundos}. 10 erros nos últimos 15 minutos fecham até o mais velho deles vencer. */
create or replace function interno.alumia_entrada_bloqueio(p_conta text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_n integer; v_mais_velho timestamptz;
begin
  select count(*), min(quando) into v_n, v_mais_velho from (
    select quando from alumia_entrada_erros where conta = p_conta and quando > now() - interval '15 minutes' order by quando desc limit 10) x;
  if v_n >= 10 then
    return jsonb_build_object('bloqueado', true, 'segundos', greatest(60, ceil(extract(epoch from (v_mais_velho + interval '15 minutes' - now())))::integer));
  end if;
  return jsonb_build_object('bloqueado', false);
end $$;

/** Anota um erro na conta (e faxina, de vez em quando, o que passou de um dia). */
create or replace function interno.alumia_entrada_errou(p_conta text) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  insert into alumia_entrada_erros (conta) values (p_conta);
  if random() < 0.05 then delete from alumia_entrada_erros where quando < now() - interval '1 day'; end if;
end $$;

/**
 * Para o servidor do site (só a chave de serviço), na rota de entrar: 'conferir' antes de pedir a sessão, 'falhou' depois de uma
 * senha errada, 'certa' depois de entrar (limpa os erros da conta). Devolve {bloqueado, segundos}.
 */
create or replace function public.alumia_porta_entrada(p_email text, p_passo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_conta text := interno.alumia_entrada_conta(p_email);
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_passo is null or p_passo not in ('conferir', 'falhou', 'certa') then perform interno.erro('invalido:passo'); end if;
  if p_passo = 'falhou' then perform interno.alumia_entrada_errou(v_conta); end if;
  if p_passo = 'certa' then
    delete from alumia_entrada_erros where conta = v_conta;
    return jsonb_build_object('bloqueado', false);
  end if;
  return interno.alumia_entrada_bloqueio(v_conta);
end $$;

/**
 * O gancho "password verification attempt" do serviço de contas (Authentication → Hooks): roda a cada senha conferida, pelo site ou
 * direto pela API. Senha errada conta um erro; com a conta fechada, recusa até a senha certa. Senha certa com a conta aberta limpa os
 * erros. Só o papel do serviço de contas chama (supabase_auth_admin).
 */
create or replace function public.alumia_porta_gancho_senha(event jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_email text; v_conta text; v_valida boolean := coalesce((event ->> 'valid')::boolean, false); v_bloqueio jsonb;
begin
  select u.email into v_email from auth.users u where u.id = nullif(event ->> 'user_id', '')::uuid;
  if v_email is null then return jsonb_build_object('decision', 'continue'); end if;
  v_conta := interno.alumia_entrada_conta(v_email);
  if not v_valida then perform interno.alumia_entrada_errou(v_conta); end if;
  v_bloqueio := interno.alumia_entrada_bloqueio(v_conta);
  if (v_bloqueio ->> 'bloqueado')::boolean then
    return jsonb_build_object('decision', 'reject', 'should_logout_user', false,
      'message', 'Muitas tentativas erradas nesta conta. Tente de novo em ' || ceil((v_bloqueio ->> 'segundos')::numeric / 60) || ' minutos.');
  end if;
  if v_valida then delete from alumia_entrada_erros where conta = v_conta; end if;
  return jsonb_build_object('decision', 'continue');
exception when others then
  -- O gancho nunca derruba a entrada de todo mundo por um erro aqui dentro.
  return jsonb_build_object('decision', 'continue');
end $$;
do $$
begin
  revoke all on function public.alumia_porta_gancho_senha(jsonb) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.alumia_porta_gancho_senha(jsonb) from anon, authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.alumia_porta_gancho_senha(jsonb) to supabase_auth_admin;
  end if;
end $$;

-- ── 2. A atividade da conta sem o endereço de rede ──────────────────────────────────────────────────────────────────────────

/**
 * Os últimos acontecimentos da conta: o que o registro do painel anotou e as entradas que o serviço de contas guardou. Sem o
 * endereço de rede (o serviço de contas anota um; daqui ele não sai, nem para a própria pessoa).
 */
create or replace function public.conta_atividade() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_auth jsonb := '[]'::jsonb;
begin
  if to_regclass('auth.audit_log_entries') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('acao', 'auth:' || coalesce(a.payload ->> 'action', ''), 'quando', a.created_at) order by a.created_at desc), '[]'::jsonb)
      from (select created_at, payload from auth.audit_log_entries where payload ->> 'actor_id' = $1::text
              and coalesce(payload ->> 'action', '') not in ('token_refreshed', 'token_revoked')
            order by created_at desc limit 40) a
    $q$ into v_auth using v;
  end if;
  return (
    select coalesce(jsonb_agg(x order by (x ->> 'quando') desc), '[]'::jsonb) from (
      select jsonb_build_object('acao', a.acao, 'quando', a.criado_em) as x
      from (select * from auditoria where (quem = v or alvo = v::text)
              and acao in ('aparelho_novo', 'segundo_fator_recuperado', 'codigo_recuperacao_errado', 'codigos_recuperacao_gerados', 'senha_trocada', 'segundo_fator_ativado', 'segundo_fator_removido',
                           'chave_acesso_cadastrada', 'chave_acesso_removida', 'saiu_dos_outros', 'meus_dados_baixados', 'emails_preferencias', 'termo_voluntario', 'papel_concedido', 'papel_removido', 'senha_redefinida')
            order by criado_em desc limit 60) a
      union all
      select e from jsonb_array_elements(v_auth) e
    ) t
  );
end $$;

-- ── 3. Nenhum post da Alumia vai para a avaliação de fora ───────────────────────────────────────────────────────────────────

/**
 * A triagem de um texto da Alumia antes de aparecer: o veredito automático (interno.veredito) e o modo de segurança (aprovação
 * manual). A segunda avaliação (feita fora, por outra empresa) não entra mais, ligada ou não: "externa" é sempre false.
 */
create or replace function interno.rede_triagem(p_texto text, p_autor uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_av jsonb := interno.veredito(p_texto, interno.cuida(), p_autor); v_ver text := v_av ->> 'veredito'; v_motivo text := coalesce(v_av ->> 'motivo', '');
begin
  if v_ver = 'publicar' and interno.aprovacao_manual() and not interno.cuida() then
    v_ver := 'revisar'; v_motivo := 'modo_seguranca';
  end if;
  return jsonb_build_object('veredito', v_ver, 'motivo', v_motivo, 'externa', false);
end $$;

/**
 * Para a função "avaliar-comunidade" (só com a chave de serviço): como antes para tópico, resposta, comentário e bate-papo de aula.
 * Para post da Alumia ('rede'), nada: o texto não sai daqui, e o post não é marcado "em avaliação".
 */
create or replace function public.comunidade_para_avaliar(p_tipo text, p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_texto text;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_tipo = 'rede' then return null; end if;
  if interno.aprovacao_manual() or not interno.avaliacao_externa() then return null; end if;
  if p_tipo = 'topico' then
    update topicos set motivo = 'em_avaliacao', avaliacao_em = now(), tentativas = tentativas + 1
    where id = p_id and retido and tentativas < 3
      and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
    returning titulo || E'\n\n' || corpo into v_texto;
  elsif p_tipo = 'resposta' then
    update respostas set motivo = 'em_avaliacao', avaliacao_em = now(), tentativas = tentativas + 1
    where id = p_id and retido and tentativas < 3
      and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
    returning corpo into v_texto;
  elsif p_tipo = 'comentario' then
    update comentarios set motivo = 'em_avaliacao', avaliacao_em = now(), tentativas = tentativas + 1
    where id = p_id and retido and tentativas < 3
      and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
    returning corpo into v_texto;
  elsif p_tipo = 'aula_chat' then
    update aulas_chat set motivo = 'em_avaliacao', avaliacao_em = now(), tentativas = tentativas + 1
    where id = p_id and retido and tentativas < 3
      and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
    returning corpo into v_texto;
  else
    perform interno.erro('invalido:tipo');
  end if;
  if v_texto is null then return null; end if;
  return jsonb_build_object('texto', v_texto);
end $$;

/** O que espera a segunda avaliação (só a chave de serviço). Post da Alumia nunca entra na lista. */
create or replace function public.comunidade_pendentes() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if interno.aprovacao_manual() or not interno.avaliacao_externa() then return '[]'::jsonb; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('tipo', x.tipo, 'id', x.id) order by x.criado_em), '[]'::jsonb) from (
      select 'topico' as tipo, id, criado_em from topicos
      where retido and tentativas < 3 and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
      union all
      select 'resposta', id, criado_em from respostas
      where retido and tentativas < 3 and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
      union all
      select 'comentario', id, criado_em from comentarios
      where retido and tentativas < 3 and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
      union all
      select 'aula_chat', id, criado_em from aulas_chat
      where retido and tentativas < 3 and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
      order by criado_em limit 20) x);
end $$;

-- O post da Alumia que esperava a avaliação de fora continua retido, agora para a leitura da equipe (nunca publica sozinho).
update interno.rede_posts set motivo = 'leitura_humana'
where retido and motivo in ('aguardando_avaliacao', 'em_avaliacao', 'avaliacao_externa_falhou');

-- ── 4. Sair só da Alumia; apagar a conta deixa "[post apagado]" ─────────────────────────────────────────────────────────────

-- O pedido de saída usa a mesma fila do apagamento (o prazo, o cancelar, a rodada do agendador), com a marca "só a Alumia".
alter table interno.alumia_apagamentos add column if not exists so_alumia boolean not null default false;

/**
 * Os posts da pessoa que outras pessoas responderam (direto ou mais abaixo na conversa) ou citaram viram "[post apagado]" (sem
 * autora, sem texto, sem mídia), com os posts dela acima deles na conversa. Os arquivos de mídia de todos os posts e stories dela
 * vão para a fila do servidor. Devolve quantos viraram "[post apagado]". Não apaga o resto: quem chama decide.
 */
create or replace function interno.alumia_md_lapides(p_usuario uuid) returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_lapides uuid[]; r record;
begin
  if p_usuario is null then return 0; end if;
  insert into alumia_arquivos_a_apagar (deposito, caminho)
  select 'rede-midia', m.caminho from rede_midia m join rede_posts x on x.id = m.post where x.autor = p_usuario and m.caminho like p_usuario::text || '/%'
  union select 'rede-midia', a.caminho from rede_audios a join rede_posts x on x.id = a.post where x.autor = p_usuario and a.caminho like p_usuario::text || '/%'
  union select 'rede-stories', s.midia_caminho from rede_stories s where s.autor = p_usuario and s.midia_caminho like p_usuario::text || '/%'
  on conflict do nothing;
  if to_regclass('storage.objects') is not null then
    begin
      execute 'insert into interno.alumia_arquivos_a_apagar (deposito, caminho)
               select o.bucket_id, o.name from storage.objects o
               where o.bucket_id in (''rede-midia'', ''rede-stories'') and o.name like $1 and o.name ~ ''^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$''
               on conflict do nothing' using p_usuario::text || '/%';
    exception when others then null;
    end;
  end if;

  with recursive guardar as (
    select x.id, x.resposta_a from rede_posts x
    where x.autor = p_usuario and exists (
      select 1 from rede_posts o where o.autor is distinct from p_usuario and (o.resposta_a = x.id or o.root_id = x.id or o.quote_of = x.id))
    union
    select pai.id, pai.resposta_a from rede_posts pai join guardar g on pai.id = g.resposta_a where pai.autor = p_usuario
  )
  select coalesce(array_agg(distinct id), '{}') into v_lapides from guardar;
  if cardinality(v_lapides) = 0 then return 0; end if;
  delete from rede_midia where post = any (v_lapides);
  delete from rede_audios where post = any (v_lapides);
  delete from rede_post_edicoes where post = any (v_lapides);
  for r in select unnest(array['rede_pub_extras', 'rede_b1_post', 'rede_rotulos']) as t loop
    if to_regclass('interno.' || r.t) is not null then execute format('delete from interno.%I where post = any ($1)', r.t) using v_lapides; end if;
  end loop;
  update rede_posts set autor = null, como = null, texto = '[post apagado]', titulo = null, corpo = null, aviso = '', cita = null,
    chamado = null, flair = null, posicao = null, motivo = '', resposta_a_remota = null, editado_em = null, fixado = false,
    oculto = true, retido = false, apagado_em = coalesce(apagado_em, now())
  where id = any (v_lapides);
  return cardinality(v_lapides);
end $$;

/**
 * Tira a pessoa da Alumia de vez, sem apagar a conta do Instituto (o agendador chama quando o prazo de "sair só da Alumia" vence).
 * O que sai: os posts (o que outras pessoas responderam ou citaram fica como "[post apagado]"), os stories, as mídias (pela fila do
 * servidor), a federação, as identidades extras dela (contas só da Alumia), e cada linha das tabelas da rede que aponta para ela
 * com "on delete cascade" (seguir e ser seguida, comunidades, salvos, reações, chat, a entrada aprovada...); onde a ligação é
 * "set null" (o que ela criou e é de outras pessoas também: a comunidade que fundou, a denúncia que fez), a ligação some e a linha
 * fica. O perfil volta ao que era antes da Alumia (codinome, @, bio, foto da rede, aparência). Ficam, de propósito: as sanções
 * e as retenções da lei (sair não apaga uma sanção nem uma retenção em vigor), o registro de moderação e o do painel (só de
 * inserção), a marca de idade abaixo de 18 e a auditoria da conta do Instituto.
 */
create or replace function interno.alumia_md_sair_de_vez(p_usuario uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_lapides integer; v_posts integer := 0; r record; v_n integer; v_linhas integer := 0; v_set text;
begin
  if p_usuario is null or not exists (select 1 from perfis where id = p_usuario) then return jsonb_build_object('saiu', false); end if;

  -- a) As identidades extras (contas que só existem na Alumia) saem inteiras. A conta de organização fica (é de mais gente).
  for r in select i.identidade from rede_identidades i where i.dono = p_usuario and i.tipo = 'identidade' loop
    begin
      perform interno.alumia_md_apagar_de_vez(r.identidade);
    exception when others then
      raise warning 'alumia_md_sair_de_vez: uma identidade extra não foi apagada (%)', sqlstate;
    end;
  end loop;

  -- b) Os posts e os stories.
  v_lapides := interno.alumia_md_lapides(p_usuario);
  delete from rede_posts where autor = p_usuario or como = p_usuario;
  get diagnostics v_posts = row_count;
  if to_regclass('interno.rede_stories') is not null then delete from rede_stories where autor = p_usuario or como = p_usuario; end if;
  delete from rede_recursos where autor = p_usuario;
  delete from rede_plenaria_perguntas where autor = p_usuario;

  -- c) A federação (sem chave estrangeira para o perfil).
  delete from rede_fed_fila where perfil = p_usuario;
  delete from rede_fed_atores where perfil = p_usuario;

  -- d) Cada tabela da rede que aponta para o perfil: o mesmo que o "on delete" faria se o perfil fosse apagado.
  for r in
    select c.conrelid::regclass::text as tabela, a.attname as coluna, c.confdeltype as acao, t.relname as nome
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'interno'
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'interno.perfis'::regclass and cardinality(c.conkey) = 1
      and (t.relname like 'rede\_%' or t.relname like 'alumia\_%' or t.relname like 'fediverso\_%')
      and t.relname not in ('alumia_apagamentos', 'alumia_apagamento_escondidos', 'alumia_sancoes', 'alumia_lei_retencoes', 'rede_moderacao')
      and t.relname not like 'alumia\_painel\_%'
    order by 1, 2
  loop
    begin
      if r.acao = 'c' then
        execute format('delete from %s where %I = $1', r.tabela, r.coluna) using p_usuario;
      elsif r.acao = 'n' then
        execute format('update %s set %I = null where %I = $1', r.tabela, r.coluna, r.coluna) using p_usuario;
      else
        continue;
      end if;
      get diagnostics v_n = row_count;
      v_linhas := v_linhas + v_n;
    exception when others then
      raise warning 'alumia_md_sair_de_vez: % não pôde ser limpa (%)', r.nome, sqlstate;
    end;
  end loop;

  -- e) Os avisos da rede e o perfil como era antes da Alumia (cada coluna rede_* volta ao valor padrão; a marca de idade fica).
  delete from avisos where para = p_usuario and categoria = 'rede';
  select string_agg(format('%I = default', c.column_name), ', ' order by c.column_name) into v_set
  from information_schema.columns c
  where c.table_schema = 'interno' and c.table_name = 'perfis' and c.column_name like 'rede\_%' and c.column_name <> 'rede_menor_em'
    and (c.is_nullable = 'YES' or c.column_default is not null);
  if v_set is not null then execute format('update interno.perfis set %s where id = $1', v_set) using p_usuario; end if;

  delete from alumia_apagamentos where usuario = p_usuario;
  return jsonb_build_object('saiu', true, 'posts', v_posts, 'post_apagado', v_lapides, 'linhas', v_linhas);
end $$;

/**
 * Pede para sair só da Alumia. Segundo fator dos últimos 10 minutos e a palavra (o @) escrita igual. Na hora, como o apagar: o
 * perfil fica invisível, os posts e os stories saem do ar (anotados, para o cancelar devolver), a federação desliga. Em 7 dias, o
 * agendador tira a pessoa da rede (interno.alumia_md_sair_de_vez); a conta do Instituto continua. Quem administra a Alumia pede à
 * coordenação. Quem já pediu para apagar a conta inteira continua com esse pedido (que já leva tudo).
 */
create or replace function public.rede_meusdados_sair(p_palavra text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a alumia_apagamentos; v_invisivel boolean;
begin
  perform interno.limite('rede_meusdados_apagar', 6, 60);
  if not interno.alumia_md_fator_recente() then perform interno.erro('confirme_segundo_fator'); end if;
  if to_regclass('interno.alumia_painel_admin') is not null and exists (select 1 from alumia_painel_admin where usuario = v) then perform interno.erro('tem_funcao'); end if;
  if lower(btrim(coalesce(p_palavra, ''))) is distinct from lower(interno.alumia_md_palavra(v)) then perform interno.erro('confirmacao_errada'); end if;
  select * into a from alumia_apagamentos where usuario = v;
  if found then return jsonb_build_object('pedido_em', a.pedido_em, 'apagar_em', a.apagar_em, 'so_alumia', a.so_alumia); end if;

  select coalesce(rede_invisivel, false) into v_invisivel from perfis where id = v;
  insert into alumia_apagamentos (usuario, apagar_em, estava_invisivel, so_alumia) values (v, now() + interval '7 days', v_invisivel, true) returning * into a;

  insert into alumia_apagamento_escondidos (usuario, tipo, alvo)
  select v, 'post', x.id from rede_posts x where x.autor = v and not x.oculto on conflict do nothing;
  update rede_posts x set oculto = true from alumia_apagamento_escondidos e where e.usuario = v and e.tipo = 'post' and e.alvo = x.id and not x.oculto;
  insert into alumia_apagamento_escondidos (usuario, tipo, alvo)
  select v, 'story', s.id from rede_stories s where s.autor = v and not s.retido on conflict do nothing;
  update rede_stories s set retido = true from alumia_apagamento_escondidos e where e.usuario = v and e.tipo = 'story' and e.alvo = s.id and not s.retido;

  update perfis set rede_invisivel = true where id = v;
  if to_regprocedure('interno.rede_fed_desligar(uuid)') is not null then perform interno.rede_fed_desligar(v); end if;
  return jsonb_build_object('pedido_em', a.pedido_em, 'apagar_em', a.apagar_em, 'so_alumia', true);
end $$;

/**
 * Pede o apagamento da conta inteira (como em 20261114-alumia-o8-meusdados.sql). O que muda: quem tinha pedido para sair só da
 * Alumia e agora pede para apagar tudo passa a ter o pedido de apagar (no mesmo prazo).
 */
create or replace function public.rede_meusdados_apagar(p_palavra text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a alumia_apagamentos; v_invisivel boolean;
begin
  perform interno.limite('rede_meusdados_apagar', 6, 60);
  if not interno.alumia_md_fator_recente() then perform interno.erro('confirme_segundo_fator'); end if;
  if interno.alumia_md_tem_funcao(v) then perform interno.erro('tem_funcao'); end if;
  if lower(btrim(coalesce(p_palavra, ''))) is distinct from lower(interno.alumia_md_palavra(v)) then perform interno.erro('confirmacao_errada'); end if;
  select * into a from alumia_apagamentos where usuario = v for update;
  if found then
    if a.so_alumia then update alumia_apagamentos set so_alumia = false where usuario = v returning * into a; end if;
    return jsonb_build_object('pedido_em', a.pedido_em, 'apagar_em', a.apagar_em, 'so_alumia', false);
  end if;

  select coalesce(rede_invisivel, false) into v_invisivel from perfis where id = v;
  insert into alumia_apagamentos (usuario, apagar_em, estava_invisivel) values (v, now() + interval '7 days', v_invisivel) returning * into a;

  insert into alumia_apagamento_escondidos (usuario, tipo, alvo)
  select v, 'post', x.id from rede_posts x where x.autor = v and not x.oculto on conflict do nothing;
  update rede_posts x set oculto = true from alumia_apagamento_escondidos e where e.usuario = v and e.tipo = 'post' and e.alvo = x.id and not x.oculto;
  insert into alumia_apagamento_escondidos (usuario, tipo, alvo)
  select v, 'story', s.id from rede_stories s where s.autor = v and not s.retido on conflict do nothing;
  update rede_stories s set retido = true from alumia_apagamento_escondidos e where e.usuario = v and e.tipo = 'story' and e.alvo = s.id and not s.retido;

  update perfis set rede_invisivel = true where id = v;
  if to_regprocedure('interno.rede_fed_desligar(uuid)') is not null then perform interno.rede_fed_desligar(v); end if;
  return jsonb_build_object('pedido_em', a.pedido_em, 'apagar_em', a.apagar_em, 'so_alumia', false);
end $$;

/** A situação de "Meus dados" (como na 8C), com o tipo do pedido em andamento: sair só da Alumia ou apagar a conta. */
create or replace function public.rede_meusdados_situacao() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a alumia_apagamentos;
begin
  select * into a from alumia_apagamentos where usuario = v;
  return jsonb_build_object(
    'palavra', interno.alumia_md_palavra(v),
    'tem_funcao', interno.alumia_md_tem_funcao(v),
    'admin_alumia', to_regclass('interno.alumia_painel_admin') is not null and exists (select 1 from alumia_painel_admin p where p.usuario = v),
    'fator_recente', interno.alumia_md_fator_recente(),
    'exportou_hoje', exists (select 1 from limites l where l.chave = 'rede_meusdados_exportar:' || v::text
                               and l.janela = to_timestamp(floor(extract(epoch from now()) / 86400) * 86400) and l.total >= 1),
    'apagamento', case when a.usuario is null then null else jsonb_build_object('pedido_em', a.pedido_em, 'apagar_em', a.apagar_em, 'so_alumia', a.so_alumia) end);
end $$;

/**
 * A rodada do agendador (como na 8C): agora cada pedido vencido segue o tipo dele (sair só da Alumia ou apagar a conta).
 */
create or replace function interno.alumia_md_rodada() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v_ok integer := 0; v_falhas integer := 0; v_url text; v_segredo text; v_chamou boolean := false;
begin
  for r in select usuario, so_alumia from alumia_apagamentos where apagar_em <= now() order by apagar_em limit 20 loop
    begin
      if r.so_alumia then perform interno.alumia_md_sair_de_vez(r.usuario);
      else perform interno.alumia_md_apagar_de_vez(r.usuario); end if;
      v_ok := v_ok + 1;
    exception when others then
      v_falhas := v_falhas + 1;
      raise warning 'alumia_md_rodada: um pedido não foi cumprido nesta rodada (%)', sqlstate;
    end;
  end loop;
  if exists (select 1 from alumia_arquivos_a_apagar) and exists (select 1 from pg_extension where extname = 'pg_net') then
    v_url := coalesce(nullif((select valor ->> 'faxina' from configuracoes where chave = 'meus_dados'), ''), interno.endereco() || '/api/rede/exportar/faxina');
    v_segredo := coalesce((select valor ->> 'segredo' from configuracoes where chave = 'meus_dados'), '');
    if v_url ~ '^https://[a-z0-9.-]+(:[0-9]+)?/api/rede/exportar/faxina$' then
      begin
        execute 'select net.http_post(url := $1, body := ''{}''::jsonb, headers := $2, timeout_milliseconds := 60000)'
          using v_url, jsonb_build_object('Content-Type', 'application/json', 'x-lucia-segredo', v_segredo);
        v_chamou := true;
      exception when others then null;
      end;
    end if;
  end if;
  return jsonb_build_object('cumpridos', v_ok, 'apagadas', v_ok, 'falhas', v_falhas, 'chamou_faxina', v_chamou);
end $$;

/**
 * Apaga a conta do site inteiro (painel → Minha conta), como no install.sql: a senha atual, o segundo fator e a trava da última
 * coordenação. O que muda: o que a pessoa publicou na Alumia e outras pessoas responderam ou citaram fica como "[post apagado]"
 * (interno.alumia_md_apagar_de_vez, o mesmo apagar da Alumia), em vez de as respostas delas sumirem junto, em cascata.
 */
create or replace function public.conta_apagar(p_senha text default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_esquema text; v_hash text; v_confere boolean := false;
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  perform interno.limite('conta_apagar', 5, 15);
  if interno.tem_fator() and not interno.aal2() then perform interno.erro('confirme_segundo_fator'); end if;
  if exists (select 1 from papeis where usuario = v and papel = 'coordenacao') and (select count(*) from papeis where papel = 'coordenacao') <= 1 then
    perform interno.erro('ultima_coordenacao');
  end if;
  select encrypted_password into v_hash from auth.users where id = v;
  select n.nspname into v_esquema from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
  if v_esquema is not null and coalesce(v_hash, '') <> '' and char_length(coalesce(p_senha, '')) between 1 and 200 then
    execute format('select %I.crypt($1, $2) = $2', v_esquema) into v_confere using p_senha, v_hash;
  end if;
  if not coalesce(v_confere, false) then perform interno.erro('senha_errada'); end if;
  perform interno.alumia_md_apagar_de_vez(v);
  delete from perfis where id = v;
  delete from auth.users where id = v;
  return jsonb_build_object('ok', true);
end $$;

-- ── 5. Voto ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- 5.1 Consulta à base: a cédula cifrada no aparelho.

-- A cédula cifrada: só a consulta e o texto cifrado ("c1.<chave do aparelho>.<nonce>.<cifra>", tudo em base64url). Sem id, sem
-- hora, sem valor padrão. Entra pela urna (regravada com as outras, em ordem sorteada) e sai quando a consulta é apurada.
create table if not exists interno.rede_consulta_cifradas (
  consulta uuid not null references interno.rede_consultas (id) on delete cascade,
  cedula text not null check (char_length(cedula) <= 1600 and cedula ~ '^c1\.[A-Za-z0-9_-]{87}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$')
);
create index if not exists rede_consulta_cifradas_consulta on interno.rede_consulta_cifradas (consulta);
alter table interno.rede_consulta_cifradas set (autovacuum_vacuum_threshold = 0, autovacuum_vacuum_scale_factor = 0);

/** A urna das cédulas cifradas (como interno.alumia_urna): a nova entra no mesmo INSERT das que já estavam, em ordem sorteada. */
create or replace function interno.alumia_urna_cifrada(p_consulta uuid, p_cedula text) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  with velhas as (
    delete from rede_consulta_cifradas
    where consulta = p_consulta
      and ctid = any (array(select ctid from rede_consulta_cifradas where consulta = p_consulta order by gen_random_uuid() limit 2000))
    returning cedula)
  insert into rede_consulta_cifradas (consulta, cedula)
  select p_consulta, t.c from (select cedula as c from velhas union all select p_cedula) t order by gen_random_uuid();
end $$;

/**
 * Votar numa consulta aberta com a cédula cifrada no aparelho (as mesmas regras de rede_org_consulta_votar, menos conferir o
 * ranking, que o banco não lê: a cédula que não abrir, ou abrir com um ranking que não vale, é descartada na apuração).
 */
create or replace function public.rede_org_consulta_votar_cifrada(p_consulta uuid, p_cedula text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_consultas; v_nucleos uuid[];
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into c from rede_consultas where id = p_consulta;
  if not found or interno.rede_bloqueado(v, c.org) then perform interno.erro('nao_encontrado'); end if;
  if c.prazo <= now() then perform interno.erro('consulta_fechada'); end if;
  v_nucleos := case when cardinality(c.nucleos) > 0 then c.nucleos else coalesce((select array_agg(id) from rede_nucleos where org = c.org), '{}') end;
  if not exists (select 1 from rede_nucleo_membros m where m.usuario = v and m.nucleo = any (v_nucleos)) then perform interno.erro('sem_permissao'); end if;
  if p_cedula is null or char_length(p_cedula) > 1600 or p_cedula !~ '^c1\.[A-Za-z0-9_-]{87}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$' then perform interno.erro('invalido:cedula'); end if;
  perform interno.limite('alumia_org_votar', 30, 60);
  perform pg_advisory_xact_lock(hashtextextended('alumia_urna:' || c.id::text, 0));
  insert into rede_consulta_votantes (consulta, usuario) values (c.id, v) on conflict do nothing;
  if not found then perform interno.erro('ja_votou'); end if;
  perform interno.alumia_urna_cifrada(c.id, p_cedula);
  return jsonb_build_object('votei', true);
end $$;

/** Para o servidor do site (só a chave de serviço): as cédulas cifradas de uma consulta FECHADA, para abrir. Aberta: nada. */
create or replace function public.alumia_voto_cifradas(p_consulta uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c rede_consultas;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  select * into c from rede_consultas where id = p_consulta;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if c.prazo > now() then return jsonb_build_object('fechada', false); end if;
  return jsonb_build_object('fechada', true, 'metodo', c.metodo,
    'opcoes', coalesce((select jsonb_agg(o.id order by o.ordem) from rede_consulta_opcoes o where o.consulta = c.id), '[]'::jsonb),
    'cedulas', coalesce((select jsonb_agg(x.cedula) from rede_consulta_cifradas x where x.consulta = c.id), '[]'::jsonb));
end $$;

/**
 * Para o servidor do site (só a chave de serviço): a apuração das cédulas cifradas de uma consulta fechada. Recebe os rankings
 * abertos (em qualquer ordem; o servidor já embaralhou) e quantas cédulas abriu, que tem de bater com as que estão no banco.
 * O ranking que não vale é descartado (nula). Os que valem entram na urna de sempre, num INSERT só, junto com as cédulas que já
 * estavam (regravadas, em ordem sorteada), e as cifradas saem. Devolve quantas entraram e quantas foram nulas.
 */
create or replace function public.alumia_voto_apurar(p_consulta uuid, p_rankings jsonb, p_quantas integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c rede_consultas; v_opcoes uuid[]; v_lista jsonb := '[]'::jsonb; e jsonb; v_r uuid[]; v_nulas integer := 0; v_ok integer := 0; v_tem integer;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  select * into c from rede_consultas where id = p_consulta;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if c.prazo > now() then perform interno.erro('consulta_aberta'); end if;
  perform pg_advisory_xact_lock(hashtextextended('alumia_urna:' || c.id::text, 0));
  select count(*) into v_tem from rede_consulta_cifradas where consulta = c.id;
  if v_tem = 0 then return jsonb_build_object('apuradas', 0, 'nulas', 0); end if;
  if p_quantas is distinct from v_tem or jsonb_typeof(p_rankings) is distinct from 'array' or jsonb_array_length(p_rankings) > v_tem then
    perform interno.erro('invalido:apuracao');
  end if;
  select array_agg(id) into v_opcoes from rede_consulta_opcoes where consulta = c.id;
  for e in select value from jsonb_array_elements(p_rankings) loop
    begin
      if jsonb_typeof(e) <> 'array' then raise exception 'nula'; end if;
      select array_agg(x::uuid order by n) into v_r from jsonb_array_elements_text(e) with ordinality as t(x, n);
      if v_r is null or cardinality(v_r) = 0 or cardinality(v_r) > cardinality(v_opcoes) or cardinality(v_r) > 8
         or (c.metodo = 'simples' and cardinality(v_r) <> 1)
         or exists (select 1 from unnest(v_r) y where y is null or not y = any (v_opcoes))
         or (select count(distinct y) from unnest(v_r) y) <> cardinality(v_r) then
        raise exception 'nula';
      end if;
      v_lista := v_lista || jsonb_build_array(to_jsonb(v_r));
      v_ok := v_ok + 1;
    exception when others then
      v_nulas := v_nulas + 1;
    end;
  end loop;
  v_nulas := v_nulas + (v_tem - jsonb_array_length(p_rankings));
  -- A urna: as cédulas que já estavam e as abertas agora, num INSERT só, em ordem sorteada.
  with velhas as (delete from rede_consulta_cedulas where consulta = c.id returning ranking)
  insert into rede_consulta_cedulas (consulta, ranking)
  select c.id, t.r from (
    select ranking as r from velhas
    union all
    select array(select y.v::uuid from jsonb_array_elements_text(x.value) with ordinality as y(v, n) order by y.n) from jsonb_array_elements(v_lista) x
  ) t order by gen_random_uuid();
  delete from rede_consulta_cifradas where consulta = c.id;
  return jsonb_build_object('apuradas', v_ok, 'nulas', v_nulas);
end $$;

/**
 * A consulta como o perfil mostra (como na 8F), com "apurar": fechada e com cédulas cifradas que ainda não foram abertas (a tela
 * pede ao servidor do site para abrir). Enquanto houver cédula fechada, o resultado não sai.
 */
create or replace function interno.alumia_consulta_json(c interno.rede_consultas, p_quem uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  v_fechada boolean := c.prazo <= now(); v_votantes integer; v_cedulas integer; v_ap jsonb; v_mostra boolean; v_nucleos uuid[];
  v_posso boolean; v_votei boolean; v_quorum boolean; v_apurar boolean := false;
begin
  v_nucleos := case when cardinality(c.nucleos) > 0 then c.nucleos else coalesce((select array_agg(id) from rede_nucleos where org = c.org), '{}') end;
  select count(*) into v_votantes from rede_consulta_votantes where consulta = c.id;
  v_votei := p_quem is not null and exists (select 1 from rede_consulta_votantes where consulta = c.id and usuario = p_quem);
  v_posso := p_quem is not null and not v_fechada and not v_votei and interno.rede2_membro(p_quem) and not interno.rede_bloqueado(p_quem, c.org)
    and exists (select 1 from rede_nucleo_membros m where m.usuario = p_quem and m.nucleo = any (v_nucleos));
  v_quorum := c.quorum is null or v_votantes >= c.quorum;
  if v_fechada then
    select count(*) into v_cedulas from rede_consulta_cedulas where consulta = c.id;
    v_apurar := exists (select 1 from rede_consulta_cifradas x where x.consulta = c.id);
  end if;
  v_mostra := v_fechada and not v_apurar and v_votantes >= 3 and coalesce(v_cedulas, 0) >= 3 and v_quorum;
  if v_mostra then v_ap := interno.alumia_apurar(c.id); end if;
  return jsonb_build_object(
    'id', c.id, 'pergunta', c.pergunta, 'metodo', c.metodo, 'prazo', c.prazo, 'compromisso', c.compromisso, 'quorum', c.quorum,
    'situacao', case when v_fechada then 'fechada' else 'aberta' end,
    'votantes', case when v_fechada then interno.alumia_pessoas(v_votantes) end,
    'quorumAtingido', case when v_fechada then v_quorum end,
    'apurar', v_apurar,
    'possoVotar', v_posso, 'votei', v_votei,
    'nucleos', coalesce((select jsonb_agg(n.nome order by n.nome) from rede_nucleos n where n.id = any (v_nucleos)), '[]'::jsonb),
    'opcoes', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'texto', o.texto,
                'proporcao', case when v_mostra then round((v_ap -> 'proporcoes' ->> o.id::text)::numeric, 4) end) order by o.ordem)
              from rede_consulta_opcoes o where o.consulta = c.id), '[]'::jsonb));
end $$;

-- 5.2 Votação secreta da equipe: quem votou vira marca do servidor.

-- A marca de quem votou (HMAC-SHA-256 com o segredo do servidor do site, sobre a votação e a pessoa). O banco não tem o segredo:
-- quem lê a tabela vê marcas, não pessoas.
create table if not exists interno.votacao_marcas (
  votacao uuid not null references interno.votacoes (id) on delete cascade,
  marca text not null check (marca ~ '^[0-9a-f]{64}$'),
  primary key (votacao, marca)
);

/** Votar uma vez (o voto aberto, como antes). O voto secreto chega só pelo servidor do site (public.alumia_voto_equipe). */
create or replace function public.votar(p_id uuid, p_opcao integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x votacoes;
begin
  select * into x from votacoes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if x.secreta then perform interno.erro('voto_pelo_servidor'); end if;
  if x.encerrada_em is not null or x.encerra_em <= now() then perform interno.erro('encerrada'); end if;
  if not interno.vota_em(x, v) then perform interno.erro('sem_permissao'); end if;
  if p_opcao is null or p_opcao < 0 or p_opcao >= cardinality(x.opcoes) then perform interno.erro('invalido:opcao'); end if;
  insert into votacao_votantes (votacao, usuario) values (x.id, v) on conflict do nothing;
  if not found then perform interno.erro('ja_votou'); end if;
  insert into votacao_votos (votacao, opcao, usuario) values (x.id, p_opcao, v);
  return jsonb_build_object('ok', true);
end $$;

/**
 * Para o servidor do site (só a chave de serviço): o voto secreto da equipe. O servidor conferiu a sessão e manda a pessoa (para
 * o banco conferir se ela vota nesta votação) e a marca dela; o banco grava só a marca e põe a cédula na urna. A pessoa não é
 * gravada em linha nenhuma.
 */
create or replace function public.alumia_voto_equipe(p_usuario uuid, p_votacao uuid, p_opcao integer, p_marca text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare x votacoes;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_marca is null or p_marca !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:marca'); end if;
  if p_usuario is null or exists (select 1 from perfis where id = p_usuario and suspenso) then perform interno.erro('sem_permissao'); end if;
  select * into x from votacoes where id = p_votacao;
  if not found or not x.secreta then perform interno.erro('nao_encontrado'); end if;
  if x.encerrada_em is not null or x.encerra_em <= now() then perform interno.erro('encerrada'); end if;
  if not interno.vota_em(x, p_usuario) then perform interno.erro('sem_permissao'); end if;
  if p_opcao is null or p_opcao < 0 or p_opcao >= cardinality(x.opcoes) then perform interno.erro('invalido:opcao'); end if;
  perform pg_advisory_xact_lock(hashtextextended('votacao_urna:' || x.id::text, 0));
  -- Quem votou antes desta migração continua em votacao_votantes (às claras): também não vota de novo.
  if exists (select 1 from votacao_votantes p where p.votacao = x.id and p.usuario = p_usuario) then perform interno.erro('ja_votou'); end if;
  insert into votacao_marcas (votacao, marca) values (x.id, p_marca) on conflict do nothing;
  if not found then perform interno.erro('ja_votou'); end if;
  perform interno.votacao_urna(x.id, p_opcao::smallint);
  return jsonb_build_object('ok', true);
end $$;

/** Para o servidor do site (só a chave de serviço): destas votações secretas (ids e marcas da pessoa), em quais ela já votou. */
create or replace function public.alumia_voto_equipe_votei(p_usuario uuid, p_marcas jsonb) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if jsonb_typeof(p_marcas) is distinct from 'object' then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(k.key) from jsonb_each_text(p_marcas) k
    where k.key ~ '^[0-9a-f-]{36}$' and (
      exists (select 1 from votacao_marcas m where m.votacao = k.key::uuid and m.marca = k.value)
      or exists (select 1 from votacao_votantes p where p.votacao = k.key::uuid and p.usuario = p_usuario))), '[]'::jsonb);
end $$;

/**
 * A votação como o painel mostra (como na 8F). O que muda: no voto secreto, "votei" vem só da lista antiga (quem votou antes desta
 * migração); quem votou depois aparece pelo servidor (a tela pergunta). O número de quem votou soma as marcas.
 */
create or replace function interno.votacao_json(v interno.votacoes) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', v.id, 'titulo', v.titulo, 'descricao', v.descricao, 'opcoes', to_jsonb(v.opcoes), 'departamento', v.departamento, 'secreta', v.secreta,
    'encerra_em', v.encerra_em, 'terminou_em', least(coalesce(v.encerrada_em, v.encerra_em), v.encerra_em), 'encerrada', v.encerrada_em is not null or v.encerra_em <= now(), 'criado_em', v.criado_em,
    'criada_por', coalesce((select interno.nome_visto(nome) from perfis where id = v.criada_por), ''),
    'minha', v.criada_por = auth.uid(),
    'posso_votar', interno.vota_em(v, auth.uid()),
    'votei', auth.uid() is not null and exists (select 1 from votacao_votantes p where p.votacao = v.id and p.usuario = auth.uid()),
    'votantes', (select count(*) from votacao_votantes p where p.votacao = v.id) + (select count(*) from votacao_marcas m where m.votacao = v.id),
    'aptos', (select count(*) from perfis f where interno.vota_em(v, f.id)),
    'resultado', case when (v.encerrada_em is not null or v.encerra_em <= now())
                        and (not v.secreta or (select count(*) from votacao_votos w where w.votacao = v.id) >= 3) then
      (select jsonb_agg(jsonb_build_object('opcao', o.i - 1, 'texto', o.t, 'votos', (select count(*) from votacao_votos w where w.votacao = v.id and w.opcao = o.i - 1),
         'quem', case when not v.secreta then (select coalesce(jsonb_agg(interno.nome_visto(f.nome) order by f.nome), '[]'::jsonb) from votacao_votos w join perfis f on f.id = w.usuario where w.votacao = v.id and w.opcao = o.i - 1) end)
         order by o.i)
       from unnest(v.opcoes) with ordinality as o(t, i)) end)
$$;

-- 5.3 Enquete de post: a pessoa sai da linha do voto.

-- Quem votou, como marca do servidor (para não votar duas vezes). A opção não está aqui.
create table if not exists interno.rede_voto_marcas (
  post uuid not null references interno.rede_posts (id) on delete cascade,
  marca text not null check (marca ~ '^[0-9a-f]{64}$'),
  primary key (post, marca)
);
-- Quem votou ANTES desta migração (só "votou", sem a opção): também não vota de novo.
create table if not exists interno.rede_voto_antigos (
  post uuid not null references interno.rede_posts (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  primary key (post, usuario)
);

-- A linha do voto fica sem pessoa (o "quem" sai da chave e passa a ser vazio).
alter table interno.rede_votos drop constraint if exists rede_votos_pkey;
alter table interno.rede_votos alter column usuario drop not null;
create unique index if not exists rede_votos_quem on interno.rede_votos (opcao, usuario);
create index if not exists rede_votos_opcao on interno.rede_votos (opcao);
alter table interno.rede_votos set (autovacuum_vacuum_threshold = 0, autovacuum_vacuum_scale_factor = 0);

-- A conversão: quem votou vira "votou" (sem a opção) e o voto perde a pessoa, tudo regravado de uma vez em ordem sorteada.
insert into interno.rede_voto_antigos (post, usuario)
select distinct o.enquete, v.usuario from interno.rede_votos v join interno.rede_opcoes o on o.id = v.opcao where v.usuario is not null
on conflict do nothing;
with velhos as (delete from interno.rede_votos where usuario is not null returning opcao)
insert into interno.rede_votos (opcao, usuario) select opcao, null from velhos order by gen_random_uuid();

/** A urna da enquete: as linhas sem pessoa das opções desta enquete, apagadas e regravadas com os votos novos, num INSERT só. */
create or replace function interno.rede_voto_urna(p_post uuid, p_opcoes uuid[]) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  with velhos as (
    delete from rede_votos
    where usuario is null and opcao in (select o.id from rede_opcoes o where o.enquete = p_post)
      and ctid = any (array(select v.ctid from rede_votos v join rede_opcoes o on o.id = v.opcao where o.enquete = p_post and v.usuario is null order by gen_random_uuid() limit 2000))
    returning opcao)
  insert into rede_votos (opcao, usuario)
  select t.o, null from (select opcao as o from velhos union all select unnest(p_opcoes)) t order by gen_random_uuid();
end $$;

/**
 * A enquete como esta pessoa pode ver (a regra da B1: totais depois do prazo; antes, para quem fez a enquete ou votou, a não ser
 * que seja "resultado só no fim"). Número só a partir de 3: com menos de 3 votos, nem o total nem os votos por opção saem (em
 * enquete pequena a autora casaria o voto com quem acabou de votar); `poucos` diz que a hora de mostrar chegou, mas são menos
 * de 3. `p_votou` diz se a pessoa votou: o banco só sabe isso dos votos de antes desta migração; os de depois, o servidor sabe
 * na hora do voto (e o aparelho lembra). "votei" (a opção escolhida) sai vazio: o banco não guarda.
 */
create or replace function interno.rede3_pub_enquete_x(p interno.rede_posts, p_quem uuid, p_votou boolean) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  with cfg as (
    select e.prazo, e.multipla, coalesce(b.so_no_fim, false) as so_no_fim, coalesce(b.embaralhar, false) as embaralhar, coalesce(p_votou, false) as votei,
           ((select count(*) from rede_voto_marcas m where m.post = p.id) + (select count(*) from rede_voto_antigos a where a.post = p.id))::integer as n
    from rede_enquetes e left join rede_b1_enquete b on b.post = e.post where e.post = p.id
  ), ve0 as (
    select c.*, (c.prazo <= now() or (not c.so_no_fim and (p.autor = p_quem or c.votei))) as hora from cfg c
  ), ve as (
    select v.*, v.hora and v.n >= 3 as mostra from ve0 v
  )
  select jsonb_build_object(
    'prazo', ve.prazo, 'multipla', ve.multipla, 'encerrada', ve.prazo <= now(), 'so_no_fim', ve.so_no_fim, 'embaralhada', ve.embaralhar,
    'votei', '[]'::jsonb, 'votou', ve.votei, 'poucos', ve.hora and ve.n < 3,
    'opcoes', (select jsonb_agg(jsonb_build_object('id', oo.id, 'texto', oo.texto,
        'votos', case when ve.mostra then (select count(*)::integer from rede_votos v3 where v3.opcao = oo.id) end)
        order by case when ve.embaralhar then md5(oo.id::text || coalesce(p_quem::text, 'visitante')) else lpad(oo.ordem::text, 4, '0') end)
               from rede_opcoes oo where oo.enquete = p.id),
    'total', case when ve.mostra then ve.n end)
  from ve
$$;

create or replace function interno.rede3_pub_enquete(p interno.rede_posts, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.rede3_pub_enquete_x(p, p_quem, p_quem is not null and exists (select 1 from rede_voto_antigos a where a.post = p.id and a.usuario = p_quem))
$$;

/** O voto da enquete chega só pelo servidor do site (public.alumia_voto_enquete): daqui a pessoa ficaria ligada ao voto. */
create or replace function public.rede_pub_enquete_votar(p_post uuid, p_opcoes uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  perform interno.erro('voto_pelo_servidor');
  return null;
end $$;

/**
 * Para o servidor do site (só a chave de serviço): o voto numa enquete de post. As mesmas regras de antes (idade, membro, quem vê o
 * post, prazo, opções), conferidas com a pessoa que o servidor mandou; gravado: só a marca e as linhas do voto sem pessoa.
 */
create or replace function public.alumia_voto_enquete(p_usuario uuid, p_post uuid, p_opcoes uuid[], p_marca text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare p rede_posts; e rede_enquetes; v_n integer;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_marca is null or p_marca !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:marca'); end if;
  perform interno.aberta('comunidade');
  if p_usuario is null or not exists (select 1 from perfis where id = p_usuario and not suspenso) then perform interno.erro('sem_permissao'); end if;
  if not coalesce((select rede_18 from perfis where id = p_usuario), false) then perform interno.erro('confirme_idade'); end if;
  if not interno.rede2_membro(p_usuario) then perform interno.erro('consentimento'); end if;
  select * into p from rede_posts where id = p_post and tipo = 'enquete';
  if not found or not interno.rede_ve(p, p_usuario) or p.oculto or p.retido or p.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  select * into e from rede_enquetes where post = p.id;
  if e.prazo <= now() then perform interno.erro('encerrada'); end if;
  if p_opcoes is null or coalesce(array_length(p_opcoes, 1), 0) = 0 then perform interno.erro('invalido:opcoes'); end if;
  if array_length(p_opcoes, 1) > 1 and not e.multipla then perform interno.erro('invalido:opcoes'); end if;
  select count(distinct o) into v_n from unnest(p_opcoes) o;
  if v_n <> array_length(p_opcoes, 1) or (select count(*) from rede_opcoes where enquete = p.id and id = any (p_opcoes)) <> v_n then perform interno.erro('invalido:opcoes'); end if;
  perform pg_advisory_xact_lock(hashtextextended('rede_voto_urna:' || p.id::text, 0));
  if exists (select 1 from rede_voto_antigos a where a.post = p.id and a.usuario = p_usuario) then perform interno.erro('ja_votou'); end if;
  insert into rede_voto_marcas (post, marca) values (p.id, p_marca) on conflict do nothing;
  if not found then perform interno.erro('ja_votou'); end if;
  perform interno.rede_voto_urna(p.id, p_opcoes);
  return interno.rede3_pub_enquete_x(p, p_usuario, true) || jsonb_build_object('votei', to_jsonb(p_opcoes));
end $$;

-- 5.4 Enquete de story: a pessoa sai da linha do voto.

create table if not exists interno.rede_story_voto_marcas (
  story uuid not null references interno.rede_stories (id) on delete cascade,
  marca text not null check (marca ~ '^[0-9a-f]{64}$'),
  primary key (story, marca)
);
create table if not exists interno.rede_story_voto_antigos (
  story uuid not null references interno.rede_stories (id) on delete cascade,
  quem uuid not null references interno.perfis (id) on delete cascade,
  primary key (story, quem)
);

alter table interno.rede_story_votos drop constraint if exists rede_story_votos_pkey;
alter table interno.rede_story_votos alter column quem drop not null;
create unique index if not exists rede_story_votos_quem on interno.rede_story_votos (story, quem);
create index if not exists rede_story_votos_story on interno.rede_story_votos (story);
alter table interno.rede_story_votos set (autovacuum_vacuum_threshold = 0, autovacuum_vacuum_scale_factor = 0);

insert into interno.rede_story_voto_antigos (story, quem)
select story, quem from interno.rede_story_votos where quem is not null on conflict do nothing;
with velhos as (delete from interno.rede_story_votos where quem is not null returning story, opcao)
insert into interno.rede_story_votos (story, quem, opcao) select story, null, opcao from velhos order by gen_random_uuid();

/** A urna da enquete do story: como a da enquete de post. */
create or replace function interno.rede_story_voto_urna(p_story uuid, p_opcao smallint) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  with velhos as (
    delete from rede_story_votos
    where story = p_story and quem is null
      and ctid = any (array(select ctid from rede_story_votos where story = p_story and quem is null order by gen_random_uuid() limit 2000))
    returning opcao)
  insert into rede_story_votos (story, quem, opcao)
  select p_story, null, t.o from (select opcao as o from velhos union all select p_opcao) t order by gen_random_uuid();
end $$;

/** O voto na enquete do story chega só pelo servidor do site (public.alumia_voto_story). */
create or replace function public.rede_story_votar(p_id uuid, p_opcao integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  perform interno.erro('voto_pelo_servidor');
  return null;
end $$;

/** Para o servidor do site (só a chave de serviço): o voto na enquete de um story. Gravado: a marca e a linha do voto sem pessoa. */
create or replace function public.alumia_voto_story(p_usuario uuid, p_story uuid, p_opcao integer, p_marca text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare s rede_stories; f rede_story_figurinhas;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_marca is null or p_marca !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:marca'); end if;
  if p_opcao is null or p_opcao not in (0, 1) then perform interno.erro('invalido:opcao'); end if;
  perform interno.aberta('comunidade');
  perform interno.rede5_story_ligado();
  if p_usuario is null or not exists (select 1 from perfis where id = p_usuario and not suspenso) or not interno.rede2_membro(p_usuario) then
    perform interno.erro('sem_permissao');
  end if;
  s := interno.rede5_story_visivel(p_story, p_usuario);
  if s.autor = p_usuario then perform interno.erro('sem_permissao'); end if;
  select * into f from rede_story_figurinhas where story = s.id and tipo = 'enquete';
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform pg_advisory_xact_lock(hashtextextended('rede_story_voto_urna:' || s.id::text, 0));
  -- Votar de novo não muda o voto nem dá erro (como antes): volta a figurinha, sem dizer qual foi o voto de antes.
  if exists (select 1 from rede_story_voto_antigos a where a.story = s.id and a.quem = p_usuario) then
    return interno.rede5_story_figurinha(f, s, p_usuario) || jsonb_build_object('ja_votou', true);
  end if;
  insert into rede_story_voto_marcas (story, marca) values (s.id, p_marca) on conflict do nothing;
  if not found then return interno.rede5_story_figurinha(f, s, p_usuario) || jsonb_build_object('ja_votou', true); end if;
  perform interno.rede_story_voto_urna(s.id, p_opcao::smallint);
  return interno.rede5_story_figurinha(f, s, p_usuario) || jsonb_build_object('meu_voto', p_opcao);
end $$;

-- 5.5 O termômetro da equipe: a marca vem do servidor, com o segredo dele (nunca o sal guardado no banco). Como nas enquetes, a
-- marca de quem respondeu e o nível ficam em tabelas separadas: em bem_estar_respostas, só "esta marca respondeu nesta semana"; em
-- bem_estar_urna, só a semana e o nível, sem marca, regravados em ordem sorteada a cada resposta. Quem tem o banco e o segredo do
-- servidor refaz a marca de alguém e sabe que ela respondeu, mas não o que respondeu. Uma resposta por semana (a tela já some
-- depois de responder): mudar exigiria ligar a marca ao nível.

create table if not exists interno.bem_estar_respostas (
  semana date not null,
  marca text not null check (marca ~ '^[0-9a-f]{32}$'),
  primary key (semana, marca)
);
create table if not exists interno.bem_estar_urna (
  semana date not null,
  nivel smallint not null check (nivel between 1 and 5)
);
create index if not exists bem_estar_urna_semana on interno.bem_estar_urna (semana);
alter table interno.bem_estar_urna set (autovacuum_vacuum_threshold = 0, autovacuum_vacuum_scale_factor = 0);
do $$
declare t text;
begin
  foreach t in array array['bem_estar_respostas', 'bem_estar_urna'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- A conversão: o que estava em bem_estar (marca e nível na mesma linha) vai para as duas tabelas e sai de lá, de uma vez, em
-- ordem sorteada. Rodar de novo não acha mais nada.
insert into interno.bem_estar_respostas (semana, marca) select semana, marca from interno.bem_estar on conflict do nothing;
with velhos as (delete from interno.bem_estar returning semana, nivel)
insert into interno.bem_estar_urna (semana, nivel) select semana, nivel from velhos order by gen_random_uuid();

/** A urna da semana: as linhas dela, apagadas e regravadas com o nível novo, num INSERT só e em ordem sorteada. */
create or replace function interno.bem_estar_urna_somar(p_semana date, p_nivel smallint) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  with velhos as (delete from bem_estar_urna where semana = p_semana returning nivel)
  insert into bem_estar_urna (semana, nivel)
  select p_semana, t.n from (select nivel as n from velhos union all select p_nivel) t order by gen_random_uuid();
end $$;

/** O termômetro chega só pelo servidor do site (public.alumia_cuidado_bem_estar). */
create or replace function public.bem_estar_responder(p_nivel integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  perform interno.erro('pelo_servidor');
  return null;
end $$;

create or replace function public.bem_estar_situacao() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  perform interno.erro('pelo_servidor');
  return null;
end $$;

/**
 * Para o servidor do site (só a chave de serviço): a resposta da semana (1 a 5), uma por semana. O servidor manda a pessoa (para
 * conferir que é da equipe), a semana e a marca dela (HMAC com o segredo do servidor, sobre a semana e a pessoa); o banco grava a
 * marca numa tabela e o nível em outra, sem marca (ver acima). Responder de novo na mesma semana não muda nada e devolve
 * `ja_respondeu`. `p_nivel` nulo: só pergunta se a pessoa já respondeu.
 */
create or replace function public.alumia_cuidado_bem_estar(p_usuario uuid, p_semana date, p_marca text, p_nivel integer default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_marca is null or p_marca !~ '^[0-9a-f]{32}$' then perform interno.erro('invalido:marca'); end if;
  if p_usuario is null or not interno.voluntario_e(p_usuario) then perform interno.erro('sem_permissao'); end if;
  if p_semana is distinct from interno.semana_atual() then perform interno.erro('invalido:semana'); end if;
  if p_nivel is null then
    return jsonb_build_object('respondeu', exists (select 1 from bem_estar_respostas where semana = p_semana and marca = p_marca));
  end if;
  if p_nivel < 1 or p_nivel > 5 then perform interno.erro('invalido:nivel'); end if;
  perform pg_advisory_xact_lock(hashtextextended('bem_estar_urna:' || p_semana::text, 0));
  insert into bem_estar_respostas (semana, marca) values (p_semana, p_marca) on conflict do nothing;
  if not found then return jsonb_build_object('ok', true, 'respondeu', true, 'ja_respondeu', true); end if;
  perform interno.bem_estar_urna_somar(p_semana, p_nivel::smallint);
  return jsonb_build_object('ok', true, 'respondeu', true);
end $$;

/** Para quem cuida da equipe: as últimas oito semanas, pela urna. Com menos de cinco respostas, só o total (senão dá para adivinhar quem). */
create or replace function public.bem_estar_resumo() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.cuida_da_equipe() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('semana', s.semana, 'respostas', s.n,
            'media', case when s.n >= 5 then s.media end,
            'baixas', case when s.n >= 5 then s.baixas end) order by s.semana desc), '[]'::jsonb)
          from (select semana, count(*)::int as n, round(avg(nivel), 1) as media, count(*) filter (where nivel <= 2)::int as baixas
                from bem_estar_urna where semana > interno.semana_atual() - 56 group by semana) s);
end $$;

-- ── 6. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────────

do $$
declare t text; f text;
begin
  foreach t in array array['rede_consulta_cifradas', 'votacao_marcas', 'rede_voto_marcas', 'rede_voto_antigos', 'rede_story_voto_marcas', 'rede_story_voto_antigos'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;

  -- O que só o servidor do site chama (a chave de serviço).
  foreach f in array array['alumia_porta_pressao(text, text)', 'alumia_porta_passar(text, text, text, timestamptz, text)', 'alumia_porta_entrada(text, text)',
                           'alumia_voto_cifradas(uuid)',
                           'alumia_voto_apurar(uuid, jsonb, integer)', 'alumia_voto_equipe(uuid, uuid, integer, text)', 'alumia_voto_equipe_votei(uuid, jsonb)',
                           'alumia_voto_enquete(uuid, uuid, uuid[], text)', 'alumia_voto_story(uuid, uuid, integer, text)',
                           'alumia_cuidado_bem_estar(uuid, date, text, integer)'] loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon, authenticated', f);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function public.%s to service_role', f);
    end if;
  end loop;

  -- As de dentro do banco.
  foreach f in array array['alumia_porta_teto(text)', 'alumia_entrada_conta(text)', 'alumia_entrada_bloqueio(text)', 'alumia_entrada_errou(text)',
                           'alumia_md_lapides(uuid)', 'alumia_md_sair_de_vez(uuid)', 'alumia_urna_cifrada(uuid, text)',
                           'rede_voto_urna(uuid, uuid[])', 'rede_story_voto_urna(uuid, smallint)', 'rede3_pub_enquete_x(interno.rede_posts, uuid, boolean)',
                           'bem_estar_urna_somar(date, smallint)'] loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function interno.%s from anon, authenticated', f);
    end if;
  end loop;

  -- As de membro (a porta vem no fim).
  foreach f in array array['rede_meusdados_sair(text)', 'rede_org_consulta_votar_cifrada(uuid, text)'] loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated', f);
    end if;
  end loop;
end $$;

select interno.alumia_trancar();
