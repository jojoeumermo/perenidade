# Instituto Lúcia

Escola e biblioteca comunitária, gratuita, sem anúncios e sem rastreadores, mantida por voluntários. No ar em **[institutolucia.org](https://institutolucia.org)**.

- **Disciplinas e trilhas** do ensino fundamental ao superior, com exercícios, glossário e nivelamento.
- **Acervo** de obras livres e em domínio público, com a fonte e a licença de cada uma.
- **Laboratórios e ferramentas de prática** que rodam no navegador (programação, simulações, terminal, planilha).
- **Memorial, jornal, galeria e podcasts.**
- **Comunidade e painel da equipe**, para quem estuda e para quem é voluntário.

Em português, inglês, espanhol, francês, chinês e russo. Funciona também no celular, como aplicativo instalável, e em leitores de tinta eletrônica (Kindle).

## Rodar na sua máquina

Precisa do Node.js 22 (a versão usada na verificação automática).

```bash
npm install
npm run dev
```

O site abre em `http://localhost:3000`. Nada mais é necessário: sem banco e sem conta, o site inteiro funciona (aulas, acervo, busca, ferramentas).

Para testar também o painel de voluntários e a comunidade, sem tocar no banco de verdade:

```bash
npm run dev:local
```

Isso sobe um banco de teste em memória e o site em `http://localhost:3100`. As contas de teste estão descritas no início de `scripts/backend-local.mjs`.

As variáveis opcionais estão explicadas em `.env.example`. Nenhuma chave secreta entra no código.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | site em modo de desenvolvimento |
| `npm run dev:local` | site + banco de teste local |
| `npm run build` | monta o site e valida todo o conteúdo |
| `npm run lint` e `npm run typecheck` | conferem o código |
| `npm run conferir:i18n` | confere se os seis idiomas têm os mesmos textos |
| `npm run conferir:painel` | confere a tradução do painel da equipe |
| `npm run conferir:links` | confere se as fontes citadas ainda respondem |
| `npm run testar:banco` | instala o banco do zero em memória e testa cada permissão |
| `npm run testar:ponta` | percorre os fluxos principais num navegador de verdade |
| `npm run testar:…` | as outras baterias (rede, moderação, isolamento, aulas ao vivo e mais), uma por área; a lista está no `package.json` |
| `node scripts/gerar-espelho.mjs` | gera o espelho de leitura (aulas e acervo em HTML puro) |
| `npm run proximo` | mostra, por disciplina, qual é a próxima aula a escrever |
| `npm run sincronizar` | leva para `content/` o que foi aprovado no painel |
| `npm run importar:catalogo` | refaz o catálogo ampliado a partir de catálogos abertos |

## Do que é feito

Next.js 16 e React 19, em TypeScript, com Tailwind CSS 4. O conteúdo fica em arquivos de texto no próprio repositório. Contas, painel e comunidade usam o Supabase (Postgres com segurança por linha em todas as tabelas). O site é publicado na Vercel.

## Onde fica cada coisa

- `content/` — todo o conteúdo, em arquivos de texto (aulas, acervo, memorial, glossário, jornal…).
- `app/` e `components/` — as páginas e as peças do site.
- `i18n/` — os textos da interface, um arquivo por idioma.
- `supabase/install.sql` — o banco de apoio (contas, funções da equipe, fila, comunidade, reforço), em um arquivo só.
- `supabase/functions/` — as funções do servidor (e-mails, avaliação da comunidade, transcrição, assistente de reforço, vídeos).
- `scripts/` — roteiros de apoio e as baterias de teste.
- `docs/MANUTENCAO.md` — **o guia completo**: como o projeto funciona, como escrever conteúdo, como ligar as contas e o que fazer se algo der errado.
- `docs/ESPELHO-E-COPIAS.md` — o espelho de leitura e as cópias do banco: o que fazer se o site cair.
- `docs/SEGURANCA-DAS-PESSOAS.md` — quem pode atacar quem participa e o que o site faz contra cada coisa.
- `docs/YOUTUBE.md` — como ligar o canal do YouTube do instituto às aulas em vídeo e às transmissões.

## Como ajudar

- **Com código:** leia o `CONTRIBUTING.md`.
- **Com aulas, traduções, revisão ou o acervo:** pelo site, em [Contribuir](https://institutolucia.org/pt/contribuir) e [Voluntariado](https://institutolucia.org/pt/voluntarios).
- **Achou uma falha de segurança?** Não abra issue pública; siga o `SECURITY.md`.

Quem participa segue o `CODE_OF_CONDUCT.md`.

## Licenças

- Código: © Jonathan Santos, software livre sob a GNU AGPL versão 3 ou posterior (`LICENSE`).
- Conteúdo educacional: CC BY-SA 4.0 (`LICENSE-CONTEUDO.md`).
- Obras do acervo, imagens e bibliotecas de terceiros mantêm a licença de origem (`THIRD_PARTY_LICENSES.md` e `docs/NOTICE.md`).
