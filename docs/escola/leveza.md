# Leveza e alcance da aula (E4-17)

Pacote da onda 3 da Etapa 4. Tudo no navegador, atrás de `ligado("escola")`. Sem back-end novo, sem rota nova, sem página
estática nova, sem leitura de disco nova. Os textos escritos pelo pacote estão **em revisão**; as traduções para en, es, fr,
ru e zh são rascunho [A REVISAR PELA COORDENAÇÃO].

## Arquivos

| Arquivo | O que faz |
|---|---|
| `lib/escola/leveza.ts` | Puro (roda no Node): `deveConvidar`, resposta do convite, `somarTransferencia`, `formatarTamanho`, `tamanhoDoTexto`, `validarLibras`, `librasDaAula`, `caminhosDeLevar`. Sem `fs`, sem `@/`. |
| `content/escola/libras-aulas.json` | Índice de vídeos em Libras com intérprete humano. Começa vazio (`{"versao":1,"aulas":[]}`). |
| `components/escola/leveza/guardado-leveza.ts` | Ganchos `useConviteDoPacote` e `useAulaLeve` (mesmo padrão de `guardado-escola.ts`). |
| `components/escola/leveza/LevezaDaAula.tsx` | Contêiner montado na página da aula, acima do "Ouvir a aula". |
| `components/escola/leveza/LevezaDaAulaSobDemanda.tsx` | Carga tardia (`dynamic`, `ssr: false`), como o E4-03 fez. |
| `components/escola/leveza/LibrasNaAula.tsx` | Botão, aviso e tradutor de Libras (reaproveita `lib/vlibras.ts`). |
| `components/escola/leveza/ConviteDoPacote.tsx` | A faixa do convite, com três botões iguais. |
| `components/escola/leveza/InterruptoresDeLeveza.tsx` | "Modo pacote de dados" e "Só o texto". |
| `components/escola/leveza/LevarEstaAula.tsx` | Texto puro, EPUB, guardar a trilha, espelho de leitura. |
| `components/escola/leveza/MedidorDeDados.tsx` | "Quanto esta página gastou". |
| `i18n/escola/leveza/*.json` | Textos nos 6 idiomas. |
| `styles/escola-leveza.css` | Visual (Caderno do Povo), alvos de 48 px, 360 px de entrada. |
| `lib/prefs.ts` | Acréscimo: preferência `pacote` (`data-pacote` em `<html>`). |
| `app/[lang]/trilhas/[track]/[lesson]/page.tsx` | Troca o ponto `{/* E4-17: Libras */}` por `<LevezaDaAula />` e põe `no-leve`/`no-pacote` em 3 elementos que já existiam. |
| `scripts/testar-leveza.mjs` | `npm run testar:leveza`. |
| `e2e/escola-leveza.spec.ts` | Computador e celular, com a Escola ligada. |

## Libras na aula: o que é e o que NÃO é

- **É** um botão que carrega o tradutor VLibras do governo federal (`lib/vlibras.ts`, o mesmo do painel de acessibilidade),
  só em português e só com o recurso `vlibras` ligado. Nada carrega antes do clique **e** da confirmação do aviso.
- O aviso diz que é serviço externo, que a tradução é automática, pode errar e **não substitui intérprete de Libras**, e traz
  o selo de privacidade "externo" (`SELOS_DE_FORA.vlibras`, E4-04). Com o modo pacote ligado, avisa que pode gastar do pacote.
  Nenhum número de tamanho é citado.
- **Não é** tradução escrita por este pacote, nem avatar próprio, nem outra língua de sinais. "Lembrar neste aparelho"
  continua sendo só o do painel de acessibilidade (`lucia:vlibras`).
- Em outros idiomas o botão não carrega nada: diz que o tradutor entende só português e leva à mesma aula em `/pt`.
- Vídeo com intérprete humano: só entra pelo índice `content/escola/libras-aulas.json` (abaixo).

