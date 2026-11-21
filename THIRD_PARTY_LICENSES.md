# Licenças de terceiros

Bibliotecas, dados e fontes de terceiros que o site serve do próprio domínio, com a licença de cada um. A lista
completa, com links, está em /pt/creditos. O código do instituto é AGPL-3.0-or-later (LICENSE) e o conteúdo,
CC BY-SA 4.0 (LICENSE-CONTEUDO.md).

## Dados servidos em public/dados

| O quê | Onde | Origem | Licença | Observação |
| --- | --- | --- | --- | --- |
| CC-CEDICT | public/dados/chines/cedict.json.gzip | MDBG e colaboradores, https://www.mdbg.net/chinese/dictionary?page=cedict | CC BY-SA 4.0 | Convertido do formato texto para JSON por scripts/dados-chines.mjs; a conversão é distribuída sob a mesma licença. Versão e data da extração em public/dados/chines/meta.json. |
| Traços de caracteres (Make Me a Hanzi) | public/dados/chines/hanzi/ | pacote hanzi-writer-data 2.0.1, https://github.com/chanind/hanzi-writer-data, a partir das fontes AR PL da Arphic | Arphic Public License (public/dados/chines/hanzi/ARPHICPL.TXT) | Recorte de caracteres comuns copiado sem alteração do conteúdo; só o nome de cada arquivo passa a ser o código Unicode do caractere. |
| VERO, dicionário de português do Brasil | public/dados/ortografia/ | Raimundo Moura e equipe (LibreOffice), pelo pacote dictionary-pt 4.0.0 | LGPL-3.0 ou MPL-2.0 (public/dados/ortografia/LICENCA-VERO.txt) | Os arquivos .aff e .dic, sem alteração, comprimidos com gzip. |

## Bibliotecas novas

