# Recursos novos (ligados por nome ou por padrão)

Cada recurso novo entra **desligado** até ser testado. Desligado, o site fica exatamente como era: as páginas novas respondem "não encontrado" e nada muda nas páginas que já existiam. A lista e a leitura ficam em `lib/recursos.ts`.

## Ligados por padrão (`PADRAO`)

Desde a Etapa 4 (E4-01), os recursos que cumprem **as duas** condições abaixo ficam ligados mesmo sem a variável:

1. este arquivo e `docs/RELATORIO-ESTUDO-NO-APARELHO.md` os dão como testados;
2. a produção **já** os liga hoje. Conferido em 03/11/2026 no código publicado de `https://institutolucia.org`: o valor gravado de `NEXT_PUBLIC_RECURSOS` é `"todos"`.

Entram: `meu-estudo`, `exercicios`, `revisoes`, `turma`, `professores`, `mapa-curricular`, `nivelamento`, `metas`, `vlibras`, `ajudou`, `guia-contribuir`, `pratica-sem-placar`. Ficam de fora `enem-curso` e `enem-video`, que o relatório do estudo no aparelho não cobre, e `escola`, que a coordenação liga.

O que muda em cada ambiente:

| Ambiente | Antes | Depois |
| --- | --- | --- |
| Produção (`NEXT_PUBLIC_RECURSOS=todos`) | tudo ligado | **igual**: tudo ligado, menos `escola` (veja abaixo) |
| Prévia da Vercel ou cópia local sem a variável | tudo desligado | os 12 de `PADRAO` ligados; `enem-curso`, `enem-video` e `escola` desligados |
| Espelho (`scripts/gerar-espelho.mjs`), montado sem a variável | tudo desligado | os 12 de `PADRAO` ligados |
| Quem quer o site como era antes | sem a variável | `NEXT_PUBLIC_RECURSOS=nenhum` |

## A Escola só liga pelo nome

`escola` está em `SO_PELO_NOME`: `todos` **não** a liga. Como a produção usa `todos`, sem essa regra a Escola abriria no ar assim que o código entrasse no master, antes de a coordenação mandar o texto "Quem foi Lúcia Maria". Para ligar: `NEXT_PUBLIC_RECURSOS=todos,escola` (ou a lista com `escola`). **Não ligar `escola` em produção antes de o texto chegar** (docs/ESCOLA.md).

## Como ligar

O valor é lido na **montagem** do site (é uma variável `NEXT_PUBLIC_`, gravada no código que vai ao navegador). Mudou a variável, monte e publique de novo.

- **Na sua máquina:** crie `.env.local` com

  ```
  NEXT_PUBLIC_RECURSOS=meu-estudo,exercicios
  ```

  ou `NEXT_PUBLIC_RECURSOS=todos,escola` para ver tudo. Depois `npm run dev`.
- **`-nome`** desliga um recurso padrão (`NEXT_PUBLIC_RECURSOS=-vlibras`) e vale também com `todos` (`todos,-vlibras`).
- **`nenhum`** desliga todos os padrões; o que estiver escrito na lista continua ligado (`nenhum,turma`).
- **No ar (Vercel):** Settings → Environment Variables → `NEXT_PUBLIC_RECURSOS` com a lista, só em *Production* (ou só em *Preview* para testar antes) → Redeploy.
- **Para desligar:** tire o nome da lista (ou apague a variável) e publique de novo.

## Os recursos

