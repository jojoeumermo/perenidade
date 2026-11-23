# Vetores do Sigstore (transparência dos binários, onda R3, item 2.4)

Os três verificadores dos apps (o do Node em `lib/rede/transparencia-apps/conferir.ts`, o do Rust em `nativo/nucleo` e o do
Android) passam pelos **mesmos** vetores. O positivo é um pacote Sigstore **real e público**, de outro projeto: assim o teste prova
que a conferência funciona com o que o Sigstore de verdade produz, sem depender de um lançamento nosso.

| Arquivo | O que é | Origem | SHA-256 |
|---|---|---|---|
| `pacote-positivo.json` | atestado de proveniência (SLSA v1, DSSE in-toto) do lançamento **v4.5.1** do `sigstore-python`, formato `application/vnd.dev.sigstore.bundle.v0.3+json`, entrada `3339149718` do Rekor público (20/10/2026) | lançamento v4.5.1 de `github.com/sigstore/sigstore-python` | `a9952f717445a7afcdd057df71f7f91fd16b783264ffcdca05504e5b1e3f8257` |
| `sigstore-4.5.1-py3-none-any.whl` | o arquivo que o atestado cobre (primeiro "subject") | o mesmo lançamento (PyPI: `sigstore` 4.5.1) | `02e000197b34980f1d382741d6f83c2fecbcef7debf7304f36a5253f3c892cd9` |

Licença dos dois: Apache-2.0 (o `sigstore-python`). São só dados de teste: nada daqui é executado.

Identidade que assina o positivo: `https://github.com/sigstore/sigstore-python/.github/workflows/release.yml@refs/tags/v4.5.1`, emissor
`https://token.actions.githubusercontent.com`.

Os negativos são feitos **dentro dos testes**, a partir do positivo (um byte do arquivo, a assinatura, a prova de inclusão cortada ou
trocada, o topo do livro, o corpo da entrada, a identidade, o emissor, a raiz de confiança, o formato): `scripts/testar-r3-transparencia.mjs`
(Node) e `nativo/nucleo/tests/vetores.rs` (Rust). Todos precisam dar "fora do log".

A raiz de confiança (`public/apps/raiz-sigstore.json`) é o `trusted_root.json` público do Sigstore, byte a byte o que vem dentro do
pacote `@sigstore/tuf` 5.0.1 (assinado pela raiz TUF do Sigstore): SHA-256
`6494e21ea73fa7ee769f85f57d5a3e6a08725eae1e38c755fc3517c9e6bc0b66`. É trocada a cada versão dos apps.
