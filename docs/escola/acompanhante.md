# E4-10 · Acompanhante do estudante

Ideias R1-49, R1-50, R1-51, R1-53, R1-57, R1-58, R1-63 e R1-64. Tudo fica atrás do recurso `escola` (as páginas de
`/escola/acompanhante` pelo layout da Escola; o "Não entendi" e o "Quero uma pista" pelo próprio componente).

## Princípios

- **A função `assistente` não muda de comportamento.** Os pedidos `pergunta` e `foto` geram exatamente o mesmo pedido
  ao provedor: `scripts/testar-assistente.mjs` compara as impressões (SHA-256) tiradas do código de antes do acréscimo,
  com o Opus, com o Haiku e no formato aberto, com e sem os campos novos. Mesma conta, mesmo `assistente_usar`, mesma
  área `reforco`, mesmo limite do dia; o banco não mudou.
- **Nada guardado no servidor.** O histórico fica só no aparelho, em `lucia:escola-privado:conversas` (até 20 conversas,
  30 dias; fora da cópia, sai no "apagar meus dados"), e nunca é gravado no modo seguro (`estaLigado()`). O trabalho
  informado fica em `lucia:escola-privado:trabalho`, com a mesma regra.
- **O que vai é dito antes.** Cada tela mostra, acima do botão, o que segue para o assistente (`AvisoDoQueVai`), o selo
  `instituto` que não guarda + `externo: provedor de IA` (`SELOS_DE_FORA.assistente`), a frase dos servidores fora do
  Brasil e o link para "Como funciona". A LGPD (Lei nº 13.709/2018, art. 33) foi lida na cópia local antes de citar.
- **Sem conta, com o assistente desligado ou sem internet**, entra o modo sem servidor, com aviso honesto.

## Edge Function (só acréscimo)

`supabase/functions/assistente/assistente.ts`:

- `MODOS_NOVOS`: `socratico`, `pistas`, `outro-jeito`, `redacao`, `documento`, `conversa` e os do E4-16 (`entrevista`,
  `oratoria`, `papelada`, `turma`, `educador`). Os prompts de todos ficam em `INSTRUCOES`; o sistema de um modo novo é
  `SISTEMA` + a instrução do modo (`sistemaDe`). O E4-16 só faz as telas.
- `validarEntrada` desvia para `validarModoNovo` só quando o modo é novo; modo desconhecido continua virando `pergunta`.
- `historico` (`validarHistorico`): até 8 falas (ficam as mais recentes), 1.500 caracteres cada, 6.000 no total (saem
  as mais antigas). Fala de forma errada é descartada; o que não for lista recusa (`historico`).
- `contexto` (`validarContexto`): tipo errado recusa (`contexto`); texto grande é cortado (trecho 1.200, enunciado
  1.500, até 6 alternativas de 300, trabalho 80, vaga 120); `nivel` só 1, 2 ou 3; `idiomaAlvo` só `en` ou `es`; `aula`
  só no formato `trilha/aula`. Campo desconhecido é ignorado.
- Foto só em `documento` e `papelada`; a escolha do provedor segue a regra da foto (só quem tem `visao`).
- Esforço `low` nos modos de resposta curta (socrático, pistas, outro jeito, conversa, entrevista, turma) e `medium`
  nos outros. Resposta em Markdown, com os mesmos `LIMITES`.
- Na redação, o tema vai em `contexto.trecho` e chega ao modelo na caixa `<tema>`.
- `provedores.ts`: o formato aberto usa `sistemaDe(entrada)` (igual a `SISTEMA` nos pedidos antigos).
- `index.ts`: só o comentário do cabeçalho.

## Cliente

| Peça | Arquivo |
| --- | --- |
| Histórico, pedido, tarja, filtro de nota | `lib/escola/acompanhante.ts` (`lerConversas`, `gravarConversa`, `apagarConversas`, `montarPedido`, `aplicarTarjas`, `tirarNotas`) |
| Modo sem servidor | `lib/escola/respostas-locais.ts` (`responderLocal`, `carregarIndice`) e `components/escola/acompanhante/RespostaSemServidor.tsx` |
| Lista pública de provedores e limite padrão | `lib/escola/provedores-publicos.ts` |
| Conversa (todos os modos) | `components/escola/acompanhante/Conversa.tsx`, com `RespostaDoAssistente` de `components/Assistente.tsx` |
| "Não entendi" (R1-49) | `NaoEntendi.tsx` (via `NaoEntendiSobDemanda.tsx`) em `components/aula/BarraDaAula.tsx`, ao lado do Ouvir |
| Outro jeito (R1-51) | `OutroJeito.tsx`, na folha do "Não entendi" e na entrada |
| Pistas (R1-50) | `PistasDoExercicio.tsx` em `components/estudo/Exercicio.tsx`, depois de um erro |
| Redação (R1-53) | `RedacaoPorCompetencia.tsx`, em `/escola/acompanhante/redacao` |
| Documento (R1-57) | `LeitorDeDocumento.tsx` + `Tarja.tsx`, em `/escola/acompanhante/documento` |
| Idiomas (R1-58) | `ConversaDeIdioma.tsx`, em `/escola/acompanhante/conversa` |
| Transparência (R1-64) | `/escola/acompanhante/como-funciona` e `LimiteDoDia.tsx` |
| Entrada | `/escola/acompanhante` com `Escolha.tsx` (modos e histórico do aparelho, "Apagar tudo") |
| Textos | `i18n/escola/acompanhante/{pt,en,es,fr,ru,zh}.json`; o servidor usa `textosDoAcompanhante(lang)`; os pedaços que entram em páginas de outros pacotes baixam só o idioma da página (`components/escola/acompanhante/textos.ts`) |
| Estilo | `styles/escola-acompanhante.css` (só tokens existentes) |

