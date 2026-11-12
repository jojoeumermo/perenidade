-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · B1 · perfil e organizações (10/11/2026) ═══════════════════════════
-- docs/plano-2026-11/ALUMIA-FUNCOES-E-IDEIAS.md §2.1 (ideias 4, 5, 6, 8 e 10), §3.6 e §6 (Onda A item 5, Onda B item 10);
-- PLANO-ALUMIA.md §5 F4, §6 e §7. O back-end do que a F4 deixou "pendente":
--   1. Funções com permissões e mandato (tesouraria, comunicação, segurança…): data de fim, etiqueta que só quem é de dentro vê.
--   2. Eleições internas: inscrição, voto secreto e quórum pela MESMA consulta ranqueada (interno.alumia_apurar, segundo turno
--      instantâneo); quem vence ganha o mandato sozinho, sem o dono "dar o cargo".
--   3. Ata Viva: pauta em pontos, inscrição de fala (a favor, contra, esclarecimento) em que a pessoa vê só a própria posição e a
--      mesa vê a fila por codinome, cronômetro da fala, carimbo por deliberação (APROVADO, RETIRADO, VAI À BASE) e a ata pronta em
--      post. A fila e os sinais SOMEM quando a ata fecha.
--   4. Sinais de consenso ao vivo (concordo, dúvida, bloqueio, abstenção): mosaico em passos de 10 % só a partir de 3; a mesa recebe
--      só "há bloqueio"; ao fechar os sinais fica só o agregado, nada individual.
--   5. Caixa transparente: livro-caixa com foto da nota (o aparelho borra e tira o EXIF antes de mandar), duplo carimbo CONFERIDO
--      por duas pessoas de tesouraria diferentes e saldo público só do que foi conferido. Não há pagamento dentro da Alumia.
--   6. Acenda um lampião completo: pauta da 1ª reunião e primeira tarefa guardadas, convite com validade e limite de usos (o mesmo
--      rede_convites, só o hash), a chama (brasa → plena com a 3ª pessoa além de quem fundou, no marco de 15 minutos; abaixo de 3
--      é sempre "brasa", sem distinguir 0, 1 ou 2) e o mapa por estado, com a opção de ficar fora.
--   7. A plenária lida de novo (fila viva) e o Tear ligado à decisão: o fio nasce de uma consulta fechada ou de uma ata, a função
--      é uma função de verdade e o prazo vencido avisa quem ocupa a função.
--   8. Diretório das organizações com selo, por tipo e cidade escrita, sem contagem de pessoas.
--
-- Idempotente: scripts/testar-alumia-b1-perfil-org.mjs roda a migração mais duas vezes sobre o install.sql. Depende da F4
-- (20261109-alumia-f4.sql) e do perfil livre (20261110-alumia-perfil.sql). NÃO rodar em produção sem o Jonathan.
--
-- Regras (PLANO-ALUMIA §5): tudo em `interno` com RLS ligada e nenhuma permissão direta nas tabelas; acesso só por função
-- security definer com search_path = interno, pg_temp; cada função confere quem chama (membro da Rede, bloqueio, gestor, função,
-- núcleo da organização) e o limite de uso (interno.limite).
--
-- Leis (conferidas no texto, leis-do-brasil):
--  - LGPD (Lei 13.709/2018) art. 5º, II e art. 11: filiação e opinião política são dado SENSÍVEL. Por isso: nenhuma resposta traz
--    lista de quem votou, de quem deu sinal, de quem está na fila (a mesa vê a fila do ponto em curso, por codinome, só enquanto a
--    ata está aberta), de quem é de um núcleo ou de quem doou; contagens de pessoas só a partir de 3; quem ocupa uma função só
--    aparece para quem é de dentro (gestor ou membro de núcleo da organização).
--  - LGPD art. 6º, III (necessidade): a fila de fala e os sinais são apagados quando o ponto é carimbado ou a ata fecha; a eleição
--    guarda votante e cédula em tabelas separadas, sem ligação; a nota do caixa não guarda EXIF (o aparelho reencoda) e a descrição
--    recusa CPF, telefone, e-mail e endereço com número (o doador nunca aparece); datas de mandato guardam só o dia.
--  - LGPD art. 46 (segurança): RLS ligada, nenhuma permissão direta; limite de uso em toda escrita.
--  - ECA (Lei 8.069/1990) e ECA Digital (Lei 15.211/2025) art. 9º § 1º: toda ação exige ser membro da Rede (18+ e consentimento).

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Funções da organização (tesouraria, comunicação, segurança…), com as permissões marcadas e quantas vagas tem.
create table if not exists interno.rede_org_funcoes (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  tipo text not null check (tipo in ('tesouraria', 'comunicacao', 'seguranca', 'secretaria', 'formacao', 'coordenacao', 'outra')),
  nome text not null check (char_length(btrim(nome)) between 2 and 40),
  -- caixa: lança e confere o caixa; mesa: conduz a Ata Viva e as plenárias; tear: tece e marca os encaminhamentos;
  -- avisos: escreve pela organização no mural (reservado); arquivos: cuida dos arquivos do núcleo (reservado).
  permissoes text[] not null default '{}' check (permissoes <@ array['caixa', 'mesa', 'tear', 'avisos', 'arquivos']::text[]),
  vagas smallint not null default 1 check (vagas between 1 and 9),
  criado_dia date not null default current_date
);
create unique index if not exists rede_org_funcoes_nome on interno.rede_org_funcoes (org, lower(nome));
alter table interno.rede_org_funcoes enable row level security;

-- Quem ocupa a função e até quando. Só o dia (LGPD art. 6º, III).
create table if not exists interno.rede_org_mandatos (
  id uuid primary key default gen_random_uuid(),
  funcao uuid not null references interno.rede_org_funcoes (id) on delete cascade,
  pessoa uuid not null references interno.perfis (id) on delete cascade,
  inicio date not null default current_date,
  fim date not null,
  origem text not null default 'nomeacao' check (origem in ('nomeacao', 'eleicao')),
  encerrado_dia date,
  check (fim >= inicio)
);
create unique index if not exists rede_org_mandatos_um on interno.rede_org_mandatos (funcao, pessoa) where encerrado_dia is null;
create index if not exists rede_org_mandatos_pessoa on interno.rede_org_mandatos (pessoa) where encerrado_dia is null;
alter table interno.rede_org_mandatos enable row level security;
-- O mandato por NOMEAÇÃO nasce pendente (aceito = false): a pessoa só aparece em "quem ocupa", e a função só vale, depois que ela
-- mesma aceitar (LGPD art. 5º, II e art. 11: ligar alguém a uma função de organização política sem ela consentir expõe filiação).
-- O da eleição já nasce aceito: a candidatura foi dela.
alter table interno.rede_org_mandatos add column if not exists aceito boolean not null default true;

-- Eleições internas: a votação é uma consulta ranqueada (voto secreto e apuração de rede_consultas).
create table if not exists interno.rede_org_eleicoes (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  funcao uuid not null references interno.rede_org_funcoes (id) on delete cascade,
  inscricoes_ate timestamptz not null,
  prazo timestamptz not null,
  mandato_fim date not null,
  quorum integer check (quorum is null or quorum between 3 and 1000000),
  consulta uuid references interno.rede_consultas (id) on delete set null,
  situacao text not null default 'inscricoes' check (situacao in ('inscricoes', 'votacao', 'apurada', 'vazia', 'sem_quorum')),
  eleito uuid references interno.rede_org_mandatos (id) on delete set null,
  criado_em timestamptz not null default now(),
  check (prazo > inscricoes_ate)
);
create index if not exists rede_org_eleicoes_org on interno.rede_org_eleicoes (org, prazo desc);
alter table interno.rede_org_eleicoes enable row level security;

create table if not exists interno.rede_org_eleicao_candidatos (
  eleicao uuid not null references interno.rede_org_eleicoes (id) on delete cascade,
  pessoa uuid not null references interno.perfis (id) on delete cascade,
  opcao uuid references interno.rede_consulta_opcoes (id) on delete set null,
  primary key (eleicao, pessoa)
);
alter table interno.rede_org_eleicao_candidatos enable row level security;

-- A consulta de uma eleição é interna (quem é de fora não vê os candidatos).
alter table interno.rede_consultas add column if not exists eleicao uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_consultas'::regclass and conname = 'rede_consultas_eleicao_fk') then
    alter table interno.rede_consultas add constraint rede_consultas_eleicao_fk foreign key (eleicao) references interno.rede_org_eleicoes (id) on delete cascade;
  end if;
end $$;

-- Ata Viva.
create table if not exists interno.rede_org_atas (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  plenaria uuid references interno.rede_plenarias (id) on delete set null,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
  situacao text not null default 'aberta' check (situacao in ('aberta', 'fechada')),
  ponto_atual uuid,
  fala_segundos smallint not null default 120 check (fala_segundos between 30 and 900),
  fala_atual uuid,
  fala_posicao text check (fala_posicao is null or fala_posicao in ('favor', 'contra', 'esclarecimento')),
  fala_desde timestamptz,
  sinais_abertos boolean not null default false,
  aberta_em timestamptz not null default now(),
  fechada_em timestamptz,
  post uuid references interno.rede_posts (id) on delete set null
);
create index if not exists rede_org_atas_org on interno.rede_org_atas (org, aberta_em desc);
alter table interno.rede_org_atas enable row level security;

create table if not exists interno.rede_org_ata_pontos (
  id uuid primary key default gen_random_uuid(),
  ata uuid not null references interno.rede_org_atas (id) on delete cascade,
  ordem smallint not null check (ordem between 1 and 30),
  texto text not null check (char_length(btrim(texto)) between 3 and 200),
  carimbo text check (carimbo is null or carimbo in ('aprovado', 'retirado', 'vai_a_base')),
  deliberacao text not null default '' check (char_length(deliberacao) <= 500),
  carimbado_em timestamptz,
  -- O agregado dos sinais quando a mesa fechou (proporções em passos de 10 %, só se houve 3 sinais ou mais). Nada individual.
  sinais jsonb,
  unique (ata, ordem)
);
alter table interno.rede_org_ata_pontos enable row level security;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_org_atas'::regclass and conname = 'rede_org_atas_ponto_fk') then
    alter table interno.rede_org_atas add constraint rede_org_atas_ponto_fk foreign key (ponto_atual) references interno.rede_org_ata_pontos (id) on delete set null;
  end if;
end $$;

-- A fila de fala (ordem de chegada: seq, que ninguém muda). Some quando o ponto é carimbado ou a ata fecha.
create table if not exists interno.rede_org_ata_falas (
  id uuid primary key default gen_random_uuid(),
  ata uuid not null references interno.rede_org_atas (id) on delete cascade,
  ponto uuid not null references interno.rede_org_ata_pontos (id) on delete cascade,
  seq bigint generated always as identity,
  pessoa uuid not null references interno.perfis (id) on delete cascade,
  posicao text not null check (posicao in ('favor', 'contra', 'esclarecimento')),
  falou_em timestamptz
);
create unique index if not exists rede_org_ata_falas_uma on interno.rede_org_ata_falas (ponto, pessoa) where falou_em is null;
create index if not exists rede_org_ata_falas_fila on interno.rede_org_ata_falas (ponto, seq);
alter table interno.rede_org_ata_falas enable row level security;

-- Sinais de consenso do ponto em curso. Apagados quando a mesa fecha os sinais, carimba o ponto ou fecha a ata.
create table if not exists interno.rede_org_ata_sinais (
  ponto uuid not null references interno.rede_org_ata_pontos (id) on delete cascade,
  pessoa uuid not null references interno.perfis (id) on delete cascade,
  sinal text not null check (sinal in ('concordo', 'duvida', 'bloqueio', 'abstencao')),
  primary key (ponto, pessoa)
);
alter table interno.rede_org_ata_sinais enable row level security;

-- Caixa transparente.
create table if not exists interno.rede_org_caixas (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 3 and 60),
  tipo text not null check (tipo in ('nucleo', 'ato', 'greve', 'geral')),
  nucleo uuid references interno.rede_nucleos (id) on delete set null,
  -- Como doar fica FORA da Alumia: a chave Pix da organização como texto e/ou um link https (sem pagamento aqui dentro).
  pix text not null default '' check (char_length(pix) <= 140),
  link text check (link is null or (link ~ '^https://[^\s]{3,}$' and char_length(link) <= 300)),
  criado_dia date not null default current_date
);
create unique index if not exists rede_org_caixas_nome on interno.rede_org_caixas (org, lower(nome));
alter table interno.rede_org_caixas enable row level security;

