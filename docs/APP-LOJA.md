<!-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE). -->
# Aplicativo na Play Store (Capacitor ou TWA)

Etapa 11 (B20), pacote `app-loja`. **Pronto, não publicado.** Publicar tem taxa única da loja e é decisão do Jonathan:
nada aqui cria conta, paga ou envia coisa alguma. A arquitetura da casca do aplicativo está em [APP.md](APP.md); o
roteiro de teste em aparelho em [TESTE-EM-APARELHO-REAL.md](TESTE-EM-APARELHO-REAL.md).

## O que está no repositório

| Arquivo | O que é |
| --- | --- |
| `capacitor.config.ts` | Configuração do Capacitor: `server.url` aponta para `https://institutolucia.org`, pacote `org.institutolucia.app`, agente de usuário com marca `InstitutoLuciaApp/2`. Sem import do Capacitor (o pacote não está instalado). |
| `app-loja/www/index.html` | Página mínima que o Capacitor exige (`webDir`). Só aparece se o site não abrir. Sem script nem rede. |
| `.gitignore` | `android/`, `ios/`, `*.jks` e `*.keystore` ficam de fora: a pasta é gerada na máquina de quem publica (centenas de arquivos que não são código nosso) e a chave de assinatura nunca vai para o repositório. |
| `npm run testar:app-loja` | Confere a configuração e este documento (sem rede). |
| `npm run testar:app-aparelho` | Playwright: Galaxy S24 (navegador e WebView) e celular de entrada contra um `next start` (ver o roteiro de teste). |

`android/` **não foi gerada** de propósito. O passo a passo abaixo a gera em minutos.

Por que `server.url` e não um build estático: o site tem páginas dinâmicas, rotas de API e banco (Supabase). Um build
estático exigiria reescrever isso e exigiria nova versão na loja a cada mudança. Com `server.url`, o aplicativo é o site.

## Escolha: Capacitor ou TWA

| | Capacitor (WebView) | TWA (Bubblewrap, Chrome Custom Tabs) |
| --- | --- | --- |
| O que é | Um aplicativo Android com um WebView que abre o site. | O Chrome do aparelho, sem barra, dentro de um pacote da loja. |
| Código nativo no repositório | A pasta `android/` (gerada) e plugins. | Quase nada: um `twa-manifest.json`. |
| Exige mudança no site | Não. | Sim: `/.well-known/assetlinks.json` com a impressão digital da chave de assinatura (sem ele aparece a barra de endereço). |
| Botão "voltar" do Android | Volta no histórico do WebView e, na raiz, sai do aplicativo (comportamento padrão do `BridgeActivity`, sem plugin). | O Chrome cuida. |
| Agente de usuário | O WebView traz `; wv)` sozinho, e é isso que liga `<html data-app>` (`lib/prefs.ts` só procura `; wv)`); `InstitutoLuciaApp/2` é só marca de versão. | Do Chrome, sem `; wv)`. O site cai no ramo "instalado" (`display-mode: standalone`); com `pointer: coarse` a casca também vale (APP.md). |
| Service worker, voz do aparelho, vídeo | Dependem da versão do WebView do sistema (atualiza pela Play Store). | Os do Chrome, geralmente mais novos e iguais aos do PWA instalado. |
| Plugins nativos (compartilhar arquivo, notificações, biometria) | Sim, quando fizer falta. | Não. |
| Tamanho do pacote | Alguns MB. | Cerca de 1 a 2 MB. |
| Manutenção | Atualizar o Capacitor e o Android Gradle Plugin de tempos em tempos; subir o `targetSdk` quando a loja exigir. | Praticamente só o `targetSdk`. |
| iPhone | O mesmo projeto gera o de iPhone (exige Mac e conta Apple paga por ano; **fora do escopo**). | Não existe TWA no iPhone. |

**Recomendação:** começar pela **TWA** se o objetivo é só estar na loja: é menos código e o site continua sendo o único
programa. Escolher o **Capacitor** se a equipe quiser plugins nativos no futuro (por exemplo, avisos da aula ao vivo) ou
o controle do agente de usuário. A casca funciona nos dois (o gesto com `touchcancel` e a consulta de mídia não dependem
do empacotamento). Não são excludentes: o mesmo `org.institutolucia.app` pode sair por um ou por outro.

## Antes de tudo: a conta de desenvolvedor

