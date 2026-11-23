<!-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE). -->
# Aplicativo de Android (Capacitor) e a Play Store

Etapa 11 (B20), pacote `app-loja`, refeito na onda R3 (itens 1.2 e 2.3). **Pronto, não publicado.** Publicar tem taxa única da
loja e é decisão do Jonathan: nada aqui cria conta, paga ou envia coisa alguma. O roteiro de teste em aparelho está em
[TESTE-EM-APARELHO-REAL.md](TESTE-EM-APARELHO-REAL.md).

## O que mudou na onda R3

Antes, o app era um WebView que abria o site (`server.url`): todo o código, inclusive o das chaves do chat, vinha do servidor a
cada abertura. Agora o app leva **dentro do pacote** a casca do chat (`casca/`, um projeto Next estático): o motor de cifra, as
telas do chat e as chaves ficam no aparelho, e **nenhum código de chave vem de servidor**. A rede social continua sendo o site, mas
abre **fora** da casca, numa tela própria sem ponte nenhuma com o nativo e em outro processo.

## O que está no repositório

| Arquivo | O que é |
| --- | --- |
| `capacitor.config.ts` | Pacote `org.institutolucia.app`, `webDir` = `casca/saida`. **Sem** `server.url` e **sem** `allowNavigation`: nenhuma página remota no WebView que tem a ponte. Nenhum plugin do npm (`includePlugins: []`). |
| `casca/` | A casca do chat: `casca/montar.mjs` copia os WebAssembly do chat, monta o Next estático em `casca/saida` e põe a política de segurança (CSP) em cada HTML. |
| `android/` | O projeto Android (Capacitor 8.6.0), **sem chave nenhuma**. Plugins próprios em `android/app/src/main/java/org/institutolucia/app/`: `AlumiaCofre` (Keystore/StrongBox, contagem das senhas erradas, apagar tudo), `AlumiaApp` (disfarce, notificação sem conteúdo, rede social fora da casca, link de fora só com confirmação). |
| `lib/rede/casca/` | A interface comum dos apps (`plataforma.ts`), a do Android (`android.ts`) e a trava do app (`trava.ts`). |
| `.gitignore` | `casca/saida`, `casca/public/cifra`, o que o `cap sync` gera dentro de `android/`, `*.jks` e `*.keystore`. |
| `scripts/testar-r3-android-casca.mjs` | A casca e a trava no Node, com plugins falsos (ataques escritos como teste). |
| `scripts/testar-r3-android-manifesto.mjs` | O manifesto, a configuração e o código nativo (sem aparelho). |
| `scripts/testar-r3-android-build.mjs` | Monta o pacote duas vezes, em pastas diferentes, e compara byte a byte. |
| `scripts/testar-r3-android-aparelho.mjs` | No emulador: instala o pacote, confere o manifesto do APK, roda os testes instrumentados e as provas de reiniciar, desligar à força e apagar no meio. |
| `npm run testar:app-loja` | Confere a configuração e este documento (sem rede). |

## Segurança do app (celular apreendido)

- **Chaves no cofre do aparelho**: uma chave AES-256-GCM não exportável no Android Keystore, no **StrongBox** quando o aparelho
  tem (senão no TEE), embrulha o que o app guarda (a senha do app; a loja do chat entra pela junção). Só serve com o aparelho
  destravado. A tela de ajustes diz onde a chave ficou.
- **Senha do app e trava automática**: o chat só aparece depois da senha do app (Argon2id). Trava ao ir para o fundo e depois de
  1 a 30 minutos parado (o padrão é 2).
- **Senha de pânico**: a da Alumia (onda 11), digitada na trava ou na entrada, tira a conta real do aparelho e abre a conta isca.
- **Apagar depois de X senhas erradas**: **desligado por padrão**; ligado (3 a 50), com aviso na tela. A tentativa é contada no
  disco **antes** de a senha ser conferida: desligar o aparelho no meio não dá tentativa grátis. Ao chegar no limite, o app apaga a
  chave do cofre e **todos** os dados dele (`clearApplicationUserData`).