create table if not exists interno.rede_org_caixa_lancamentos (
  id uuid primary key default gen_random_uuid(),
  caixa uuid not null references interno.rede_org_caixas (id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'saida')),
  centavos bigint not null check (centavos between 1 and 100000000000),
  descricao text not null check (char_length(btrim(descricao)) between 3 and 140),
  dia date not null,
  -- Quem lançou e quem conferiu: guardado só para impedir que a mesma pessoa carimbe duas vezes. Nunca sai em resposta nenhuma.
  lancou uuid references interno.perfis (id) on delete set null,
  conferiu1 uuid references interno.perfis (id) on delete set null,
  conferiu1_dia date,
  conferiu2 uuid references interno.perfis (id) on delete set null,
  conferiu2_dia date,
  criado_em timestamptz not null default now(),
  check (conferiu2 is null or conferiu1 is not null)
);
create index if not exists rede_org_caixa_lancamentos_caixa on interno.rede_org_caixa_lancamentos (caixa, dia desc);
alter table interno.rede_org_caixa_lancamentos enable row level security;

-- A foto da nota (já reencodada pelo aparelho: sem EXIF; o dado pessoal foi borrado antes de mandar). Até 400 KB.
create table if not exists interno.rede_org_caixa_notas (
  lancamento uuid primary key references interno.rede_org_caixa_lancamentos (id) on delete cascade,
  mime text not null check (mime in ('image/webp', 'image/jpeg')),
  bytes bytea not null check (octet_length(bytes) between 100 and 400000)
);
alter table interno.rede_org_caixa_notas enable row level security;

-- Lampião: o que o núcleo novo guarda além do nome (pauta da 1ª reunião, primeira tarefa, cidade e estado escritos, mapa).
alter table interno.rede_nucleos add column if not exists org_pauta text not null default '';
alter table interno.rede_nucleos add column if not exists org_tarefa text not null default '';
alter table interno.rede_nucleos add column if not exists org_cidade text not null default '';
alter table interno.rede_nucleos add column if not exists org_uf text;
alter table interno.rede_nucleos add column if not exists org_no_mapa boolean not null default false;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_nucleos'::regclass and conname = 'rede_nucleos_org_pauta') then
    alter table interno.rede_nucleos add constraint rede_nucleos_org_pauta check (char_length(org_pauta) <= 600);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_nucleos'::regclass and conname = 'rede_nucleos_org_tarefa') then
    alter table interno.rede_nucleos add constraint rede_nucleos_org_tarefa check (char_length(org_tarefa) <= 200);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_nucleos'::regclass and conname = 'rede_nucleos_org_cidade') then
    alter table interno.rede_nucleos add constraint rede_nucleos_org_cidade check (char_length(org_cidade) <= 60);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_nucleos'::regclass and conname = 'rede_nucleos_org_uf') then
    alter table interno.rede_nucleos add constraint rede_nucleos_org_uf check (org_uf is null or org_uf in ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
      'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'));
  end if;
end $$;

-- Tear ligado: de onde o fio nasceu (à mão, de uma consulta fechada, de uma ata) e a função de verdade.
alter table interno.rede_org_encaminhamentos add column if not exists origem text not null default 'mao';
alter table interno.rede_org_encaminhamentos add column if not exists origem_id uuid;
alter table interno.rede_org_encaminhamentos add column if not exists funcao_id uuid;
alter table interno.rede_org_encaminhamentos add column if not exists avisado_dia date;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_org_encaminhamentos'::regclass and conname = 'rede_org_encaminhamentos_origem') then
    alter table interno.rede_org_encaminhamentos add constraint rede_org_encaminhamentos_origem check (origem in ('mao', 'consulta', 'ata'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_org_encaminhamentos'::regclass and conname = 'rede_org_encaminhamentos_funcao_fk') then
    alter table interno.rede_org_encaminhamentos add constraint rede_org_encaminhamentos_funcao_fk foreign key (funcao_id) references interno.rede_org_funcoes (id) on delete set null;
  end if;
end $$;
create unique index if not exists rede_org_encaminhamentos_origem_um on interno.rede_org_encaminhamentos (origem, origem_id) where origem_id is not null;

-- Nenhuma permissão direta nas tabelas novas.
do $$
declare t text;
begin
  foreach t in array array['rede_org_funcoes', 'rede_org_mandatos', 'rede_org_eleicoes', 'rede_org_eleicao_candidatos', 'rede_org_atas',
    'rede_org_ata_pontos', 'rede_org_ata_falas', 'rede_org_ata_sinais', 'rede_org_caixas', 'rede_org_caixa_lancamentos', 'rede_org_caixa_notas'] loop
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ── 2. Ajudas internas ────────────────────────────────────────────────────────────────────────────────────────────────────

/** `p_quem` é de dentro da organização: gerencia ou é de um núcleo dela. */
create or replace function interno.alumia_org_dentro(p_quem uuid, p_org uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and p_org is not null and (interno.alumia_org_gere(p_quem, p_org) or exists (
    select 1 from rede_nucleos n join rede_nucleo_membros m on m.nucleo = n.id where n.org = p_org and m.usuario = p_quem))
$$;

/** `p_quem` ocupa hoje (mandato aceito por ela) uma função da organização com a permissão `p_perm`. */
create or replace function interno.alumia_org_funcao_tem(p_quem uuid, p_org uuid, p_perm text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and exists (
    select 1 from rede_org_mandatos m join rede_org_funcoes f on f.id = m.funcao
    where f.org = p_org and m.pessoa = p_quem and m.aceito and m.encerrado_dia is null and m.fim >= current_date and p_perm = any (f.permissoes))
$$;

/** Conduz a mesa (Ata Viva, plenária): gestor ou função com a permissão "mesa". */
create or replace function interno.alumia_org_mesa(p_quem uuid, p_org uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.alumia_org_gere(p_quem, p_org) or interno.alumia_org_funcao_tem(p_quem, p_org, 'mesa')
$$;

/**
 * A chama de um núcleo, em DUAS faixas só: "brasa" (menos de 3 pessoas além de quem fundou, sem distinguir 0, 1 ou 2: contagem só
 * a partir de 3) e "plena" (3 ou mais além de quem fundou). Nunca o número. Conta quem estava no núcleo no último marco
 * (interno.rede_contagem_marco, o mesmo atraso do mosaico dos atos; a migração 20261110-alumia-b1-atos.sql roda antes): quem
 * recarrega o perfil não vê a chama mudar no instante em que alguém entra ou sai (filiação a núcleo é dado sensível).
 */
create or replace function interno.alumia_chama(p_nucleo uuid) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select case when
    (select count(*) from rede_nucleo_membros m join perfis f on f.id = m.usuario
      where m.nucleo = p_nucleo and not f.suspenso and m.entrou_em <= interno.rede_contagem_marco())
    + (select count(*) from rede_contagem_saidas s where s.alvo = p_nucleo
        and s.entrou_em <= interno.rede_contagem_marco() and s.saiu_em > interno.rede_contagem_marco())
    >= 4 then 'plena' else 'brasa' end
$$;

/** Quem sai do núcleo deixa só o intervalo, sem a pessoa (se já contava no marco). Núcleo apagado (cascata) não deixa nada. */
create or replace function interno.alumia_nucleo_saiu() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if old.entrou_em <= interno.rede_contagem_marco() and exists (select 1 from rede_nucleos where id = old.nucleo) then
    insert into rede_contagem_saidas (alvo, entrou_em) values (old.nucleo, old.entrou_em);
  end if;
  if random() < 0.05 then delete from rede_contagem_saidas where saiu_em < now() - interval '1 hour'; end if;
  return old;
end $$;
drop trigger if exists alumia_nucleo_saiu on interno.rede_nucleo_membros;
create trigger alumia_nucleo_saiu after delete on interno.rede_nucleo_membros for each row execute function interno.alumia_nucleo_saiu();

/** Uma proporção em passos de 10 % (para baixo), como o mosaico acende. */
create or replace function interno.alumia_passo10(p_n bigint, p_total bigint) returns numeric language sql immutable set search_path = interno, pg_temp as $$
  select case when p_total > 0 then floor(p_n * 10.0 / p_total) / 10 else 0 end
$$;

/** Texto livre que vai a público não pode trazer CPF, telefone, e-mail nem endereço com número (o doador nunca aparece). */
create or replace function interno.alumia_sem_dado_pessoal(p_texto text, p_campo text) returns text language plpgsql immutable set search_path = interno, pg_temp as $$
begin
  if interno.rede3_pub_dado_pessoal(p_texto) or coalesce(p_texto, '') ~ '\d{4,5}[-\s]?\d{4}' then perform interno.erro('dado_pessoal'); end if;
  return btrim(coalesce(p_texto, ''));
end $$;

/** A organização de um id, com quem chama já conferido como membro da Rede e sem bloqueio. */
create or replace function interno.alumia_org_vista(p_org uuid, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_org is not null and not interno.rede_bloqueado(p_quem, p_org) and exists (select 1 from perfis f where f.id = p_org and not f.suspenso)
$$;

-- ── 3. Funções e mandatos ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * As funções da organização. Quem é de fora vê só os nomes (nunca quem ocupa). Quem é de dentro vê quem ocupa (codinome e @, a
 * etiqueta ao lado do codinome) e até quando; e "minhas", as funções que eu ocupo. A indicação que a pessoa ainda NÃO aceitou só
 * aparece para quem gerencia (que a fez) e para ela mesma, em "minhas", marcada como pendente: os outros de dentro não a veem.
 */
create or replace function public.rede_org_funcoes(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); o uuid := interno.alumia_org_de(p_handle); v_dentro boolean; v_gere boolean;
begin
  perform interno.limite('alumia_org_ler', 300, 10);
  if o is null or interno.rede_bloqueado(v, o) then return null; end if;
  if v is null and not exists (select 1 from rede_orgs where perfil = o and verificada_em is not null) then return null; end if;
  v_dentro := interno.alumia_org_dentro(v, o);
  v_gere := coalesce(interno.alumia_org_gere(v, o), false);
  return jsonb_build_object(
    'dentro', v_dentro, 'gerencio', interno.alumia_org_gere(v, o),
    'funcoes', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'tipo', f.tipo, 'nome', f.nome, 'permissoes', to_jsonb(f.permissoes), 'vagas', f.vagas,
        'ocupantes', case when v_dentro then coalesce((select jsonb_agg(jsonb_build_object('mandato', m.id, 'handle', p.rede_handle, 'codinome', coalesce(p.rede_codinome, ''),
              'fim', m.fim, 'origem', m.origem, 'eu', m.pessoa = v, 'pendente', not m.aceito) order by m.inicio, p.rede_handle)
            from rede_org_mandatos m join perfis p on p.id = m.pessoa
            where m.funcao = f.id and m.encerrado_dia is null and m.fim >= current_date and not p.suspenso and (m.aceito or v_gere)), '[]'::jsonb) end)
      order by f.tipo, lower(f.nome)) from rede_org_funcoes f where f.org = o), '[]'::jsonb),
    'minhas', case when v is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('funcao', f.id, 'nome', f.nome, 'fim', m.fim, 'mandato', m.id, 'permissoes', to_jsonb(f.permissoes), 'pendente', not m.aceito) order by f.nome)
      from rede_org_mandatos m join rede_org_funcoes f on f.id = m.funcao
      where f.org = o and m.pessoa = v and m.encerrado_dia is null and m.fim >= current_date), '[]'::jsonb) end);
end $$;

