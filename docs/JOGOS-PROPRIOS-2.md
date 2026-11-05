# Jogos próprios, parte 2 (Etapa 5)

Oito jogos em `components/jogos/proprios2/`. O registro `JOGOS_PROPRIOS_2` (em `registro.ts`) é o que a página Jogos lê:
cada item tem `id`, `titulo`, `resumo`, `publico`, `minutos`, `tema`, `fontes` e `carregar` (um `import()` dinâmico: o jogo só
é baixado quando a pessoa o abre; use `next/dynamic` ou `React.lazy` com `carregar`). O registro não importa React nem lê disco.
Texto dos jogos só em português (nas outras línguas a página deve mostrar o aviso de conteúdo não traduzido).

| Jogo | Arquivo | O que se faz | Fontes conferidas |
|---|---|---|---|
| Quem construiu a cidade? | QuemConstruiu | 5 obras, 5 perguntas | Wikipédia (Candango, Madeira-Mamoré, Aleijadinho, Central Pacific, Grande Pirâmide), CC BY-SA 4.0 |
| Zoneamento popular | ZoneamentoPopular | mapa 5x5, 6 regras | Estatuto da Cidade (Lei 10.257/2001, art. 2º I, II, V, VI-b, XIV; art. 4º V-f; art. 9º) |
| Transição energética justa | TransicaoEnergetica | 5 decisões, 4 medidores | Decreto 5.051/2004 (Conv. 169 OIT, art. 6º), Lei 14.299/2022, Lei 12.212/2010, Lei 14.300/2022 |
| Mapa da saúde popular | MapaDaSaude | 6 casas fictícias, 3 visitas, sigilo | Lei 11.350/2006 (art. 3º §§ 2º e 3º), LGPD (art. 5º II, art. 11) |
| Quadro de disjuntores | QuadroDeDisjuntores | fio, disjuntor e DR de 5 circuitos | NBR 5410:2004 (conferida em fonte secundária), Lei 9.610/1998 art. 46, III |
| Ajuste o ponto | AjusteOPonto | agulha por tecido, tensão por sintoma | Wikipédia (Sewing machine needle, Lockstitch), ajuda da Brother |
| O bug na memória | BugNaMemoria | 5 enigmas, achar a linha | MDN (Array, Strict equality), docs do Python |
| Redundância de servidores | RedundanciaDeServidores | n servidores, derrubar, calcular | Livro SRE do Google (tabela de disponibilidade), CC BY-NC-ND 4.0 |

## Decisões e limites honestos

- Dados em `dados/*.ts`, lógica pura (testável no Node). Os componentes só desenham.
- Nada viciante: todos terminam, sem pontuação acumulada, sem sequência diária, sem relógio. Tudo funciona por botão e lista de escolha (teclado e leitor de tela), com `aria-live` nos retornos.
- Nada é gravado no aparelho nem enviado: sem rede, sem script ou iframe de terceiros, sem contagem. Links de fonte abrem em outra aba com `noopener noreferrer`.
- **NBR 5410** é norma paga da ABNT. Usamos só cinco valores de capacidade de condução (1,5 a 10 mm², método B1, PVC, dois condutores carregados), citados para estudo (Lei 9.610/1998, art. 46, III), conferidos em fonte secundária (proeletrics.com): na página de origem o número de condutores carregados não está dito. A regra DR de 30 mA em áreas molhadas e as seções mínimas (1,5 e 2,5 mm²) também não foram conferidas em texto primário. O jogo traz aviso de segurança (NR-10, profissional habilitado). Pendência: um profissional conferir a Tabela 36 e o item de DR na norma.
- **Saúde:** a Lei 11.350/2006 não traz dever de sigilo próprio (conferido); o jogo cita a LGPD para dado sensível de saúde e a finalidade do registro (art. 3º, § 3º, II). As famílias e nomes são inventados. A ordem de prioridade das visitas é didática (a lei não define) e o texto diz isso.
- **Tensão do fio:** o sentido do ajuste vem da central de ajuda da Brother (fabricante); a Wikipédia confirma só o ponto equilibrado no meio da espessura. Comprimento de ponto não entrou porque não achamos fonte.
- **Transição energética:** os efeitos nos medidores são didáticos (dito na tela); só os fatos legais têm fonte.
- **Zoneamento:** as três primeiras regras vêm de diretrizes do Estatuto da Cidade; as outras são marcadas "regra do jogo". A nota de usucapião especial urbana é informação, não orientação jurídica.
- "Mapa da saúde popular" é uma grade de cartões das casas, não um desenho de mapa.
- Imagens, sons e código de terceiros: nenhum (os trechos de código dos enigmas são originais). Nada novo em `docs/NOTICE.md`.
- Sem SQL, sem tabela, sem mudança em menu ou i18n: a integração da página Jogos usa o registro.

## Teste

`npm run testar:jogos-proprios2` (`scripts/testar-jogos-proprios2.mjs`): registro, fontes com https, regras de cada jogo (inclui solução à mão do zoneamento, caminho vencível da transição, fórmula Ib ≤ In ≤ Iz, tabela SRE contra a fórmula), licença nos arquivos, palavras proibidas, sem iframe/script/rede/armazenamento.
