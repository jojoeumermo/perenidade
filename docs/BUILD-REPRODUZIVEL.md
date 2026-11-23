# Build reproduzível e transparência dos apps da Alumia

Este roteiro é público. Ele serve para qualquer pessoa conferir que o app da Alumia que ela baixou foi feito a partir deste
código, sem nada a mais, e que a versão está registrada num livro público. É a parte 2.4 da onda R3 ("transparência dos
binários"); a página de baixar e conferir é `/alumia/app` no site.

## Em palavras simples

1. **Cada arquivo dos apps é assinado sem chave guardada.** Quem assina é o fluxo de lançamento deste repositório
   (`.github/workflows/apps-lancamento.yml`), numa tag de versão (`v1.2.3`), com a identidade que o GitHub dá a esse fluxo. O
   Sigstore transforma essa identidade num certificado de dez minutos, e a assinatura vai para o **Rekor**, o livro público de
   assinaturas do Sigstore. Não existe uma chave que alguém possa roubar para assinar uma versão falsa por fora; e se alguém
   tomar o fluxo de lançamento, a versão falsa fica registrada no livro, à vista de todos.
2. **O app recusa atualização fora do livro.** Antes de abrir um instalador baixado, o app do computador confere o pacote Sigstore
   dele (certificado, identidade, assinatura e a prova de que a entrada está no livro). Não conferiu, não instala. Ao abrir, o app
   também confere a si mesmo: se o executável não for o registrado para a versão dele, o chat não abre.
3. **O build é reproduzível.** Seguindo este roteiro, você chega ao **mesmo** executável (o mesmo resumo SHA-256) que o fluxo de
   lançamento registrou. Se não chegar, alguma coisa está diferente, e isso é motivo para avisar.

## O que é reproduzível, e o que não é

| Arquivo | Reproduzível? | Como conferir |
|---|---|---|
| Executável do computador (`alumia-<versão>-<alvo>-executavel[.exe]`, o de dentro do instalador) | **Sim**, no mesmo sistema operacional e com as mesmas ferramentas fixadas | montar e comparar o SHA-256 |
| Instalador do Windows (NSIS), `.dmg` do macOS, `.AppImage` do Linux | **Não garantido**: o embrulho grava datas e a ordem de arquivos da ferramenta de empacotar | conferir no Rekor; o executável de dentro é o mesmo publicado à parte |
| APK do Android **sem** assinatura | **Sim** (montado em contêiner com versões fixas) | montar e comparar; ver "Android" |
| APK do Android assinado | o conteúdo é o do APK sem assinatura; a assinatura é da coordenação | `apksigcopier compare` contra o sem assinatura |
| WebAssembly do ratchet pós-quântico (`public/cifra/spqr-1.7.0.wasm`) | **Sim**, no contêiner Linux de referência | o CI refaz e compara |

Windows, Linux e macOS **não** dão o mesmo executável entre si (o ligador e os caminhos são de cada sistema): cada plataforma tem o
seu executável de referência, montado no sistema dela pelo fluxo de lançamento.

## Ferramentas fixadas

- **Rust 1.99.0** (o arquivo `rust-toolchain.toml` de cada pasta Rust faz o `rustup` usar exatamente esta versão).
- Dependências Rust pelo `Cargo.lock` de cada pasta (`--locked`: nada é resolvido de novo na hora de montar).
- **Node 24** e as dependências do `package-lock.json` (`npm ci`), inclusive a CLI do Tauri `@tauri-apps/cli` 2.12.4.
- Tauri 2.12.5 (o crate), com as versões exatas em `desktop/src-tauri/Cargo.toml`.
- A raiz de confiança do Sigstore embutida nos apps: `public/apps/raiz-sigstore.json`, o `trusted_root.json` público do Sigstore
  (SHA-256 `6494e21ea73fa7ee769f85f57d5a3e6a08725eae1e38c755fc3517c9e6bc0b66` nesta versão), trocada a cada versão dos apps.

## Montar o executável do computador

Use um clone limpo do repositório, na tag da versão que você quer conferir.

```sh
git clone https://github.com/jojoeumermo/perenidade.git alumia && cd alumia
git checkout v1.2.3            # a versão que você baixou
npm ci
```

Monte a casca do chat (o mesmo projeto estático do Android; o comando está em `docs/APP-LOJA.md`), que fica em `casca/saida`.

Depois, o executável, com as variáveis que tiram do binário o que muda de máquina para máquina (o caminho da pasta, a data). Use
o **mesmo comando do fluxo de lançamento** (`tauri build` com o tipo de instalador da sua plataforma), e não só `cargo build`: a
ferramenta do Tauri grava dentro do executável o tipo de instalador que o acompanha, e o publicado é esse executável "marcado".

**Linux** (`appimage`) **e macOS** (`dmg`)

```sh
export SOURCE_DATE_EPOCH="$(git log -1 --format=%ct)"
export CARGO_INCREMENTAL=0
export RUSTFLAGS="--remap-path-prefix=$PWD=/alumia --remap-path-prefix=${CARGO_HOME:-$HOME/.cargo}=/cargo"
(cd desktop/src-tauri && npx tauri build --ci --bundles appimage -- --locked)   # no macOS: --bundles dmg
sha256sum desktop/src-tauri/target/release/alumia
```

**Windows** (`nsis`; PowerShell, com o Visual Studio Build Tools para o ligador da Microsoft)

```powershell
$env:SOURCE_DATE_EPOCH = git log -1 --format=%ct
$env:CARGO_INCREMENTAL = "0"
$cargo = if ($env:CARGO_HOME) { $env:CARGO_HOME } else { "$env:USERPROFILE\.cargo" }
$env:RUSTFLAGS = "--remap-path-prefix=$PWD=/alumia --remap-path-prefix=$cargo=/cargo -C link-arg=/Brepro"
cd desktop\src-tauri; npx tauri build --ci --bundles nsis -- --locked
Get-FileHash target\release\alumia.exe -Algorithm SHA256
```

**Use o `--bundles` de cada sistema, como acima, e não `--no-bundle`:** o empacotador do Tauri grava no executável o tipo de
instalador ("Patching alumia.exe with bundle type information"), e é esse executável, já marcado, que vai dentro do instalador e
que o lançamento registra. Montado sem empacotar, o resumo sai diferente.

`/Brepro` faz o ligador da Microsoft trocar a data do executável por um resumo do conteúdo. O resumo que sair tem de ser o do
arquivo `alumia-<versão>-<alvo>-executavel[.exe]` do lançamento (e o da página `/alumia/app`).

**Por que existe um `Cargo.toml` na raiz do repositório.** O Cargo dá a cada pacote "de caminho" (o app e o `nativo/nucleo`) uma
identidade que entra nos nomes internos do executável. Para pacote dentro da raiz do Cargo, ela usa o caminho **relativo**; fora,
o caminho **inteiro** da máquina, e o executável mudaria de uma pasta para outra. A raiz (`Cargo.toml`, só com o app) resolve isso.
No Windows, o app montado em duas pastas diferentes deu o mesmo `alumia.exe`, byte a byte; o instalador NSIS, não (como diz a
tabela acima).

## Conferir um arquivo no livro público

Baixe o arquivo e o pacote dele (`<arquivo>.sigstore.json`, no mesmo lançamento). Duas formas, que conferem a mesma coisa:

**Com o código deste repositório** (sem rede; usa a raiz de confiança embutida):

```sh
node scripts/conferir-app.mjs alumia-1.2.3-windows-x64-setup.exe alumia-1.2.3-windows-x64-setup.exe.sigstore.json --versao 1.2.3
```

**Com a ferramenta oficial do Sigstore** (`cosign`):

```sh
cosign verify-blob-attestation --new-bundle-format --type slsaprovenance1 \
  --bundle alumia-1.2.3-windows-x64-setup.exe.sigstore.json \
  --certificate-identity https://github.com/jojoeumermo/perenidade/.github/workflows/apps-lancamento.yml@refs/tags/v1.2.3 \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  alumia-1.2.3-windows-x64-setup.exe
```

A identidade tem de ser **exatamente** essa: o fluxo de lançamento, **na tag da versão**. Uma assinatura válida de outra identidade
(outro repositório, outro fluxo, outra tag) não vale.

## Como o app confere

O pacote Sigstore de cada arquivo (formato `application/vnd.dev.sigstore.bundle.v0.3+json`) traz o atestado (uma declaração in-toto
com o SHA-256 do arquivo), o certificado de dez minutos do Fulcio com a identidade do fluxo e a entrada no Rekor com a prova de
inclusão. O app, no Rust (`nativo/nucleo/src/transparencia.rs`), e o script, no Node (`lib/rede/transparencia-apps/conferir.ts`),
conferem com os clientes oficiais do Sigstore de cada linguagem:

1. o certificado sobe até o Fulcio da raiz de confiança embutida e tem o carimbo (SCT) de um registro de certificados dela;
2. a identidade do certificado é a do fluxo de lançamento na tag da versão, comparada como texto exato, e o emissor é o do GitHub;
3. a assinatura confere com o certificado, e o resumo do arquivo é o da declaração;
4. o corpo da entrada do Rekor é o deste pacote;
5. **a prova de inclusão de Merkle leva essa entrada até um topo do livro, e o topo está assinado pelo Rekor** (com a chave do
   Rekor da raiz de confiança, escolhida pelo id do livro que o pacote declara);
6. **a "promessa" assinada do Rekor** (o corpo, a hora em que a entrada foi ao livro, o id e o índice) confere com a chave do Rekor:
   é ela que prende a hora usada para conferir a janela de dez minutos do certificado;
7. as cópias sem assinatura que o pacote traz (a raiz e o tamanho do livro ao lado da prova; o tipo e a versão da entrada) são as
   mesmas do que está assinado.

Sobre os passos 5 e 6, dito sem rodeio: a versão do cliente Rust do Sigstore que usamos (0.14.0) confere os passos 1 a 4 mas
**ainda não** a prova de inclusão, o topo assinado nem a promessa (está marcado como pendente no próprio código dele). Sem o passo 5,
um pacote com uma entrada inventada, que nunca foi ao livro, passaria; sem o 6, quem tivesse a chave de um certificado vencido
mudaria a hora de entrada para caber na janela dele. Por isso o app faz os passos 5, 6 e 7 com as funções da **mesma** biblioteca (a
prova de Merkle do RFC 6962, a assinatura do topo e a conferência de assinatura com a chave do Rekor), e os testes
(`nativo/nucleo/tests/vetores.rs`) mostram os pacotes adulterados que só esses passos recusam. No Node, o cliente oficial já faz os
passos 5 e 6; o nosso código exige que a prova de inclusão exista (sem ela, a biblioteca aceitaria só a promessa) e faz o 7, para
os dois verificadores darem sempre a mesma resposta.

Os dois verificadores passam pelos mesmos vetores (`scripts/vetores/sigstore/`): um pacote real e público de outro projeto como
positivo, e mais de quinze adulterações dele como negativos.

## Limites

- **Quem tomar o fluxo de lançamento** (a conta do GitHub com permissão de criar tag, ou o próprio GitHub) consegue assinar um
  binário que o app aceita. O que o livro garante é que isso fica **público e permanente**: dá para ver todas as versões já
  assinadas por esta identidade no Rekor.
- **A loja pode instalar por cima.** Quem instala por uma loja recebe o que a loja entrega; o app, ao abrir, confere a si mesmo e
  não abre o chat se a versão não estiver no livro, mas não impede a instalação.
- **Windows e macOS sem a assinatura paga do sistema.** O sistema avisa que o programa é de origem desconhecida. A confiança vem
  do livro e do build reproduzível.
- **A raiz de confiança vai dentro do app.** Se o Sigstore trocar as chaves dele, o app precisa de uma versão nova (a troca é rara
  e anunciada).
- **iPhone**: não há app nesta etapa.

## Android

O APK é montado **sem assinatura** pelo CI, num contêiner com JDK 21, Gradle e o SDK do Android fixados (`android/`), e registrado
no Rekor como os arquivos do computador. A coordenação assina o APK na máquina dela (a chave de produção nunca vai ao CI nem ao
repositório) e um segundo passo confere que o APK assinado, sem o bloco de assinatura, é igual ao do CI (`apksigcopier compare`); o
assinado também vai ao Rekor. Para reproduzir: `docs/APP-LOJA.md`, parte "Build reproduzível".
