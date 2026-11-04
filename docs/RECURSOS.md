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
