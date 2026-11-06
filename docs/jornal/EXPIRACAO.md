# Matéria com prazo no Jornal (`sai_do_ar_em`)

Uma matéria urgente pode ser publicada para ficar no ar só por um tempo. No cabeçalho do arquivo em `content/jornal/`:

```yaml
sai_do_ar_em: "2026-11-13 23:59"   # hora de Brasília
```

Formatos aceitos (`lib/jornal/validade.ts`):

- `"2026-11-13"`: vale o dia inteiro; sai às 23:59:59 de Brasília.
- `"2026-11-13 23:59"` ou `"2026-11-13T23:59"`: hora de Brasília (o Brasil não tem horário de verão desde 2019, Decreto 9.772/2019: é sempre -03:00).
- `"2026-11-14T02:59:00Z"` ou com `-03:00`: o fuso escrito vale.

Um valor que não é data para a montagem do site com o aviso do arquivo. Pelo painel, o campo é "sai do ar em" (`scripts/sincronizar.mjs`).

## O que acontece

Enquanto está no ar, a página da matéria mostra um aviso: "Matéria com prazo: fica no ar até …" (`journal.expires`, nos seis idiomas).

Passada a hora:

| Onde | O que faz | Arquivo |
| --- | --- | --- |
| Endereço da matéria (`/<idioma>/jornal/<slug>`) | responde **410** (removida), com uma página curta no idioma, sem script, `noindex` | `proxy.ts`, `lib/jornal/saidas.ts` |
| Capa do Jornal, página inicial, Territórios | a matéria some da lista | `getArticles` em `lib/content.ts` |
| Busca (`/indice.json`, `/indice-leve.json`) | sai do índice | `lib/indice-de-busca.ts` (usa `getArticles`) |
| Mapa do site (`sitemap.xml`) | sai do mapa | `app/sitemap.ts` |
| `novidades.json` (boletim) | sai da lista | `app/[lang]/novidades.json/route.ts` |
| Modo sem internet | a cópia guardada da página é apagada ao receber o 410 | `public/sw.js` |

As páginas prontas são refeitas a cada hora (`revalidate = 3600`), então as listas deixam de mostrar a matéria em até uma hora depois do prazo. O endereço da matéria responde 410 na hora exata, porque o `proxy.ts` confere o relógio a cada pedido.

O Jornal não tem feed RSS próprio hoje (o único RSS do site é o do podcast). Se um feed do Jornal for criado, ele deve usar `getArticles`, que já deixa de fora as matérias vencidas.

## O arquivo continua

A matéria **não é apagada** do repositório: o histórico fica (regra do projeto de não apagar). `todasAsMaterias` em `lib/content.ts` lista também as vencidas, para uso interno. Para tirar o arquivo de vez, apague-o numa publicação.

## Teste

`npm run testar:jornal-prazo` confere a leitura da data, a hora exata da saída, o caminho reconhecido pelo proxy, a página 410 e que os prazos lidos pelo proxy batem com os de `lib/content.ts`. `npm run testar:app-offline` confere que o modo sem internet apaga a cópia de uma página que respondeu 410.