| O quê | Versão | Licença |
| --- | --- | --- |
| hanzi-writer | 3.7.3 | MIT |
| hanzi-writer-data (só para gerar os dados; não vai para o navegador) | 2.0.1 | Arphic Public License |
| dictionary-pt (só para copiar o dicionário) | 4.0.0 | LGPL-3.0 ou MPL-2.0 (dicionário), MIT (pacote) |
| jsQR (lê o QR pela câmera do "Levar o progresso" e do código de segurança do chat privado da Alumia, só quando o navegador não tem leitor nativo; carregado sob demanda) | 1.4.0 | Apache-2.0 |
| qrcode (desenha no aparelho o QR do "Levar o progresso" e o do código de segurança do chat privado da Alumia; carregado sob demanda) | 1.5.4 | MIT |
| @wireapp/core-crypto (a cifra do chat da Alumia: Proteus, o Double Ratchet da conversa a dois, e OpenMLS, o MLS dos grupos, do chat da equipe e da chave da sala de voz; docs/rede/CHAT-PRIVADO.md e docs/rede/POSTS-RESTRITOS.md; versão exata; o WebAssembly é servido pelo próprio site e carregado só quando o chat ou um grupo abre) | 11.0.1 | GPL-3.0 |
| libsodium-wrappers-sumo, libsodium-sumo (Argon2id das senhas digitadas no aparelho, XChaCha20-Poly1305 dos embrulhos e dos cofres, X-Wing do voto em limiar; versão exata) | 0.8.4 | ISC |
| @cloudflare/privacypass-ts, @cloudflare/voprf-ts, @cloudflare/blindrsa-ts (passes anônimos, Privacy Pass VOPRF, RFC 9578: os limites de uso do chat sem dizer de quem é o passe) | 0.9.0, 1.0.0, 0.4.6 | Apache-2.0, BSD-3-Clause, Apache-2.0 |
| shamir-secret-sharing (as partes da chave da votação secreta, K de N guardiãs) | 0.0.4 | Apache-2.0 |
| @scure/bip39 (as 24 palavras da cópia de segurança do chat) | 2.4.0 | MIT |
| @hpke/core, @hpke/common, @hpke/dhkem-x25519, @hpke/hybridkem-x-wing, @hpke/chacha20poly1305 (HPKE, RFC 9180: o envelope pós-quântico da conversa a dois, os pedidos de conversa e de entrada no núcleo e o canal de ligar aparelho; X-Wing = X25519 + ML-KEM-768) | 1.9.0, 1.13.0, 1.8.x, 0.7.0, 1.8.0 | MIT |
| mlkem (ML-KEM do X-Wing) | 2.7.0 | MIT |
| @noble/post-quantum, @noble/curves, @noble/hashes, @noble/ciphers (Ed25519 das identidades, HKDF, HMAC da denúncia com prova; versões exatas) | 0.5.2, 2.0.1, 2.0.1, 2.1.1 | MIT |
| ts-mls (só nos testes: o teste cruzado do MLS contra o OpenMLS; não vai para o site) | 1.6.4 | MIT |
| asn1js, pvtsutils, pvutils (dependências indiretas dos passes anônimos, pela @cloudflare/blindrsa-ts e pela @cloudflare/privacypass-ts) | 3.0.5, 1.3.6, 1.2.0 | BSD-3-Clause, MIT, MIT |
| asn1-parser (dependência indireta dos passes anônimos; o pacote npm não traz arquivo de licença: vale o SPDX do package.json, o arquivo distribuído traz só o Anexo A da MPL-2.0, sem a cláusula "Incompatible With Secondary Licenses": veja abaixo) | 1.1.8 | MPL-2.0 |
| quicvarint, rfc4648 (dependências indiretas dos passes anônimos) | 0.1.4, 1.5.3 | MIT |
| sjcl (dependência indireta da @cloudflare/blindrsa-ts; o tipo RSA cego nem é chamado pela Alumia) | 1.0.9 | BSD-2-Clause OR GPL-2.0-only: a Alumia o usa pela BSD-2-Clause (a GPL-2.0-only não é compatível com a AGPL-3.0) |
| @noble/curves e @noble/hashes aninhados na @cloudflare/voprf-ts; @noble/hashes aninhado na @scure/bip39 | 1.5.0 e 1.4.0; 2.4.0 | MIT |
| spqr, o "Sparse Post-Quantum Ratchet" do Signal (a camada pós-quântica da conversa a dois da Alumia, compilada para WebAssembly em `nativo/spqr-wasm` e servida como `/cifra/spqr-1.7.0.wasm`; docs/rede/CHAT-PRIVADO.md) | 1.7.0 (tag v1.7.0, commit 3a69df8f01179fce970693f072b710a8ab8dc6c2) | AGPL-3.0-only |
| libcrux-ml-kem, libcrux-hmac, libcrux-sha2, libcrux-sha3, libcrux-hacl-rs, libcrux-intrinsics, libcrux-macros, libcrux-platform, libcrux-secrets, libcrux-traits (Cryspen; o ML-KEM-768 formalmente verificado, dentro do WebAssembly do SPQR) | 0.0.10, 0.0.8, 0.0.8, 0.0.10, 0.0.5, 0.0.8, 0.0.3, 0.0.3, 0.0.6, 0.0.8 | Apache-2.0 |
| crates de apoio dentro do WebAssembly do SPQR: hkdf, hmac, sha2, digest, chacha20, rand, rand_core, rand_chacha, getrandom, prost, bytes, hax-lib, sorted-vec, thiserror, num_enum, zerocopy e as dependências deles (a lista inteira, com versão, está no `nativo/spqr-wasm/Cargo.lock`) | as do `Cargo.lock` | MIT OR Apache-2.0, salvo: prost, hax-lib e sorted-vec (Apache-2.0); bytes e winnow (MIT); zerocopy (BSD-2-Clause OR Apache-2.0 OR MIT); num_enum (BSD-3-Clause OR MIT OR Apache-2.0); memchr (Unlicense OR MIT); unicode-ident ((MIT OR Apache-2.0) AND Unicode-3.0) |
| sigstore (npm; só nos scripts e no CI: confere se um arquivo dos apps está no Rekor, scripts/conferir-app.mjs) | 5.0.0 | Apache-2.0 |
| @tauri-apps/cli, @tauri-apps/api (montar o app do computador) | 2.12.4 | Apache-2.0 OR MIT |
| App do computador (desktop/src-tauri, Rust): tauri, tauri-build, tauri-plugin-single-instance, tauri-plugin-notification, tauri-plugin-opener | 2.12.5, 2.7.4, 2.5.5, 2.8.0, 2.7.2 | Apache-2.0 OR MIT |
| Núcleo do computador (nativo/nucleo, Rust): sigstore (só a conferência), aes-gcm, keyring, reqwest (com rustls), sha2, serde, serde_json, base64, zeroize, thiserror; as dependências indiretas, com versão exata, estão nos Cargo.lock (a lista completa com as licenças sai de `cargo about` ou do `cargo-license` sobre eles) | 0.14.0, 0.10.3, 4.2.0, 0.13.5, 0.10.9, 1.0.229, 1.0.154, 0.22.1, 1.9.1, 2.0.21 | Apache-2.0 (sigstore); Apache-2.0 OR MIT (os demais) |
| Raiz de confiança do Sigstore (public/apps/raiz-sigstore.json, o trusted_root.json público do @sigstore/tuf 5.0.1) e os vetores de scripts/vetores/sigstore (do sigstore-python 4.5.1) | — | Apache-2.0 |
| Crates do servidor do chat separado (nativo/servidor-chat; não vão ao site): axum, tokio, tokio-postgres, deadpool-postgres, ring, rustls, reqwest, serde_json, base64, spki, subtle (e 170 dependências indiretas pelo Cargo.lock) | 0.8.9, 1.54.1, 0.7.18, 0.14.2, 0.17.14, 0.23.45, 0.13.5, 1.0.154, 0.22.1, 0.8.1, 2.6.1 | MIT; MIT; MIT/Apache-2.0; MIT/Apache-2.0; Apache-2.0 AND ISC; Apache-2.0/ISC/MIT; MIT/Apache-2.0; MIT/Apache-2.0; MIT/Apache-2.0; Apache-2.0/MIT; BSD-3-Clause. As indiretas: MIT/Apache-2.0 na maioria, Unicode-3.0 (icu_*), ISC (rustls-webpki, untrusted), CDLA-Permissive-2.0 (webpki-root-certs), todas compatíveis com a AGPL-3.0 |

