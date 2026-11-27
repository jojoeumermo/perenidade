# Média e notas de corte do Sisu (curso ENEM)

Página: `/[lang]/enem/sisu` (recurso `enem-curso`). A pessoa digita as cinco notas do Enem e vê a média ponderada
dela em **cada oferta real do Sisu**, com os pesos daquele curso e a nota de corte da ampla concorrência por ano,
de 2020 a 2025. Tudo calculado no aparelho; o único pedido de rede é o arquivo estático `/sisu/ofertas.json`.

## Os dados

`scripts/enem/gerar-sisu.mjs <dir>` gera `public/sisu/ofertas.json` a partir de um clone do projeto
[sisu-data](https://github.com/maiakanegae/sisu-data) (licença MIT), que coleta das APIs públicas do Sisu
(sisu.mec.gov.br). São dados públicos do MEC, sem caráter oficial; a página lembra de confirmar no portal do Sisu.

Decisões documentadas:

- **Só a ampla concorrência.** As modalidades de cota mudam de nome e de regra entre edições; a v1 mostra só a
  ampla, que é a referência comum. Cotas ficam para uma etapa futura.
- **Pesos e cadastro da edição mais nova (2025).** Os pesos mudam de tempos em tempos; o simulador usa os da
  última edição em que a oferta apareceu. Ofertas que não existem em 2025 saem do catálogo.
- **A série casa por identidade, não por código.** O código da oferta muda a cada edição, então os anos são
  ligados por (sigla da IES, campus, curso, grau, turno), normalizados sem acento e em maiúsculas.
- **Ordem dos pesos no JSON:** LC, CH, CN, MT, RED — a ordem de `PROVAS_DO_SISU` em `lib/enem-sisu.ts` (no CSV
  do sisu-data a ordem é CN, CH, LC, MT, RED; o gerador converte).
- **Proveniência das notas de corte, ano a ano** (rótulos no campo `cortes` do JSON e na página):
  - **2025, 2024 e 2022:** iguais à nota final da chamada regular, conferidas oferta por oferta com os
    relatórios oficiais do MEC (gov.br/mec/sisu). Para 2025, a API parou de divulgar parciais antes do fim;
    as ofertas sem parcial foram comparadas com o relatório oficial e, onde ele registra nota 0 (ninguém
    classificado na ampla naquela vaga), a oferta fica sem corte de 2025 — não existe corte para mostrar.
  - **2023:** última parcial coletada da API (2023/1); o relatório oficial disponível é de 2023/2, edição
    diferente, então não foi conferido.
  - **2020 e 2021:** última parcial coletada da API (2020/1 e 2021/1); sem relatório oficial da mesma edição.
- **Nomes que valem para mais de um código MEC.** Quando (sigla, cidade, campus, curso, grau, turno) cobre
  mais de um `CO_IES_CURSO` com cortes diferentes nos relatórios oficiais (hoje 4 casos: UEM Eng. Produção,
  UFMS Eng. Civil, IFRN Interdisciplinar Canguaretama, UFBA Artes Cênicas Escola de Teatro), a oferta vira uma
  entrada por código (campo `cod`), com as notas oficiais daquele código. Anos sem relatório oficial (2020,
  2021, 2023) não dá para atribuir a um código e ficam de fora dessas entradas — no scraping a última linha
  lida vencia, o que misturava códigos.
- **Ofertas que só existem nos relatórios oficiais** (sem linha no scraping, logo sem pesos divulgados) entram
  com `sm: 1` e a página mostra a média simples com aviso, sem inventar pesos.

## Conferência

`scripts/enem/extrair-sisu-oficial.py <dir>` extrai as linhas da ampla concorrência dos relatórios oficiais
(xlsx em `data/relatorios/` do clone do sisu-data, baixados de gov.br/mec/sisu) para CSVs em
`data/relatorios/extraidos/`. Rode antes do gerador e do teste.

`npm run testar:sisu` (scripts/enem/testar-sisu.mjs) refaz a comparação completa: estrutura e identidade de
cada oferta, nenhuma oferta repetida, **toda** nota de 2022, 2024 e 2025 igual à do relatório oficial do MEC
(por código MEC nas ofertas separadas), nenhum corte de 2025 faltando onde o oficial registra nota, e nenhuma
nota 2025 inventada onde o oficial registra 0.

`npm run testar:enem` valida o catálogo: milhares de ofertas, 5 pesos positivos por oferta, UF válida, ao menos
um corte por oferta, cortes entre 0 e 1000 em anos de 2020 a 2025, e que `mediaDaOferta` bate com
`mediaPonderada` usando os pesos da oferta.