### Como acrescentar um vídeo em Libras com intérprete [A REVISAR PELA COORDENAÇÃO]

Imagem e voz de uma pessoa são dado pessoal (LGPD, Lei 13.709/2018, arts. 7º e 11): é preciso **autorização por escrito**,
arquivada pela coordenação. Nada de crianças ou adolescentes nesses vídeos (ECA). Cada entrada leva:

```json
{ "aula": "trilha/aula", "url": "https://player.vimeo.com/video/...", "fonte": "...", "interprete": "nome ou equipe",
  "autorizacao": "onde está arquivada a autorização", "licenca": "...", "em_revisao": true }
```

`validarLibras` (e o teste) recusam: aula que não existe, `http`, usuário e senha na URL, servidor fora dos já liberados para
vídeo (YouTube sem cookies, Vimeo, ou `NEXT_PUBLIC_VIDEO_HOSTS`), aula repetida, `autorizacao` vazia e palavras proibidas.
Quem produz, quem revisa e a política de guarda das autorizações são da coordenação.

## Modo pacote de dados

- Nova preferência `pacote` em `lib/prefs.ts` (dentro de `lucia:acessibilidade`, fora da cópia, como as outras). Põe
  `data-pacote` em `<html>` (em `flags` **e** no `prefsScript`, que têm de listar o mesmo conjunto) e **liga também o modo
  leve**. Desligar o pacote não desliga o leve: a tela oferece "Desligar também o modo leve". `pedeEconomia()` não mudou.
- `Link` já desliga o prefetch com `data-light`, então o pacote herda isso. As simulações somem (`.no-pacote`).
- Isso muda **o que aparece**, não o que o navegador já baixou. Os textos dizem isso. A economia de verdade vem do texto puro,
  do EPUB e de guardar a trilha no Wi-Fi.

### Convite (árvore de decisão de `deveConvidar`)

1. Pacote já ligado: não convida.
2. Resposta `aceito` ou `nunca`: não convida. Resposta `depois`: só convida quando passaram 14 dias (`DIAS_DEPOIS`).
3. Motivo, nesta ordem: matrícula com `acesso === "pacote-acaba"`; aparelho com `saveData`; rede `slow-2g`, `2g` ou `3g`.
4. Sem motivo (rede 4g ou desconhecida, sem matrícula "pacote acaba"): não convida.

Sem dark pattern: três botões do mesmo tamanho e peso ("Ligar o modo pacote", "Agora não", "Não perguntar mais"), sem contagem
regressiva, nunca modal, não rouba o foco, alvo de toque de 48 px. A resposta fica em `lucia:modo-pacote-convite`.

## Aula leve ("Só o texto")

Interruptor `lucia:escola:aula-leve` (`"1"` ou ausente) que põe `data-aula-leve` em `<html>` enquanto a aula está aberta.
O CSS esconde a margem (`.coluna-da-margem`), as aulas parecidas, os educadores e as simulações (`.no-leve`). O texto e o botão
de próxima aula continuam. Não há rota nem página nova.

## Levar esta aula

- **Só o texto**: `/<lang>/trilhas/<trilha>/<aula>/texto` (já existia), com o tamanho estimado por `tamanhoDoTexto`, calculado
  no servidor com o `lesson.body` que a página já tem (sem ler disco).
- **EPUB da trilha**: `/epub/<trilha>.epub` (já existia). Serve em celular antigo e em leitores de livro.
- **Guardar a trilha para ler sem internet**: `SaveOffline` de `components/Offline.tsx`, sem reescrever. O `sw.js` e o cache
  `lucia-paginas-v4` não mudaram.
- **Se o site cair, leia aqui**: os endereços do espelho de leitura (`espelhosDoSite()`, E4-04, só lê `NEXT_PUBLIC_ESPELHOS`).
  Some quando a variável está vazia. O passo a passo da coordenação continua em `docs/ESPELHO-E-COPIAS.md`.

