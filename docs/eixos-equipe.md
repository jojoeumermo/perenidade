# Pesquisa dos 12 eixos da equipe (Etapa 8, B6)

Tarefa **opcional** para todo voluntário: fazer o teste dos 12 eixos (curto ou médio; longo é opcional) e mandar o resultado de forma **anônima**. A coordenação vê só a média e a distribuição da equipe, nunca a resposta de alguém.

## Onde está

- Tela: `components/painel/EixosEquipe.tsx`. Seção `eixos-equipe` ("Pesquisa dos 12 eixos", espaço Equipe, grupo Pessoas) visível a todo voluntário; o bloco "Resultado da equipe" só aparece para coordenação e vice. `ConviteEixos` é um convite discreto, junto do termo e do aviso da equipe, para quem já aceitou o termo e ainda não respondeu ("Mais tarde" ou "Não quero responder", este último guardado só no navegador).
- Partes puras: `lib/eixos/equipe.ts` (ordem fixa dos 12 números, versão e texto do aviso). A conta é a de `lib/eixos/pontuacao.ts` (`pontuarEixos`, `ordemDoNivel`; o SQL repete a lógica de `agregarPontos`: média e cinco faixas, mínimo 5).
- Banco: `supabase/migracoes/2026-11-eixos-equipe.sql` (idempotente; **não** está no `install.sql`, a integração junta).
- Teste: `npm run testar:eixos-equipe` (`scripts/testar-eixos-equipe.mjs`).

## O que o banco guarda

Três tabelas no esquema `interno` (nenhuma em `public`, RLS ligada, sem acesso de `anon` nem `authenticated`):

| Tabela | Conteúdo |
| --- | --- |
| `eixos_equipe_vivo` | uma linha: total `n`, soma por eixo e contagem por faixa (12 eixos x 5 faixas). Só agregado. |
| `eixos_equipe_publicado` | a "foto" do agregado tirada quando `n` chega a 5, 10, 15... É a única que a coordenação lê. |
| `eixos_equipe_marcas` | `usuario` e `versao` do aviso aceito. Sem data, sem valor, sem ligação com o agregado. É a marca "já respondeu" e a prova de qual texto a pessoa leu. |

Funções (`public.*`, `security definer`, `search_path = interno, pg_temp`, só `authenticated`):

- `eixos_equipe_estado()`: voluntário; devolve só `respondeu` (sim ou não).
- `eixos_equipe_enviar(p_pontos int[12], p_consentimento boolean, p_versao text)`: voluntário; exige consentimento `true`, 12 números de 0 a 100 na ordem de `interno.eixos_equipe_ids()` (a mesma de `content/eixos.json`), uma resposta por conta; soma nos baldes, trava a linha para respostas simultâneas e **não devolve nada além de ok**. As respostas às perguntas nunca saem do navegador e não são guardadas nem lá (só em memória, até enviar ou desistir).
- `eixos_equipe_resultado()`: só `interno.coord()`; devolve `liberado: false` com menos de 5 respostas; com 5 ou mais, devolve média e distribuição por eixo.

## Base legal (conferida no planalto.gov.br, Lei 13.709/2018)

- **Art. 5º, II**: opinião política é dado pessoal sensível.
- **Art. 11, I**: o tratamento de dado sensível pode ocorrer com consentimento "específico e destacado, para finalidades específicas". Por isso a tela tem um aviso próprio, com caixa de consentimento marcada pela pessoa (não pré-marcada), antes de qualquer pergunta; a função recusa envio sem o consentimento e grava a versão do aviso lido.
- **Art. 8º, § 4º**: o consentimento refere-se a finalidades determinadas. O aviso declara a finalidade (entender a diversidade de ideias da equipe e evitar que um lado domine a escolha de pautas) e nenhum outro uso.
- **Art. 5º, XI e art. 12**: dado anonimizado deixa de ser dado pessoal, a menos que a anonimização possa ser revertida com meios próprios ou esforços razoáveis. Por isso: só agregado, mínimo de 5 respostas e agregado visível só em degraus de 5.

### Limites que a pessoa lê antes de consentir

Depois de enviado, o número entra na soma e não dá mais para separá-lo, então a resposta **não pode ser retirada** (a pessoa pode simplesmente não responder; nada muda para ela). O aviso diz isso com todas as letras.

### Risco residual (honesto)

- Quem tiver acesso direto ao banco (administrador do Supabase, fora do painel) poderia, em teoria, comparar a ordem física de inserção da marca com a do agregado, ou ler o log do servidor. Mitigações: a marca não tem data; a coordenação, pelo painel, nunca vê as tabelas nem o total ao vivo, só a foto em degraus de 5; o conteúdo dos 12 números não é registrado em tabela alguma. Não eliminamos o risco para quem administra o banco.
- Com poucas pessoas na equipe, mesmo a foto de 5 pode ser pouco. Se a equipe for pequena, a coordenação deve decidir se vale divulgar o resultado internamente.

## Para quem integra

1. Rodar `supabase/migracoes/2026-11-eixos-equipe.sql` e copiar o mesmo bloco para o fim de `supabase/install.sql`.
2. O painel já registra a seção em `components/painel/Painel.tsx` e o mapa em `components/painel/estrutura.ts` (`"eixos-equipe"`, molde `configuracao`).
3. Mudou o texto do aviso? Aumente `VERSAO_DO_AVISO_EIXOS` em `lib/eixos/equipe.ts`.
