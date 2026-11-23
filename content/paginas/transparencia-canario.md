---
titulo: "Canário"
sobretitulo: "Transparência"
resumo: "Um texto com data, assinado, dizendo o que não aconteceu: nenhuma ordem secreta, nenhuma chave entregue, nenhuma mudança forçada no código. Se ele parar de ser renovado, é um aviso."
---

Algumas ordens judiciais proíbem quem recebe de contar que recebeu. O canário existe por isso: em vez de dizer o que aconteceu, ele diz o que **não** aconteceu, com data e validade. Se um dia ele não for renovado no prazo, ou se um dos itens sumir, você fica sabendo sem que ninguém tenha contado nada.

## Como conferir a assinatura

O canário é assinado pelo fluxo de publicação do repositório no GitHub, com o Sigstore (o livro público de assinaturas): a assinatura registra no livro **o texto exato** e **a data**, e ninguém consegue trocar nenhum dos dois depois. Cada canário sai como uma versão (release) do repositório, com o arquivo `canario.md` e o pacote `canario.sigstore.json`.

Com o [cosign](https://docs.sigstore.dev/cosign/system_config/installation/):

```
cosign verify-blob canario.md --bundle canario.sigstore.json \
  --certificate-identity "https://github.com/jojoeumermo/perenidade/.github/workflows/canario.yml@refs/heads/master" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```

Ou, com o código do site baixado: `node scripts/ferramentas/canario.mjs conferir canario.md canario.sigstore.json`.

"Verified OK" quer dizer: este texto saiu do fluxo de publicação do repositório, nesta data, e não mudou desde então.
