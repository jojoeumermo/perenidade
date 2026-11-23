-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · a tag da Escola no modo só leitura: desligar a tag continua, como tirar qualquer outra coisa do perfil.
--
-- Roda depois de 20261126-p5-fim.sql (banco na versão 17) e das outras 20261127-p4-*; quem junta põe antes do
-- 20261127-p4-fim.sql. Não mexe em rede_alumia_versao nem na lista de exceções da porta: o 20261127-p4-fim.sql faz isso.
--
-- Redefine uma função que já existia: interno.alumia_so_leitura_perfil() (o gatilho do modo só leitura no perfil da rede, de
-- 20261126-p5-auditoria.sql), inteira, a partir do corpo lido do banco montado. Muda só a conferência de "tirar": a tag de
-- revolucionária(o) da Escola (perfis.escola_tag) é booleana, e "false" virava texto não vazio, então desligar a própria tag (ou
-- sair da Frente, que a desliga) caía em "alumia_so_leitura" com o modo ligado. Agora nulo, texto vazio e false contam como tirar;
-- trocar o codinome, o @, a foto, a capa, a bio, os pronomes, o status, o post fixado ou LIGAR a tag continua barrado para quem não
-- passa na trava (interno.alumia_so_leitura_passa). Sem interruptor: é conserto de uma regra que já vale (o modo só leitura é do
-- Prompt 5), e com o modo desligado nada muda.
-- Privacidade: o gatilho só compara a linha nova com a velha da mesma pessoa; não devolve nada, não guarda nada e não se chama de
-- fora. Endereço de rede: nada daqui lê ou guarda. Pode rodar mais de uma vez.
-- Lei: LGPD art. 18 (a pessoa desfaz o que fez: tirar a tag do perfil não espera o fim da emergência) e art. 46 (segurança: o
-- modo só leitura continua barrando o que os outros veem).

/**
 * A trava do modo só leitura no perfil da rede. O perfil fica em interno.perfis (dividido com o site do instituto e o painel), que
 * a trava das tabelas interno.rede_* e interno.alumia_* não cobria: com o modo ligado, uma conta comum ainda trocava o codinome,
 * o @, a foto, a capa e a bio (numa invasão, contas trocando de nome para imitar outras). Aqui só as colunas que os outros veem
 * na rede; o resto da linha (férias, avisos, se proteger, entrada) segue. Tirar (pôr vazio, nulo ou, na tag da Escola, false) não é
 * trocar e continua. Quem passa é quem passa na trava das tabelas (interno.alumia_so_leitura_passa).
 */
create or replace function interno.alumia_so_leitura_perfil() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare c text; v_novo jsonb; v_velho jsonb;
begin
  if not interno.alumia_so_leitura() or interno.alumia_so_leitura_passa() then return new; end if;
  v_novo := to_jsonb(new);
  v_velho := to_jsonb(old);
  foreach c in array array['rede_codinome', 'rede_handle', 'rede_bio', 'rede_avatar', 'rede_avatar_dados', 'rede_capa', 'rede_capa_dados',
                           'rede_pronomes', 'rede_status_texto', 'rede_status_tipo', 'rede_fixado', 'escola_tag'] loop
    if (v_novo -> c) is distinct from (v_velho -> c) and coalesce(v_novo -> c, 'null'::jsonb) not in ('null'::jsonb, '""'::jsonb, 'false'::jsonb) then
      perform interno.erro('alumia_so_leitura');
    end if;
  end loop;
  return new;
end $$;
revoke all on function interno.alumia_so_leitura_perfil() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.alumia_so_leitura_perfil() from anon, authenticated; end if;
end $$;

select interno.alumia_trancar();
