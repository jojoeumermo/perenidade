# Cursos da Escola Revolucionária Lúcia Maria

Cada curso é um arquivo `<slug>.json` nesta pasta. O nome do arquivo é o slug do curso. A pasta vazia é válida: a Escola abre sem nenhum curso.

O formato e as regras estão em `lib/escola/cursos.ts` (tipo `Curso` e `validarCurso`). A leitura da pasta fica em `lib/escola/cursos-servidor.ts`, que roda só no servidor e na montagem. `npm run testar:escola` valida **todos** os arquivos desta pasta e falha se algum tiver erro.

## Campos

| Campo | Obrigatório | O que é |
| --- | --- | --- |
| `slug` | sim | letras minúsculas, números e hífen; igual ao nome do arquivo |
| `titulo` | sim | nome do curso |
| `ciclo` | sim | `basico`, `profissional` ou `avancado` |
| `formato` | sim | `regular`, `alternancia` (tempo escola e tempo trabalho) ou `percurso` |
| `area` | sim | slug de uma disciplina de `lib/areas.ts` |
| `resumo` | sim | uma ou duas frases |
| `objetivo` | sim | o que a pessoa consegue fazer no fim |
| `objetivos` | sim | lista dos objetivos da matrícula para os quais o curso é sugerido: `terminar-a-escola`, `trabalho-e-renda`, `entender-o-mundo`, `enem`, `ajudar-em-casa`, `outro` |
| `modulos` | sim | lista de `{ "titulo", "aulas": ["trilha/aula", ...], "pratica"?: ["tarefa de tempo trabalho", ...] }` |
| `requisitos` | sim | slugs de cursos que vêm antes (pode ser `[]`); não pode formar ciclo |
| `sensivel` | não | `true` quando o vínculo com o curso revela opinião política (turma só com consentimento) |
| `patrono` | não | `{ "memorial": "<slug em content/memorial>", "motivo", "confirmado": false }` |
| `leituras` | não | `[{ "obra": "<slug em content/acervo>", "ordem": 1, "porque" }]` |
| `emConstrucao` | não | `[{ "titulo", "motivo" }]`: o que falta e ainda não tem aula |
| `tarefaNoMundo` | sim | a tarefa feita fora da tela |
| `projetoFinal` | sim | o projeto de fim de curso |
| `casoDoBairro` | não | `true` quando o projeto final pode ser um caso do bairro |
| `semanas` | sim | duração sugerida, número inteiro |

## Regras que o teste confere

- Toda aula existe em `content/trilhas/<trilha>/<aula>.md`.
- O curso tem pelo menos 6 aulas, e nenhuma aparece duas vezes.
- O patrono existe em `content/memorial`, e cada obra de `leituras` existe em `content/acervo`.
- Os requisitos existem e não formam ciclo (A pede B, B pede A).

## Nada inventado

Curso só com aula que já existe. O que ainda não tem aula vai em `emConstrucao`, com o motivo. Patrono só do Memorial, com `confirmado: false` até a coordenação confirmar. Texto escrito para o curso (tarefa, projeto, motivo) leva a marca "em revisão" na interface e não é atribuído a nenhuma pessoa.

## Horas

As horas são **estimativa**: para cada aula, o tempo de leitura (180 palavras por minuto, como no resto do site), mais 2 minutos por questão do teste e 3 por exercício. O total do curso é arredondado para meia hora (`horasDoCurso`). Não é carga horária oficial: a Escola não é universidade e não dá diploma.