/** Criar ou mudar uma função (só quem gerencia). Até 30 funções por organização. */
create or replace function public.rede_org_funcao_salvar(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare o uuid := interno.alumia_org_gestor(p_handle, 'alumia_org_funcao', 60, 60); v_perm text[]; v_vagas integer;
begin
  begin
    select coalesce(array_agg(distinct x), '{}') into v_perm from jsonb_array_elements_text(coalesce(p -> 'permissoes', '[]'::jsonb)) x;
  exception when others then perform interno.erro('invalido:permissoes');
  end;
  if not v_perm <@ array['caixa', 'mesa', 'tear', 'avisos', 'arquivos']::text[] then perform interno.erro('invalido:permissoes'); end if;
  if coalesce(p ->> 'vagas', '1') !~ '^[0-9]{1,2}$' then perform interno.erro('invalido:vagas'); end if;
  v_vagas := coalesce(nullif(p ->> 'vagas', ''), '1')::integer;
  if v_vagas not between 1 and 9 then perform interno.erro('invalido:vagas'); end if;
  if char_length(btrim(coalesce(p ->> 'nome', ''))) not between 2 and 40 then perform interno.erro('invalido:nome'); end if;
  begin
    if nullif(p ->> 'id', '') is not null then
      update rede_org_funcoes set tipo = p ->> 'tipo', nome = btrim(p ->> 'nome'), permissoes = v_perm, vagas = v_vagas where id = (p ->> 'id')::uuid and org = o;
      if not found then perform interno.erro('nao_encontrado'); end if;
    else
      if (select count(*) from rede_org_funcoes where org = o) >= 30 then perform interno.erro('limite'); end if;
      insert into rede_org_funcoes (org, tipo, nome, permissoes, vagas) values (o, p ->> 'tipo', btrim(p ->> 'nome'), v_perm, v_vagas);
    end if;
  exception
    when unique_violation then perform interno.erro('funcao_existe');
    when check_violation or not_null_violation or invalid_text_representation then perform interno.erro('invalido:funcao');
  end;
  return public.rede_org_funcoes(p_handle);
end $$;

/** Apagar uma função (só quem gerencia). Os mandatos dela acabam junto; os fios do Tear ficam com o nome escrito. */
create or replace function public.rede_org_funcao_apagar(p_handle text, p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare o uuid := interno.alumia_org_gestor(p_handle, 'alumia_org_funcao', 60, 60);
begin
  delete from rede_org_funcoes where id = p_id and org = o;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('alumia_funcao_apagar', o::text, '{}'::jsonb);
  return public.rede_org_funcoes(p_handle);
end $$;

/**
 * Indicar alguém para uma função até `fim` (só quem gerencia). A pessoa precisa ser de um núcleo da organização e membro da Rede;
 * respeita as vagas (a indicação pendente segura a vaga). O mandato nasce PENDENTE: ela recebe um aviso e só passa a ocupar a
 * função, e a aparecer para os outros de dentro, quando aceitar (rede_org_mandato_aceitar). Recusar é encerrar.
 */
create or replace function public.rede_org_mandato_dar(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare o uuid := interno.alumia_org_gestor(p_handle, 'alumia_org_mandato', 60, 60); f rede_org_funcoes; v_quem uuid; v_fim date;
begin
  begin
    select * into f from rede_org_funcoes where id = (p ->> 'funcao')::uuid and org = o;
  exception when others then perform interno.erro('invalido:funcao');
  end;
  if f.id is null then perform interno.erro('nao_encontrado'); end if;
  begin v_fim := (p ->> 'fim')::date; exception when others then perform interno.erro('invalido:fim'); end;
  if v_fim is null or v_fim <= current_date or v_fim > current_date + 730 then perform interno.erro('invalido:fim'); end if;
  select id into v_quem from perfis where rede_handle = lower(btrim(coalesce(p ->> 'handle', ''), ' @')) and not suspenso;
  if v_quem is null or not interno.rede2_membro(v_quem) or interno.rede_bloqueado(o, v_quem)
     or not exists (select 1 from rede_nucleos n join rede_nucleo_membros m on m.nucleo = n.id where n.org = o and m.usuario = v_quem) then
    perform interno.erro('nao_encontrado');
  end if;
  if (select count(*) from rede_org_mandatos where funcao = f.id and encerrado_dia is null and fim >= current_date) >= f.vagas then perform interno.erro('sem_vaga'); end if;
  insert into rede_org_mandatos (funcao, pessoa, fim, origem, aceito) values (f.id, v_quem, v_fim, 'nomeacao', false) on conflict do nothing;
  if not found then perform interno.erro('ja_ocupa'); end if;
  perform interno.avisar_em(v_quem, format('Você foi indicada para a função “%s” em “%s”, até %s. Ela só vale, e só aparece para as outras pessoas, se você aceitar pela página da organização.', f.nome, interno.rede_nome(o), to_char(v_fim, 'DD/MM/YYYY')), 'rede');
  return public.rede_org_funcoes(p_handle);
end $$;

/** Aceitar a indicação para uma função: só a própria pessoa, e só enquanto a indicação está de pé. A partir daí o mandato vale. */
create or replace function public.rede_org_mandato_aceitar(p_mandato uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); m rede_org_mandatos; o uuid;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into m from rede_org_mandatos where id = p_mandato and pessoa = v and encerrado_dia is null and fim >= current_date;
  if m.id is null then perform interno.erro('nao_encontrado'); end if;
  select f.org into o from rede_org_funcoes f where f.id = m.funcao;
  perform interno.limite('alumia_org_mandato', 60, 60);
  update rede_org_mandatos set aceito = true where id = m.id;
  return public.rede_org_funcoes((select rede_handle from perfis where id = o));
end $$;

/** Encerrar um mandato: quem gerencia, ou a própria pessoa (sair da função, ou recusar a indicação). Registrado sem dizer quem era. */
create or replace function public.rede_org_mandato_encerrar(p_mandato uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); m rede_org_mandatos; o uuid;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into m from rede_org_mandatos where id = p_mandato and encerrado_dia is null;
  select f.org into o from rede_org_funcoes f where f.id = m.funcao;
  if m.id is null or not (m.pessoa = v or interno.alumia_org_gere(v, o)) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_org_mandato', 60, 60);
  update rede_org_mandatos set encerrado_dia = current_date where id = m.id;
  perform interno.registrar('alumia_mandato_encerrar', o::text, jsonb_build_object('funcao', m.funcao));
  return public.rede_org_funcoes((select rede_handle from perfis where id = o));
end $$;

-- ── 4. Eleições internas ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Faz a eleição andar no relógio: fim das inscrições → abre a votação (uma consulta ranqueada com os candidatos e "Reabrir a
 * eleição"); fim do prazo → apura (alumia_apurar). Com menos de 3 votos ou sem quórum, ninguém é eleito. Quem vence ganha o
 * mandato até `mandato_fim`. Roda na leitura e na rotina; é idempotente.
 */
create or replace function interno.alumia_eleicao_avancar(p_id uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare e rede_org_eleicoes; f rede_org_funcoes; v_c uuid; c record; i integer := 0; v_votantes integer; v_ap jsonb; v_venc uuid; v_pessoa uuid; v_m uuid;
begin
  select * into e from rede_org_eleicoes where id = p_id for update;
  if not found then return; end if;
  select * into f from rede_org_funcoes where id = e.funcao;
  if e.situacao = 'inscricoes' and now() >= e.inscricoes_ate then
    if not exists (select 1 from rede_org_eleicao_candidatos where eleicao = e.id) then
      update rede_org_eleicoes set situacao = 'vazia' where id = e.id;
      return;
    end if;
    insert into rede_consultas (org, nucleos, pergunta, metodo, quorum, prazo, compromisso, eleicao)
    values (e.org, '{}', left(format('Eleição: %s', f.nome), 280), 'ranqueada', e.quorum, e.prazo,
            left(format('Quem vencer ocupa a função “%s” até %s. Se “Reabrir a eleição” vencer, ninguém assume e a eleição é marcada de novo.', f.nome, to_char(e.mandato_fim, 'DD/MM/YYYY')), 500), e.id)
    returning id into v_c;
    for c in select k.pessoa, coalesce(nullif(p.rede_codinome, ''), p.rede_handle) as nome from rede_org_eleicao_candidatos k join perfis p on p.id = k.pessoa
             where k.eleicao = e.id and not p.suspenso order by lower(coalesce(nullif(p.rede_codinome, ''), p.rede_handle)) limit 7 loop
      i := i + 1;
      insert into rede_consulta_opcoes (consulta, ordem, texto) values (v_c, i, left(c.nome, 120)) returning id into v_m;
      update rede_org_eleicao_candidatos set opcao = v_m where eleicao = e.id and pessoa = c.pessoa;
    end loop;
    insert into rede_consulta_opcoes (consulta, ordem, texto) values (v_c, i + 1, 'Reabrir a eleição');
    update rede_org_eleicoes set situacao = 'votacao', consulta = v_c where id = e.id;
    return;
  end if;
  if e.situacao = 'votacao' and now() >= e.prazo and e.consulta is not null then
    select count(*) into v_votantes from rede_consulta_votantes where consulta = e.consulta;
    if v_votantes < 3 or (e.quorum is not null and v_votantes < e.quorum) then
      update rede_org_eleicoes set situacao = 'sem_quorum' where id = e.id;
      return;
    end if;
    v_ap := interno.alumia_apurar(e.consulta);
    v_venc := nullif(v_ap ->> 'vencedora', '')::uuid;
    select k.pessoa into v_pessoa from rede_org_eleicao_candidatos k where k.eleicao = e.id and k.opcao = v_venc;
    if v_pessoa is not null and interno.rede2_membro(v_pessoa) and not exists (select 1 from perfis where id = v_pessoa and suspenso) then
      update rede_org_mandatos set encerrado_dia = current_date where funcao = e.funcao and pessoa = v_pessoa and encerrado_dia is null;
      insert into rede_org_mandatos (funcao, pessoa, fim, origem) values (e.funcao, v_pessoa, greatest(e.mandato_fim, current_date), 'eleicao') returning id into v_m;
      update rede_org_eleicoes set situacao = 'apurada', eleito = v_m where id = e.id;
      perform interno.avisar_em(v_pessoa, format('Você foi eleita para a função “%s” em “%s”, até %s.', f.nome, interno.rede_nome(e.org), to_char(e.mandato_fim, 'DD/MM/YYYY')), 'rede');
    else
      update rede_org_eleicoes set situacao = 'apurada' where id = e.id;
    end if;
  end if;
end $$;

/** Uma eleição como a tela mostra (só para quem é de dentro). */
create or replace function interno.alumia_eleicao_json(e interno.rede_org_eleicoes, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', e.id, 'funcao', jsonb_build_object('id', f.id, 'nome', f.nome, 'tipo', f.tipo),
    'inscricoesAte', e.inscricoes_ate, 'prazo', e.prazo, 'mandatoFim', e.mandato_fim, 'quorum', e.quorum, 'situacao', e.situacao,
    'candidatos', coalesce((select jsonb_agg(jsonb_build_object('handle', p.rede_handle, 'codinome', coalesce(p.rede_codinome, ''), 'eu', k.pessoa = p_quem) order by lower(coalesce(nullif(p.rede_codinome, ''), p.rede_handle)))
      from rede_org_eleicao_candidatos k join perfis p on p.id = k.pessoa where k.eleicao = e.id and not p.suspenso), '[]'::jsonb),
    'souCandidata', exists (select 1 from rede_org_eleicao_candidatos k where k.eleicao = e.id and k.pessoa = p_quem),
    'possoCandidatar', e.situacao = 'inscricoes' and now() < e.inscricoes_ate and interno.rede2_membro(p_quem)
      and exists (select 1 from rede_nucleos n join rede_nucleo_membros m on m.nucleo = n.id where n.org = e.org and m.usuario = p_quem),
    'consulta', (select interno.alumia_consulta_json(c, p_quem) from rede_consultas c where c.id = e.consulta),
    'eleita', (select jsonb_build_object('handle', p.rede_handle, 'codinome', coalesce(p.rede_codinome, '')) from rede_org_mandatos m join perfis p on p.id = m.pessoa where m.id = e.eleito))
  from rede_org_funcoes f where f.id = e.funcao
$$;

/** As eleições da organização (só quem é de dentro; de fora: nulo). Faz cada uma andar no relógio antes de mostrar. */
create or replace function public.rede_org_eleicoes(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); o uuid := interno.alumia_org_de(p_handle); e record;
begin
  perform interno.limite('alumia_org_ler', 300, 10);
  if o is null or not interno.alumia_org_dentro(v, o) or interno.rede_bloqueado(v, o) then return null; end if;
  for e in select id from rede_org_eleicoes where org = o and situacao in ('inscricoes', 'votacao') loop perform interno.alumia_eleicao_avancar(e.id); end loop;
  return coalesce((select jsonb_agg(interno.alumia_eleicao_json(x, v) order by x.prazo desc)
    from (select * from rede_org_eleicoes where org = o order by prazo desc limit 10) x), '[]'::jsonb);
end $$;

/** Marcar uma eleição para uma função (só quem gerencia). Inscrições de 1 h a 30 dias; votação de 1 h a 30 dias depois. */
create or replace function public.rede_org_eleicao_abrir(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare o uuid := interno.alumia_org_gestor(p_handle, 'alumia_org_eleicao', 10, 1440); v_f uuid; v_ins timestamptz; v_prazo timestamptz; v_fim date; v_q integer;
begin
  begin
    v_f := (p ->> 'funcao')::uuid;
    v_ins := (p ->> 'inscricoesAte')::timestamptz;
    v_prazo := (p ->> 'prazo')::timestamptz;
    v_fim := (p ->> 'mandatoFim')::date;
    v_q := nullif(p ->> 'quorum', '')::integer;
  exception when others then perform interno.erro('invalido:eleicao');
  end;
  if not exists (select 1 from rede_org_funcoes where id = v_f and org = o) then perform interno.erro('nao_encontrado'); end if;
  if v_ins is null or v_ins < now() + interval '1 hour' or v_ins > now() + interval '30 days' then perform interno.erro('invalido:inscricoes'); end if;
  if v_prazo is null or v_prazo < v_ins + interval '1 hour' or v_prazo > v_ins + interval '30 days' then perform interno.erro('invalido:prazo'); end if;
  if v_fim is null or v_fim <= (v_prazo at time zone 'America/Sao_Paulo')::date or v_fim > current_date + 1100 then perform interno.erro('invalido:mandato'); end if;
  if v_q is not null and v_q not between 3 and 1000000 then perform interno.erro('invalido:quorum'); end if;
  if exists (select 1 from rede_org_eleicoes where funcao = v_f and situacao in ('inscricoes', 'votacao')) then perform interno.erro('eleicao_aberta'); end if;
  insert into rede_org_eleicoes (org, funcao, inscricoes_ate, prazo, mandato_fim, quorum) values (o, v_f, v_ins, v_prazo, v_fim, v_q);
  return public.rede_org_eleicoes(p_handle);
end $$;

/** Me candidatar (ou desistir) enquanto as inscrições estão abertas. Só quem é de um núcleo da organização. Até 7 candidaturas. */
create or replace function public.rede_org_eleicao_candidatar(p_eleicao uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); e rede_org_eleicoes;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into e from rede_org_eleicoes where id = p_eleicao;
  if not found or interno.rede_bloqueado(v, e.org) or not exists (select 1 from rede_nucleos n join rede_nucleo_membros m on m.nucleo = n.id where n.org = e.org and m.usuario = v) then
    perform interno.erro('nao_encontrado');
  end if;
  perform interno.limite('alumia_org_candidatar', 20, 60);
  if e.situacao <> 'inscricoes' or now() >= e.inscricoes_ate then perform interno.erro('inscricoes_fechadas'); end if;
  if coalesce(p_sim, false) then
    if (select count(*) from rede_org_eleicao_candidatos where eleicao = e.id) >= 7 then perform interno.erro('limite'); end if;
    insert into rede_org_eleicao_candidatos (eleicao, pessoa) values (e.id, v) on conflict do nothing;
  else
    delete from rede_org_eleicao_candidatos where eleicao = e.id and pessoa = v;
  end if;
  return interno.alumia_eleicao_json((select x from rede_org_eleicoes x where x.id = e.id), v);
end $$;

-- ── 5. Ata Viva e sinais de consenso ──────────────────────────────────────────────────────────────────────────────────────

/** O agregado dos sinais de um ponto: nulo abaixo de 3; senão proporções em passos de 10 % e se há bloqueio. */
create or replace function interno.alumia_sinais(p_ponto uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select case when count(*) >= 3 then jsonb_build_object(
      'concordo', interno.alumia_passo10(count(*) filter (where sinal = 'concordo'), count(*)),
      'duvida', interno.alumia_passo10(count(*) filter (where sinal = 'duvida'), count(*)),
      'bloqueio', interno.alumia_passo10(count(*) filter (where sinal = 'bloqueio'), count(*)),
      'abstencao', interno.alumia_passo10(count(*) filter (where sinal = 'abstencao'), count(*)),
      'pessoas', interno.alumia_pessoas(count(*)),
      'haBloqueio', count(*) filter (where sinal = 'bloqueio') > 0) end
  from rede_org_ata_sinais where ponto = p_ponto
$$;

/**
 * A ata como a tela mostra. Quem é de fora vê só ata FECHADA (pauta, carimbos e deliberações, sem ninguém). Quem é de dentro vê a
 * aberta: o ponto em curso, a fala (posição e tempo), o meu lugar na fila ("você é a 4ª") e os sinais (mosaico a partir de 3).
 * Só a mesa vê a fila por codinome e o aviso "há bloqueio".
 */
create or replace function interno.alumia_ata_json(a interno.rede_org_atas, p_quem uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_dentro boolean := interno.alumia_org_dentro(p_quem, a.org); v_mesa boolean := interno.alumia_org_mesa(p_quem, a.org); v_minha rede_org_ata_falas; v_lugar integer; v_sinais jsonb;
begin
  if a.situacao = 'aberta' and not v_dentro then return null; end if;
  if a.situacao = 'aberta' and a.ponto_atual is not null then
    select * into v_minha from rede_org_ata_falas where ponto = a.ponto_atual and pessoa = p_quem and falou_em is null;
    if v_minha.id is not null then
      select count(*) into v_lugar from rede_org_ata_falas where ponto = a.ponto_atual and falou_em is null and seq <= v_minha.seq;
    end if;
    v_sinais := interno.alumia_sinais(a.ponto_atual);
  end if;
  return jsonb_build_object(
    'id', a.id, 'titulo', a.titulo, 'situacao', a.situacao, 'abertaEm', a.aberta_em, 'fechadaEm', a.fechada_em, 'post', a.post,
    'org', (select jsonb_build_object('handle', f.rede_handle, 'codinome', coalesce(f.rede_codinome, '')) from perfis f where f.id = a.org),
    'plenaria', a.plenaria, 'souMesa', v_mesa and a.situacao = 'aberta', 'dentro', v_dentro,
    'pontoAtual', case when a.situacao = 'aberta' then a.ponto_atual end,
    'falaSegundos', a.fala_segundos,
    'fala', case when a.situacao = 'aberta' and a.fala_desde is not null then jsonb_build_object('desde', a.fala_desde, 'posicao', a.fala_posicao,
      'quem', case when v_mesa then (select coalesce(nullif(p.rede_codinome, ''), p.rede_handle) from rede_org_ata_falas x join perfis p on p.id = x.pessoa where x.id = a.fala_atual) end,
      'souEu', exists (select 1 from rede_org_ata_falas x where x.id = a.fala_atual and x.pessoa = p_quem)) end,
    'minha', case when v_minha.id is not null then jsonb_build_object('posicao', v_minha.posicao, 'lugar', v_lugar) end,
    'naFila', case when a.situacao = 'aberta' and a.ponto_atual is not null then interno.alumia_pessoas((select count(*) from rede_org_ata_falas where ponto = a.ponto_atual and falou_em is null)) end,
    'fila', case when v_mesa and a.situacao = 'aberta' and a.ponto_atual is not null then coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'posicao', x.posicao,
        'codinome', coalesce(nullif(p.rede_codinome, ''), p.rede_handle),
        'funcoes', coalesce((select jsonb_agg(fu.nome order by fu.nome) from rede_org_mandatos m join rede_org_funcoes fu on fu.id = m.funcao
                    where fu.org = a.org and m.pessoa = x.pessoa and m.aceito and m.encerrado_dia is null and m.fim >= current_date), '[]'::jsonb)) order by x.seq)
      from (select * from rede_org_ata_falas where ponto = a.ponto_atual and falou_em is null order by seq limit 60) x join perfis p on p.id = x.pessoa), '[]'::jsonb) end,
    'sinais', case when a.situacao = 'aberta' then jsonb_build_object('abertos', a.sinais_abertos,
      'mosaico', case when v_sinais is not null then v_sinais - 'haBloqueio' end,
      'meu', (select s.sinal from rede_org_ata_sinais s where s.ponto = a.ponto_atual and s.pessoa = p_quem),
      'haBloqueio', case when v_mesa then coalesce((v_sinais ->> 'haBloqueio')::boolean, exists (select 1 from rede_org_ata_sinais s where s.ponto = a.ponto_atual and s.sinal = 'bloqueio')) end) end,
    'pontos', coalesce((select jsonb_agg(jsonb_build_object('id', pt.id, 'ordem', pt.ordem, 'texto', pt.texto, 'carimbo', pt.carimbo, 'deliberacao', pt.deliberacao,
        'carimbadoEm', pt.carimbado_em, 'sinais', pt.sinais) order by pt.ordem) from rede_org_ata_pontos pt where pt.ata = a.id), '[]'::jsonb));
end $$;

/** As atas da organização: as abertas (só quem é de dentro) e as 10 últimas fechadas (todos que veem a organização). */
create or replace function public.rede_org_atas(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); o uuid := interno.alumia_org_de(p_handle);
begin
  perform interno.limite('alumia_org_ler', 300, 10);
  if o is null or interno.rede_bloqueado(v, o) then return null; end if;
  if v is null and not exists (select 1 from rede_orgs where perfil = o and verificada_em is not null) then return null; end if;
  return jsonb_build_object('mesa', interno.alumia_org_mesa(v, o), 'dentro', interno.alumia_org_dentro(v, o),
    'atas', coalesce((select jsonb_agg(j order by (j ->> 'situacao') = 'aberta' desc, j ->> 'abertaEm' desc) from (
      select interno.alumia_ata_json(a, v) as j from (
        (select * from rede_org_atas where org = o and situacao = 'aberta' order by aberta_em desc limit 5)
        union all (select * from rede_org_atas where org = o and situacao = 'fechada' order by fechada_em desc limit 10)) a) x where j is not null), '[]'::jsonb));
end $$;

/** Uma ata pelo id (a tela da Ata Viva lê de novo a cada poucos segundos). */
create or replace function public.rede_org_ata(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); a rede_org_atas;
begin
  perform interno.limite('alumia_org_ata_ler', 600, 10);
  select * into a from rede_org_atas where id = p_id;
  if not found or interno.rede_bloqueado(v, a.org) then return null; end if;
  if v is null and not exists (select 1 from rede_orgs where perfil = a.org and verificada_em is not null) then return null; end if;
  return interno.alumia_ata_json(a, v);
end $$;

/** Abrir uma Ata Viva com a pauta (2 a 30 pontos). Só a mesa (gestor ou função "mesa"). Pode ligar a uma plenária da organização. */
create or replace function public.rede_org_ata_abrir(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); o uuid := interno.alumia_org_de(p_handle); v_id uuid; v_pontos text[]; v_pl uuid; v_seg integer; i integer;
begin
  perform interno.rede3_perfil_exige_membro(v);
  if o is null or not interno.alumia_org_mesa(v, o) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_org_ata', 20, 1440);
  if (select count(*) from rede_org_atas where org = o and situacao = 'aberta') >= 3 then perform interno.erro('limite'); end if;
  select coalesce(array_agg(btrim(x)), '{}') into v_pontos from jsonb_array_elements_text(coalesce(p -> 'pontos', '[]'::jsonb)) x where btrim(x) <> '';
  if cardinality(v_pontos) not between 1 and 30 then perform interno.erro('invalido:pontos'); end if;
  if nullif(p ->> 'plenaria', '') is not null then
    begin v_pl := (p ->> 'plenaria')::uuid; exception when others then perform interno.erro('invalido:plenaria'); end;
    if not exists (select 1 from rede_plenarias where id = v_pl and org = o) then perform interno.erro('invalido:plenaria'); end if;
  end if;
  if coalesce(p ->> 'falaSegundos', '120') !~ '^[0-9]{1,4}$' then perform interno.erro('invalido:tempo'); end if;
  v_seg := coalesce(nullif(p ->> 'falaSegundos', ''), '120')::integer;
  if v_seg not between 30 and 900 then perform interno.erro('invalido:tempo'); end if;
  begin
    insert into rede_org_atas (org, plenaria, titulo, fala_segundos) values (o, v_pl, btrim(coalesce(p ->> 'titulo', '')), v_seg) returning id into v_id;
    for i in 1 .. cardinality(v_pontos) loop
      insert into rede_org_ata_pontos (ata, ordem, texto) values (v_id, i, v_pontos[i]);
    end loop;
  exception when check_violation then perform interno.erro('invalido:ata');
  end;
  update rede_org_atas set ponto_atual = (select id from rede_org_ata_pontos where ata = v_id and ordem = 1) where id = v_id;
  return public.rede_org_ata(v_id);
end $$;

/** Me inscrever para falar no ponto em curso (a favor, contra, esclarecimento), ou sair da fila (nulo). Só quem é de dentro. */
create or replace function public.rede_org_ata_inscrever(p_ata uuid, p_posicao text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a rede_org_atas;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into a from rede_org_atas where id = p_ata;
  if not found or interno.rede_bloqueado(v, a.org) or not interno.alumia_org_dentro(v, a.org) then perform interno.erro('nao_encontrado'); end if;
  if a.situacao <> 'aberta' or a.ponto_atual is null then perform interno.erro('ata_fechada'); end if;
  perform interno.limite('alumia_org_ata_falar', 30, 10);
  if p_posicao is null or p_posicao = '' then
    delete from rede_org_ata_falas where ponto = a.ponto_atual and pessoa = v and falou_em is null;
  else
    if p_posicao not in ('favor', 'contra', 'esclarecimento') then perform interno.erro('invalido:posicao'); end if;
    if (select count(*) from rede_org_ata_falas where ponto = a.ponto_atual and falou_em is null) >= 200 then perform interno.erro('limite'); end if;
    -- Trocar a posição não muda o lugar: a pessoa continua onde chegou.
    update rede_org_ata_falas set posicao = p_posicao where ponto = a.ponto_atual and pessoa = v and falou_em is null;
    if not found then insert into rede_org_ata_falas (ata, ponto, pessoa, posicao) values (a.id, a.ponto_atual, v, p_posicao); end if;
  end if;
  return public.rede_org_ata(a.id);
end $$;

/** Dar o meu sinal de consenso no ponto em curso (ou tirar: nulo). Só com os sinais abertos pela mesa. */
create or replace function public.rede_org_ata_sinal(p_ata uuid, p_sinal text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a rede_org_atas;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into a from rede_org_atas where id = p_ata;
  if not found or interno.rede_bloqueado(v, a.org) or not interno.alumia_org_dentro(v, a.org) then perform interno.erro('nao_encontrado'); end if;
  if a.situacao <> 'aberta' or a.ponto_atual is null or not a.sinais_abertos then perform interno.erro('sinais_fechados'); end if;
  perform interno.limite('alumia_org_ata_sinal', 60, 10);
  if p_sinal is null or p_sinal = '' then
    delete from rede_org_ata_sinais where ponto = a.ponto_atual and pessoa = v;
  else
    if p_sinal not in ('concordo', 'duvida', 'bloqueio', 'abstencao') then perform interno.erro('invalido:sinal'); end if;
    insert into rede_org_ata_sinais (ponto, pessoa, sinal) values (a.ponto_atual, v, p_sinal) on conflict (ponto, pessoa) do update set sinal = excluded.sinal;
  end if;
  return public.rede_org_ata(a.id);
end $$;

/**
 * O que a mesa faz na Ata Viva: `acao` = chamar (a próxima da fila, ou `fala`), encerrar_fala, ponto (ir ao ponto `ponto`),
 * sinais_abrir, sinais_fechar (guarda só o agregado e apaga os sinais), carimbar (`carimbo`, `deliberacao`; com `funcao` e
 * `prazo`, o APROVADO vira fio no Tear), tempo (`segundos`). Carimbar apaga a fila e os sinais do ponto.
 */
create or replace function public.rede_org_ata_mesa(p_ata uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); a rede_org_atas; x rede_org_ata_falas; pt rede_org_ata_pontos; v_acao text := coalesce(p ->> 'acao', ''); v_seg integer;
  v_fn rede_org_funcoes; v_prazo date; v_ag jsonb; v_prox uuid;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into a from rede_org_atas where id = p_ata for update;
  if not found or not interno.alumia_org_mesa(v, a.org) then perform interno.erro('sem_permissao'); end if;
  if a.situacao <> 'aberta' then perform interno.erro('ata_fechada'); end if;
  perform interno.limite('alumia_org_ata_mesa', 300, 10);
  if v_acao = 'chamar' then
    if nullif(p ->> 'fala', '') is not null then
      begin select * into x from rede_org_ata_falas where id = (p ->> 'fala')::uuid and ponto = a.ponto_atual and falou_em is null;
      exception when others then perform interno.erro('invalido:fala'); end;
    else
      select * into x from rede_org_ata_falas where ponto = a.ponto_atual and falou_em is null order by seq limit 1;
    end if;
    if x.id is null then perform interno.erro('fila_vazia'); end if;
    -- Quem acabou de falar sai de vez (a fila não guarda quem já falou).
    delete from rede_org_ata_falas where id = a.fala_atual;
    update rede_org_ata_falas set falou_em = now() where id = x.id;
    update rede_org_atas set fala_atual = x.id, fala_posicao = x.posicao, fala_desde = now() where id = a.id;
  elsif v_acao = 'encerrar_fala' then
    delete from rede_org_ata_falas where id = a.fala_atual;
    update rede_org_atas set fala_atual = null, fala_posicao = null, fala_desde = null where id = a.id;
  elsif v_acao = 'ponto' then
    begin select * into pt from rede_org_ata_pontos where id = (p ->> 'ponto')::uuid and ata = a.id;
    exception when others then perform interno.erro('invalido:ponto'); end;
    if pt.id is null then perform interno.erro('invalido:ponto'); end if;
    delete from rede_org_ata_sinais where ponto = a.ponto_atual;
    update rede_org_atas set ponto_atual = pt.id, fala_atual = null, fala_posicao = null, fala_desde = null, sinais_abertos = false where id = a.id;
  elsif v_acao = 'sinais_abrir' then
    if a.ponto_atual is null then perform interno.erro('invalido:ponto'); end if;
    delete from rede_org_ata_sinais where ponto = a.ponto_atual;
    update rede_org_atas set sinais_abertos = true where id = a.id;
  elsif v_acao = 'sinais_fechar' then
    v_ag := interno.alumia_sinais(a.ponto_atual);
    update rede_org_ata_pontos set sinais = case when v_ag is not null then v_ag - 'haBloqueio' - 'pessoas' end where id = a.ponto_atual;
    delete from rede_org_ata_sinais where ponto = a.ponto_atual;
    update rede_org_atas set sinais_abertos = false where id = a.id;
  elsif v_acao = 'carimbar' then
    begin select * into pt from rede_org_ata_pontos where id = coalesce(nullif(p ->> 'ponto', '')::uuid, a.ponto_atual) and ata = a.id;
    exception when others then perform interno.erro('invalido:ponto'); end;
    if pt.id is null then perform interno.erro('invalido:ponto'); end if;
    if coalesce(p ->> 'carimbo', '') not in ('aprovado', 'retirado', 'vai_a_base') then perform interno.erro('invalido:carimbo'); end if;
    if char_length(coalesce(p ->> 'deliberacao', '')) > 500 then perform interno.erro('invalido:deliberacao'); end if;
    if pt.id = a.ponto_atual and a.sinais_abertos then
      v_ag := interno.alumia_sinais(pt.id);
      update rede_org_ata_pontos set sinais = case when v_ag is not null then v_ag - 'haBloqueio' - 'pessoas' end where id = pt.id;
    end if;
    update rede_org_ata_pontos set carimbo = p ->> 'carimbo', deliberacao = interno.alumia_sem_dado_pessoal(p ->> 'deliberacao', 'deliberacao'), carimbado_em = now() where id = pt.id;
    delete from rede_org_ata_falas where ponto = pt.id;
    delete from rede_org_ata_sinais where ponto = pt.id;
    if p ->> 'carimbo' = 'aprovado' and nullif(p ->> 'funcao', '') is not null then
      begin
        select * into v_fn from rede_org_funcoes where id = (p ->> 'funcao')::uuid and org = a.org;
        v_prazo := (p ->> 'prazo')::date;
      exception when others then perform interno.erro('invalido:fio');
      end;
      if v_fn.id is null or v_prazo is null or v_prazo < current_date or v_prazo > current_date + 730 then perform interno.erro('invalido:fio'); end if;
      insert into rede_org_encaminhamentos (org, texto, funcao, prazo, origem, origem_id, funcao_id)
      values (a.org, left(coalesce(nullif(btrim(p ->> 'deliberacao'), ''), pt.texto), 200), v_fn.nome, v_prazo, 'ata', pt.id, v_fn.id)
      on conflict (origem, origem_id) where origem_id is not null do nothing;
    end if;
    -- Vai ao próximo ponto sem carimbo, se houver.
    select id into v_prox from rede_org_ata_pontos where ata = a.id and carimbo is null and id <> pt.id order by ordem limit 1;
    if pt.id = a.ponto_atual then
      update rede_org_atas set ponto_atual = coalesce(v_prox, a.ponto_atual), fala_atual = null, fala_posicao = null, fala_desde = null, sinais_abertos = false where id = a.id;
    end if;
  elsif v_acao = 'tempo' then
    if coalesce(p ->> 'segundos', '') !~ '^[0-9]{1,4}$' then perform interno.erro('invalido:tempo'); end if;
    v_seg := (p ->> 'segundos')::integer;
    if v_seg not between 30 and 900 then perform interno.erro('invalido:tempo'); end if;
    update rede_org_atas set fala_segundos = v_seg where id = a.id;
  else
    perform interno.erro('invalido:acao');
  end if;
  return public.rede_org_ata(a.id);
end $$;

/** O texto da ata (markdown): pauta, carimbos, deliberações e o agregado dos sinais. Nunca quem falou. */
create or replace function interno.alumia_ata_texto(p_ata uuid) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select format(E'Ata: %s\n%s, aberta em %s.\n\n', a.titulo, coalesce(f.rede_codinome, f.rede_handle), to_char(a.aberta_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'))
    || coalesce(string_agg(format(E'%s. %s — %s%s', pt.ordem, pt.texto,
         case pt.carimbo when 'aprovado' then 'APROVADO' when 'retirado' then 'RETIRADO' when 'vai_a_base' then 'VAI À BASE' else 'SEM DELIBERAÇÃO' end,
         case when pt.deliberacao <> '' then E'\n   ' || pt.deliberacao else '' end), E'\n' order by pt.ordem), '')
    || E'\n\nA ata registra as deliberações, não quem falou. A fila de fala e os sinais de consenso foram apagados ao fechar.'
  from rede_org_atas a join perfis f on f.id = a.org left join rede_org_ata_pontos pt on pt.ata = a.id
  where a.id = p_ata group by a.id, a.titulo, a.aberta_em, f.rede_codinome, f.rede_handle
$$;

/**
 * Fechar a ata (só a mesa). Apaga a fila de fala e os sinais (nada individual fica). Com `p_publicar` ('internet', 'membros' ou
 * 'seguidores'), a ata vira um post DA organização (o autor é a organização; quem fechou não aparece). Devolve a ata e o texto.
 */
create or replace function public.rede_org_ata_fechar(p_ata uuid, p_publicar text default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a rede_org_atas; v_texto text; v_post uuid;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into a from rede_org_atas where id = p_ata for update;
  if not found or not interno.alumia_org_mesa(v, a.org) then perform interno.erro('sem_permissao'); end if;
  if p_publicar is not null and p_publicar not in ('internet', 'membros', 'seguidores') then perform interno.erro('invalido:publico'); end if;
  perform interno.limite('alumia_org_ata', 20, 1440);
  if a.situacao = 'aberta' then
    -- O ponto em curso com sinais abertos guarda o agregado antes de apagar.
    if a.ponto_atual is not null and a.sinais_abertos then
      update rede_org_ata_pontos set sinais = interno.alumia_sinais(id) - 'haBloqueio' - 'pessoas' where id = a.ponto_atual;
    end if;
    delete from rede_org_ata_falas where ata = a.id;
    delete from rede_org_ata_sinais s using rede_org_ata_pontos pt where pt.id = s.ponto and pt.ata = a.id;
    update rede_org_atas set situacao = 'fechada', fechada_em = now(), ponto_atual = null, fala_atual = null, fala_posicao = null, fala_desde = null, sinais_abertos = false where id = a.id;
  end if;
  v_texto := interno.alumia_ata_texto(a.id);
  if p_publicar is not null and a.post is null then
    insert into rede_posts (autor, como, tipo, titulo, texto, corpo, publico, alcance, oculto, retido, avaliacao, motivo)
    values (a.org, a.org, 'aviso', left('Ata: ' || a.titulo, 140), left(format('Ata de “%s”: %s pontos deliberados.', a.titulo,
              (select count(*) from rede_org_ata_pontos where ata = a.id and carimbo is not null)), 500),
            left(v_texto, 20000), p_publicar, interno.rede_alcance(p_publicar), false, false, 'publicada', '')
    returning id into v_post;
    update rede_org_atas set post = v_post where id = a.id;
  end if;
  return jsonb_build_object('ata', public.rede_org_ata(a.id), 'texto', v_texto);
end $$;

-- ── 6. Caixa transparente ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Um caixa como a tela mostra. De fora: só o saldo e os lançamentos com os DOIS carimbos. De dentro: tudo, sem quem lançou. */
create or replace function interno.alumia_caixa_json(c interno.rede_org_caixas, p_quem uuid, p_dentro boolean, p_tesouraria boolean) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', c.id, 'nome', c.nome, 'tipo', c.tipo, 'pix', nullif(c.pix, ''), 'link', c.link,
    'nucleo', (select n.nome from rede_nucleos n where n.id = c.nucleo),
    'saldo', coalesce((select sum(case when l.tipo = 'entrada' then l.centavos else -l.centavos end) from rede_org_caixa_lancamentos l where l.caixa = c.id and l.conferiu2 is not null), 0),
    'entradas', coalesce((select sum(l.centavos) from rede_org_caixa_lancamentos l where l.caixa = c.id and l.conferiu2 is not null and l.tipo = 'entrada'), 0),
    'saidas', coalesce((select sum(l.centavos) from rede_org_caixa_lancamentos l where l.caixa = c.id and l.conferiu2 is not null and l.tipo = 'saida'), 0),
    'esperando', case when p_dentro then (select count(*) from rede_org_caixa_lancamentos l where l.caixa = c.id and l.conferiu2 is null) end,
    'lancamentos', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'tipo', l.tipo, 'centavos', l.centavos, 'descricao', l.descricao, 'dia', l.dia,
        'carimbos', (l.conferiu1 is not null)::int + (l.conferiu2 is not null)::int, 'conferidoEm', l.conferiu2_dia,
        'nota', p_dentro and exists (select 1 from rede_org_caixa_notas n where n.lancamento = l.id),
        'meu', p_quem is not null and l.lancou = p_quem,
        'possoConferir', p_tesouraria and l.conferiu2 is null and p_quem is distinct from l.conferiu1)
        order by l.dia desc, l.criado_em desc)
      from (select * from rede_org_caixa_lancamentos l where l.caixa = c.id and (p_dentro or l.conferiu2 is not null) order by l.dia desc, l.criado_em desc limit 100) l), '[]'::jsonb))
$$;

/** Os caixas da organização. Doador nunca aparece; quem lançou e quem conferiu, nunca. */
create or replace function public.rede_org_caixa(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); o uuid := interno.alumia_org_de(p_handle); v_dentro boolean; v_tes boolean;
begin
  perform interno.limite('alumia_org_ler', 300, 10);
  if o is null or interno.rede_bloqueado(v, o) then return null; end if;
  if v is null and not exists (select 1 from rede_orgs where perfil = o and verificada_em is not null) then return null; end if;
  v_dentro := interno.alumia_org_dentro(v, o);
  v_tes := interno.alumia_org_funcao_tem(v, o, 'caixa');
  return jsonb_build_object('dentro', v_dentro, 'tesouraria', v_tes, 'gerencio', interno.alumia_org_gere(v, o),
    'caixas', coalesce((select jsonb_agg(interno.alumia_caixa_json(c, v, v_dentro, v_tes) order by c.criado_dia, c.nome) from rede_org_caixas c where c.org = o), '[]'::jsonb));
end $$;

/** Abrir um caixa (quem gerencia ou tesouraria). Pix só como texto da ORGANIZAÇÃO: CPF de pessoa é recusado. */
create or replace function public.rede_org_caixa_criar(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); o uuid := interno.alumia_org_de(p_handle); v_pix text := btrim(coalesce(p ->> 'pix', '')); v_nucleo uuid;
begin
  perform interno.rede3_perfil_exige_membro(v);
  if o is null or not (interno.alumia_org_gere(v, o) or interno.alumia_org_funcao_tem(v, o, 'caixa')) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_org_caixa', 30, 1440);
  if (select count(*) from rede_org_caixas where org = o) >= 20 then perform interno.erro('limite'); end if;
  if v_pix ~ '^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$' or v_pix ~ '\(?\d{2}\)?\s?9\d{4}[-\s]?\d{4}' or v_pix ~* '@' then perform interno.erro('dado_pessoal'); end if;
  if nullif(p ->> 'nucleo', '') is not null then
    begin v_nucleo := (p ->> 'nucleo')::uuid; exception when others then perform interno.erro('invalido:nucleo'); end;
    if not exists (select 1 from rede_nucleos where id = v_nucleo and org = o) then perform interno.erro('invalido:nucleo'); end if;
  end if;
  begin
    insert into rede_org_caixas (org, nome, tipo, nucleo, pix, link) values (o, btrim(coalesce(p ->> 'nome', '')), p ->> 'tipo', v_nucleo, v_pix, nullif(btrim(coalesce(p ->> 'link', '')), ''));
  exception
    when unique_violation then perform interno.erro('caixa_existe');
    when check_violation or not_null_violation then perform interno.erro('invalido:caixa');
  end;
  return public.rede_org_caixa(p_handle);
end $$;

/**
 * Lançar uma entrada ou saída (só tesouraria). A descrição não pode ter CPF, telefone, e-mail ou endereço (doador nunca aparece).
 * A foto da nota vem em base64 já reencodada pelo aparelho (sem EXIF, dado pessoal borrado), webp ou jpeg, até 400 KB.
 */
create or replace function public.rede_org_caixa_lancar(p_caixa uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_org_caixas; v_id uuid; v_dia date; v_cent bigint; v_bytes bytea; v_mime text := coalesce(p ->> 'mime', '');
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into c from rede_org_caixas where id = p_caixa;
  if not found or not interno.alumia_org_funcao_tem(v, c.org, 'caixa') then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_org_caixa_lancar', 120, 1440);
  begin v_dia := (p ->> 'dia')::date; exception when others then perform interno.erro('invalido:dia'); end;
  if v_dia is null or v_dia > current_date or v_dia < current_date - 730 then perform interno.erro('invalido:dia'); end if;
  if coalesce(p ->> 'centavos', '') !~ '^[0-9]{1,12}$' then perform interno.erro('invalido:valor'); end if;
  v_cent := (p ->> 'centavos')::bigint;
  if v_cent < 1 or v_cent > 100000000000 then perform interno.erro('invalido:valor'); end if;
  if nullif(p ->> 'nota', '') is not null then
    if v_mime not in ('image/webp', 'image/jpeg') then perform interno.erro('invalido:nota'); end if;
    begin v_bytes := decode(p ->> 'nota', 'base64'); exception when others then perform interno.erro('invalido:nota'); end;
    if octet_length(v_bytes) not between 100 and 400000 then perform interno.erro('invalido:nota'); end if;
    -- O aparelho reencoda e tira o EXIF; aqui confere que é mesmo webp/jpeg e que não sobrou bloco EXIF no jpeg.
    if v_mime = 'image/webp' and (substring(v_bytes from 1 for 4) <> '\x52494646'::bytea or substring(v_bytes from 9 for 4) <> '\x57454250'::bytea) then perform interno.erro('invalido:nota'); end if;
    if v_mime = 'image/jpeg' and (substring(v_bytes from 1 for 2) <> '\xffd8'::bytea or position('\x45786966'::bytea in v_bytes) > 0) then perform interno.erro('invalido:nota'); end if;
  end if;
  begin
    insert into rede_org_caixa_lancamentos (caixa, tipo, centavos, descricao, dia, lancou)
    values (c.id, p ->> 'tipo', v_cent, interno.alumia_sem_dado_pessoal(p ->> 'descricao', 'descricao'), v_dia, v) returning id into v_id;
  exception when check_violation or not_null_violation then perform interno.erro('invalido:lancamento');
  end;
  if v_bytes is not null then insert into rede_org_caixa_notas (lancamento, mime, bytes) values (v_id, v_mime, v_bytes); end if;
  return public.rede_org_caixa((select rede_handle from perfis where id = c.org));
end $$;

/** Carimbar CONFERIDO (só tesouraria). Dois carimbos de duas pessoas diferentes; só com os dois o lançamento entra no saldo. */
create or replace function public.rede_org_caixa_conferir(p_lancamento uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); l rede_org_caixa_lancamentos; o uuid;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into l from rede_org_caixa_lancamentos where id = p_lancamento for update;
  select c.org into o from rede_org_caixas c where c.id = l.caixa;
  if l.id is null or not interno.alumia_org_funcao_tem(v, o, 'caixa') then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_org_caixa_conferir', 200, 1440);
  if l.conferiu2 is not null then perform interno.erro('ja_conferido'); end if;
  if l.conferiu1 is null then
    update rede_org_caixa_lancamentos set conferiu1 = v, conferiu1_dia = current_date where id = l.id;
  elsif l.conferiu1 = v then
    perform interno.erro('outra_pessoa');
  else
    update rede_org_caixa_lancamentos set conferiu2 = v, conferiu2_dia = current_date where id = l.id;
  end if;
  return public.rede_org_caixa((select rede_handle from perfis where id = o));
end $$;

/** Tirar um lançamento ainda não conferido duas vezes: quem lançou ou quem gerencia. Registrado (sem quem). */
create or replace function public.rede_org_caixa_retirar(p_lancamento uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); l rede_org_caixa_lancamentos; o uuid;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into l from rede_org_caixa_lancamentos where id = p_lancamento for update;
  select c.org into o from rede_org_caixas c where c.id = l.caixa;
  if l.id is null or not (l.lancou = v or interno.alumia_org_gere(v, o)) then perform interno.erro('sem_permissao'); end if;
  if l.conferiu2 is not null then perform interno.erro('ja_conferido'); end if;
  perform interno.limite('alumia_org_caixa_lancar', 120, 1440);
  delete from rede_org_caixa_lancamentos where id = l.id;
  insert into auditoria (quem, nome, acao, alvo, detalhes) values (o, '', 'alumia_caixa_retirar', l.caixa::text, jsonb_build_object('centavos', l.centavos, 'tipo', l.tipo));
  return public.rede_org_caixa((select rede_handle from perfis where id = o));
end $$;

/** A foto da nota (só quem é de dentro). Volta como data URL. */
create or replace function public.rede_org_caixa_nota(p_lancamento uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); o uuid; n rede_org_caixa_notas;
begin
  perform interno.limite('alumia_org_ler', 300, 10);
  select c.org into o from rede_org_caixa_lancamentos l join rede_org_caixas c on c.id = l.caixa where l.id = p_lancamento;
  if o is null or not interno.alumia_org_dentro(v, o) or interno.rede_bloqueado(v, o) then perform interno.erro('nao_encontrado'); end if;
  select * into n from rede_org_caixa_notas where lancamento = p_lancamento;
  if not found then return null; end if;
  return jsonb_build_object('mime', n.mime, 'url', 'data:' || n.mime || ';base64,' || translate(encode(n.bytes, 'base64'), E'\n', ''));
end $$;

-- ── 7. Lampião: núcleo com pauta, tarefa, convite, chama e mapa ──────────────────────────────────────────────────────────

/**
 * Criar um núcleo da organização (troca a da F4, mesma assinatura): nome, quando, onde, cor e, do Lampião, pauta da 1ª reunião,
 * primeira tarefa, cidade e estado escritos (nunca GPS) e se entra no mapa (padrão: NÃO; em cidade pequena um núcleo pode
 * identificar pessoas). Com `convite` {dias, usos}, gera o convite (o mesmo de rede_fix_convite_criar: só o hash fica guardado)
 * e devolve o código UMA vez.
 */
create or replace function public.rede_org_nucleo_criar(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_org uuid := interno.alumia_org_gestor(p_handle, 'alumia_org_nucleo', 10, 1440); v_id uuid; v_uf text := nullif(upper(btrim(coalesce(p ->> 'uf', ''))), '');
  v_conv jsonb; v_dias integer; v_usos integer;
begin
  if (select count(*) from rede_nucleos where org = v_org) >= 50 then perform interno.erro('limite_nucleos'); end if;
  begin
    insert into rede_nucleos (nome, cidade, criado_por, org, org_quando, org_cor, org_pauta, org_tarefa, org_cidade, org_uf, org_no_mapa)
    values (btrim(coalesce(p ->> 'nome', '')), btrim(coalesce(p ->> 'onde', '')), v_org, v_org, btrim(coalesce(p ->> 'quando', '')),
            coalesce(nullif(p ->> 'cor', '')::smallint, 1),
            interno.alumia_sem_dado_pessoal(left(coalesce(p ->> 'pauta', ''), 600), 'pauta'), interno.alumia_sem_dado_pessoal(left(coalesce(p ->> 'tarefa', ''), 200), 'tarefa'),
            btrim(coalesce(p ->> 'cidade', '')), v_uf, coalesce((p ->> 'mapa')::boolean, false))
    returning id into v_id;
  exception when check_violation or invalid_text_representation or numeric_value_out_of_range then perform interno.erro('invalido:nucleo');
  end;
  -- Quem cria entra como mediação (para receber e decidir pedidos e gerar convites). Não aparece em lista nenhuma.
  insert into rede_nucleo_membros (nucleo, usuario, papel) values (v_id, v, 'mediacao') on conflict do nothing;
  if jsonb_typeof(p -> 'convite') = 'object' then
    if coalesce(p -> 'convite' ->> 'dias', '7') !~ '^[0-9]{1,2}$' or coalesce(p -> 'convite' ->> 'usos', '10') !~ '^[0-9]{1,3}$' then perform interno.erro('invalido:convite'); end if;
    v_dias := coalesce(nullif(p -> 'convite' ->> 'dias', ''), '7')::integer;
    v_usos := coalesce(nullif(p -> 'convite' ->> 'usos', ''), '10')::integer;
    v_conv := public.rede_fix_convite_criar(v_id::text, 'membro', v_dias, v_usos);
  end if;
  return jsonb_build_object('id', v_id, 'convite', case when v_conv is not null then jsonb_build_object('codigo', v_conv ->> 'codigo', 'validade', v_conv ->> 'validade', 'usos', v_usos) end);
end $$;

/** Pôr ou tirar o núcleo do mapa (quem gerencia ou a mediação do núcleo). */
create or replace function public.rede_org_nucleo_mapa(p_nucleo uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n rede_nucleos;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into n from rede_nucleos where id = p_nucleo and org is not null;
  if not found or not (interno.alumia_org_gere(v, n.org) or exists (select 1 from rede_nucleo_membros m where m.nucleo = n.id and m.usuario = v and m.papel = 'mediacao')) then
    perform interno.erro('sem_permissao');
  end if;
  perform interno.limite('alumia_org_nucleo_mapa', 30, 60);
  update rede_nucleos set org_no_mapa = coalesce(p_sim, false) where id = n.id;
  return jsonb_build_object('mapa', coalesce(p_sim, false), 'chama', interno.alumia_chama(n.id));
end $$;

/**
 * O mapa: os estados onde há núcleo com chama PLENA (3 pessoas ou mais além de quem fundou) de organização com selo, que escolheu
 * aparecer. Só o estado e o nome das cidades escritas, sem número de núcleos nem de pessoas.
 */
create or replace function public.rede_org_mapa() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  perform interno.limite('alumia_org_ler', 300, 10);
  return coalesce((select jsonb_agg(jsonb_build_object('uf', x.uf, 'cidades', x.cidades) order by x.uf) from (
    select n.org_uf as uf, jsonb_agg(distinct initcap(lower(btrim(n.org_cidade)))) filter (where btrim(n.org_cidade) <> '') as cidades
    from rede_nucleos n join rede_orgs o on o.perfil = n.org join perfis f on f.id = n.org
    where n.org_no_mapa and n.org_uf is not null and o.verificada_em is not null and not f.suspenso and not interno.rede_bloqueado(v, n.org)
      and interno.alumia_chama(n.id) = 'plena'
    group by n.org_uf) x), '[]'::jsonb);
end $$;

-- ── 8. Perfil da organização (troca a da F4): chama dos núcleos, eleição só para quem é de dentro ──────────────────────

create or replace function public.rede_org_perfil(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_org uuid; o rede_orgs; f perfis; v_membro boolean; v_dentro boolean; v_gere boolean;
begin
  perform interno.limite('alumia_org_ler', 300, 10);
  v_org := interno.alumia_org_de(p_handle);
  if v_org is null then return null; end if;
  select * into o from rede_orgs where perfil = v_org;
  select * into f from perfis where id = v_org;
  if interno.rede_bloqueado(v, v_org) then return null; end if;
  v_membro := interno.rede2_membro(v);
  if not v_membro and o.verificada_em is null then return null; end if;
  v_dentro := interno.alumia_org_dentro(v, v_org);
  v_gere := interno.alumia_org_gere(v, v_org);
  return jsonb_build_object(
    'handle', f.rede_handle, 'codinome', coalesce(f.rede_codinome, ''), 'tipo', o.tipo, 'bio', coalesce(f.rede_bio, ''),
    'cidade', nullif(o.cidade, ''), 'verificadaEm', o.verificada_em,
    'documento', case when o.verificada_em is not null then nullif(o.documento_tipo, '') end,
    'palavra', o.palavra,
    'sigo', v is not null and exists (select 1 from rede_seguindo s where s.quem = v and s.segue = v_org and not s.pendente),
    'sino', v is not null and exists (select 1 from rede_org_sinos s where s.org = v_org and s.usuario = v),
    'gerencio', v_gere, 'dentro', v_dentro, 'mesa', interno.alumia_org_mesa(v, v_org),
    'nucleos', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'nome', n.nome, 'cor', n.org_cor, 'quando', n.org_quando,
                  'onde', nullif(n.cidade, ''), 'chama', interno.alumia_chama(n.id),
                  'sou', v is not null and exists (select 1 from rede_nucleo_membros m where m.nucleo = n.id and m.usuario = v),
                  'pedi', v is not null and exists (select 1 from rede_org_nucleo_pedidos q where q.nucleo = n.id and q.usuario = v),
                  'mapa', case when v_gere then n.org_no_mapa end,
                  'pauta', case when v_dentro then nullif(n.org_pauta, '') end, 'tarefa', case when v_dentro then nullif(n.org_tarefa, '') end) order by n.nome)
                from rede_nucleos n where n.org = v_org), '[]'::jsonb),
    'votacoes', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'data', x.data, 'projeto', x.projeto, 'voto', x.voto, 'porque', x.porque,
                  'resultado', x.resultado, 'fonte', x.fonte) order by x.data desc, x.criado_em desc)
                from (select * from rede_org_votacoes where org = v_org order by data desc, criado_em desc limit 30) x), '[]'::jsonb),
    'consultas', coalesce((select jsonb_agg(interno.alumia_consulta_json(c, v) || jsonb_build_object('eleicao', c.eleicao is not null,
                  'virouFio', exists (select 1 from rede_org_encaminhamentos e where e.origem = 'consulta' and e.origem_id = c.id)) order by c.prazo desc)
                from (select * from rede_consultas where org = v_org and (eleicao is null or v_dentro) order by prazo desc limit 10) c), '[]'::jsonb),
    'plenarias', coalesce((select jsonb_agg(interno.alumia_plenaria_json(p, v, v_membro) order by (p.situacao = 'ao_vivo') desc, p.inicio)
                from (select * from rede_plenarias where org = v_org and situacao <> 'encerrada' order by inicio limit 5) p), '[]'::jsonb));
