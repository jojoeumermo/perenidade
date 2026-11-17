-- ───────────────────────────── Chat da equipe: o aparelho que se certifica sozinho espera 24 horas ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Fica no fim do install.sql (depois da integração, antes do fim dela). Pode rodar mais de uma vez. Teste: npm run testar:banco
-- (a parte "chat da equipe: o aparelho que se certifica sozinho espera").
--
-- O problema (revisão da integração, 17/11): no chat da equipe, a conferência de "aparelho aprovado" do servidor era só
-- "certificado is not null". O banco não confere Ed25519, e chat_aparelho_registrar (com p_assina) e chat_aparelho_recuperar
-- aceitam qualquer texto de 86 letras como certificado, desde que venha junto a chave PÚBLICA da identidade, que não é segredo.
-- Quem tinha só a sessão de alguém da equipe registrava um aparelho "aprovado" sem a chave privada e passava em todas as
-- equipe_chat_*: via os pedidos de chave (conversa, sessão, quem pediu), consumia as chaves de uso único dos colegas e recebia a
-- caixa do aparelho. O conteúdo continuava protegido (o cliente confere o certificado e não manda chave de sala a aparelho com
-- certificado falso); o que vazava era metadado.
--
-- O conserto: o aparelho que se certifica SOZINHO numa conta que já teve identidade (a cópia de recuperação, a identidade
-- recomeçada, o "definir" depois de recomeçar) fica certificado mas só VALE 24 horas depois (chat_aparelhos.vale_desde). Nesse
-- tempo a pessoa recebe o aviso de aparelho novo e pode removê-lo em Conversas → Aparelhos. O aparelho aprovado por outro aparelho
-- dela que já vale (chat_aparelho_aprovar) vale na hora; e um aparelho ainda na espera não aprova ninguém. O primeiro aparelho de
-- uma conta que nunca teve identidade vale na hora (não há em quem confiar antes dele). O segundo fator continua valendo como
-- antes: interno.voluntario() já o exige de quem o tem.
--
-- Funções redefinidas (inteiras, com o corpo de hoje no banco montado mais o que vem aqui): interno.chat_aparelho_json,
-- public.chat_aparelho_registrar, public.chat_aparelho_recuperar, public.chat_identidade_definir, public.chat_aparelho_aprovar,
-- public.chat_aparelho_pedir, public.chat_aparelhos_meus, interno.equipe_chat_meu e interno.equipe_de. Uma função nova, pequena
-- (interno.chat_aparelho_vale). Uma coluna nova (vale_desde), nenhuma tabela nova, nenhuma permissão nova (create
-- or replace mantém as de antes). As funções public.chat_* são do chat da EQUIPE (o painel): ficam fora da porta da Alumia.
-- Nenhuma recebe linha de tabela com valor padrão. Endereço de rede: nada daqui lê ou guarda.

-- ── 1. A coluna ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Nulo: vale já (os aparelhos de antes, o primeiro da conta, o aprovado por outro). Com data: certificado, mas só vale a partir dela.
alter table interno.chat_aparelhos add column if not exists vale_desde timestamptz;

/** O aparelho certificado já vale (fora da espera de 24 horas)? */
create or replace function interno.chat_aparelho_vale(p_vale_desde timestamptz) returns boolean language sql stable as $$
  select p_vale_desde is null or p_vale_desde <= now()
$$;
revoke all on function interno.chat_aparelho_vale(timestamptz) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.chat_aparelho_vale(timestamptz) from anon, authenticated;
  end if;
end $$;

-- ── 2. O aparelho como a tela recebe ─────────────────────────────────────────────────────────────────────────────────────────
-- Na espera, o aparelho aparece "pendente" para ele mesmo (lib/chaveiro.ts não usa a biblioteca enquanto pendente e pergunta de
-- novo depois); passadas as 24 horas, "aprovado" sem mais nada. "vale_desde" vai junto, para a tela dizer até quando.
create or replace function interno.chat_aparelho_json(a interno.chat_aparelhos) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', a.id, 'rotulo', a.rotulo, 'criado_em', a.criado_em, 'visto_em', a.visto_em, 'aprovado_em', a.aprovado_em,
    'estado', case when a.certificado is not null and interno.chat_aparelho_vale(a.vale_desde) then 'aprovado' else 'pendente' end,
    'vale_desde', a.vale_desde,
    'certificado', a.certificado, 'identidade_embrulho', a.identidade_embrulho, 'aprovado_publica', a.aprovado_publica,
    'identidade', (select jsonb_build_object('assina', i.assina, 'versao', i.versao) from chat_identidades i where i.usuario = a.usuario))
