# Ferramentas num arquivo só e manifesto por idioma (Etapa 3, B17)

## Baixar a ferramenta para o WhatsApp

Na página de cada ferramenta (`/[lang]/ferramentas/[tool]`) aparece "Baixar a ferramenta num arquivo só" quando a ferramenta tem versão offline. O arquivo é um `.html` de poucos KB, com a conta dentro (JavaScript ES5, sem seta nem template, para celular antigo), que abre sem internet.

- Código: `lib/ferramentas-offline.ts` (puro, sem `@/` e sem `fs`; roda no Node), `components/BaixarFerramentaUnica.tsx` (o botão; o código das ferramentas só é carregado no clique), textos em `compartilhar.baixarFerramenta*` nos 6 idiomas.
- Com versão offline: `calculadora`, `juros-compostos`, `bases-numericas`, `conversor-de-unidades`, `escala-cartografica`, `cronometro`. As frases do arquivo (rótulos, erros) estão nos 6 idiomas; o título e a descrição vêm do dicionário do site.
- Sem versão offline (o botão não aparece): editores de código (python, php, html, ide), simulações (PhET), pronúncia (voz do aparelho), dicionários e frases (arquivos grandes ou rede), gráficos, resolvedor, estatística, tabela periódica e as demais que usam bibliotecas ou dados grandes; e as ferramentas com valores de lei (direitos trabalhistas, quanto cobrar, dívidas), porque os valores mudam e o arquivo ficaria velho. Para incluir uma nova: acrescentar a entrada em `FERRAMENTAS` (corpo, núcleo, cola) e frases nos 6 idiomas em `FRASES`; o teste cobra o resto.
- Não guarda nada: sem `localStorage`, sem cookie, sem rastreio. O arquivo só tem um link, o do rodapé, de volta ao site (navegação, não requisição).
- Fatos usados nas conversões: fatores exatos do SI (polegada 0,0254 m, pé 0,3048 m, jarda 0,9144 m, milha 1609,344 m, libra 0,45359237 kg, onça 0,028349523125 kg, galão americano 3,785411784 L), conferidos pelo teste.

## Teste

`npm run testar:ferramentas-offline` (`scripts/testar-ferramentas-offline.mjs`). Para cada ferramenta e cada idioma: gera o arquivo, confere tamanho (< 1 MB; as daqui ficam abaixo de 60 KB), ausência de requisição externa (nada de `src`, `link`, `@import`, `url()`, `fetch`, XHR, WebSocket, `import()`, iframe, imagem, áudio, vídeo, service worker; único endereço http só dentro do rodapé), ausência de armazenamento/rastreio, compilação do script, ES5 e que todo `data-t` tem frase. Roda o núcleo no Node e confere as contas (juros, bases, conversões, escala, cronômetro, entradas inválidas e tentativa de injetar código na calculadora). Confere também que as ferramentas sem versão offline não geram arquivo e que a página só mostra o botão com `temVersaoOffline`.

## Manifesto por idioma

Quem instala o site estando em `/en` agora abre `/en`.

- `lib/manifesto.ts`: `montarManifesto(lang, dicionario)`, o mesmo código monta todos. `start_url` e `id` = `/{lang}`; `lang` = `htmlLang`; atalhos e nomes no idioma; `scope` continua `/` (trocar de idioma não sai do aplicativo).
- `app/[lang]/manifest.webmanifest/route.ts`: serve `/{lang}/manifest.webmanifest` (6 páginas estáticas, `dynamicParams = false`, sem ler disco, só os dicionários que o site já carrega).
- `app/[lang]/layout.tsx`: `generateMetadata` ganhou `manifest: /{lang}/manifest.webmanifest`. Nenhum import novo no layout.
- `app/manifest.ts` continua (padrão em `/manifest.webmanifest`, agora gerado por `montarManifesto("pt", pt)`: saída igual à de antes). O `id` de pt continua `/pt`, então quem já instalou não vira outro aplicativo.
- Deploy: nada de `fs` no layout ou em componente global; a rota só importa JSON de i18n. Conferir depois do build: `npm run conferir:rastreio` (esperado sem mudança) e que `<link rel="manifest">` das páginas de `/en` aponte para `/en/manifest.webmanifest` (o Next resolve o `manifest` do layout mais interno por cima do arquivo `app/manifest.ts`; se o build mostrar o padrão, o fallback é seguro: tudo continua como antes, só sem o start_url por idioma).
