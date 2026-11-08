# Matérias do Jornal não expiram

Até 8 de novembro de 2026, uma matéria podia sair do ar sozinha pelo campo `sai_do_ar_em` (o endereço respondia 410).
Isso foi retirado: **toda matéria publicada fica no ar, no endereço permanente `/{idioma}/jornal/{slug}`, e no arquivo
`/{idioma}/jornal/arquivo`**. Saíram `lib/jornal/validade.ts`, `lib/jornal/saidas.ts`, o bloco do 410 em `proxy.ts`, o
aviso `journal.expires` e o teste `testar:jornal-prazo`. Um `sai_do_ar_em` vindo do painel é ignorado
(`scripts/sincronizar.mjs`), e `npm run testar:jornal` falha se o campo aparecer em `content/jornal/`.

Para tirar uma matéria do ar, só apagando o arquivo numa publicação (decisão da equipe, não do relógio).

## Como o Jornal mostra as matérias

- `/{idioma}/jornal` abre a **última matéria publicada, inteira** (a mais nova por `data`; no mesmo dia, pela `hora`
  opcional, `"HH:MM"` entre aspas, hora de Brasília).
- No fim de cada matéria, **"Leia também"**: as 3 mais recentes que não são a aberta, e o link para o arquivo.
- **Destaque fixo:** a matéria com `destaque: true` no cabeçalho aparece no topo do arquivo e na lateral (ou no fim, no
  celular) das outras matérias, por mais matérias novas que cheguem. Hoje é a dos povos indígenas
  (`content/jornal/2026-11-06-indigenas-sob-ataque-depois-das-urnas.md`).
- A escolha fica em `lib/jornal/selecao.ts`; o teste é `npm run testar:jornal`.