$$;

-- ── 3. Registrar: com identidade numa conta que já teve uma, a espera ────────────────────────────────────────────────────────
create or replace function public.chat_aparelho_registrar(p_publica text, p_rotulo text default '', p_pedido jsonb default null, p_assina text default null, p_certificado text default null) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_rotulo text := interno.txt(p_rotulo, 'rotulo', 0, 80); v_id uuid; v_dono uuid; v_outros integer; v_assina text; v_teve boolean; a chat_aparelhos;
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_publica, '') !~ '^B[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:publica'); end if;
  select id, usuario into v_id, v_dono from chat_aparelhos where publica = p_publica;
  if v_id is not null then
    if v_dono is distinct from v then perform interno.erro('invalido:publica'); end if;
    update chat_aparelhos set visto_em = now(), rotulo = case when v_rotulo <> '' then v_rotulo else rotulo end where id = v_id returning * into a;
    return interno.chat_aparelho_json(a);
  end if;
  perform interno.limite('chat_aparelho', 10, 1440);
  if p_assina is not null and p_assina !~ '^B[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:assina'); end if;
  if p_certificado is not null and p_certificado !~ '^[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:certificado'); end if;
  if p_pedido is not null and (jsonb_typeof(p_pedido) <> 'object' or coalesce(p_pedido ->> 'sal', '') !~ '^[A-Za-z0-9_-]{22}$' or coalesce(p_pedido ->> 'iv', '') !~ '^[A-Za-z0-9_-]{16}$' or coalesce(p_pedido ->> 'cifrado', '') !~ '^[A-Za-z0-9_-]{100,160}$') then
    perform interno.erro('invalido:pedido');
  end if;
  select count(*) into v_outros from chat_aparelhos where usuario = v;
  if v_outros >= 10 then
    perform interno.chat_aparelho_tirar((select id from chat_aparelhos where usuario = v order by visto_em limit 1));
  end if;
  select assina, true into v_assina, v_teve from chat_identidades where usuario = v;
  v_teve := coalesce(v_teve, false);
  if p_assina is not null then
    -- Com identidade: ou é a primeira da conta (ou a primeira depois de recomeçar), ou é a mesma que já existe, vinda da cópia de recuperação.
    if p_certificado is null then perform interno.erro('invalido:certificado'); end if;
    if v_assina is not null and v_assina <> p_assina then perform interno.erro('identidade_existe'); end if;
    if v_assina is null then
      insert into chat_identidades (usuario, assina) values (v, p_assina)
      on conflict (usuario) do update set assina = excluded.assina, atualizado_em = now();
    end if;
    -- O banco não confere o certificado: numa conta que já teve identidade (a cópia de recuperação, ou depois de recomeçar), o
    -- aparelho que se certifica sozinho só vale daqui a 24 horas. A primeira identidade da conta vale na hora.
    insert into chat_aparelhos (usuario, publica, rotulo, certificado, aprovado_em, vale_desde)
      values (v, p_publica, v_rotulo, p_certificado, now(), case when v_teve then now() + interval '24 hours' end) returning * into a;
    perform interno.registrar(case when v_assina is null then 'chat_identidade_criada' else 'chat_aparelho_recuperado' end, v::text, jsonb_build_object('rotulo', v_rotulo, 'espera', a.vale_desde is not null));
  else
    if p_pedido is null then perform interno.erro('invalido:pedido'); end if;
    insert into chat_aparelhos (usuario, publica, rotulo, pedido, pedido_em) values (v, p_publica, v_rotulo, p_pedido, now()) returning * into a;
  end if;
  if v_outros > 0 or a.vale_desde is not null then
    perform interno.avisar_em(v, 'As suas conversas da equipe foram abertas em um aparelho novo (' || coalesce(nullif(v_rotulo, ''), 'navegador desconhecido')
      || case when a.certificado is null then '). Ele só passa a ler as conversas depois que você o aprovar, em Conversas → Aparelhos. Se não foi você, remova-o lá e avise a coordenação.'
              when a.vale_desde is not null then '). Ele só passa a valer daqui a 24 horas (ou antes, se um aparelho seu que já vale o aprovar). Se não foi você, remova esse aparelho em Conversas → Aparelhos e avise a coordenação.'
              else '). Se não foi você, remova esse aparelho em Conversas → Aparelhos e avise a coordenação.' end, 'conta');
  end if;
  perform interno.registrar('chat_aparelho_novo', v::text, jsonb_build_object('rotulo', v_rotulo, 'pendente', a.certificado is null));
  return interno.chat_aparelho_json(a);
