# Instituto Lúcia

Escola e biblioteca comunitária, gratuita e sem anúncios: disciplinas do ensino fundamental ao superior, um acervo de obras livres, ferramentas de prática, memorial, jornal e comunidade. Em português, inglês, espanhol, chinês e russo.

> Código: © Jonathan Santos, software livre sob a GNU AGPL versão 3 ou posterior (`LICENSE`).
> Conteúdo educacional: CC BY-SA 4.0 (`LICENSE-CONTEUDO.md`).

## Rodar na sua máquina

```bash
npm install
npm run dev
```

O site abre em `http://localhost:3000`. Nada mais é necessário: sem banco e sem conta, o site inteiro funciona (aulas, acervo, busca, ferramentas).

Para testar também o painel de voluntários, a comunidade e a rádio, sem tocar no banco de verdade:

```bash
npm run dev:local
```

Isso sobe um banco de teste em memória e o site em `http://localhost:3100`. As contas de teste estão descritas no início de `scripts/backend-local.mjs`.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | site em modo de desenvolvimento |
| `npm run dev:local` | site + banco de teste local |
| `npm run build` | monta o site e valida todo o conteúdo |
| `npm run lint` e `npm run typecheck` | conferem o código |
| `npm run conferir:i18n` | confere se os cinco idiomas têm os mesmos textos |
| `npm run conferir:links` | confere se as fontes citadas ainda respondem |
| `npm run testar:banco` | instala o banco do zero em memória e testa cada permissão |
| `npm run proximo` | mostra, por disciplina, qual é a próxima aula a escrever |
| `npm run sincronizar` | leva para `content/` o que foi aprovado no painel |
| `npm run importar:catalogo` | refaz o catálogo ampliado a partir de catálogos abertos |

## Onde fica cada coisa

- `content/` — todo o conteúdo, em arquivos de texto (aulas, acervo, memorial, glossário, jornal…).
- `app/` e `components/` — as páginas e as peças do site.
- `i18n/` — os textos da interface, um arquivo por idioma.
- `supabase/install.sql` — o banco de apoio (contas, fila, comunidade, rádio), em um arquivo só.
- `scripts/` — roteiros de apoio.
- `docs/MANUTENCAO.md` — **o guia completo**: como o projeto funciona, como escrever conteúdo, como ligar as contas e o que fazer se algo der errado.