**O código-fonte do WebAssembly da @wireapp/core-crypto.** O site serve o `.wasm` compilado do pacote (copiado para `public/cifra/`
no build, fora do git). O pacote npm não traz o arquivo da licença e o SPDX dele diz só `GPL-3.0`. Conferido em 18/11/2026 no
repositório de origem, <https://github.com/wireapp/core-crypto>, na tag `v11.0.1` (commit `20babc2ae47cbd0b2edd8ce32d0bb955317a9f14`,
a versão que o `package-lock.json` fixa): o arquivo `LICENSE` é o texto da GPL versão 3 (sha256
`198fa22b0f276c8810470fbb3cec7fac6fb48473092daeb150668c1610a7f52f`, sem permissão adicional) e os `Cargo.toml` dos crates `crypto` e
`crypto-ffi` dizem `GPL-3.0-only`. GPL-3.0-only junto da AGPL-3.0-or-later da Alumia: a seção 13 da GPLv3 e a da AGPLv3 permitem a
combinação (cada parte segue com a própria licença). O código-fonte correspondente é o dessa tag; o texto da GPL-3.0 está em
<https://www.gnu.org/licenses/gpl-3.0.txt>. O README do repositório lembra que a marca Wire não é licenciada (a Alumia não a usa).

**A cláusula do asn1-parser.** O arquivo `asn1-parser.js` do pacote 1.1.8 traz o aviso do Anexo A da MPL-2.0 e **não** traz o do Anexo
B ("Incompatible With Secondary Licenses"): pela seção 3.3 da MPL-2.0, pode ir junto de código sob GPL/AGPL. Conferido em 18/11/2026 no
próprio arquivo distribuído (o repositório de origem indicado no pacote, git.coolaj86.com, não foi consultado).