end $$;

-- ── 4. Recuperar (a cópia de recuperação num aparelho pendente): a espera ───────────────────────────────────────────────────
create or replace function public.chat_aparelho_recuperar(p_id uuid, p_assina text, p_certificado text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a chat_aparelhos;
begin
  perform interno.limite('chat_recuperar', 10, 60);
  if coalesce(p_assina, '') !~ '^B[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:assina'); end if;
  if coalesce(p_certificado, '') !~ '^[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:certificado'); end if;
  if not exists (select 1 from chat_identidades where usuario = v and assina = p_assina) then perform interno.erro('identidade_diferente'); end if;
  -- A chave pública da identidade não é segredo: o aparelho que se certifica com ela só vale daqui a 24 horas.
  update chat_aparelhos set certificado = p_certificado, aprovado_em = now(), pedido = null, vale_desde = now() + interval '24 hours'
  where id = p_id and usuario = v and certificado is null returning * into a;
  if not found then perform interno.erro('aparelho_desconhecido'); end if;
  perform interno.registrar('chat_aparelho_recuperado', v::text, jsonb_build_object('rotulo', a.rotulo, 'espera', true));
  perform interno.avisar_em(v, 'Um aparelho das suas conversas da equipe foi recuperado pela cópia de recuperação (' || coalesce(nullif(a.rotulo, ''), 'navegador desconhecido')
    || '). Ele só passa a valer daqui a 24 horas (ou antes, se um aparelho seu que já vale o aprovar). Se não foi você, remova-o em Conversas → Aparelhos e avise a coordenação.', 'conta');
  return interno.chat_aparelho_json(a);
end $$;

-- ── 5. Definir a identidade (a conta que tinha aparelhos sem identidade): depois de recomeçar, a espera ──────────────────────
create or replace function public.chat_identidade_definir(p_aparelho uuid, p_assina text, p_certificado text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a chat_aparelhos; v_teve boolean := exists (select 1 from chat_identidades where usuario = interno.eu());
begin
  if coalesce(p_assina, '') !~ '^B[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:assina'); end if;
  if coalesce(p_certificado, '') !~ '^[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:certificado'); end if;
  if exists (select 1 from chat_identidades where usuario = v and assina is not null) then perform interno.erro('identidade_existe'); end if;
  update chat_aparelhos set certificado = p_certificado, aprovado_em = now(), pedido = null, vale_desde = case when v_teve then now() + interval '24 hours' end
  where id = p_aparelho and usuario = v returning * into a;
  if not found then perform interno.erro('aparelho_desconhecido'); end if;
  insert into chat_identidades (usuario, assina) values (v, p_assina) on conflict (usuario) do update set assina = excluded.assina, atualizado_em = now();
  perform interno.registrar('chat_identidade_criada', v::text, jsonb_build_object('rotulo', a.rotulo, 'migracao', true, 'espera', a.vale_desde is not null));
  return jsonb_build_object('ok', true,
    'outros', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'publica', x.publica, 'rotulo', x.rotulo, 'visto_em', x.visto_em) order by x.visto_em desc)
                        from chat_aparelhos x where x.usuario = v and x.id <> p_aparelho and x.certificado is null and x.pedido is null), '[]'::jsonb));
end $$;

