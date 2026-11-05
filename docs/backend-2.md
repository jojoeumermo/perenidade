# Back-end novo, parte 2 (Etapa 8, pacote backend-2)

Oito itens do back-end novo do painel, cada um com função SQL, tela e teste. SQL em `supabase/migracoes/2026-11-backend-2.sql` (idempotente; **não** está no `install.sql`, a integração junta). Teste: `npm run testar:backend-2`. Nenhuma tabela no esquema `public` (cinco em `interno`, RLS ligada, sem acesso de `anon`/`authenticated`); toda função `public.*` é `security definer` com `search_path = interno, pg_temp`; nenhuma função interna é executável por quem chama.

## Mapa

| Item | Função SQL (`public.*`) | Tela (seção do painel) |
| --- | --- | --- |
| Limpar cache, ver publicação, ver backup | `operacao_pedir`, `operacao_resultado`, `operacao_situacao` | `operacao` (Site), `components/painel/Operacao.tsx`; rota `app/api/painel/operacao/route.ts` |
| Aviso de vencimento do token do Instagram | `instagram_token_situacao`, `instagram_token_validade_salvar` (+ `interno.instagram_token_vigiar`) | dentro de `operacao` |
| Regras do Mural de Saúde | `saude_regras_ajustes_ver`, `saude_regras_ajustes_salvar` | `components/painel/SaudeRegras.tsx`, no fim da seção `saude` (coordenação e vice) |
| Lacunas da disciplina no banco | `lacunas_listar`, `lacunas_salvar`, `lacunas_apagar`, `lacunas_resumo` | aba "Lacunas" de `ensino` (Produção), `Ensino.tsx` |
| Resultado das aulas para quem ensina | `aulas_resultado_minhas`, `aulas_resultado_ensino` | aba "Resultado das aulas" de `ensino` |
| Caixa de imprensa para o porta-voz | `imprensa_enviar` (visitante), `imprensa_listar`, `imprensa_atender`, `imprensa_contar` | `imprensa` (Comunidade e atendimento), `Imprensa.tsx`; formulário público em `/imprensa` (`ImprensaForm.tsx`) |
| Prévia com dados de exemplo | `previa_exemplo` | `previa` (Equipe), `Previa.tsx` |
| Resumo diário opcional por e-mail | `resumo_diario_estado`, `resumo_diario_definir` (+ `interno.resumo_diario_enviar`) | `previa` (a mesma seção) |

Seções novas no registro de `Painel.tsx` e no mapa de `estrutura.ts`: `operacao`, `imprensa`, `ensino`, `previa`.

## Operação do site

A tela fala com `/api/painel/operacao`, que (1) confere o token da sessão e chama `operacao_pedir` (só coordenação e vice; limpeza do cache no máximo 3 por hora, os "ver" 30 por hora), (2) só então fala com o serviço, (3) anota o resultado em uma frase curta com `operacao_resultado`. Os tokens ficam só no servidor e nunca voltam na resposta. Sem a variável, o botão fica desligado (o `GET` diz o que está ligado).

| Botão | Variáveis na Vercel | Chamada |
| --- | --- | --- |
| Ver a publicação | `VERCEL_TOKEN_LEITURA`, `VERCEL_PROJECT_ID`, opcional `VERCEL_TEAM_ID` | `GET https://api.vercel.com/v7/deployments?projectId=...&target=production&limit=1` (campos `readyState`, `created`; conferido na documentação da Vercel em novembro de 2026) |
| Ver a cópia do banco | `GITHUB_LEITURA_TOKEN` (só "Actions: leitura"), opcional `GITHUB_PUBLICAR_REPO` | `GET /repos/{repo}/actions/workflows/backup.yml/runs?per_page=1` |
| Limpar o cache | `CF_TOKEN_CACHE`, `CF_ZONE_ID` (os mesmos de `limpar-cache.yml`; permissão só "Cache Purge") | `POST .../zones/{zona}/purge_cache` com `purge_everything` |

Observação: `backup.yml` só roda com o repositório privado e com os segredos criados; com o repositório público a rodada aparece como "pulada" e a tela explica. Se o site migrar para o servidor próprio, a chamada da Vercel deve ser trocada pela do novo servidor (a tela só depende da frase em `lib/operacao.ts`). Partes puras (frases, faixas do token): `lib/operacao.ts`.

## Token do Instagram

Guarda **só a data de vencimento** (`configuracoes`, chave `instagram_token`), nunca o token (que mora em `INSTAGRAM_TOKEN` na Vercel). Faixas: mais de 14 dias, ok; 14 ou menos, aviso; 3 ou menos, urgente; negativo, vencido. A rotina diária manda **um** e-mail à coordenação em cada faixa (14, 7, 3, 1 dia e vencido); anotar data nova zera o controle. A data é digitada porque a Meta mostra a validade ao gerar o token; o prazo de validade do token não é presumido pelo código.