## Medidor "quanto esta página gastou"

Lê `performance.getEntriesByType` (navegação e recursos) e soma `transferSize` **só do que veio da mesma origem**. Não inclui o
que veio de fora (como o tradutor de Libras, cujo tamanho o navegador não revela) nem o que já estava guardado no aparelho, e o
texto diz isso. Sem a API ou com tudo zero: "O navegador não informou". Não grava e não envia nada.

## Tela apagada

Não foi refeita: o modo tela desligada é do E4-03 (R1-24, Media Session no leitor das aulas) e o rádio é do E4-06. O painel só
explica ("Ouvir com a tela apagada"), e o aviso `voz.telaApagada` de `i18n/escola/aula` continua valendo (o teste confere).

## Chaves no aparelho e privacidade

| Chave | O que guarda | Cópia de segurança | "Apagar meus dados" |
|---|---|---|---|
| `lucia:modo-pacote-convite` | `{resposta, em}` | fora (já em `SO_APAGAR`) | apaga |
| `lucia:escola:aula-leve` | `"1"` | entra (prefixo `lucia:escola:`) | apaga (`apagarEscola`) |
| `pacote` em `lucia:acessibilidade` | interruptor | como as outras preferências | como as outras |

Nada sai do aparelho: sem contagem nova (`scripts/alvos-de-contagem.mjs` não foi tocado), sem rastreio. `lib/estudo.ts` e
`lib/escola/estudante.ts` não foram editados.

## Deploy

Este pacote não acrescenta `fs` em módulo algum, não cria `generateStaticParams` nem página por aula, e só importa um JSON
pequeno. As peças de cliente são carga tardia e entram no HTML da aula só como marcador. Não mexe em `next.config.ts`,
`NEXT_PUBLIC_RECURSOS`, `lib/recursos.ts`, `outputFileTracingIncludes` nem no recurso `escola` em produção.
Observação para o dono do E4-06: a página da aula já tem um `fs.existsSync` por aula (o do cordel); é custo por aula e idioma
e convém trocá-lo por um índice estático. Não foi tirado aqui.

## Passos manuais (não automatizáveis)

1. Android com Chrome e "Economizar dados" ligado: abrir uma aula e ver o convite; ligar o pacote e ver o site mais leve.
2. Baixar a trilha no Wi-Fi, desligar a rede e abrir a aula guardada.
3. Abrir o EPUB num leitor de livro; num celular antigo, abrir o espelho de leitura.
4. Com a coordenação e uma pessoa usuária de Libras, conferir o tradutor numa aula real [A REVISAR PELA COORDENAÇÃO].
5. Depois do build: `npm run orcamento:peso` (a aula não pode passar de 700 KiB).
6. Pendência de calibração: o peso real do tradutor e do modo pacote em aparelho de entrada só se mede com o site no ar
   (`docs/escola/acesso.md`, `e2e/aparelho-de-entrada.spec.ts`). Os textos não citam número.

## Ficou para outros pacotes

- Avisar antes de baixar a voz natural no modo pacote: o seletor é `components/aula/SeletorDeVoz.tsx` (E4-03/E4-06); pode
  ler `readPrefs().pacote`.
- Interruptor do pacote no painel de acessibilidade (`components/A11yWidget.tsx`): pede chaves novas em `i18n/*.json`
  principais (E4-01). Hoje o interruptor fica na aula e no convite.
- A tela final da matrícula (E4-08) continua oferecendo só o modo leve; o convite aparece na primeira aula.
- Publicar o espelho de leitura, produzir vídeos em Libras, contagem anônima de uso, reescrever o service worker.

## Testes

`npm run testar:leveza`, `npm run testar:textos-escola`, `npm run testar:etapa4`, `npm run testar:estudo`,
`npm run testar:acesso` e `e2e/escola-leveza.spec.ts` (com `NEXT_PUBLIC_RECURSOS=todos,escola`).
