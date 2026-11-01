# Onde parei (01/11/2026)

## No master (publicado até 9d78de94)
Ondas 0, 1 e 2: matriz, edição 2026 conferida, 347 questões oficiais de 2022 e 2023 classificadas e resolvidas, reta final
(18 aulas), estratégia de prova (8), páginas `/enem` (provas por ano e dia, prática, diagnóstico, plano, minissimulados,
oficina de redação, TRI, Sisu, dia da prova), textos nos 6 idiomas. Liga com `enem-curso` em `NEXT_PUBLIC_RECURSOS`.

## Só no ramo enem-curso-completo (testes verdes, build NÃO rodado)
- Onda 7 (parcial): `redacao/temas-oficiais.yml` (27 anos, 1998–2025 sem 2008), `grade.yml`, `modelos.yml`
  (10 redações-modelo), as 8 aulas de `enem-redacao` no modelo; validadores da grade e dos modelos.
- Onda 3 (parcial): 4 trilhas de Matemática com 6 aulas cada e 60 exercícios cada (proporcionalidade, geometria,
  estatística e probabilidade, funções e álgebra) e o mapa curricular; questões oficiais ligadas por `npm run ligar:enem`.
- Cobertura: 94/120 habilidades com aula, 8/120 com 10+ exercícios, 136/286 tópicos com aula, 338 exercícios com etiquetas.

## Pela metade / pendente
- `temas-oficiais.yml` usa link direto para o PDF da prova em 25 anos: trocar pela página "Provas e gabaritos" do Inep.
- Matemática: falta `enem-matematica-fundamentos` e as aulas restantes de cada plano.json.
- Ondas 4, 5, 6 (Linguagens, Natureza, Humanas), 8 e 9: não começadas. Molde de equipe:
  `scratchpad/prompts/TAREFA-TRILHA-DE-AREA.md` (resumo em docs/ENEM.md, seção 10).
- `testar:curriculo` falha também no master (dicionários, `areas.cooperativismo`), fora do curso.

## Próxima tarefa
Rodar o build, revisão independente da Onda 3 e publicar o ramo no master; depois Linguagens (Onda 4).