end $$;

/** Uma plenária pelo id, para a fila viva (a tela lê de novo a cada poucos segundos, só com a aba visível). */
create or replace function public.rede_org_plenaria(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); p rede_plenarias;
begin
  perform interno.limite('alumia_org_plenaria_ler', 600, 10);
  select * into p from rede_plenarias where id = p_id;
  if not found or interno.rede_bloqueado(v, p.org) or exists (select 1 from perfis where id = p.org and suspenso) then return null; end if;
  if v is null and not exists (select 1 from rede_orgs where perfil = p.org and verificada_em is not null) then return null; end if;
  return interno.alumia_plenaria_json(p, v, interno.rede2_membro(v));
end $$;

-- ── 9. Tear ligado à decisão ──────────────────────────────────────────────────────────────────────────────────────────────

/** O tear (troca o do perfil livre): + origem do fio, a função de verdade, quantos vencidos; e quem ocupa a função "tear" tece. */
create or replace function public.rede_org_tear(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); o uuid; dentro boolean;
begin
  select ro.perfil into o from rede_orgs ro join perfis f on f.id = ro.perfil where f.rede_handle = lower(btrim(coalesce(p_handle, ''), ' @')) and ro.verificada_em is not null;
  if o is null or interno.rede_bloqueado(v, o) then return null; end if;
  dentro := interno.alumia_org_dentro(v, o);
  return jsonb_build_object(
    'decididos', (select count(*) from rede_org_encaminhamentos where org = o and estado <> 'retirado'),
    'cumpridos', (select count(*) from rede_org_encaminhamentos where org = o and estado = 'cumprido'),
    'vencidos', (select count(*) from rede_org_encaminhamentos where org = o and estado = 'aberto' and prazo < current_date),
    'dentro', dentro,
    'gerencio', v is not null and (interno.alumia_org_gere(v, o) or interno.alumia_org_funcao_tem(v, o, 'tear')),
    'funcoes', case when dentro then coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome) order by lower(f.nome)) from rede_org_funcoes f where f.org = o), '[]'::jsonb) end,
    'fios', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'texto', e.texto, 'estado', e.estado, 'criado', e.criado_dia, 'origem', e.origem,
        'funcao', case when dentro then e.funcao end, 'prazo', case when dentro then e.prazo end,
        'vencido', e.estado = 'aberto' and e.prazo < current_date, 'cumprido', e.cumprido_dia) order by e.criado_dia desc, e.id), '[]'::jsonb)
      from (select * from rede_org_encaminhamentos where org = o and estado <> 'retirado' order by criado_dia desc, id limit 60) e));