| Nome | O que liga | Onde aparece |
| --- | --- | --- |
| `meu-estudo` | painel do que a pessoa estudou: aulas feitas, testes, acertos por tema, o que revisar, cópia e "apagar" | `/meu-estudo`; o teste de fim de aula passa a guardar o resultado no aparelho; link na página Mais (`/explorar`) |
| `exercicios` | exercícios com explicação de cada erro, dificuldade, tema e etiqueta "Em revisão" (disciplina piloto: Matemática fundamental) | fim das aulas que têm exercícios; `/meu-estudo/praticar` (à vontade ou "revisar meus erros") |
| `revisoes` | etiqueta "Em revisão" / "Revisada por [função] em [data]" em cada aula, com histórico e créditos | topo e rodapé de cada aula |
| `turma` | modo turma: sequência de aulas num link, sem cadastro; comprovante de conclusão gerado no aparelho | `/turma` |
| `professores` | guia de uso em sala e planos de aula | `/professores` |
| `mapa-curricular` | habilidades da BNCC e da matriz do Enem ligadas a cada aula (com "a confirmar" onde não houve conferência) | fim das aulas mapeadas; `/professores/mapa` |
| `nivelamento` | teste curto que só sugere por onde começar, sem nota | `/nivelamento` |
| `metas` | meta semanal opcional e lembrete por arquivo de agenda (.ics) | `/meu-estudo` |
| `vlibras` | botão para ativar o VLibras; nada é carregado antes do clique | botão de acessibilidade |
| `ajudou` | "Isso ajudou?" no fim da aula; a resposta fica no aparelho e, com a Escola ligada, soma +1 anônimo para a equipe (E4-02) | fim de cada aula |
| `guia-contribuir` | guia de contribuição: funções, passo a passo, modelo de aula e checklist | `/contribuir/guia` |
| `enem-curso` | o curso ENEM: a porta do curso, diagnóstico, plano de estudos, prática por habilidade e por área, provas oficiais por ano e por dia com o relógio oficial, oficina de redação, reta final e as questões oficiais no fim das aulas (veja `docs/ENEM.md`) | `/enem` e as páginas abaixo dela; "Questões oficiais para treinar" no fim das aulas do percurso |
| `enem-video` | vídeos curtos do curso ENEM: narração pré-gravada (voz sintética), legendas, transcrição, capítulos e velocidade; nada carrega antes do clique (veja `docs/enem/video/RELATORIO.md`) | no topo das aulas que têm vídeo e no bloco `videocurto` |
| `pratica-sem-placar` | esconde os pontos e a sequência de dias da prática das aulas de idioma | aulas de idioma |
| `escola` | Escola Lúcia Maria: entrada, Quem foi Lúcia Maria, cursos, matrícula, campus e calendário; com ela, a barra de baixo do celular passa a Início, Estudar, Meu estudo, Campus e Buscar (veja `docs/ESCOLA.md`). Só liga pelo nome | `/escola` e as páginas abaixo dela; "Escola" no menu do topo, no índice do site e na barra do celular |
| `rede-v2` | Rede Lúcia v2: Rede e Fórum numa só (posts curtos, discussões, dúvidas, enquetes), comunidades com página própria, perfil com @nome e endereço próprio para post, perfil e comunidade (veja `docs/rede/V2.md`). Só liga pelo nome | `/comunidade` (troca a Rede de hoje pela v2) e `/comunidade/p/[id]`, `/comunidade/c/[slug]`, `/comunidade/u/[handle]` |

Alguns dependem de outros para fazer sentido: `exercicios` e `metas` aparecem melhor com `meu-estudo`; `mapa-curricular` usa as páginas de `professores`.

## Testar à mão

1. `.env.local` com `NEXT_PUBLIC_RECURSOS=todos` e `npm run dev`.
2. Abra `/pt/trilhas/matematica-fundamental/fracoes`: no fim, os exercícios com a etiqueta "Em revisão". Erre um de propósito: aparece o engano e como corrigir. "Ver a resolução" mostra a resposta.
3. Faça o teste "O que você aprendeu" e marque a aula como concluída.
4. Abra `/pt/meu-estudo`: aula, teste e exercícios aparecem. "Baixar a cópia" e "Restaurar" levam tudo para outro navegador.
5. Apague `.env.local` (ou deixe a variável vazia), reinicie: `/pt/meu-estudo` responde "não encontrado" e a aula fica como era.

## O que fica guardado

Tudo o que estes recursos guardam fica no navegador de quem estuda (`localStorage`), nas chaves `lucia:testes`, `lucia:exercicios`, `lucia:concluidas-em`, `lucia:metas`, `lucia:nivelamento`, `lucia:ajudou`, `lucia:turmas`, `lucia:enem` e `lucia:video-curto` (onde parou em cada vídeo curto e a velocidade) (o curso ENEM: provas e simulados feitos, diagnóstico, plano e tempo por questão). Elas entram na cópia de segurança (Caderno e Meus dados) e saem no "Apagar". Nada vai para o servidor nem para o Supabase; nenhum cookie novo. O único recurso que fala com um serviço de fora é o `vlibras`, e só depois do clique de quem quer usar (veja `docs/privacidade-vlibras.md`).