1. Conta no Google Play Console: **taxa única de cerca de US$ 25** (valor de 2025; confirme na hora).
2. O Instituto **não tem CNPJ** (plano, "Para depois"), então a conta é de **pessoa física**, no nome do Jonathan. Conta de
   organização exige CNPJ e número D-U-N-S. Se o CNPJ sair depois, a mudança de titular é um pedido à parte.
3. Contas pessoais novas passam por verificação de identidade e, pela regra vigente em 2025, por um **teste fechado**
   (um mínimo de testadores por 14 dias seguidos) antes de liberar a produção. **Confira a regra do dia no Play
   Console**: ela muda. Reserve umas semanas.
4. Ative a verificação em duas etapas na conta Google dona do aplicativo. Perder essa conta é perder o aplicativo.

## Passo a passo com o Capacitor

Na máquina de quem publica: Node 20 ou mais novo, **Android Studio** (traz o JDK e o SDK) e um aparelho ou emulador com
Android 10 ou mais novo.

```bash
# 1. Instalar o Capacitor SÓ nesta máquina, sem gravar no package.json do site:
npm install --no-save @capacitor/core @capacitor/cli @capacitor/android

# 2. Gerar a pasta android/ (usa o capacitor.config.ts do repositório):
npx cap add android
npx cap sync android

# 3. Abrir no Android Studio:
npx cap open android
```

Se a equipe decidir manter o Capacitor, instale com `npm install` (grava no `package.json`) e registre a decisão em
`PROGRESSO.md`. Até lá o site não depende dele (e o rastreio do deploy não cresce).

### Teste local antes de publicar

- Emulador: Android Studio › Device Manager › criar um aparelho de 1080 × 2340 (Pixel 8, que tem a mesma proporção do
  Galaxy S24) com Android 14.
- Contra o site rodando no seu computador: `APP_URL=http://10.0.2.2:3000 npx cap sync android` (10.0.2.2 é o
  `localhost` do computador visto pelo emulador). O `capacitor.config.ts` liga o tráfego em texto puro e a depuração
  **só** quando o endereço começa com `http://`. Depurar: `chrome://inspect` no Chrome do computador.
- Volte ao endereço de produção antes de gerar o pacote da loja: `npx cap sync android` **sem** `APP_URL`.
- Conferir: o visual de aplicativo liga (`<html data-app>`), a barra de baixo tem 5 abas, o botão "voltar" volta uma tela
  por vez e, na raiz de uma aba, sai do aplicativo; navegação por gestos **e** por três botões (APP.md, app-loja).

### Ícone e tela de abertura

Os ícones do site estão em `public/` (`icone-512.png`, `marca-512.png`, `icone-recorte-512.png`). No Android Studio:
botão direito em `res` › New › Image Asset, tipo "Launcher Icons (Adaptive and Legacy)", primeiro plano
`public/icone-recorte-512.png` (a versão recortada deixa folga para as máscaras redondas). Na tela de abertura o Capacitor
usa o ícone sobre fundo branco (`SplashScreen` no `capacitor.config.ts`). Nada de animação nem propaganda.

### Assinatura

A loja exige o pacote **AAB** assinado. Use a **Play App Signing** (a loja guarda a chave final; você guarda só a chave
de envio):

1. Android Studio › Build › Generate Signed Bundle / APK › Android App Bundle › Create new keystore.
2. Guarde o arquivo `.jks` e as senhas **fora do repositório** (o `.gitignore` ignora `*.jks` e `*.keystore`). Faça
   **duas cópias** em lugares diferentes. Sem a chave de envio o aplicativo não recebe atualização (há como pedir a
   troca ao suporte da loja, mas demora).
3. Em `android/app/build.gradle`, `versionCode` sobe de 1 em 1 a cada envio; `versionName` é o que a pessoa vê (comece
   em `1.0.0`). Confira se o `targetSdk` atende ao que o Play Console exige na data (ele avisa, e sobe todo ano).

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

- Versão nova do site **não** exige versão nova do aplicativo (ele abre o site). Só mude o pacote para trocar o ícone,
  subir o `targetSdk`, mudar permissões ou a ficha.
- Mudou a política de privacidade? Reenviar o formulário "Segurança dos dados".
- Anotar em `docs/MANUTENCAO.md` quem tem a conta e onde estão as duas cópias da chave.

## O que NÃO foi feito (de propósito)

- Instalar o Capacitor no `package.json`: aumenta as dependências e o rastreio do deploy sem necessidade enquanto não se
  decidir publicar.
- Gerar `android/`, a chave de assinatura, a conta, mexer no `assetlinks.json` existente e qualquer envio.
- iPhone (App Store): exige Mac e conta paga por ano; fora da etapa.
