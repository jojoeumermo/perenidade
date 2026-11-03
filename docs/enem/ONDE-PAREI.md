# Onde parei (02/11/2026)

## Pronto
- Ondas 0, 1 e 2 (fundação, reta final, motor do curso): no master desde 30/10.
- Onda 7 (redação), parcial: 27 temas oficiais (1998–2025, sem 2008; fonte: página "Provas e gabaritos" do Inep),
  grade de autocorreção, 10 redações-modelo, 10 propostas, 30 itens de repertório, as 8 aulas de `enem-redacao` no modelo.
- Onda 3 (Matemática): 5 trilhas, 45 aulas, 450 exercícios; revisão em `revisao-onda-3.md`.
- Onda 4 (Linguagens): 7 trilhas (leitura e gêneros 12, língua em uso 10, literatura 17, artes e corpo 6,
  tecnologias 4, inglês 4, espanhol 4), 57 aulas, 570 exercícios.
- Onda 5 (Natureza), parcial: Física 10 aulas, Química 22, Biologia 9.
- Onda 6 (Humanas), parcial: História do Brasil 8, História geral 8, Geografia 8, Filosofia 5, Sociologia 5.
- Revisão independente das Ondas 4 a 6 (`revisao-ondas-4-a-6.md`, 14 correções).
- Cobertura (02/11): 120/120 habilidades com aula (6 aulas novas de fechamento), 67/120 com 10+ exercícios, 196/286 tópicos com aula, 1.978 exercícios com
  etiquetas, 347 questões oficiais classificadas (2022 e 2023). Detalhes em `COBERTURA.md`; fila em `FILA-DE-REVISAO.md`.

## Ponto exato onde parei
Build local verde das Ondas 4 a 6 e da revisão; publicado no master (02/11). O curso parou aqui por decisão do dono.

## O que falta
- Aulas restantes de cada `plano.json` (as trilhas listam todos os tópicos; `npm run proximo` mostra o que falta):
  Física 18, Química 11, Biologia 22, História do Brasil 4, História geral 11, Geografia 10, Filosofia 6, Sociologia 8,
  artes e corpo 7, Geometria 6.
- Redação: mais aulas (meta 25), propostas (meta 100), modelos (meta 30), repertório (meta 300).
- Classificar as provas de 2009 a 2021 (`docs/ENEM.md`, seção 6) e depois `npm run incidencia:enem` e `ligar:enem`.
- Onda 8: trilha `enem-base`, Encceja, atendimento especializado, `enem-como-funciona` no modelo, teste de acessibilidade.
- Onda 9: planos de aula ENEM em `content/professores/planos`, sequências do modo turma, apostila por área.
  Lacunas novas (habilidade sem aula etc.) pedem mudança no banco (`regras` em `supabase/install.sql`): fica como
  proposta para o dono, não foi feito.
- Simulados fixos do instituto (6) e e2e no Playwright (sem navegadores nesta máquina).
- `testar:curriculo` falha também no master (dicionários, `areas.cooperativismo`), fora do curso.
