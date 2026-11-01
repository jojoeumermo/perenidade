# Vozes naturais no "Ouvir a aula": onde parei (01/11/2026)

O trabalho parou cedo, a pedido da coordenação. Ainda não há código: só o levantamento abaixo.

## O que já foi conferido
Conferido só no registro do npm (`npm view`). As páginas oficiais e os cartões de modelo ainda **não** foram abertos:
- onnxruntime-web 1.31.1: MIT.
- phonemizer 1.2.1 (xenova/phonemizer.js, espeak-ng em WebAssembly): o código JS é Apache-2.0. Falta confirmar como o espeak-ng embutido é licenciado (GPL-3.0, compatível com a AGPL do site, mas precisa ser registrado).
- kokoro-js 1.2.1: Apache-2.0 (depende de @huggingface/transformers ^3.5.1 e phonemizer ^1.2.1).
- @mintplex-labs/piper-tts-web 1.0.5: MIT. @diffusionstudio/vits-web 1.0.3: MIT (prende onnxruntime-web 1.18.0).

Ainda falta conferir: o cartão de cada voz pt_BR do Piper (faber, cadu, jeff, edresson: base de dados e licença), o Kokoro-82M v1.0 (Apache-2.0) e as vozes pt dele (pf_dora, pm_alex, pm_santa).

## O que se descobriu no código
- `lib/speech.ts` e `components/aula/OuvirAula.tsx` só leem o texto em pedaços com a voz do aparelho. Hoje **não existem** destaque da frase lida, pausar, voltar e avançar frase nem velocidade: isso precisa ser feito do zero.
- O mesmo `startReading(TRECHOS_DA_AULA)` também é chamado em `components/aula/BarraDaAula.tsx`, `components/celular/BarraDoCelular.tsx` e `components/A11yWidget.tsx`.
- A política de segurança (next.config.ts) só deixa compilar WebAssembly em `/workers/*`. O motor de voz tem de morar em `public/workers/voz.js` (esse arquivo vai para o Git). Ele pode buscar `/vozes/...`, porque connect-src 'self' permite. Não é preciso mexer no next.config.
- Não há COOP+COEP juntos, então o WebAssembly roda numa linha só, sem threads. O Kokoro vai ficar lento no WASM.
- Modelo a seguir para baixar e conferir: `scripts/preparar.mjs` (copia o que vem do node_modules para public/) e `scripts/editores.mjs` (baixa com conferência).

## Plano decidido (próxima tarefa)
1. Um espeak-ng só (phonemizer.js) para as duas vozes. Piper: o mapa de fonemas vem do `.onnx.json`, e o modelo recebe input, input_lengths e scales, saindo a 22.050 Hz. Kokoro: o vocabulário do modelo, com style tirado do `.bin` da voz pelo tamanho da frase e speed, saindo a 24.000 Hz. Tudo sobre onnxruntime-web chamado direto, sem transformers.js.
2. `npm run vozes:baixar` baixa para `public/vozes/` (pasta no .gitignore) com revisão fixa do Hugging Face e sha256 conferido: Piper pt_BR medium (cerca de 63 MB cada), Kokoro `model_quantized.onnx` (cerca de 92 MB) e as vozes pf_dora e pm_alex (cerca de 0,5 MB cada). Ele também copia do node_modules o ORT e o espeak, e escreve `public/vozes/vozes.json`. Sem esse arquivo, o site mostra só a voz do aparelho.
3. Guardar os modelos no navegador com a Cache API. Escrever o normalizador `lib/vozes/normalizar.ts` com bateria de testes e o léxico `content/vozes/lexico.yml`. Fazer o leitor por frase com a CSS Custom Highlight API. Fazer o seletor no OuvirAula, com a chave nova em lib/estudo.ts e na página de privacidade. Textos nos 6 idiomas.
4. Coolify: comando de build `npm run vozes:baixar && npm run build`. Opcional, depois: Cache-Control longo para /vozes no next.config (fica com quem faz a migração).
