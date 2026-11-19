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
- A nota de corte guardada é a da última parcial publicada naquela edição (campo `nu_nota_corte` da API do Sisu).

## Conferência

`npm run testar:enem` valida o catálogo: milhares de ofertas, 5 pesos positivos por oferta, UF válida, ao menos
um corte por oferta, cortes entre 0 e 1000 em anos de 2020 a 2025, e que `mediaDaOferta` bate com
`mediaPonderada` usando os pesos da oferta.
