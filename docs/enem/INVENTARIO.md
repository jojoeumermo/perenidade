# Inventário do curso ENEM (30/10/2026)

O que já existia antes do curso completo e em que estado. A cobertura detalhada, por habilidade e por objeto, está em
`docs/enem/COBERTURA.md` (gerado por `npm run cobertura:enem`).

## Trilhas da disciplina `enem`

| Trilha | Aulas | Estado no modelo (npm run pendencias) |
| --- | --- | --- |
| `enem-como-funciona` (Comece aqui) | 8 de 8 | todas sem "O que você vai aprender" e sem "Resumo"; 5 sem exemplo resolvido. Algumas escrevem horários e regras do edital à mão (devem passar a citar `{{enem:…}}`) |
| `enem-por-area` | 9 de 9 | aulas curtas; faltam objetivo, resumo e as seções do percurso; "o que mais cai" sem contagem (a contagem agora está em `content/enem/incidencia.yml`) |
| `enem-redacao` | 8 de 8 | faltam objetivo, resumo, "Como isso cai no ENEM" e "Para aprofundar" |
| `enem-aprofundamento` | 0 de 24 previstas | só o roteiro |

## Trilhas de disciplina que sustentam a prova

Contagem aproximada de aulas: matematica-fundamental 14, matematica-medio 14, matematica-superior 10, portugues-fundamental 12,
portugues-medio 12, fisica-medio 14, quimica-medio 14, biologia-medio 12, historia-do-brasil 10, historia-antiga 11,
historia-superior 8, geografia-fundamental 10, geografia-medio 3, filosofia-medio 11, sociologia-medio 10, ingles-medio 12,
espanhol-medio 10, literatura-brasileira 4, artes-fundamental 3. As classificações das provas oficiais já apontam para elas
em `aulas` quando servem; onde nenhuma serve, a lista fica vazia e a lacuna aparece na cobertura.

## Exercícios e mapa curricular

- Antes: exercícios com explicação do erro só em `content/exercicios/matematica-fundamental` (30); mapa curricular só de
  `matematica-fundamental`.
- O validador do mapa conferia a faixa de habilidades só em Matemática; agora confere as quatro áreas (`FAIXAS_DO_ENEM`).

## Provas oficiais (public/questoes)

- 15 edições (2009 a 2023), 2.689 questões distintas (há ids repetidos na fonte, por exemplo `enem-2023-150`, `enem-2022-50`).
- A área que vem da fonte está trocada em várias questões (contagens por área diferentes de 45). A área auditada sai da
  numeração (`areaPelaNumeracao`).
- Problemas de importação vistos na classificação (não editamos o JSON; vão para o mantenedor do importador):
  - inglês 1–5 ausente em 2022 e 2023 (só há espanhol);
  - alternativa "0" descartada (2022, questões 144 e 166) e letras deslocadas;
  - enunciados vazios (2023, 141 e 142) e imagens perdidas na fonte (2023, 44 e 56);
  - 2023, questão 174 e 34 ausentes; 2023, 114 com duas alternativas iguais; 2022, 143 com figuras que não batem.

## Motor de estudo

Simulado aleatório (`components/Simulado.tsx`), banco de questões, caderno de erros e revisão espaçada (`lib/estudo.ts`),
Meu estudo (`lib/meu-estudo.ts`), nivelamento, plano de estudos por trilha e prova da trilha. Não havia calculadora de TRI,
cronograma, prova oficial por dia com o tempo da prova nem prática por habilidade.