## Regras do Mural de Saúde

A fonte continua sendo `content/saude/regras.json` (bloco gerado no `install.sql`). A coordenação só **aperta**: acrescenta grupos de termos (até 30 grupos, 30 termos de 2 a 60 caracteres, com motivo e sugestão) e **pausa** categorias. Não existe caminho para tirar um termo do arquivo nem para ligar uma categoria que ele deixa desligada. A migração redefine, dentro de um `DO` protegido por `to_regprocedure`, `interno.saude_conferir` e `interno.saude_categoria_ligada` (agora `stable`) para lerem os ajustes; **ao juntar no `install.sql`, estas duas definições substituem as do bloco do Mural de Saúde**. Termos novos valem para todo texto salvo daqui em diante; pausar uma categoria tira os perfis dela da vitrine na hora.

## Lacunas da disciplina

Tabela `interno.disciplina_lacunas` (disciplina, título, detalhe, aula relacionada, prioridade, situação). Lê e escreve quem ensina a disciplina (`interno.ensina`: função de educação da disciplina, ou curadoria, ou coordenação). Só a coordenação apaga de vez; os demais marcam "descartada". Suposição: o `slug` da disciplina nas funções de educação é o mesmo `slug` da trilha (é o que `Curriculo.tsx` e `aula_acertos` já usam).

## Resultado das aulas

Reaproveita as somas anônimas de `contagens` (`aula_teste`, `aula_acertou`) que `aula_acertos` já lê. Diferenças: restrito a quem ensina **aquela** disciplina; esconde aula com menos de 5 testes ("poucos testes", sem número); marca aula difícil (10 testes ou mais e menos de 40% de acerto); compara os últimos 30 dias com os 30 anteriores. Nenhum dado de pessoa entra.

## Caixa de imprensa

Formulário público em `/imprensa` (só em português; nos outros idiomas aparece o aviso de página sem tradução). Pede nome, veículo (opcional), e-mail, assunto, mensagem e prazo (opcional). Sem telefone, documento, rede social, IP nem rastreador; sem script de terceiros.

Base legal, conferida no planalto.gov.br (Lei 13.709/2018, LGPD): **art. 6º, I e III** (finalidade e necessidade: só o mínimo para responder), **art. 7º, I** (consentimento marcado, obrigatório no formulário e no banco), **arts. 15, I, e 16** (acabada a finalidade, eliminação: `apagar_em` = 180 dias depois de respondido ou arquivado; pedido novo sem resposta some em 365 dias). A faxina roda junto do resumo diário.

Proteções: campo-isca `site`; 3 envios por hora por origem; 3 por dia por e-mail; teto de 300 pedidos novos. Quem lê: porta-voz, coordenação e vice (o acesso fica no registro de atividades). Aviso por e-mail à equipe de imprensa **sem nenhum dado do pedido**. O painel não envia resposta: o porta-voz responde pelo e-mail do instituto.

Pendência para a integração: nenhum link para `/imprensa` foi posto no menu nem no rodapé, nem no `sitemap.ts` (arquivos compartilhados). Decidir onde.

## Prévia e resumo diário

`previa_exemplo(tela)` devolve dados inventados e marcados `exemplo: true` (telas: imprensa, lacunas, resultado_aulas, resumo_diario, operacao); a tela escreve "EXEMPLO: nada abaixo é real". O resumo diário é **opt-in** (nasce desligado; a linha só existe depois que a pessoa liga), traz só contagens do que as funções dela enxergam (revisões pendentes, pedidos de imprensa novos, lacunas de prioridade alta abertas, token do Instagram para a coordenação), nunca nome nem conteúdo, e não é enviado em dia sem novidade. Entra na fila de e-mails de sempre (`interno.email`, tipo `resumo_diario`, 1 por dia por endereço; quem desligou o tipo em Minha conta também não recebe); agendamento por `pg_cron` às 10h UTC (7h em Brasília) quando a extensão existe, e a reserva `emails.yml` envia o que ficar na fila.

## Pendências e decisões

- Não rodei o SQL contra um Postgres (sem banco nesta sessão): conferido por leitura e pelo teste estático. Rodar `2026-11-backend-2.sql` em um banco de teste antes de juntar.
- Sem conferência visual no navegador nem `next build`.
- Variáveis novas da Vercel (todas opcionais): `VERCEL_TOKEN_LEITURA`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `GITHUB_LEITURA_TOKEN`; as do Cloudflare já existiam nos segredos do GitHub e precisam ser copiadas para a Vercel (`CF_TOKEN_CACHE`, `CF_ZONE_ID`).
- A Mesa por função e o aviso na Mesa (contagem de imprensa e do token) ficam com os pacotes `mesa` e `backend-1`; `imprensa_contar()` já está pronta para o número no menu.
- Faltam textos em en/es/fr/ru/zh: as telas do painel novas estão só em português, como as demais telas recentes.
