# App offline (Etapa 11, pacote app-offline)

O que funciona sem internet, como o service worker (`public/sw.js`) decide, o aviso de "nova versão", a fila do que
precisa de rede e o manifesto. A casca do aplicativo está em `docs/APP.md`.

Teste: `npm run testar:app-offline` (41 conferências; roda o `sw.js` de verdade num ambiente de mentira com `caches` e
`fetch` simulados, sem rede e sem navegador).

## O que fica offline

| O quê | Como | Onde fica |
|---|---|---|
| Casca do aplicativo: as 5 telas das abas (`/<lang>`, `/trilhas`, `/jogos`, `/comunidade`, `/meu-estudo`) | A página manda `{tipo:"casca", lang}` ao abrir (uma vez por visita, com o aparelho livre). O sw baixa uma de cada vez só o que falta. | `lucia-casca-<VERSAO>` (até 90 entradas, aparado) |
| Aulas do "Comece aqui" (a do dia e as 5 seguintes) | `AulaDoDia` manda os endereços junto com a casca. | mesmo cache da casca |
| Últimas aulas abertas | Toda navegação bem-sucedida é guardada (rede primeiro; sem rede, a cópia). Rede lenta: com cópia guardada espera 3 s, sem cópia 6 s. Sem internet o sw nem tenta a rede. | `lucia-paginas-<VERSAO>` (últimas 300) |
| Cursos guardados ("Guardar curso") | `SaveOffline` (components/Offline.tsx) grava aqui. | `lucia-cursos` (SEM versão, nunca aparado) |
| Jogos e ferramentas leves | `/labs`, `/blockly`, `/jscpp`, `/fontes`, `/capas`, `/territorios`, `/tri`, `/workers`, `/_next/image`: guardados ao serem usados, mostra a cópia e atualiza por trás. Arquivo acima de 4 MB não é guardado. | `lucia-leves-<VERSAO>` (até 250) |
| Arquivos fixos (`/_next/static`, `/imagens`, `/arquivos`, marca, ícones) | cópia guardada primeiro | `lucia-fixos-<VERSAO>` (até 800) |

Fora, de propósito: pyodide, php, ruby, lua, typescript, vídeos curtos e amostras de voz (dezenas de MB; ficam por conta da
rede), `/api`, `/_vercel` e `/<lang>/(painel|entrar|meus-dados|certificado)`. Quem quiser rodar Python offline precisa
de um pedido próprio de "guardar" (pendência abaixo).

A tela `/<lang>/...` que não foi guardada e não tem rede mostra a página "sem conexão" nos 6 idiomas (status 503,
cabeçalho `X-Lucia-Offline: 1`), com botão "Tentar de novo".

Modo de economia de dados (`saveData`) e conexão 2G: a página **não** pede a casca (`podeGuardarCasca`).

## Aviso "sem internet" e "nova versão"

`components/offline/AvisoDeRede.tsx`, montado por `OfflineSupport` (layout), com textos de `components/offline/offline.ts`
nos 6 idiomas. Tem três linhas, empilhadas acima da barra de baixo (CSS `.aviso-rede` em `app/app-casca.css`):

1. **Sem internet. O que você já abriu continua aqui.** enquanto `navigator.onLine` é falso; também põe `data-sem-internet`
   em `<html>` (outros pacotes podem ler, como a `data-casca`).
2. **Fila** ("Esperando a internet para enviar: N", com "Descartar").
3. **Nova versão do aplicativo. Toque para atualizar** (botões "Toque para atualizar" e "Depois").

### Atualização sem quebrar
- `VERSAO` em `public/sw.js` (hoje `v5`) e `NOME_DAS_PAGINAS` em `components/Offline.tsx` têm de ser iguais (o teste confere).
  Mudou o `sw.js`? Suba as duas.
- O `install` só faz `skipWaiting()` na **primeira** instalação. Numa atualização a versão nova espera. A página vê
  `registration.waiting` (ou o evento `updatefound` seguido de `installed`) e mostra o aviso. O toque manda
  `{tipo:"pular"}`; no `controllerchange` a página recarrega **só se a pessoa tocou** (a primeira instalação assume sem recarregar nada).
- `register("/sw.js", { updateViaCache: "none" })`: o navegador nunca usa cópia velha do próprio `sw.js`. Ao voltar ao
  aplicativo (`visibilitychange`), a página pede `registration.update()` no máximo a cada 30 min.