- **Nome e ícone disfarçados**: "Instituto Lúcia", "Calculadora" ou "Notas" (nos ajustes).
- **Nada na tela bloqueada**: a notificação é só "Nova mensagem", escondida na tela bloqueada (`VISIBILITY_SECRET`). O app não usa
  serviço de notificação do Google: só avisa enquanto está rodando.
- **Captura de tela bloqueada** (`FLAG_SECURE`) e a foto da troca de apps em branco; **teclado sem aprendizado** nos campos (o
  WebView do app pede `IME_FLAG_NO_PERSONALIZED_LEARNING`; é um pedido, e teclados de terceiros podem ignorar).
- **Nada na cópia do sistema**: `allowBackup="false"` e regras que excluem tudo da nuvem e da transferência entre aparelhos.
- **Modo sem internet (Bluetooth LE)**: só quando a pessoa ativa, com o aviso; só Android 12+ (a procura usa `neverForLocation`:
  o app não pede localização). O anúncio leva só o identificador do serviço da Alumia, sem nome do aparelho; o endereço Bluetooth
  é o aleatório do Android e não sai do nativo. O nativo só move bytes: o que guardar, repassar e entregar é do núcleo
  (`lib/rede/malha/**`, documento público em `docs/rede/SEM-INTERNET.md`).
- **Trocar o nome do app fecha a tela** (o sistema fecha a tarefa aberta pelo nome antigo): abra de novo pelo nome novo.
- **Nenhum link abre ação sem confirmação**: o app não tem filtro de link (deep link); a casca não navega para fora (o que não é
  dela é bloqueado); endereço de fora só depois de uma confirmação nativa com o endereço inteiro.

## Antes de tudo: a conta de desenvolvedor

1. Conta no Google Play Console: **taxa única de cerca de US$ 25** (valor de 2025; confirme na hora).
2. O Instituto **não tem CNPJ** (plano, "Para depois"), então a conta é de **pessoa física**, no nome do Jonathan. Conta de
   organização exige CNPJ e número D-U-N-S. Se o CNPJ sair depois, a mudança de titular é um pedido à parte.
3. Contas pessoais novas passam por verificação de identidade e, pela regra vigente em 2025, por um **teste fechado**
   (um mínimo de testadores por 14 dias seguidos) antes de liberar a produção. **Confira a regra do dia no Play
   Console**: ela muda. Reserve umas semanas.
4. Ative a verificação em duas etapas na conta Google dona do aplicativo. Perder essa conta é perder o aplicativo.

## Passo a passo do pacote

Na máquina de quem monta: Node 24, **JDK 21** e o **Android SDK** (plataforma 36, build-tools 36). O Capacitor (8.6.0, versão
exata) já está nas dependências do projeto (`npx cap add android` não é mais preciso: a pasta `android/` está no repositório).

```bash
# 1. A casca do chat (estática), com o endereço do serviço de contas de produção:
NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… node casca/montar.mjs

# 2. Copiar a casca para dentro do projeto Android (o cap sync, e o caminho do Capacitor de volta para ../node_modules):
node casca/android.mjs

# 3. O pacote de lançamento SEM assinatura:
cd android && ./gradlew assembleRelease     # → app/build/outputs/apk/release/app-release-unsigned.apk
```

Abrir no **Android Studio** é opcional (`npx cap open android`).

### Build reproduzível

Duas montagens do mesmo commit, em pastas diferentes, dão o **mesmo** `app-release-unsigned.apk` byte a byte (conferido por
`node scripts/testar-r3-android-build.mjs`, que monta duas vezes e compara). O que garante isso:

- a casca: `generateBuildId` fixo pela versão, `SOURCE_DATE_EPOCH`, sem mapas de código, os números de módulo do webpack
  tirados do nome **sem** a pasta do repositório (a mesma casca em qualquer pasta), e o resumo da árvore em `casca/arvore.sha256`;