end $$;

/**
 * Tecer um fio (texto, função, prazo) ou mudar o estado de um. Quem gerencia ou ocupa a função "tear". A função pode ser uma de
 * verdade (`funcaoId`) ou só o nome; `consulta` faz o fio nascer de uma consulta FECHADA da organização (um fio por consulta).
 */
create or replace function public.rede_org_tear_fio(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); o uuid := interno.alumia_org_de(p_handle); v_fn rede_org_funcoes; v_nome text := btrim(coalesce(p ->> 'funcao', '')); v_cons rede_consultas; v_texto text := btrim(coalesce(p ->> 'texto', ''));
begin
  perform interno.rede3_perfil_exige_membro(v);
  if o is null or not (interno.alumia_org_gere(v, o) or interno.alumia_org_funcao_tem(v, o, 'tear')) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_org_tear', 60, 60);
  if p ? 'id' then
    if coalesce(p ->> 'estado', '') not in ('aberto', 'cumprido', 'retirado') then perform interno.erro('invalido:estado'); end if;
    begin
      update rede_org_encaminhamentos set estado = p ->> 'estado', cumprido_dia = case when p ->> 'estado' = 'cumprido' then current_date end, avisado_dia = null
        where id = (p ->> 'id')::uuid and org = o;
    exception when invalid_text_representation then perform interno.erro('nao_encontrado');
    end;
    if not found then perform interno.erro('nao_encontrado'); end if;
  else
    begin
      if (p ->> 'prazo')::date < current_date or (p ->> 'prazo')::date > current_date + 730 then perform interno.erro('invalido:prazo'); end if;
    exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation then perform interno.erro('invalido:prazo');
    end;
    if nullif(p ->> 'funcaoId', '') is not null then
      begin select * into v_fn from rede_org_funcoes where id = (p ->> 'funcaoId')::uuid and org = o;
      exception when others then perform interno.erro('invalido:funcao'); end;
      if v_fn.id is null then perform interno.erro('invalido:funcao'); end if;
      v_nome := v_fn.nome;
    end if;
    if nullif(p ->> 'consulta', '') is not null then
      begin select * into v_cons from rede_consultas where id = (p ->> 'consulta')::uuid and org = o;
      exception when others then perform interno.erro('invalido:consulta'); end;
      if v_cons.id is null or v_cons.prazo > now() or v_cons.eleicao is not null then perform interno.erro('invalido:consulta'); end if;
      if v_texto = '' then v_texto := left(v_cons.pergunta, 200); end if;
    end if;
    if (select count(*) from rede_org_encaminhamentos where org = o and estado = 'aberto') >= 200 then perform interno.erro('limite'); end if;
    begin
      insert into rede_org_encaminhamentos (org, texto, funcao, prazo, origem, origem_id, funcao_id)
      values (o, v_texto, v_nome, (p ->> 'prazo')::date, case when v_cons.id is not null then 'consulta' else 'mao' end, v_cons.id, v_fn.id);
    exception
      when unique_violation then perform interno.erro('ja_tecido');
      when check_violation then perform interno.erro('invalido:fio');
    end;
  end if;
  return public.rede_org_tear(p_handle);