### Detalhes que importam

- **Não entendi.** Leva o trecho marcado dentro do texto da aula (guardado no `selectionchange`, porque o toque no
  botão desfaz a marca em alguns celulares) ou, sem marca, a parte na tela (`data-parte` do E4-03, a partir do bloco
  visível; sem partes, os parágrafos `data-p`), cortado em 1.200 caracteres. A folha é um `<dialog>` modal (Esc fecha,
  foco preso). A conversa só é baixada quando a folha abre. A faixa da aula fica escondida no modo aplicativo do
  celular (`app:max-md:hidden`, do E4-03): ali o botão não aparece.
- **Pistas.** Vão o enunciado, o texto-base e as alternativas, **nunca qual é a certa**. Nível 1 → 2 → 3; no 3, o botão
  "Quero a solução completa". Sem conta ou com o assistente desligado não aparece nada (fica a explicação local).
- **Redação.** Até 2.800 caracteres; aceita a redação de `sessionStorage["lucia:redacao-para-correcao"]` (lida uma vez e
  apagada). Aviso fixo "Comentário automático, não é correção nem nota". Linha com nota/pontos/nível/"x/1000" que
  escape da instrução é tirada no aparelho (`tirarNotas`), com aviso. A Oficina de Redação não muda.
- **Documento.** A foto só pode ser escolhida depois do "Li o aviso". `imageForAssistant` reduz e tira o EXIF; a tarja
  grava preto nos pixels (`aplicarTarjas` sobre o `ImageData`), e a imagem que sai é exportada do canvas riscado, sem
  as marcas de ajuda. Teclado: setas, Shift + setas, Enter.
- **Idiomas.** Microfone opcional com o mesmo aviso da busca por voz (`useAvisoDaVoz`, E4-05); "Ouvir a resposta" com
  `falar()` de `lib/pratica`, sem a correção entre colchetes. Selos da voz do navegador e do reconhecimento de fala.

## R1-63 · Modo sem servidor

**Parte 1 (feita).** `responderLocal(pergunta, indice)` busca só nas aulas do `/{lang}/indice.json` (baixado na
primeira vez que se usa, no aparelho) e devolve até 3 trechos copiados da aula, a partir da frase que mais casa, com o
link. Sem casamento, devolve vazio e a tela diz isso.

**Parte 2 (teste com critério de parada): não implementada.** Critério: licença aberta, servido pelo próprio site, até
cerca de 150 MB, funcionar em português, tempo aceitável num aparelho de 4 GB, usado só para resumir os 3 trechos.
Tamanhos dos arquivos ONNX conferidos na API do Hugging Face em 03/11/2026 (nenhum arquivo foi baixado):

| Modelo | Licença | Menor versão ONNX | Idioma declarado |
| --- | --- | --- | --- |
| SmolLM2-135M-Instruct | Apache 2.0 | 117,3 MB (q4f16); 135,7 MB (int8) | só inglês |
| SmolLM2-360M-Instruct | Apache 2.0 | 272,7 MB (q4f16) | só inglês |
| Qwen2.5-0.5B-Instruct | Apache 2.0 | 483,0 MB (q4f16) | multilíngue |
| Gemma 3 270M (it) | termos do Gemma (não é licença aberta) | 272,6 MB (q4f16) | — |

O único dentro do tamanho é declarado só para inglês; resumir aula em português com ele arrisca inventar, o que o
pacote proíbe. Por isso a medição de tempo no projeto `entrada` nem foi feita, e o recurso `acompanhante-no-aparelho`
não foi criado. A página "Como funciona" diz isso com os números. Se surgir modelo que passe, o pedido é: recurso
`acompanhante-no-aparelho` em `lib/recursos.ts` (desligado; dono E4-01), tamanho mostrado e confirmação antes de baixar,
modelo servido de `public/`, uso só sobre os trechos de `responderLocal`, e a base `lucia-explicacoes` (já listada em
`BASES_CONHECIDAS` e no "apagar") para o cache.

## Testes

- `npm run testar:assistente`: pedidos antigos iguais byte a byte (com e sem campos novos), cada modo novo, cortes do
  histórico e do contexto, tipo errado, campo desconhecido, caixas que não se fecham antes da hora, nomes das
  competências iguais aos de `content/enem/redacao/grade.yml`, regra da foto no documento.
- `npm run testar:acompanhante`: histórico (20 conversas, 30 dias, modo seguro, apagar), pedido cortado e aceito pela
  função, `responderLocal` (só aulas, trecho copiado, vazio sem casamento), lista de provedores igual à da função,
  limite padrão igual ao de `install.sql`, tarja muda os pixels, filtro de nota, páginas, interdição e amarrações.
- `e2e/escola-acompanhante.spec.ts` (função simulada por rota interceptada): Não entendi, pista de nível 1, redação
  sem número e sem nota, documento só depois do aviso, modo sem servidor sem conta, Como funciona e 360 px. Suba com
  `NEXT_PUBLIC_RECURSOS=escola,meu-estudo,exercicios npm run dev:local`.

## Pendências para a coordenação

1. Publicar a função `assistente` de novo (o acréscimo só vale em produção depois do deploy da Edge Function).
2. `lib/escola/rotas.ts` (dono E4-01): a rota `acompanhante` deixou de ser provisória (`provisoria: true` → tirar) e o
   teste "17 páginas provisórias" de `scripts/testar-escola.mjs` passa a 16.
3. Se um dia `assistente_estado` devolver `por_pessoa`, a página "Como funciona" mostra o número do banco sozinha.
