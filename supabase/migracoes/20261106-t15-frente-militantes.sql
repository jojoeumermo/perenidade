-- ───────────────────────────── Frente Revolucionária Lúcia: inscrição de militantes (T15, novembro de 2026) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. O mesmo bloco está no fim do install.sql.
-- Explicação e decisões: docs/escola-revolucionaria/LEIA-ME.md. Teste: npm run testar:militantes.
--
-- A Escola Revolucionária Lúcia Maria chama voluntários militantes da Frente Revolucionária Lúcia. A inscrição usa a
-- MESMA fila do voluntariado (interno.inscricoes, public.voluntariar), para chegar no mesmo lugar do painel interno
-- (Pessoas, "Candidaturas"). Só acréscimos:
--
-- 1. interno.inscricoes ganha `tipo` ('voluntario' | 'militante', padrão 'voluntario': nada do que já existe muda),
--    `consentimento_em` e `maior_idade`.
-- 2. public.voluntariar passa a aceitar p.tipo = 'militante'. Tudo o que já valia continua valendo (mesmas regras, mesmo
--    freio, mesmo campo-isca). Para militante, exige também:
--      - consentimento específico e destacado (p.consentimento = true): dizer que quer militar numa frente política
--        revela OPINIÃO POLÍTICA e FILIAÇÃO A ORGANIZAÇÃO DE CARÁTER POLÍTICO, que a LGPD chama de dado pessoal
--        sensível (Lei 13.709/2018, art. 5º, II). O tratamento só pode ser feito com consentimento "de forma específica
--        e destacada, para finalidades específicas" (art. 11, I). O momento do consentimento fica guardado
--        (`consentimento_em`), porque cabe ao controlador provar que ele foi dado (art. 8º, § 2º).
--      - maioridade declarada (p.maior_idade = true): a inscrição militante é só para quem tem 18 anos ou mais. Dado
--        sensível de adolescente pediria o consentimento de um dos pais ou responsável e o melhor interesse (art. 14 da
--        LGPD; ECA, Lei 8.069/1990, arts. 17 e 18, e ECA Digital, Lei 15.211/2025). Sem vínculo de contas com
--        responsável, a decisão conservadora é não receber. Quem tem menos de 18 continua estudando na Escola.
--    O tipo militante entra também no "já pediu" (a mesma pessoa pode ter um pedido de voluntário e outro de militante).
--    Os e-mails de confirmação e de aviso à coordenação dizem que é inscrição militante.
-- 3. public.inscricoes_listar devolve também `tipo` e `consentimento_em` (o painel mostra a marca "Militante").
--
-- Nada de rastreio: o banco não guarda endereço de rede na inscrição; o freio (interno.limite) é o mesmo do voluntariado.

-- 1. Colunas novas ────────────────────────────────────────────────────────────────────────────────────────────────────────
alter table interno.inscricoes add column if not exists tipo text not null default 'voluntario';
alter table interno.inscricoes drop constraint if exists inscricoes_tipo_check;
alter table interno.inscricoes add constraint inscricoes_tipo_check check (tipo in ('voluntario', 'militante'));
alter table interno.inscricoes add column if not exists consentimento_em timestamptz;
alter table interno.inscricoes add column if not exists maior_idade boolean;
-- Militante sem consentimento ou sem maioridade declarada não entra, nem por fora da função (LGPD, art. 11, I).
alter table interno.inscricoes drop constraint if exists inscricoes_militante_check;
alter table interno.inscricoes add constraint inscricoes_militante_check
  check (tipo <> 'militante' or (consentimento_em is not null and coalesce(maior_idade, false)));
create index if not exists inscricoes_tipo on interno.inscricoes (tipo, status, criado_em);

-- 2. A candidatura pública, agora também militante ────────────────────────────────────────────────────────────────────────
/**
 * Quem quer ser voluntário preenche o formulário, sem precisar de conta: nome completo, e-mail de contato, função
 * pretendida e uma apresentação. A coordenação lê no painel e responde por e-mail.
 * T15: com p.tipo = 'militante', a inscrição é da Frente Revolucionária Lúcia (Escola Revolucionária Lúcia Maria) e
 * exige o consentimento destacado (dado sensível, LGPD art. 11, I) e a maioridade declarada (LGPD art. 14).
 */
create or replace function public.voluntariar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_email text := lower(btrim(coalesce(p ->> 'email', '')));
  v_papel text := coalesce(p ->> 'papel', '');
  v_disc text := interno.disciplina_ok(p ->> 'disciplina');
  v_tipo text := coalesce(nullif(p ->> 'tipo', ''), 'voluntario');
  v_militante boolean;
  v_nome text; v_mensagem text; v_id uuid;
  v_instagram text := nullif(regexp_replace(btrim(coalesce(p ->> 'instagram', '')), '^@', ''), '');