end $$;

-- ── 10. Diretório ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O diretório das organizações COM SELO: por tipo, cidade escrita e busca no nome ou no @, em ordem alfabética, 30 por página
 * (`depois` = o último codinome visto). Sem contagem de pessoas; só quantos núcleos a organização tem (núcleo não é pessoa).
 */
create or replace function public.rede_org_diretorio(p jsonb default '{}'::jsonb) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_tipo text := nullif(p ->> 'tipo', ''); v_cidade text := lower(btrim(coalesce(p ->> 'cidade', ''))); v_busca text := lower(btrim(coalesce(p ->> 'busca', '')));
  v_depois text := coalesce(p ->> 'depois', ''); v_itens jsonb;
begin
  perform interno.limite('alumia_org_diretorio', 120, 10);
  if v_tipo is not null and v_tipo not in ('partido', 'mandato', 'sindicato', 'movimento', 'coletivo', 'gremio', 'dce', 'outro') then perform interno.erro('invalido:tipo'); end if;
  if char_length(v_cidade) > 60 or char_length(v_busca) > 60 or char_length(v_depois) > 120 then perform interno.erro('invalido:busca'); end if;
  select coalesce(jsonb_agg(x.j order by x.k), '[]'::jsonb) into v_itens from (
    select lower(coalesce(f.rede_codinome, f.rede_handle)) || '|' || f.rede_handle as k,
      jsonb_build_object('handle', f.rede_handle, 'codinome', coalesce(f.rede_codinome, f.rede_handle), 'tipo', o.tipo, 'cidade', nullif(o.cidade, ''),
        'palavra', o.palavra, 'bio', left(coalesce(f.rede_bio, ''), 160), 'verificadaEm', o.verificada_em,
        'nucleos', (select count(*) from rede_nucleos n where n.org = o.perfil), 'k', lower(coalesce(f.rede_codinome, f.rede_handle)) || '|' || f.rede_handle) as j
    from rede_orgs o join perfis f on f.id = o.perfil
    where o.verificada_em is not null and not f.suspenso and not interno.rede_bloqueado(v, o.perfil)
      and (v_tipo is null or o.tipo = v_tipo)
      and (v_cidade = '' or position(v_cidade in lower(o.cidade)) > 0)
      and (v_busca = '' or position(v_busca in lower(coalesce(f.rede_codinome, ''))) > 0 or position(v_busca in f.rede_handle) > 0)
      and (v_depois = '' or lower(coalesce(f.rede_codinome, f.rede_handle)) || '|' || f.rede_handle > v_depois)
    order by 1 limit 31) x;
  return jsonb_build_object('itens', (select coalesce(jsonb_agg(e - 'k' order by n), '[]'::jsonb) from jsonb_array_elements(v_itens) with ordinality t(e, n) where n <= 30),
    'depois', case when jsonb_array_length(v_itens) > 30 then v_itens -> 29 ->> 'k' end);
