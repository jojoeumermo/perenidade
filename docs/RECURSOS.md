# Recursos novos (desligados por padrão)

Os recursos de estudo desta rodada entram **desligados**. Desligados, o site fica exatamente como era: as páginas novas respondem "não encontrado" e nada muda nas páginas que já existiam. A lista e a leitura ficam em `lib/recursos.ts`.

## Como ligar

O valor é lido na **montagem** do site (é uma variável `NEXT_PUBLIC_`, gravada no código que vai ao navegador). Mudou a variável, monte e publique de novo.

- **Na sua máquina:** crie `.env.local` com

  ```
  NEXT_PUBLIC_RECURSOS=meu-estudo,exercicios
  ```

  ou `NEXT_PUBLIC_RECURSOS=todos` para ver tudo. Depois `npm run dev`.
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
| `ajudou` | "Isso ajudou?" no fim da aula, guardado só no aparelho | fim de cada aula |
| `guia-contribuir` | guia de contribuição: funções, passo a passo, modelo de aula e checklist | `/contribuir/guia` |
| `pratica-sem-placar` | esconde os pontos e a sequência de dias da prática das aulas de idioma | aulas de idioma |

Alguns dependem de outros para fazer sentido: `exercicios` e `metas` aparecem melhor com `meu-estudo`; `mapa-curricular` usa as páginas de `professores`.

## Testar à mão

1. `.env.local` com `NEXT_PUBLIC_RECURSOS=todos` e `npm run dev`.
2. Abra `/pt/trilhas/matematica-fundamental/fracoes`: no fim, os exercícios com a etiqueta "Em revisão". Erre um de propósito: aparece o engano e como corrigir. "Ver a resolução" mostra a resposta.
3. Faça o teste "O que você aprendeu" e marque a aula como concluída.
4. Abra `/pt/meu-estudo`: aula, teste e exercícios aparecem. "Baixar a cópia" e "Restaurar" levam tudo para outro navegador.
5. Apague `.env.local` (ou deixe a variável vazia), reinicie: `/pt/meu-estudo` responde "não encontrado" e a aula fica como era.

## O que fica guardado

Tudo o que estes recursos guardam fica no navegador de quem estuda (`localStorage`), nas chaves `lucia:testes`, `lucia:exercicios`, `lucia:concluidas-em`, `lucia:metas`, `lucia:nivelamento`, `lucia:ajudou` e `lucia:turmas`. Elas entram na cópia de segurança (Caderno e Meus dados) e saem no "Apagar". Nada vai para o servidor nem para o Supabase; nenhum cookie novo. O único recurso que fala com um serviço de fora é o `vlibras`, e só depois do clique de quem quer usar (veja `docs/privacidade-vlibras.md`).