- Ao ativar, o sw apaga os caches `lucia-*` de versão antiga, mas **antes** copia as páginas e os fixos antigos para os
  novos (sem rede), então as "últimas aulas" sobrevivem. `lucia-cursos` nunca é apagado.
- Limite conhecido: o HTML de uma aula guardada numa versão antiga pode apontar para pedaços de JavaScript de um build
  antigo que já saíram do cache; sem rede ela abre legível (HTML pronto) mas sem interatividade até a próxima visita online.

## Fila do que precisa de rede (`components/offline/offline.ts`)

Para quem envia algo que só funciona com rede (um recado, um formulário):

```ts
import { enviarOuEnfileirar, situacaoDoStatus } from "@/components/offline/offline";
const r = await enviarOuEnfileirar(localStorage, { url: "/api/...", metodo: "POST", corpo: JSON.stringify(dados) },
  async (e) => { try { return situacaoDoStatus((await fetch(e.url, { method: e.metodo, body: e.corpo, headers: { "Content-Type": "application/json" } })).status); } catch { return "rede"; } },
  Date.now());
// "enviado" | "na-fila" | "recusado" | "falhou"
```

Regras: só `/api/...` do próprio site (nunca outro endereço, nunca `//` nem `..`); método POST/PUT/PATCH/DELETE; corpo até
16 KB; no máximo 20 itens; some em 7 dias ou 5 falhas do servidor. 4xx sai da fila (repetir não adianta); 5xx/429 fica com
mais uma tentativa; sem rede para na primeira falha e guarda o resto, na ordem. Ao voltar a internet (`online`) e ao abrir,
`AvisoDeRede` esvazia a fila. **Hoje nenhuma tela usa a fila**: ela está pronta para as telas que dependem de rede
(comunidade, mural). Para usá-la, chame `enviarOuEnfileirar` no lugar do `fetch` direto.

Privacidade: a fila guarda só o que a pessoa acabou de mandar enviar, só no aparelho (localStorage), e só fala com o
próprio site. Ela vê quantos itens esperam e pode descartar todos. O service worker só baixa páginas do próprio site e não
guarda nada sobre o que a pessoa leu: o cache é do aparelho. Sem rastreamento, sem envio automático de dado pessoal (nada
novo aqui trata dado pessoal sensível; por isso não há artigo de lei a citar).

## Manifesto (`lib/manifesto.ts`)

- `display: "standalone"`, `display_override: ["standalone","minimal-ui"]`, `scope: "/"`, `id: "/<lang>"` (um app por idioma).
- `orientation: "any"` de propósito: leitura e laboratórios usam retrato e paisagem; travar em retrato atrapalharia quem
  usa o aparelho apoiado ou o tablet.
- `shortcuts` (toque longo no ícone): os 4 primeiros são as abas do aplicativo (Estudar, Jogos e labs, Comunidade, Eu),
  com nome no idioma e ícone 96 px; depois Acervo e Rádio (os atalhos antigos, para lançadores que mostram mais de 4).
- `screenshots`: o campo só entra quando `lib/capturas-app.json` tem capturas (sem imagem o Chrome reclama). Para gerar:
  suba o site (`npm run dev` ou `npm start`) e rode `npm run gerar:capturas-app` (Playwright + Chromium; só aceita
  endereço local). Ele grava 4 capturas de celular (390x844: Início, Estudar, Jogos, Comunidade) e 1 larga (1280x720) em
  `public/capturas-app/` e atualiza a lista. O rótulo de cada captura vem do idioma.

## Pendências e pedidos

- Gerar as capturas (precisa do site no ar). O campo já está pronto e o teste confere que, preenchido, os arquivos existem.
- Testar em aparelho: instalar o PWA, ir ao modo avião, abrir as 5 abas e uma aula; atualizar e ver o aviso de versão.
- Python/Pyodide offline (13 MB) e PHP/Ruby/Lua: precisam de um "Guardar este laboratório" próprio, com o tamanho à vista.
- Ligar a fila (`enviarOuEnfileirar`) nas telas de comunidade quando a Rede v2 for ligada.
- Rastreio do deploy: nada novo lê disco (o teste confere); `lib/capturas-app.json` é importado estático. Rodar
  `npm run conferir:rastreio` antes de publicar.
