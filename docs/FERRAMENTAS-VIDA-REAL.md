# Ferramentas da vida real, parte 2 (Etapa 3)

Quatro ferramentas novas, todas no aparelho (selo "aparelho"), na interface em português (`lang="pt-BR"`, com o aviso "só em português" nos outros idiomas) e com nome e descrição nos seis idiomas (`toolNames` de `i18n/*.json`).

| Ferramenta | id | Onde está |
| --- | --- | --- |
| Emergência no trabalho (árvore de decisão) | `arvore-trabalhista` | `EmergenciaTrabalhista` |
| Explicador de cláusulas (aluguel e empréstimo) | `clausulas-de-contrato` | `ClausulasDeContrato` |
| Carga elétrica da casa | `carga-eletrica` | `CargaEletrica` |
| Mapa de serviços públicos | `mapa-de-servicos` | `MapaDeServicos` |

Lógica pura (sem tela, testável no Node): `lib/ferramentas/vida-real.ts`. Telas: `components/tools/novas/ServicosDaVida.tsx` (usa `Aviso`, `Folha`, `Apagar` e `usePersistente` de `VidaReal.tsx`, agora exportados). Registro: `lib/areas.ts` (lista, `areaTools`), `lib/ferramentas/caixa.ts`, `secoes.ts`, `lib/selos.ts`, `components/tools/vitrine-dados.ts`, `ToolView.tsx` e `app/[lang]/ferramentas/[tool]/page.tsx`.

Teste: `scripts/testar-vida-real.mjs` (297 conferências), ligado ao `npm run testar:ferramentas` (que agora roda também este) e avulso em `npm run testar:vida-real`.

## O que cada uma faz e de que lei vem

- **Emergência no trabalho.** Nove situações (rescisão não paga, sem carteira, horas extras, férias, desconto, acidente, assédio, justa causa, acordo ou demissão). Cada resultado tem checklist de provas (marcável), passos, lei com artigo e um resumo em texto para levar ao sindicato ou à Defensoria. Artigos conferidos em planalto.gov.br em 4/11/2026: CLT arts. 29, 41, 58, 59, 74 § 2º, 129, 130, 134, 137, 146, 189, 195, 223-B, 462, 467, 477 § 6º (texto da Lei 13.467/2017), 482, 483 (alíneas e, f), 484-A, 818; CF art. 7º, I, XVI, XVII e XXIX; Lei 8.213/1991 art. 22 e § 2º (CAT). Não foi escrito nada sobre a multa do art. 477 § 8º (o texto vigente cita unidade monetária extinta), nem sobre estabilidade da gestante (ADCT não conferido).
- **Explicador de cláusulas.** Aluguel, Lei 8.245/1991: arts. 4º, 6º, 8º, 9º, 17 a 20, 22, 23, 25 a 27, 33, 35, 37 a 40, 42, 43, 63. Empréstimo, CDC (Lei 8.078/1990): arts. 6º, 39, 42, 46, 51 (I, IV, X, XII), 52 (e §§ 1º e 2º), 53, 54-B, 54-D, 54-G, 104-A. A ferramenta procura palavras no texto colado, mostra o trecho, a gravidade e a lei, e avisa o que não achou (valor, juros, parcelas, garantia). O texto colado não é guardado nem enviado. Não é parecer jurídico.
- **Carga elétrica.** Usa a tabela simplificada do manual ELEKTRO/Pirelli baseado na NBR 5410, a mesma da aula `instalacoes-eletricas-residenciais/dimensionar-um-circuito` (corrente = potência ÷ tensão, primeira linha cujo disjuntor cobre a corrente, seção mínima 1,5 mm² para iluminação e 2,5 mm² para força, DR mínimo). Avisa quando o disjuntor é maior do que o fio aguenta (risco de incêndio) e nunca sugere trocar por um maior. Aviso de segurança no topo e ligação às três trilhas de eletricista. As potências dos botões são exemplos; vale a etiqueta do aparelho. A norma em si é paga: citamos o manual, como a aula.
- **Mapa de serviços.** Sem endereço nenhum. Cada serviço (CRAS, UBS, CAPS, Defensoria, Procon, EJA) tem o que faz, quando procurar, como chegar (só o que a fonte oficial diz) e links oficiais sem parâmetro. Onde não há buscador nacional conferido (UBS, CAPS, EJA), a página diz isso e manda pedir à Secretaria Municipal. Links: gov.br (CRAS e Cadastro Único), gov.br/saude (CAPS, Conecte SUS), gov.br/mj (serviços públicos), DPU (`dpu.def.br/contatos-dpu`), ANADEP, consumidor.gov.br (órgãos de defesa do consumidor por estado), Inep (Encceja).

## Privacidade

- Sem rede: nenhuma das quatro chama `fetch`; o teste confere. Sem GPS: o site não usa geolocalização.
- Guardado só no aparelho, em `localStorage` com try/catch e o prefixo `lucia:ferramenta:` (já coberto pela cópia e pelo apagar em `lib/estudo.ts`): `emergencia-trabalhista` (situação, provas marcadas, relato), `carga-eletrica` (aparelhos e fios) e `mapa-de-servicos` (município e UF que a pessoa digitou). Cada uma tem o botão "Apagar o que ficou guardado neste aparelho". O explicador de cláusulas não guarda nada.
- Os links externos do mapa não recebem município nem UF: a pessoa escolhe lá.

## Para revisar pela coordenação

- Textos em português marcados "em revisão" (`ComoUsar revisao`). Traduções do nome e da descrição (en/es/fr/ru/zh) são rascunho.
- Conferir de tempos em tempos os links do mapa (órgãos mudam endereços) e, a cada ano, as leis citadas.
- Não conferidos e por isso fora do texto: nº de telefone de emergência (190, 192, 136), `art. 477 § 8º`, ADCT art. 10, II, b.