begin
  perform interno.aberta('voluntariado');
  -- Campo-isca: gente não vê, robô preenche. Finge que deu certo e não guarda nada.
  if coalesce(p ->> 'site', '') <> '' then return jsonb_build_object('id', gen_random_uuid()); end if;
  perform interno.limite('voluntariar', 3, 1440);
  if v_tipo not in ('voluntario', 'militante') then perform interno.erro('invalido:tipo'); end if;
  v_militante := v_tipo = 'militante';
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or char_length(v_email) > 200 then perform interno.erro('invalido:email'); end if;
  if v_papel not in ('curadoria', 'mediacao', 'educacao', 'educacao_secundaria', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento', 'porta_voz', 'saude') then perform interno.erro('invalido:papel'); end if;
  if v_papel in ('educacao', 'educacao_secundaria', 'mentoria') and v_disc is null then perform interno.erro('invalido:disciplina'); end if;
  if v_papel not in ('educacao', 'educacao_secundaria', 'mentoria') then v_disc := null; end if;
  -- Militante: consentimento destacado para o dado sensível (LGPD, art. 11, I) e 18 anos ou mais (LGPD, art. 14).
  if v_militante and coalesce(p ->> 'consentimento', '') <> 'true' then perform interno.erro('invalido:consentimento'); end if;
  if v_militante and coalesce(p ->> 'maior_idade', '') <> 'true' then perform interno.erro('invalido:idade'); end if;
  v_nome := interno.txt(p ->> 'nome', 'nome', 5, 120);
  -- Nome e sobrenome: a coordenação precisa saber quem está pedindo acesso.
  if array_length(regexp_split_to_array(btrim(v_nome), '\s+'), 1) < 2 then perform interno.erro('invalido:nome'); end if;
  if v_instagram is not null and v_instagram !~ '^[A-Za-z0-9._]{1,30}$' then perform interno.erro('invalido:instagram'); end if;
  v_mensagem := interno.txt(p ->> 'mensagem', 'mensagem', 30, 2000);
  if interno.vetado(v_nome || ' ' || v_mensagem) then perform interno.erro('conteudo_recusado'); end if;
  if exists (select 1 from inscricoes where email = v_email and papel = v_papel and tipo = v_tipo and status = 'pendente') then perform interno.erro('ja_pediu'); end if;
  insert into inscricoes (nome, email, papel, disciplina, mensagem, instagram, tipo, consentimento_em, maior_idade)
    values (v_nome, v_email, v_papel, v_disc, v_mensagem, v_instagram, v_tipo, case when v_militante then now() end, case when v_militante then true end)
    returning id into v_id;
  if v_militante then
    perform interno.email(v_email, 'inscricao_recebida', 'Recebemos sua inscrição de militante',
      'Olá, ' || coalesce(nullif(left(split_part(interno.sem_link(v_nome), ' ', 1), 40), ''), 'tudo bem') || E'.\n\nRecebemos sua inscrição como militante voluntário(a) da Frente Revolucionária Lúcia, na frente de trabalho de ' || interno.nome_papel(v_papel) || E'.\n\n'
      || E'A coordenação lê cada inscrição e responde por este mesmo endereço. Os seus dados são vistos só pela coordenação e servem só para responder a você.\n\n'
      || E'Você pode pedir a qualquer momento que a sua inscrição seja apagada, respondendo a este e-mail.\n\n'
      || 'Se não foi você quem enviou esta inscrição, é só ignorar esta mensagem.');
    perform interno.email_lideranca('inscricao_nova', 'Nova inscrição militante: ' || left(interno.sem_link(v_nome), 60),
      interno.sem_link(v_nome) || ' (' || v_email || coalesce(', Instagram @' || v_instagram, '') || ') quer militar na Frente Revolucionária Lúcia, na frente de ' || interno.nome_papel(v_papel) || E'.\n\nLeia a inscrição e decida no painel: ' || interno.endereco() || '/pt/painel?aba=pessoas');
  else
    perform interno.email(v_email, 'inscricao_recebida', 'Recebemos seu pedido de voluntariado',
      'Olá, ' || coalesce(nullif(left(split_part(interno.sem_link(v_nome), ' ', 1), 40), ''), 'tudo bem') || E'.\n\nRecebemos seu pedido para atuar como voluntário(a) no Instituto Lúcia, na função de ' || interno.nome_papel(v_papel) || E'.\n\n'
      || E'A coordenação lê cada pedido e responde por este mesmo endereço. Se o pedido for aceito, chega aqui o link para você criar a sua conta e entrar no painel da equipe.\n\n'
      || 'Se não foi você quem enviou este pedido, é só ignorar esta mensagem.');
    perform interno.email_lideranca('inscricao_nova', 'Novo pedido de voluntariado: ' || left(interno.sem_link(v_nome), 60),
      interno.sem_link(v_nome) || ' (' || v_email || coalesce(', Instagram @' || v_instagram, '') || ') quer atuar na função de ' || interno.nome_papel(v_papel) || E'.\n\nLeia o pedido e decida no painel: ' || interno.endereco() || '/pt/painel?aba=pessoas');
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- 3. A lista do painel, com o tipo ────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.inscricoes_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'nome', i.nome, 'email', i.email, 'papel', i.papel, 'disciplina', i.disciplina, 'instagram', i.instagram,
            'mensagem', i.mensagem, 'status', i.status, 'criado_em', i.criado_em, 'tem_conta', exists (select 1 from auth.users u where lower(u.email) = i.email),
            'tipo', i.tipo, 'consentimento_em', i.consentimento_em)
            order by (i.status = 'pendente') desc, i.criado_em desc), '[]'::jsonb)
          from (select * from inscricoes order by criado_em desc limit 300) i);
end $$;