- o Android: versões fixas (Capacitor 8.6.0, Android Gradle Plugin e Gradle do `gradle-wrapper.properties`, com o resumo SHA-256
  da distribuição), **sem** a informação do git no pacote (`vcsInfo`), **sem** o bloco de dependências do Google
  (`dependenciesInfo`) e sem assinatura;
- o mesmo JDK (21) e o mesmo SDK. Limite dito: máquinas com JDK ou build-tools diferentes podem gerar bytes diferentes; o roteiro
  fixa as versões.

Para conferir um APK assinado contra o do build reproduzível, compare sem o bloco de assinatura (por exemplo com
`apksigcopier compare`, ou tirando a assinatura e comparando o resto).

### Assinatura

A chave de assinatura **nunca** fica no projeto, no CI nem no disco do repositório. O pacote sai sem assinatura e o Jonathan assina
na máquina dele (a **Play App Signing** guarda a chave final da loja; você guarda só a chave de envio):

```bash
apksigner sign --ks /caminho/fora/do/projeto/alumia.jks --out alumia-0.1.0.apk app-release-unsigned.apk
apksigner verify --print-certs alumia-0.1.0.apk
```

Para a loja, o pacote é o **AAB** (`./gradlew bundleRelease`). Guarde o `.jks` e as senhas **fora do repositório** (o `.gitignore`
ignora `*.jks` e `*.keystore`), em **duas cópias**. `versionCode` sobe de 1 em 1 a cada envio. Confira se o `targetSdk` atende ao
que o Play Console exige na data.

### Teste no emulador

- O pacote de **teste** (expõe o cofre, a trava e o chat à prova, pela depuração do WebView; o de lançamento não leva isso):
  `NEXT_PUBLIC_CASCA_TESTE=1 ALUMIA_APP_DEPURAR=1 node casca/montar.mjs`, `ALUMIA_APP_DEPURAR=1 node casca/android.mjs` e
  `cd android && ./gradlew :app:assembleDebug :app:assembleDebugAndroidTest`.
- Com um emulador ligado: `node --experimental-wasm-jspi --experimental-wasm-exnref --import ./scripts/carregar-ts.mjs
  scripts/testar-r3-android-aparelho.mjs` instala, roda os testes instrumentados e as provas (reiniciar o aparelho, desligar à
  força, apagar no limite, sincronia interrompida). `--sem-reiniciar` pula as duas reinicializações.
- **O chat precisa do Android System WebView 137 ou mais novo** (o motor de cifra usa o JSPI do WebAssembly). A imagem AOSP do
  emulador traz um WebView antigo (124): nela todo o resto roda, e a prova do chat aparece como **não conferida**. Num aparelho
  com o WebView atualizado pela loja, a prova do chat roda; sem ele, a casca diz "atualize o Android System WebView".
- O lado nativo do modo sem internet (corte em pedaços, pares, tetos) roda sem aparelho: `cd android && ./gradlew
  :app:testDebugUnitTest` (transporte falso; o emulador não tem Bluetooth).
- Contra o site no seu computador: `ALUMIA_APP_BASE=http://10.0.2.2:3000 NEXT_PUBLIC_ALUMIA_APP_BASE=http://10.0.2.2:3000` na
  montagem. **Só o pacote de depuração** aceita `http` (para 10.0.2.2 e 127.0.0.1); o de lançamento recusa texto puro.
- Depurar o WebView: `ALUMIA_APP_DEPURAR=1 node casca/android.mjs` e `chrome://inspect`. Nunca no pacote da loja.

### Enviar

Play Console › Criar app › idioma padrão **Português (Brasil)** › aplicativo (não jogo) › gratuito. Comece pelo **Teste
interno** e pelo **Teste fechado** (exigido para contas novas) antes da **Produção**. Envie o `.aab`.

## Passo a passo com a TWA (Bubblewrap)

```bash
npm install -g @bubblewrap/cli
mkdir app-twa && cd app-twa            # fora do repositório do site
bubblewrap init --manifest=https://institutolucia.org/manifest.webmanifest
bubblewrap build                        # gera o .aab e imprime a impressão digital SHA-256 da chave
```