end $$;

/**
 * Os atos da organização (aba Atos): os chamados que ela publicou, os próximos primeiro e depois os dos últimos 60 dias, até 20.
 * Mesma visibilidade da linha (rede_ve, silêncio e bloqueio); cada ato no formato de rede_ato_json (a contagem é a publicada).
 */
create or replace function public.rede_org_atos(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); o uuid := interno.alumia_org_de(p_handle);
begin
  perform interno.limite('alumia_org_ler', 300, 10);
  if o is null or interno.rede_bloqueado(v, o) then return null; end if;
  if v is null and not exists (select 1 from rede_orgs where perfil = o and verificada_em is not null) then return null; end if;
  return coalesce((select jsonb_agg(interno.rede_ato_json(x.p, x.c, v) order by x.futuro desc, case when x.futuro then x.inicio end, x.inicio desc)
    from (select p, c, c.inicio, c.inicio > now() - interval '6 hours' as futuro
          from rede_chamados c join rede_posts p on p.id = c.post
          where p.autor = o and p.apagado_em is null and c.inicio > now() - interval '60 days' and interno.rede_ve(p, v) and not interno.rede_silenciado(p, v)
          order by (c.inicio > now() - interval '6 hours') desc, abs(extract(epoch from c.inicio - now())) limit 20) x), '[]'::jsonb);
