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

Para testar também o painel de voluntários e a comunidade, com dados de teste:

```bash
npm run dev:local
```

Isso sobe o site em `http://localhost:3100` com dados de teste.

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

## Onde fica cada coisa

- `content/` — todo o conteúdo, em arquivos de texto (aulas, acervo, memorial, glossário, jornal…).
- `app/` e `components/` — as páginas e as peças do site.
- `i18n/` — os textos da interface, um arquivo por idioma.
- `scripts/` — roteiros de apoio e as baterias de teste.

## Como ajudar

- **Com código:** leia o `CONTRIBUTING.md`.
- **Com aulas, traduções, revisão ou o acervo:** pelo site, em [Contribuir](https://institutolucia.org/pt/contribuir) e [Voluntariado](https://institutolucia.org/pt/voluntarios).
- **Achou uma falha de segurança?** Não abra issue pública; siga o `SECURITY.md`.

Quem participa segue o `CODE_OF_CONDUCT.md`.

## Licenças

- Código: © Jonathan Santos, software livre sob a GNU AGPL versão 3 ou posterior (`LICENSE`).
- Conteúdo educacional: CC BY-SA 4.0 (`LICENSE-CONTEUDO.md`).
- Obras do acervo, imagens e bibliotecas de terceiros mantêm a licença de origem (`THIRD_PARTY_LICENSES.md` e `docs/NOTICE.md`).
- As silhuetas da entrada da Alumia (`public/alumia/entrada/`) são obras derivadas de fotos do Wikimedia Commons e NÃO são AGPL: `freire.webp` é CC BY-SA 3.0 e `marielle.webp` é CC BY-SA 2.0 (mesma licença da foto original, como ela exige); as outras vêm de fotos em domínio público. Autor, licença e fonte de cada uma: `lib/rede/entrada/creditos.json`.
