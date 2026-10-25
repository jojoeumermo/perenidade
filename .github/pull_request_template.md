## O que muda

## Segurança (marque o que vale)
- [ ] Função nova no banco: `security definer`, `search_path` fixo, confere quem chama (`interno.eu()` e o papel) e tem teste em `scripts/testar-banco.mjs` para quem pode e para quem não pode.
- [ ] Nada de SQL montado com texto de fora; `execute format` só com `%I`/`%L` ou parâmetros.
- [ ] Texto de quem visita ou de quem é da equipe só aparece escapado (sem `dangerouslySetInnerHTML` com dado de fora).
- [ ] Endereço vindo de fora: só `https`, e chamada do servidor só por `lib/externo.ts`.
- [ ] Envio de arquivo: tipo conferido pelos bytes, tamanho e quantidade limitados, depósito fechado por padrão.
- [ ] Código de quem estuda roda em Worker que começa por `ISOLAR_WORKER` / `isolar.js`, ou em iframe sem `allow-same-origin`.
- [ ] Nenhuma chave nova em variável `NEXT_PUBLIC_*`; segredo novo listado em `docs/seguranca/ROTACAO.md`.
- [ ] E-mail automático: sem texto livre de visitante (ou passado por `interno.sem_link`) e com limite.
- [ ] Rota nova pública está em uma área de `lib/interdicao.ts`.

## Como conferi
- [ ] `npm run lint`, `npm run typecheck` e os testes da área