-- ── 6. Aprovar: só um aparelho que já vale aprova; o aprovado (e o que estava na espera) vale na hora ───────────────────────
create or replace function public.chat_aparelho_aprovar(p_id uuid, p_por uuid, p_certificado text, p_identidade_embrulho text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_publica text; a chat_aparelhos;
begin
  select publica into v_publica from chat_aparelhos where id = p_por and usuario = v and certificado is not null and interno.chat_aparelho_vale(vale_desde);
  if v_publica is null then perform interno.erro('aparelho_desconhecido'); end if;
  if coalesce(p_certificado, '') !~ '^[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:certificado'); end if;
  if not interno.equipe_chat_embrulho_ok(p_identidade_embrulho) then perform interno.erro('invalido:embrulho'); end if;
  update chat_aparelhos set certificado = p_certificado, aprovado_por = p_por, aprovado_publica = v_publica, aprovado_em = now(), identidade_embrulho = p_identidade_embrulho, pedido = null, vale_desde = null
  where id = p_id and usuario = v and (certificado is null or not interno.chat_aparelho_vale(vale_desde)) and id <> p_por returning * into a;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('chat_aparelho_aprovado', v::text, jsonb_build_object('rotulo', a.rotulo));
  return interno.chat_aparelho_json(a);
end $$;

-- ── 7. Na espera, o aparelho pode pedir aprovação (e a lista o mostra "pendente") ─────────────────────────────────────────
-- Para a pessoa poder aprová-lo antes das 24 horas pelo código, como um aparelho novo.
create or replace function public.chat_aparelho_pedir(p_id uuid, p_pedido jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a chat_aparelhos;
begin
  perform interno.limite('chat_pedido', 20, 60);
  if p_pedido is null or jsonb_typeof(p_pedido) <> 'object' or coalesce(p_pedido ->> 'sal', '') !~ '^[A-Za-z0-9_-]{22}$' or coalesce(p_pedido ->> 'iv', '') !~ '^[A-Za-z0-9_-]{16}$' or coalesce(p_pedido ->> 'cifrado', '') !~ '^[A-Za-z0-9_-]{100,160}$' then
    perform interno.erro('invalido:pedido');
  end if;
  update chat_aparelhos set pedido = p_pedido, pedido_em = now(), visto_em = now()
  where id = p_id and usuario = v and (certificado is null or not interno.chat_aparelho_vale(vale_desde)) returning * into a;
  if not found then perform interno.erro('aparelho_desconhecido'); end if;
  return interno.chat_aparelho_json(a);
end $$;

create or replace function public.chat_aparelhos_meus() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'rotulo', a.rotulo, 'criado_em', a.criado_em, 'visto_em', a.visto_em, 'aprovado_em', a.aprovado_em, 'publica', a.publica,
            'estado', case when a.certificado is not null and interno.chat_aparelho_vale(a.vale_desde) then 'aprovado' else 'pendente' end, 'vale_desde', a.vale_desde, 'pedido', a.pedido)
            order by (a.certificado is null or not interno.chat_aparelho_vale(a.vale_desde)) desc, a.visto_em desc), '[]'::jsonb)
          from chat_aparelhos a where a.usuario = v);
end $$;

-- ── 8. As conferências do chat da equipe: aprovado E fora da espera ─────────────────────────────────────────────────────────
/** Este aparelho é meu, está aprovado e já vale? (Toda função da biblioteca exige.) */
create or replace function interno.equipe_chat_meu(p_aparelho uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.voluntario() and exists (select 1 from chat_aparelhos a join perfis f on f.id = a.usuario
    where a.id = p_aparelho and a.usuario = interno.eu() and a.certificado is not null and interno.chat_aparelho_vale(a.vale_desde) and not f.suspenso)
$$;
/** É da equipe (conta não suspensa, com um aparelho aprovado que já vale)? Lê sem depender de quem chama. */
create or replace function interno.equipe_de(p_usuario uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from perfis f where f.id = p_usuario and not f.suspenso)
     and exists (select 1 from chat_aparelhos a where a.usuario = p_usuario and a.certificado is not null and interno.chat_aparelho_vale(a.vale_desde))
$$;