end $$;

-- ── 11. A rotina: eleições no relógio, aviso de prazo vencido à função e faxina das filas ─────────────────────────────────

/**
 * Roda de 15 em 15 minutos (pg_cron, onde houver) e também é segura de rodar à mão: faz as eleições andarem, avisa UMA vez quem
 * ocupa a função de um fio do Tear que passou do prazo (sem dizer a ninguém quem foi avisado) e apaga fila e sinais que
 * sobraram de ata fechada.
 */
create or replace function interno.alumia_org_rotina() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare e record; r record; v_el integer := 0; v_av integer := 0;
begin
  for e in select id from rede_org_eleicoes where situacao in ('inscricoes', 'votacao') and (now() >= inscricoes_ate) limit 200 loop
    perform interno.alumia_eleicao_avancar(e.id);
    v_el := v_el + 1;
  end loop;
  for r in select x.id, x.texto, x.org, x.funcao_id from rede_org_encaminhamentos x
           where x.estado = 'aberto' and x.prazo < current_date and x.avisado_dia is null and x.funcao_id is not null limit 500 loop
    perform interno.avisar_em(m.pessoa, format('O encaminhamento “%s” de “%s” passou do prazo. Abra o Tear para marcar como cumprido ou combinar novo prazo.', left(r.texto, 80), interno.rede_nome(r.org)), 'rede')
    from rede_org_mandatos m where m.funcao = r.funcao_id and m.aceito and m.encerrado_dia is null and m.fim >= current_date;
    update rede_org_encaminhamentos set avisado_dia = current_date where id = r.id;
    v_av := v_av + 1;
  end loop;
  delete from rede_org_ata_falas f using rede_org_atas a where a.id = f.ata and a.situacao = 'fechada';
  delete from rede_org_ata_sinais s using rede_org_ata_pontos pt, rede_org_atas a where pt.id = s.ponto and a.id = pt.ata and a.situacao = 'fechada';
  return jsonb_build_object('eleicoes', v_el, 'avisos', v_av);
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-org-rotina', '*/15 * * * *', 'select interno.alumia_org_rotina()');
  end if;
exception when others then null;
end $$;

-- ── 12. Permissões das funções ────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'interno.alumia_org_dentro(uuid, uuid)', 'interno.alumia_org_funcao_tem(uuid, uuid, text)', 'interno.alumia_org_mesa(uuid, uuid)',
    'interno.alumia_chama(uuid)', 'interno.alumia_nucleo_saiu()', 'interno.alumia_passo10(bigint, bigint)', 'interno.alumia_sem_dado_pessoal(text, text)', 'interno.alumia_org_vista(uuid, uuid)',
    'interno.alumia_eleicao_avancar(uuid)', 'interno.alumia_eleicao_json(interno.rede_org_eleicoes, uuid)', 'interno.alumia_sinais(uuid)',
    'interno.alumia_ata_json(interno.rede_org_atas, uuid)', 'interno.alumia_ata_texto(uuid)',
    'interno.alumia_caixa_json(interno.rede_org_caixas, uuid, boolean, boolean)', 'interno.alumia_org_rotina()',
    'public.rede_org_funcoes(text)', 'public.rede_org_funcao_salvar(text, jsonb)', 'public.rede_org_funcao_apagar(text, uuid)',
    'public.rede_org_mandato_dar(text, jsonb)', 'public.rede_org_mandato_encerrar(uuid)', 'public.rede_org_mandato_aceitar(uuid)',
    'public.rede_org_eleicoes(text)', 'public.rede_org_eleicao_abrir(text, jsonb)', 'public.rede_org_eleicao_candidatar(uuid, boolean)',
    'public.rede_org_atas(text)', 'public.rede_org_ata(uuid)', 'public.rede_org_ata_abrir(text, jsonb)', 'public.rede_org_ata_inscrever(uuid, text)',
    'public.rede_org_ata_sinal(uuid, text)', 'public.rede_org_ata_mesa(uuid, jsonb)', 'public.rede_org_ata_fechar(uuid, text)',
    'public.rede_org_caixa(text)', 'public.rede_org_caixa_criar(text, jsonb)', 'public.rede_org_caixa_lancar(uuid, jsonb)',
    'public.rede_org_caixa_conferir(uuid)', 'public.rede_org_caixa_retirar(uuid)', 'public.rede_org_caixa_nota(uuid)',
    'public.rede_org_nucleo_criar(text, jsonb)', 'public.rede_org_nucleo_mapa(uuid, boolean)', 'public.rede_org_mapa()',
    'public.rede_org_perfil(text)', 'public.rede_org_plenaria(uuid)', 'public.rede_org_tear(text)', 'public.rede_org_tear_fio(text, jsonb)',
    'public.rede_org_diretorio(jsonb)', 'public.rede_org_atos(text)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    -- Visitante: só leitura do que é público (organização com selo): funções sem ocupantes, atas fechadas, caixa conferido, mapa,
    -- perfil, plenária, tear e diretório.
    grant execute on function public.rede_org_funcoes(text), public.rede_org_atas(text), public.rede_org_ata(uuid), public.rede_org_caixa(text),
      public.rede_org_mapa(), public.rede_org_perfil(text), public.rede_org_plenaria(uuid), public.rede_org_tear(text), public.rede_org_diretorio(jsonb), public.rede_org_atos(text) to anon;
    grant execute on function public.rede_org_funcoes(text), public.rede_org_funcao_salvar(text, jsonb), public.rede_org_funcao_apagar(text, uuid),
      public.rede_org_mandato_dar(text, jsonb), public.rede_org_mandato_encerrar(uuid), public.rede_org_mandato_aceitar(uuid),
      public.rede_org_eleicoes(text), public.rede_org_eleicao_abrir(text, jsonb), public.rede_org_eleicao_candidatar(uuid, boolean),
      public.rede_org_atas(text), public.rede_org_ata(uuid), public.rede_org_ata_abrir(text, jsonb), public.rede_org_ata_inscrever(uuid, text),
      public.rede_org_ata_sinal(uuid, text), public.rede_org_ata_mesa(uuid, jsonb), public.rede_org_ata_fechar(uuid, text),
      public.rede_org_caixa(text), public.rede_org_caixa_criar(text, jsonb), public.rede_org_caixa_lancar(uuid, jsonb),
      public.rede_org_caixa_conferir(uuid), public.rede_org_caixa_retirar(uuid), public.rede_org_caixa_nota(uuid),
      public.rede_org_nucleo_criar(text, jsonb), public.rede_org_nucleo_mapa(uuid, boolean), public.rede_org_mapa(),
      public.rede_org_perfil(text), public.rede_org_plenaria(uuid), public.rede_org_tear(text), public.rede_org_tear_fio(text, jsonb),
      public.rede_org_diretorio(jsonb), public.rede_org_atos(text) to authenticated;
  end if;
end $$;

-- ═══════════════════════════ fim do B1 do perfil e organizações ═══════════════════════════
