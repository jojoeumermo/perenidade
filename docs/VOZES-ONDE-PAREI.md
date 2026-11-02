# Vozes naturais: onde parei (02/11/2026)

O trabalho parou a pedido do dono. O código está todo no ramo `vozes-naturais` e **não foi para o master**, porque o
build (`npm run build`) ainda não rodou. O passo a passo, as licenças e as medidas estão em docs/VOZES.md.

## Pronto e conferido
- `npm run vozes:baixar` baixa o Kokoro em revisão fixa, confere o sha256, recorta o espeak para só o português
  (de 18 MB para 0,9 MB) e escreve public/vozes/vozes.json. A pasta public/vozes/ está no .gitignore.
- Motor único Piper/Kokoro em public/workers/voz.js e voz-motor.js. Leitor por frase com destaque, pausar,
  voltar, avançar e velocidade. Seletor com amostra, tamanho, progresso e avisos. Textos nos 6 idiomas.
- A chave lucia:voz entra na cópia e no apagar de lib/estudo.ts, e as vozes baixadas saem no apagar de Meus dados.
- Licenças registradas em THIRD_PARTY_LICENSES.md, docs/NOTICE.md, nos créditos (5 idiomas) e na página de privacidade.
- Verde: `npm run testar:vozes` (210 conferências), `npm run testar:estudo`, `npm run conferir:i18n`,
  `npx tsc --noEmit`, eslint nos arquivos mudados, e o e2e/vozes.spec.ts no computador e no celular (voz falsa,
  sem lista de vozes, Kindle). O teste de verdade passou no Chrome com a Piper e com o Kokoro.
- Decisões: as vozes Piper pt_BR ficaram fora do site (licença incerta). O WebGPU ficou desligado, porque o modelo
  de 8 bits travou nele.

## O que falta
1. Rodar `npm run build`, juntar o origin/master, rodar as conferências de novo e publicar no master.
2. Achado fora desta frente: no celular (Pixel 7 emulado), a `.folha-da-aula` tem 510 px numa tela de 412 px,
   **também no site no ar**. A causa está dentro da aula (footer e `div.xl:hidden`). O texto da aula fica cortado
   nas laterais. Vale uma correção à parte em app/celular.css.
3. Passos do dono (docs/VOZES.md): o build do Coolify passa a ser `npm run vozes:baixar && npm run build`. Na
   Cloudflare, uma regra de cache longo para /vozes/*. Na Vercel, as vozes naturais continuam desligadas (de propósito).
4. Decisão do dono: liberar ou não uma voz Piper (`liberada: true` em scripts/vozes-baixar.mjs). É a única voz
   natural rápida num computador sem placa de vídeo.