**O código-fonte do WebAssembly do SPQR.** O `.wasm` servido em `/cifra/spqr-1.7.0.wasm` é montado a partir de `nativo/spqr-wasm/`
(neste repositório: a cola, o `Cargo.toml` e o `Cargo.lock`) e do crate `spqr` do repositório de origem,
<https://github.com/signalapp/SparsePostQuantumRatchet>, na tag v1.7.0, sob a AGPL-3.0-only (compatível com a AGPL-3.0-or-later da
Alumia: a obra junta fica sob a AGPL-3.0). O roteiro para refazer o mesmo arquivo, byte a byte, está em `nativo/spqr-wasm/MONTAR.md`.
A licença foi lida no `Cargo.toml` da tag; o arquivo `LICENSE` inteiro do repositório de origem não foi conferido nesta revisão.

## Vozes naturais do "Ouvir a aula" (public/vozes, fora do Git)

Baixadas por `npm run vozes:baixar` (scripts/vozes-baixar.mjs), em revisão fixa e com sha256 conferido. Rodam no
aparelho de quem ouve; o site não envia texto para lugar nenhum. Licenças conferidas em 02/11/2026 nas páginas
oficiais (detalhes em docs/VOZES.md).

| O quê | Versão | Origem | Licença | Observação |
| --- | --- | --- | --- | --- |
| onnxruntime-web | 1.22.0 (npm) | https://github.com/microsoft/onnxruntime | MIT | Roda os modelos (WebAssembly). Copiado do node_modules sem alteração. |
| piper_phonemize em WebAssembly (pacote @diffusionstudio/piper-wasm) | 1.0.0 (npm) | https://github.com/diffusion-studio/piper-wasm, compilado de https://github.com/wide-video/piper-phonemize (MIT) e https://github.com/rhasspy/espeak-ng | MIT (piper-phonemize) + GPL-3.0-or-later (espeak-ng) | O binário junta os dois: vale a GPL-3.0, compatível com a AGPL-3.0 do site. Do pacote de dados do espeak-ng ficam só os arquivos do português (os outros saem; nenhum arquivo é mudado). Código-fonte correspondente: os dois repositórios acima e o roteiro de compilação no README do pacote. |
| Kokoro-82M v1.0, em ONNX (model_quantized.onnx, tokenizer.json) | Hugging Face onnx-community/Kokoro-82M-v1.0-ONNX, revisão 1939ad2a8e416c0acfeecc08a694d14ef25f2231 | https://huggingface.co/hexgrad/Kokoro-82M | Apache-2.0 | Pesos treinados só com áudio de licença permissiva ou sem direitos, segundo o cartão do modelo. |
| Vozes pf_dora e pm_alex do Kokoro | mesma revisão | idem | Apache-2.0 | Mostradas como "Voz 1" e "Voz 2". A pm_santa ficou de fora (nome de personagem). |
| Vozes af_heart, am_michael (inglês), ef_dora, em_alex (espanhol) e ff_siwis (francês) do Kokoro | mesma revisão | idem | Apache-2.0 | Usadas sozinhas nos trechos desses idiomas. A ff_siwis foi treinada com a base SIWIS (CC BY 4.0), segundo o cartão de vozes. |
| Piper (código) | — | https://github.com/rhasspy/piper | MIT | O site não usa o programa, só o formato dos modelos. |
| Vozes pt_BR do Piper (faber, cadu, jeff, edresson) | rhasspy/piper-voices, revisão b4e358ffcb232591bf73a540e70f7de528e4174a | https://huggingface.co/rhasspy/piper-voices | Incerta: FORA do site | Dados em português CC0 (CC BY 4.0 na edresson), mas cada modelo foi ajustado a partir de uma voz inglesa cuja base não permite uso comercial (lessac: Blizzard 2013, só pesquisa; ryan: CC BY-NC-SA 4.0). Só baixa com --com-bloqueadas, para teste local. |