Depois: (1) pegar a impressão digital que o Bubblewrap mostra (ou, com a Play App Signing, a da **chave de assinatura do
aplicativo** em Play Console › Integridade do app); (2) publicar `public/.well-known/assetlinks.json` no site com o
`package_name` `org.institutolucia.app` e essa impressão (**o arquivo já existe** em `public/.well-known/assetlinks.json`, do commit da biometria nativa, com o pacote
`org.institutolucia.app` e uma impressão digital: confira se ela é a da chave que de fato vai assinar o aplicativo na Play
Store e acrescente a da Play App Signing se for outra); (3) conferir que `https://institutolucia.org/.well-known/assetlinks.json` responde 200 em
`application/json`, sem redirecionamento. Sem isso aparece a barra de endereço do Chrome.

## Ficha da loja

Rascunho em português para o Jonathan revisar. A ficha é conteúdo público: nada de promessa que o site não cumpra, nada
de "universidade" nem "diploma".

- **Nome:** Instituto Lúcia
- **Descrição curta (até 80 caracteres):** Estudo livre, gratuito e sem anúncios. Seus dados ficam no seu aparelho.
- **Descrição completa:** trilhas de estudo do alfabetizar ao ensino superior, jogos e laboratórios de prática, comunidade e
  aulas ao vivo; funciona sem internet nas páginas já abertas; sem anúncios e sem rastreamento; código aberto (AGPL-3.0).
  Conferir cada frase com o que está de fato ligado em produção: as áreas "escola", "vale o escrito" e "rede v2" estão
  desligadas, e **não** entram na ficha enquanto estiverem.
- **Categoria:** Educação. **Contato:** o e-mail público e o endereço do site (`lib/site.ts`).
- **Imagens exigidas:** ícone 512 × 512 (`public/icone-512.png`); gráfico de destaque 1024 × 500 (a fazer); de 2 a 8
  capturas de tela do celular (1080 × 2340, do emulador). Sem foto de pessoa.
- **Idiomas da ficha:** começar só em português. En/es/fr/ru/zh do site seguem como rascunho marcado: não anunciar na loja.

## Política de privacidade

A loja exige um **endereço público** da política: `https://institutolucia.org/pt/privacidade` (a página já existe, em
`app/[lang]/privacidade/page.tsx`). Ela precisa estar atualizada antes do envio: a Etapa 12 do plano a atualiza (12 eixos
agregados, envio de fontes, sincronização por QR, aula ao vivo e este aplicativo). **Não envie à loja antes disso.**

### Formulário "Segurança dos dados" (Data safety)

Responder com o que o código faz de verdade, e reconferir a cada versão:

- O aplicativo em si **não tem SDK de anúncio, de estatística nem de rastreio**, não usa identificador de publicidade e
  não pede câmera, microfone, localização nem contatos. O `AndroidManifest.xml` gerado deve trazer só `INTERNET`
  (conferir depois de gerar e tirar o que o Capacitor trouxer a mais).
- O progresso de estudo, as preferências e o que se escreve nas ferramentas **ficam no aparelho** (`localStorage` e
  IndexedDB). Nada sai sem a pessoa pedir (APP.md, "Privacidade").
- Sai dado do aparelho **por ação da pessoa**: criar conta e entrar (e-mail e senha, no Supabase), mensagem na
  comunidade, relato de erro, voluntariado. Esses itens entram como "coletado, ligado à conta, não compartilhado com
  terceiros, não usado para publicidade", para "funcionalidade do aplicativo" e "gerenciamento de conta". Confirmar a lista
  final com `/pt/privacidade` e com a coordenação.
- Criptografia em trânsito: sim (HTTPS). Exclusão de dados: a loja pede um endereço para a pessoa pedir a exclusão da
  conta; usar o da página de privacidade.
- Não participar do programa "Famílias" (ver abaixo).

## Classificação etária e o ECA Digital (Lei nº 15.211/2025)

Conferido no texto da lei, em `planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm` (consulta de 05/11/2026):

