# Perenidade

Biblioteca de Alexandria comunitária: conhecimento livre, gratuito e preservado.

- **Trilhas e aulas** escritas pela comunidade, em Markdown, com teste ao final de cada aula.
- **Acervo**: índice de obras em domínio público e licenças abertas. Guardamos só os metadados e o link para a fonte legítima. Nenhum arquivo de terceiros é hospedado.
- **Moderação pública**: toda contribuição é um Pull Request, revisado antes de entrar.
- **Histórico completo**: o Git guarda cada versão. Nada se perde e tudo é reversível.
- **Sem cadastro**: o progresso do aluno fica no navegador dele.

## Rodando na sua máquina

Requer Node.js 20 ou mais novo.

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Gera o site estático e valida todo o conteúdo |
| `npm run lint` | Confere o estilo do código |
| `npm run typecheck` | Confere os tipos do TypeScript |
| `npm run check:links` | Confere se os links do acervo ainda respondem |

## Como o projeto está organizado

```
content/
  trilhas/<trilha>/_trilha.md     dados da trilha
  trilhas/<trilha>/NN-slug.md     uma aula (NN define a ordem)
  acervo/<obra>.md                ficha de uma obra
app/                              páginas (Next.js, App Router)
components/                       componentes de interface
lib/content.ts                    lê e valida o conteúdo
lib/history.ts                    lê o histórico do Git
supabase/schema.sql               camada opcional de contas (ainda não usada)
docs/MODERACAO.md                 guia de moderação
```

O conteúdo é lido dos arquivos na hora do build e vira páginas estáticas. Não há banco de dados em produção: a fonte da verdade é este repositório.

Um arquivo de conteúdo inválido (campo faltando, licença desconhecida, link que não é `https`) **quebra o build de propósito**, com uma mensagem dizendo qual arquivo corrigir.

## Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md). O jeito mais fácil é pela página **Contribuir** do próprio site.

## Publicando

O site é estático e funciona em qualquer hospedagem compatível com Next.js. Configure a variável `NEXT_PUBLIC_SITE_URL` com o endereço final (veja `.env.example`), para o sitemap e os metadados apontarem para o domínio certo.

Na Vercel, defina também `VERCEL_DEEP_CLONE=true`. Sem isso o build recebe só os commits mais recentes, e as páginas de histórico ficam incompletas.

## Licenças

- **Código**: [MIT](LICENSE).
- **Aulas e textos da comunidade** (pasta `content/trilhas`): [CC BY-SA 4.0](LICENSE-CONTEUDO.md).
- **Obras do acervo**: pertencem aos seus autores. Cada ficha indica a licença e a fonte.
