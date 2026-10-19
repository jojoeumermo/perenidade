# Editores avançados (PhotoCraft, FilmCraft, EffectCraft) em estudio.institutolucia.org

Os três são programas de código aberto do projeto ArtCraft, com versão web (WebAssembly) distribuída como site estático.
O instituto hospeda o pacote **oficial, sem nenhuma modificação**, num endereço separado do site e do painel. Assim o
código deles não alcança cookies, sessão do painel nem as chaves do Supabase (outra origem), e nenhum script do site
entra neles.

| Editor | Versão fixada | Pacote | Tamanho (download do aluno) | Licença |
|---|---|---|---|---|
| PhotoCraft | 0.10.0 | `photocraft-web-0.10.0.zip` | 10,9 MB (11,1 MB extraído; a maior parte, 10,9 MiB) | MIT ou Apache-2.0 |
| FilmCraft | 0.9.0 | `filmcraft-web-0.9.0.zip` | cerca de 12 MB | Apache-2.0 |
| EffectCraft | 0.11.1 | `effectcraft-web-0.11.1.zip` | cerca de 18 MB | Apache-2.0 |

Licença e marca (conferidas em 18/10/2026): o código é MIT ou Apache-2.0; o nome e as marcas ArtCraft não são livres, mas
podem aparecer **sem alteração** nas cópias oficiais, só para dizer que o time ArtCraft faz o programa
(`docs/brand/LICENSE-brand.txt` de cada repositório). Por isso o pacote é publicado como veio. Se um dia for preciso
modificar algo, a marca tem de sair: pare e decida antes.

## 1. Montar a pasta (no computador)

```bash
node scripts/editores.mjs
```

O script baixa cada pacote da página de releases do GitHub (versões em `scripts/editores.mjs` e `lib/estudio.ts`),
confere o SHA-256 contra o `SHA256SUMS.txt` publicado pelo projeto (se não conferir, para), extrai em
`estudio/site/<editor>/` e gera `estudio/site/_headers` com:

- as regras de cabeçalho que cada pacote já traz (tipo `application/wasm`, cache longo nos arquivos com hash, `no-cache` no
  `index.html`, no carregador e na lista de partes), com o caminho do editor na frente;
- uma CSP restrita por editor (`script-src 'self' 'wasm-unsafe-eval'` mais o hash do script que o `index.html` traz
  escrito dentro, nada de fora, `frame-ancestors 'none'`);
- `Referrer-Policy: no-referrer`, `nosniff` e `Permissions-Policy` sem câmera, microfone ou localização.

Os pacotes ficam fora do Git (`.gitignore`): são publicados à parte. O script avisa se algum arquivo passar de 25 MiB
(limite por arquivo da Cloudflare Pages); hoje nenhum passa (o PhotoCraft já vem com o WebAssembly cortado em partes).

Para testar no computador antes de publicar: `node scripts/servir-estudio.mjs` e abra http://localhost:4600/ (aplica o
mesmo `_headers`). Teste: abrir o PhotoCraft, abrir um PSD baixado do Estúdio rápido (botão “Abrir no editor avançado”
ou “PSD” num modelo), mexer numa camada de texto, exportar PNG.

## 2. Publicar (uma vez)

1. Na Cloudflare: **Workers & Pages › Create › Pages › Upload assets**, projeto `estudio-lucia`, e envie a pasta
   `estudio/site` (ou, com o Wrangler: `npx wrangler pages deploy estudio/site --project-name estudio-lucia`).
2. No projeto: **Custom domains › estudio.institutolucia.org**.
3. Na Vercel do site principal: variável `NEXT_PUBLIC_ESTUDIO_URL=https://estudio.institutolucia.org` e um redeploy.
   Sem ela, o painel e as páginas dizem que o editor ainda não está no ar e oferecem só o que funciona sem ele.
4. Confira o isolamento: em https://estudio.institutolucia.org/photocraft/, o DevTools › Application não mostra cookies
   nem armazenamento do institutolucia.org; e a aba Network não mostra chamadas ao Supabase.

Plano gratuito da Cloudflare Pages: até 20 000 arquivos por site e 25 MiB por arquivo, banda sem cobrança. Não é preciso R2
com as versões atuais.

## 3. Trocar de versão (sempre à mão)

1. Leia as notas da release nova e confira de novo `LICENSE`, `NOTICE` e `docs/brand/LICENSE-brand.txt`.
2. Mude o número em `scripts/editores.mjs` (`VERSOES`) e em `lib/estudio.ts` (`EDITORES`, com o tamanho novo).
3. `node scripts/editores.mjs` (confere o SHA-256), teste com `node scripts/servir-estudio.mjs`.
4. Publique de novo a pasta `estudio/site` e faça o commit das mudanças de número.

## O que se perde do Estúdio rápido para o PSD

- Cada camada vai desenhada (o visual chega igual em qualquer editor).
- Textos sem rotação e sem tarja vão também como **texto editável** (fonte, tamanho, entrelinha, espaçamento e cor). Textos
  girados ou com tarja chegam só desenhados.
- Filtros de imagem (preto e branco, duotom…) chegam aplicados, não como ajuste.
- Fontes: EB Garamond, Inter e IBM Plex Mono, todas livres (Google Fonts). Sem elas instaladas, o editor troca a fonte ao
  editar o texto.
