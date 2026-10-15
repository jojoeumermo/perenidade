# Sentinela Lúcia

Painel de monitoramento de segurança do site do Instituto Lúcia, para uma equipe de até cinco pessoas. App de mesa
para Windows (Tauri), o mesmo código como PWA (celular), um coletor na Cloudflare e um projeto Supabase separado do site.

Documentos: [PLANO.md](PLANO.md) (o plano e o que foi feito) · [RELATORIO.md](RELATORIO.md) (a entrega: o que você
precisa fazer, achados, manual).

## O que há aqui

| Pasta | O quê |
| --- | --- |
| `supabase/install.sql` | O banco do Sentinela (esquema `vigia`, funções, regras, limpeza). Cola no SQL Editor do projeto **do Sentinela**. |
| `supabase/testar-banco.mjs` | Prova as regras do banco em um Postgres na memória (`npm run testar:banco`). |
| `worker/` | O coletor (Cloudflare Worker): cron de 5 min e de 6 h, receptor de CSP, executor de ações. `npm run worker:conferir`, `npm run testar:worker`. |
| `src/` | O app (React + Vite + Tailwind). `npm run dev` abre em `http://localhost:1420`. |
| `src-tauri/` | A casca de mesa (Tauri 2). `npx tauri build` gera o instalador (precisa de Rust + Build Tools); o GitHub Actions faz isso por você. |
| `public/` | Manifesto e service worker do PWA, ícones. |
| `vercel.json` | Publicação do PWA na Vercel (projeto com *Root Directory* = `sentinela`). |

## Rodar localmente

```bash
cd sentinela
npm install
npm run testar          # banco (PGlite) + coletor (sem rede)
npm run dev             # o app em http://localhost:1420 (botão "Ver a demonstração" dispensa serviço)
npm run worker:dev      # o coletor local (precisa dos segredos em worker/.dev.vars)
```

## Instalar de verdade (resumo; o passo a passo completo está em RELATORIO.md, seção 1)

1. Crie um projeto Supabase novo (não o do site), rode `supabase/install.sql`, crie a sua conta pelo app e rode
   `select public.promover_dono('seu-email');`.
2. Publique o coletor: `npx wrangler login`, ajuste `SENTINELA_SUPABASE_URL` em `worker/wrangler.toml`,
   `npm run worker:deploy`, e cadastre os segredos com `npx wrangler secret put NOME --config worker/wrangler.toml`.
3. Abra o app (instalador do GitHub Actions ou `npm run dev`), cole o endereço do Supabase do Sentinela, a chave anon e o
   endereço do Worker, entre, cadastre o aplicativo autenticador e preencha **Configuração** (zona, projeto, repositório).
4. Convide a equipe em **Equipe → Convites**.
