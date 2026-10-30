# Relatório da Onda 2: motor do curso (30/10/2026)

Tudo atrás da chave `enem-curso`. Nada sai do aparelho: o que o curso guarda fica na chave `lucia:enem` (cópia de
segurança e "apagar" do Meu estudo; descrita em `content/paginas/privacidade.md`).

## O que entrou

- **Diagnóstico** (`/enem/diagnostico`): 60 questões oficiais classificadas, 15 por área, uma por habilidade sempre que
  possível, sem imagem e de dificuldade 1 ou 2 (`content/enem/simulados/diagnostico.yml`). Sem nota: o resultado sai por
  área e habilidade, fica no aparelho e alimenta o plano. Quem mostra pouca base numa área é encaminhado, sem
  constrangimento, para matemática do zero, leitura e escrita e alfabetização (a trilha `enem-base` é da Onda 8).
- **Plano de estudos** (`/enem/plano`, `lib/enem-plano.ts`): horas por semana, dias, se trabalha, pesos do curso
  (digitados pela pessoa), diagnóstico, data da prova (de `edicao.yml`) e incidência. Monta as semanas com estudo,
  revisões espaçadas nos intervalos de `lib/estudo.ts`, uma redação por semana e simulados; modos reta final, 1 mês,
  3 meses, 6 meses e 1 ano; "refazer a partir de hoje" sem acumular atraso; exporta `.ics`. Testado com prova amanhã,
  prova já passada, pouco tempo e pesos.
- **Prática por habilidade** (`/enem/praticar`) e **provas oficiais** com relatório por área, habilidade e dificuldade e
  tempo por questão guardado (Onda 1).
- **Minissimulados** (`/enem/simulados`): 40 (10 por área), de questões oficiais fora do diagnóstico, 3 minutos por
  questão (`content/enem/simulados/minissimulados.yml`).
- **Caderno de erros**: o erro que se repete sobe na fila de refazer; botão "Revisar os erros da semana" (seis idiomas).
- **Progresso** no Meu estudo: acertos por área somando as provas feitas e as habilidades para revisar primeiro, sem placar.
- **Oficina de redação** (`/enem/redacao`): proposta com textos motivadores, roteiro de planejamento guardado no aparelho,
  relógio, a folha de 30 linhas e a revisão guiada da ferramenta que já existia, e o banco de repertório pesquisável.
  Nenhuma correção automática; a cópia para correção humana continua (aula de reforço).
- **Laboratório da TRI** (`/enem/laboratorio-tri`, `lib/enem-tri.ts`): modelo de 3 parâmetros com itens ilustrativos,
  coerência e chute, no formato preveja, rode e compare; aviso fixo de que não calcula a nota oficial.
- **Média ponderada do Sisu** (`/enem/sisu`, `lib/enem-sisu.ts`): notas e pesos digitados; sem nota de corte; link do Sisu.
- **Página `/enem` completa**, na ordem da especificação, com a contagem até a prova; ligada na estante da disciplina,
  no banco de questões, no Meu estudo e no guia das disciplinas.
- **Textos de interface** nos 6 idiomas (`i18n/estudo/*.json`, chave `enem`).

## O que ficou para depois, e por quê

- Os 6 simulados completos fixos do instituto (3 do 1º dia e 3 do 2º) precisam de ~540 questões originais: ficam para
  quando as Ondas 3 a 6 tiverem os exercícios no estilo ENEM. Hoje, as provas oficiais completas cobrem esse treino.
- Comparação lado a lado com a redação-modelo do mesmo tema: depende das redações-modelo (Onda 7).
- Laboratórios por área da seção 9 da especificação (matemática, física, química, biologia, humanas, linguagens): os
  componentes de laboratório moram em `components/labs`, que é a frente de outra equipe; ficaram fora para não colidir.
- Teste de ponta a ponta no Playwright (`testar:ponta`): não rodado nesta máquina (sem navegadores do Playwright
  instalados); o caminho foi conferido abrindo as páginas no build local.
