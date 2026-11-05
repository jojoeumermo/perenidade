# Jogos próprios, parte 1 (Etapa 5)

Oito jogos curtos (3 a 8 minutos), sem pontuação infinita, sem sequência diária, sem relógio contra a pessoa, com teclado, `aria-live` e botões de 44 px.

## Onde está

- `components/jogos/proprios/`: um componente por jogo, `kit.tsx` (moldura, botão, barra, campo), `registro.ts` (exporta `JOGOS_PROPRIOS`, só dados) e `Catalogo.tsx` (`JogoProprio`, abre o jogo por `slug` com `dynamic import`).
- `lib/jogos-proprios/regras.ts`: regras puras e dados com fonte. `lib/jogos-proprios/checagens.ts`: lê `content/checagens/` (pasta literal, só servidor).
- Teste: `npm run testar:jogos-proprios`.

## Como a página Jogos usa

`/[lang]/jogos` ainda não existia quando o pacote foi feito. A página (servidor) deve: listar `JOGOS_PROPRIOS`; para o jogo aberto, renderizar `<JogoProprio slug={slug} checagens={...} />`; e, só quando `precisaChecagens`, passar `lerChecagensParaJogo()` (o módulo lê disco: não importar em layout nem em componente de cliente).

## Jogos e fontes conferidas

| Jogo | Base | Fonte conferida |
| --- | --- | --- |
| Linha de montagem | mais-valia, taxa = tempo excedente / necessário; números do exemplo | Marx, O Capital, Livro I, cap. VII a IX (domínio público) |
| Quem é o dono? | exemplo inventado (R$ 100); cooperativa | Lei 5.764/1971, art. 3º (planalto.gov.br) |
| Conquistas e greves | direito ↔ lei; pauta de 1917 | Lei 4.090/1962, Lei 605/1949, CF art. 7º III, VIII, XIII, XV, XVII, XVIII, XXVI, XXXIII e art. 9º (planalto.gov.br); pauta de 1917: IHU Unisinos e Agência CEUB |
| Orçamento | CTB 2023 = 32,11% do PIB (União 21,78; estados 8,01; municípios 2,31); POF 2017-2018: habitação 36,6%, transporte 18,1%, alimentação 17,5%; famílias até R$ 1,9 mil gastam 61,2% em alimentação e habitação | Receita Federal; IBGE |
| Fato ou boato? | veredito das 17 checagens do site | `content/checagens/` |
| Detetive de fake news | mensagem inventada | método, sem dado |
| A catraca e o relógio | exemplo de 24 h; limite de 8 h diárias | CF art. 7º, XIII |
| Negociação coletiva | empresa inventada; base legal real | CF arts. 7º XXVI, 8º VI, 9º |

Observações da conferência: a soma publicada das três partes da CTB (21,78 + 8,01 + 2,31) dá 32,10, diferença de arredondamento da Receita. As fontes da greve de 1917 divergem em datas e no percentual de aumento pedido, por isso o jogo não cita esses números. O texto da CF no planalto mostra redação recente do art. 7º XIII com mudança de 2026; o jogo cita só "oito horas diárias", sem a carga semanal. Não foram usados dados do Tesouro por despesa: não houve fonte conferida, então o jogo não afirma percentuais de gasto do Estado.

## Idiomas

O texto dos jogos está só em português (`lang="pt"` na moldura). en/es/fr/ru/zh: rascunho pendente de tradução; nas outras línguas a página mostra o jogo em português.

## Privacidade e leis

Nada é enviado nem guardado: o estado vive na memória da página. Sem cookies, rastreio, scripts ou iframes de terceiros. Não há dado pessoal, de criança, imagem de pessoa nem obra protegida (LGPD, ECA e Lei 9.610 não se aplicam ao conteúdo).

## Pendências

- Página `/[lang]/jogos` ligar o registro; menu.
- Tradução dos textos.
- Fora desta parte: Quem construiu a cidade?, Zoneamento popular, Transição energética justa, Mapa da saúde popular, Quadro de disjuntores, Ajuste o ponto, O bug na memória, Redundância de servidores (parte 2).