## `vale-o-escrito` (Etapa 10)

O observatório Vale o Escrito (`/[lang]/vale-o-escrito`) também está em `SO_PELO_NOME`: `todos` **não** o liga. Só abre com o nome na lista (`NEXT_PUBLIC_RECURSOS=todos,vale-o-escrito`) e **não deve ser ligado em produção antes de a curadoria revisar as entradas e a assessoria jurídica conferir** (docs/vale-o-escrito/ESPEC.md). Desligado, as rotas respondem 404 e o item some do menu.


## `rede-v2` (Etapa 7)

A Rede Lúcia v2 (Rede e Fórum numa só: posts curtos, discussões, dúvidas, enquetes; comunidades com página própria; perfil com @nome; endereços `/comunidade/p/[id]`, `/comunidade/c/[slug]` e `/comunidade/u/[handle]`) também está em `SO_PELO_NOME`: `todos` **não** a liga, porque a produção usa `todos` e a migração SQL dela (`supabase/migracoes/2026-11-rede-*.sql`, depois do `install.sql`) ainda precisa rodar no Supabase. Só abre com o nome na lista (`NEXT_PUBLIC_RECURSOS=todos,rede-v2`).

- **Desligado** (o caso da produção hoje): a Rede e o Fórum de hoje ficam exatamente como estão, as três rotas novas respondem 404 e `?t=` e `?sala=` não redirecionam. É a volta atrás garantida.
- **Ligado**: `/[lang]/comunidade` abre a v2 (carregada sob demanda, com esqueleto), `?t=<tópico>` e `?sala=<disciplina>` redirecionam (301) para o post e a comunidade novos, e o Fórum de visual antigo deixa de aparecer.
- Os consertos de segurança e privacidade (contagens só para o autor, idade mínima 18, convites com hash, moderação externa) valem para as duas versões e não dependem do recurso.
- Ordem para ligar: rodar `install.sql` e as migrações `2026-11-rede-*.sql` na ordem de `docs/rede/V2.md`; conferir com `npm run testar:rede-fundacao`; ligar para a equipe (prévia), depois beta, depois todos. Nenhum `drop` até a v2 estar no ar há 30 dias.

## `turmas` (T08, 06/11/2026): em pausa

A coordenação pediu: "deixa desativado pelo painel interno (podendo ligar de novo) as turmas por enquanto. Não temos gente o suficiente". As turmas são as **turmas por curso da Escola** (`/escola/turmas` e `/escola/turmas/[curso]`) e a **Turma do mês** (`/turmas`). O modo turma (`turma`, `/turma`, sequência de aulas num link para quem dá aula) é outra coisa e continua como está; as ferramentas de quem facilita (`/escola/turmas/circulo`, `/banca`, `/cartaz`) funcionam no aparelho, sem precisar de gente da equipe, e também continuam.

- **Vem desligado.** `turmas` está em `EM_PAUSA` (`lib/recursos.ts`): como os de `SO_PELO_NOME`, a variável `todos` da produção **não** o liga. A migração `supabase/migracoes/20261106-painel-turmas.sql` põe o recurso no catálogo e grava a decisão "desligado", para a chave aparecer desligada no painel desde o primeiro dia.
- **Como religar:** Painel › Site e operação › Controles avançados › Recursos › "Turmas (da Escola e Turma do mês)" › **Ligar**. Vale na hora, **sem** segunda pessoa (no banco, `so_pelo_nome = false`): não há texto, revisão jurídica nem migração esperando. Também liga pela variável, com o nome escrito (`NEXT_PUBLIC_RECURSOS=todos,escola,turmas`).
- **Desligado:** os endereços continuam vivos (nenhum link quebra, nada de 404) e mostram um aviso curto e digno, "As turmas estão em pausa", com o caminho para os cursos e as disciplinas, nos 6 idiomas (`i18n/escola/turma/*.json`, chave `pausa`). O aviso leva `noindex` e `/turmas` sai do mapa do site. Somem: o link "Turmas" da faixa da Escola, a "Turma do mês" do menu Mais e o cartão da turma no quadro de avisos do Campus. Os links soltos no meio de outras páginas (cursos, provas, formatura) continuam e levam ao aviso.
- **Quanto demora:** as páginas de turma leem a decisão no servidor (cache de 60 s, `lib/recursos-vivos.ts`) e se refazem sozinhas; a faixa da Escola e o quadro de avisos leem `/api/recursos` no navegador. O menu Mais e o mapa do site seguem a variável de montagem e a última leitura do servidor.
- **Privacidade:** nada novo é guardado nem enviado; a leitura de `/api/recursos` só devolve nomes de recursos (LGPD, Lei 13.709/2018, art. 6º, III).

