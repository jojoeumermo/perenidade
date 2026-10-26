-- Mural de Saúde (2026-10-25): verificação depois de rodar o arquivo de instalação, e plano de volta.
-- Só leitura: pode rodar quantas vezes quiser.

-- 1. Versão do termo e categorias (esperado: 2026-10-25; só psicologia ligada).
select interno.saude_termo_vigente() as termo_vigente,
       (select string_agg(k, ', ') from jsonb_each(interno.saude_regras() -> 'categorias') c (k, v) where (v ->> 'ligada')::boolean) as categorias_ligadas;

-- 2. O filtro barra os disfarces (esperado: preco, preco, preco, titulo, pratica; e null na última linha).
select t, interno.saude_conferir(jsonb_build_object('bio', t)) ->> 'grupo' as regra
from unnest(array['Atendimento gratuito', 'g r á t i s', 'gr4tis', 'Dra. Ana', 'constelação familiar', 'Acompanho adultos com ansiedade']) t;

-- 3. Colunas novas e a migração única (esperado: 7 colunas; termo_2026_10_25 = true).
select count(*) as colunas_novas from information_schema.columns
where table_schema = 'interno' and table_name = 'saude_perfis'
  and column_name in ('publico', 'idiomas', 'estado', 'declaracao_etica_em', 'declaracao_etica_versao', 'aviso_politico_em', 'aviso_politico_versao');
select valor from interno.configuracoes where chave = 'saude_migracoes';

-- 4. Situação dos perfis (esperado logo depois: ninguém visível até o novo aceite).
select count(*) filter (where interno.saude_visivel(s)) as visiveis, count(*) filter (where interno.saude_apto(s)) as nas_7_condicoes, count(*) as total
from interno.saude_perfis s;

-- Plano de volta (só se for preciso; nada foi apagado):
-- a) Ligar de novo a vitrine antiga sem as regras novas não é recomendado. Para tirar o mural do ar enquanto se decide,
--    use a chave geral no painel (Mural de Saúde › Desligar o mural) ou:
--      update interno.configuracoes set valor = valor || '{"desligada": true}' where chave = 'saude';
-- b) Para voltar o código, reverta o commit "Mural de Saúde: adequação às normas de publicidade" e rode o arquivo de
--    instalação da versão anterior. As colunas novas ficam (vazias para quem não usou), e a coluna "valor" continua lá.
-- c) Os registros (interno.saude_registro) e os aceites (interno.termos_aceites) são imutáveis e não mudam com a volta.
