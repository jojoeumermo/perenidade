-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Onda R3 · frente "o que é público e as ferramentas" (item 3.2: nada para entregar). Menos do que o servidor guarda sobre o
-- aparelho de cada pessoa. A lista completa do que o banco guarda está em content/transparencia/o-que-o-servidor-guarda.json
-- (gerada do banco montado por scripts/ferramentas/inventario-do-banco.mjs; o teste falha se aparecer tabela ou coluna fora dela).
--
-- O "user agent" (o texto que o navegador manda dizendo o programa, a versão, o sistema, às vezes o modelo do celular) é quase uma
-- impressão digital do aparelho. Dois lugares guardavam o texto inteiro:
--   1. auth.sessions.user_agent: o serviço de contas grava em cada sessão (e regrava a cada renovação). A Alumia só usa daí o
--      navegador e o sistema (a lista "seus aparelhos" e o aviso de entrada nova, por interno.alumia_navegador).
--   2. interno.termos_aceites.navegador: o termo de voluntário, de adesão e da vitrine de saúde guardavam o texto inteiro, para
--      sempre, junto do nome.
-- Agora os dois guardam só o mínimo que dá o mesmo resultado em interno.alumia_navegador: um texto como "Firefox/ Linux" (o nome do
-- navegador e o do sistema, sem versão, sem modelo, sem idioma). O que a tela e o e-mail mostram não muda.
--
-- Os aceites de termo JÁ gravados não mudam: um gatilho recusa alterar qualquer aceite (é a prova do voluntariado), e reescrever a
-- prova é decisão do dono, não desta migração. As sessões já gravadas são reduzidas aqui.
--
-- Se o projeto não deixar criar o gatilho em auth.sessions, o aviso diz (como em alumia_sem_endereco, onda 8). Pode rodar mais de
-- uma vez. Teste: scripts/testar-r3-publico-guardamos.mjs.

/**
 * O mínimo de um "user agent" que dá o mesmo navegador e o mesmo sistema em interno.alumia_navegador: "Firefox/ Linux",
 * "Chrome/ Android", "" quando nenhum dos dois é conhecido. Aplicar duas vezes dá o mesmo texto.
 */
create or replace function interno.alumia_agente_minimo(p_agente text) returns text language sql immutable set search_path = interno, pg_temp as $$
  select btrim(
    (case n ->> 'navegador' when 'firefox' then 'Firefox/' when 'edge' then 'Edg/' when 'opera' then 'OPR/' when 'chrome' then 'Chrome/'
                           when 'safari' then 'Safari/' else '' end)
    || ' ' ||
    (case n ->> 'sistema' when 'android' then 'Android' when 'ios' then 'iPhone' when 'windows' then 'Windows' when 'macos' then 'Mac OS X'
                         when 'linux' then 'Linux' else '' end))
  from (select interno.alumia_navegador(p_agente) as n) x
$$;

/** Gatilho: troca a coluna tg_argv[0] pelo mínimo do "user agent" antes de gravar. Nulo continua nulo. */
create or replace function interno.alumia_agente_reduzir() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v text := to_jsonb(new) ->> tg_argv[0];
begin
  if v is not null then
    new := jsonb_populate_record(new, jsonb_build_object(tg_argv[0], interno.alumia_agente_minimo(v)));
  end if;
  return new;
end $$;

revoke all on function interno.alumia_agente_minimo(text), interno.alumia_agente_reduzir() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_agente_minimo(text), interno.alumia_agente_reduzir() from anon, authenticated;
  end if;
end $$;

-- 1. As sessões do serviço de contas. O gatilho roda antes do de endereço (alumia_sem_endereco) e antes do aviso de entrada nova
--    (alumia_sessao_nova, depois de gravar), que só precisa do navegador e do sistema.
do $$
begin
  if to_regclass('auth.sessions') is null
     or not exists (select 1 from information_schema.columns c where c.table_schema = 'auth' and c.table_name = 'sessions' and c.column_name = 'user_agent') then
    return;
  end if;
  execute 'drop trigger if exists alumia_agente_minimo on auth.sessions';
  execute 'create trigger alumia_agente_minimo before insert or update on auth.sessions for each row execute function interno.alumia_agente_reduzir(''user_agent'')';
  execute 'update auth.sessions set user_agent = interno.alumia_agente_minimo(user_agent)
           where user_agent is not null and user_agent is distinct from interno.alumia_agente_minimo(user_agent)';
exception when others then
  raise warning 'alumia_agente_minimo: auth.sessions ficou com o "user agent" inteiro (%). Conferir com o Jonathan.', sqlerrm;
end $$;

-- 2. Os aceites de termo, daqui para frente (o gatilho de imutabilidade é de update e delete; este é só de insert).
drop trigger if exists alumia_agente_minimo on interno.termos_aceites;
create trigger alumia_agente_minimo before insert on interno.termos_aceites
  for each row execute function interno.alumia_agente_reduzir('navegador');

select interno.alumia_trancar();