- **Vigência (art. 41-A):** 17 de março de 2026 (redação da Lei nº 15.352/2026). Ou seja, **já vale**.
- **Âmbito (art. 1º e parágrafo único):** todo produto ou serviço de tecnologia da informação direcionado a crianças e
  adolescentes **ou de "acesso provável"** por eles (uso e atratividade, facilidade de acesso, risco à privacidade, à
  segurança ou ao desenvolvimento). O art. 2º, I inclui aplicativos e lojas de aplicações. O Instituto ensina desde a
  alfabetização e tem uma área infantil (`/criancas`): **trate o aplicativo como de acesso provável por menores**, ainda
  que não seja só para eles.
- **Padrão de maior proteção (art. 7º):** configuração inicial no nível mais alto de privacidade, com informação clara.
  O aplicativo já nasce sem rastreio e sem perfil; manter.
- **Publicidade e perfis (arts. 22 e 26):** vedado criar perfis de crianças e adolescentes para publicidade. O Instituto
  não tem publicidade nem perfil comportamental; **não introduzir**.
- **Idade (arts. 9º e 13):** verificar a idade (não basta autodeclarar) é dever de quem oferece conteúdo impróprio a
  menores; o Instituto não oferece. Se um dia oferecer, os dados da aferição só servem a esse fim (art. 13).
- **Lojas e sistemas (art. 12):** quem afere a idade e envia o sinal de faixa etária é a **loja** (Google); menores
  dependem de consentimento parental para baixar (§§ 2º e 3º). O aplicativo **não pede idade de novo nem guarda o sinal**.
- **Relatório de impacto (art. 16, parágrafo único):** só se trata dado de menor além do estritamente necessário. Hoje não
  se trata (CRIANCAS-CONFORMIDADE.md); se mudar, fazer antes.
- **Regulamento:** o art. 12, § 3º remete a decreto do Executivo (requisitos mínimos). **Reconferir o decreto e a atuação
  da autoridade fiscalizadora** no `planalto.gov.br` na data do envio. Esta lista é a leitura da lei, não parecer
  jurídico; se o Jonathan quiser segurança, peça revisão a quem seja da área.

### Questionário de classificação (IARC, no Play Console)

Responder pelo que o aplicativo tem, não pelo que se deseja. Hoje: sem violência gráfica, sem sexo, sem drogas, sem jogo
de azar, sem compras dentro do aplicativo, sem localização compartilhada; **há interação entre usuários** (comunidade) e
aulas sobre temas sensíveis (história, política, saúde) em tom de aula. Declare as duas coisas e **aceite a faixa que o
questionário devolver**. A expectativa é uma faixa baixa, mas o resultado vale mais que a expectativa. A classificação
indicativa brasileira vem do mesmo questionário. Se a comunidade subir a faixa, não esconder a comunidade para baixá-la:
a faixa serve à proteção (art. 8º, II e V).

No **público-alvo**, marcar **13 anos ou mais**. A área infantil existe no site, mas é usada com adulto por perto
(`/criancas/adultos`); marcar "inclui crianças" aciona a Política para Famílias da Google, que o Instituto hoje não
cumpre por inteiro. **Decisão do Jonathan:** se quiser a área infantil no aplicativo para menores de 13, reler essa
política antes.

## Depois de publicar

- Versão nova do **chat** exige versão nova do app (a casca vai dentro do pacote: é o que garante que nenhum código de chave vem do
  servidor). Versão nova da rede social, não (ela abre o site).
- Mudou a política de privacidade? Reenviar o formulário "Segurança dos dados".
- Anotar em `docs/MANUTENCAO.md` quem tem a conta e onde estão as duas cópias da chave.

## O que NÃO foi feito (de propósito)

- A chave de assinatura de produção, a conta, mexer no `assetlinks.json` existente e qualquer envio.
- iPhone (App Store): fora (decisão do dono, 18/11/2026). A casca é a mesma; o cofre seria um plugin com a mesma interface.
- A alternativa TWA (acima) continua documentada, mas **não serve ao chat**: na TWA todo o código viria do site.
