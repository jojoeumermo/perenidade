# Novos baralhos do Rumos (Etapa 5)

Oito baralhos de vida real, no mesmo motor de 4 medidores (`lib/rumos.ts`, formato `rumos/1`, modo `fases`, partida de
10 cartas em 2 fases). Cada um mora em `content/jogos/rumos-<id>.json`, está em `BARALHOS_DE_RUMOS`
(`lib/laboratorios.ts`) e é importado em `app/[lang]/jogos/page.tsx`, onde passa por `validarBaralho` no build.

| Baralho | Cartas | Fontes principais (todas com link oficial) |
|---|---|---|
| `eletricista-autonomo` | 16 | CDC (8.078), NR-10, LC 123, CLT, Lei 12.690 |
| `costureira-e-cooperativa` | 16 | Lei 5.764, Lei 12.690, Código Penal, LC 123, CDC, Lei 9.610 |
| `desenvolvedor-de-software-livre` | 16 | Lei 9.609, LGPD, GPL, Marco Civil, Lei 9.608, LC 123 |
| `sindicato-de-bairro` | 16 | Constituição, LGPD, Lei 12.009, Lei 14.297, Lei 7.783 |
| `radio-comunitaria` | 16 | Lei 9.612, Lei 9.608, Lei 9.610, Lei 13.019, LGPD, Lei 13.018 |
| `cursinho-popular` | 15 | Lei 12.711, Lei 9.610, Lei 9.608, ECA, LGPD, Constituição |
| `reforma-agraria-e-mutirao` | 17 | Lei 8.629, Lei 11.326, Código Penal, Código Florestal, Lei 11.947, Lei 11.888 |
| `coletivo-de-artes-e-hip-hop` | 16 | Lei 9.605 art. 65, Lei 12.408, CF art. 5º IX, X, XVI, ECA art. 149, Lei 9.610, Lei 13.018, Lei 14.399 |

Personagens, cidades e histórias são inventados; as leis e os números de "Na história real" são reais.

## Coletivo de artes e hip-hop (conferido no planalto.gov.br)

Medidores: Público, Respaldo, Caixa, Grupo. Marcas: `muro-autorizado`, `contrato-escrito`, `ponto-de-cultura`
(final "Arte de quebrada com chão firme" pede as três). Fatos usados, todos lidos no texto oficial:

- Grafite com consentimento do dono não é crime; pichar é; coisa tombada tem pena maior: Lei 9.605/1998, art. 65 e §§ 1º e 2º (texto da Lei 12.408/2011).
- Spray só a maiores de 18, com documento e nota com identificação: Lei 12.408/2011, arts. 2º e 3º.
- Reunião em local aberto sem autorização, com aviso prévio; imagem inviolável; liberdade de expressão sem censura: CF art. 5º, XVI, X, IX.
- Adolescente em espetáculo público: portaria ou alvará da autoridade judiciária, caso a caso: ECA art. 149, II, a e § 2º.
- Autorização prévia e expressa do autor (reprodução, adaptação, arranjo), direitos morais, cessão por escrito e onerosa, execução pública: Lei 9.610/1998, arts. 22, 24, 29, 49, 50, 68.
- Ponto de Cultura pode ser coletivo sem constituição jurídica: Lei 13.018/2014, art. 4º, I; objetivo de garantir meios para produzir e difundir cultura: art. 2º, I.
- Política Nacional Aldir Blanc: gestão democrática e controle social (art. 3º, V e VIII) e contrapartida gratuita de quem recebe subsídio de espaço (art. 10, § 2º): Lei 14.399/2022.

Cuidado de redação: o texto do art. 68 da Lei 9.610 foi conferido só em parte (caput e § 2º); a nota da carta do DJ está
em paráfrase curta. Se alguém quiser citar mais, releia o artigo inteiro antes.

## Texto e idiomas

Só em português. en, es, fr, ru e zh: rascunho pendente; a página mostra o aviso de conteúdo não traduzido.

## Testes

- `npm run testar:jogos`: validador, motor e simulação (todas as cartas e todos os desfechos são alcançáveis; os valores
  iniciais e os efeitos do coletivo foram ajustados para isso).
- `npm run testar:rumos-baralhos` (`scripts/testar-rumos-baralhos.mjs`, node puro): arquivos, 4 medidores, fontes com
  link https, aulas existentes, palavras proibidas ("universidade", "diploma"), registro e importação.

## Alterações em arquivos que já existiam

`lib/laboratorios.ts` (lista de baralhos) e `app/[lang]/jogos/page.tsx` (import e mapa), com Edit mínimo.
Em `rumos-cursinho-popular.json`, "universidade" virou "ensino superior" (regra de interface).