## `assistente-publico` (T03, 06/11/2026): o assistente em todo o site, ligado

A coordenação pediu: "eu quero ligar o assistente em todo o site. Mas quero uma API gratuita e que limite por IP o uso para não estourar. Precisa ser generosa."

- **Vem ligado** (`PADRAO`, `lib/recursos.ts`). Em todas as páginas (menos o painel da equipe e a área infantil) aparece um botão discreto, o balão com ponto de interrogação, no canto de baixo à esquerda (no celular, empilhado acima do botão de acessibilidade). Só o botão vem com a página; a janela (`components/assistente/PainelDoAssistente.tsx`) e o Markdown só são baixados no primeiro uso (o ponteiro passando por cima já adianta).
- **Sem conta.** A pergunta vai a `app/api/assistente` (no servidor do site, na VPS), que pergunta às IAs **gratuitas** em rodízio: Groq, Gemini, Cerebras e OpenRouter (modelos `:free`), as mesmas do robô do Vale o Escrito. O Claude (pago) continua só na função da conta. Sem nenhuma chave cadastrada, o assistente aberto fica desligado sozinho (a janela diz isso e manda ao reforço).
- **Também nas telas de estudo.** O Assistente da Escola (acompanhante), a Aula de reforço e a Foto do exercício (esta só com o Gemini, que lê foto) passam a funcionar sem conta e quando o assistente da conta está desligado: `askAssistant` (`lib/backend.ts`) tenta a conta e, se ela não puder responder, passa ao aberto.
- **Limite por pessoa:** 40 perguntas por hora e 150 por dia; **do site:** 1.200 por dia (variáveis `ASSISTENTE_POR_HORA`, `ASSISTENTE_POR_DIA`, `ASSISTENTE_LIMITE_GLOBAL` em `/opt/lucia/site.env`). "Pessoa" é um HMAC-SHA-256 do IP (vindo do `CF-Connecting-IP` do Cloudflare; IPv6 pelo /64) com um sal aleatório que nasce na memória a cada dia de Brasília. O IP nunca é gravado nem registrado; resumos e contagens ficam só na memória e somem na virada do dia (LGPD, art. 6º, III, e art. 12). Falha de todos os provedores devolve a vez. Mensagens claras ao passar: `assistente_limite_hora`, `assistente_limite` e `assistente_lotado`, com `Retry-After`.
- **Desligar:** Painel › Site e operação › Controles avançados › Recursos › `assistente-publico` › Desligar (a rota obedece em até 1 minuto; o botão continua, mas a janela diz que está desligado até a próxima publicação). Na hora, sem painel: `ASSISTENTE_PUBLICO=0` em `/opt/lucia/site.env`. Para tirar também o botão: `NEXT_PUBLIC_RECURSOS` com `-assistente-publico` e publicar.
- **Ordem do rodízio:** `ASSISTENTE_ORDEM=groq,gemini,cerebras,openrouter` (opcional). Modelos: `GROQ_MODELO`/`GROQ_MODEL` e os equivalentes, como no robô.
- **Banco:** só a linha do catálogo (`supabase/migracoes/20261106-t03-assistente-publico.sql`, já também em `install.sql` e em `2026-11-backend-1.sql`). Nenhuma tabela nova.
- **Testes:** `npm run testar:assistente` (limite, sal do dia, IPv6, rodízio, rota e botão) e `npm run testar:privacidade`.
