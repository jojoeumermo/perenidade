# Entrar com a digital — o que falta configurar

O código do site está pronto, mas a entrada pela digital só funciona depois de três configurações que ficam
fora deste repositório: no painel do Supabase, no projeto do Android Studio e em um arquivo publicado no site.
Enquanto elas não forem feitas, o botão aparece e mostra uma mensagem de erro; a entrada por senha continua igual.

## Como funciona, em uma frase

O celular cria uma "chave de acesso" (passkey, padrão WebAuthn) presa à digital; o Supabase guarda só a metade
pública dessa chave. A digital nunca sai do aparelho.

- **Cadastrar:** painel → Minha conta → "Entrar com a digital" → "Cadastrar a digital deste aparelho".
- **Entrar:** tela Entrar → "Entrar com a digital". Não pede e-mail.
- **Remover um aparelho:** na mesma seção do painel.
- Quem tem aplicativo autenticador continua devendo o código de seis números depois da digital.

## Um limite que o código não resolve: "só impressão digital"

O site não escolhe o método de desbloqueio. Ele pede ao Android "confirme que é o dono do aparelho", e o
Android oferece o que estiver configurado: digital, e também rosto ou PIN da tela, se o aparelho os aceitar
para esse fim. Não existe, no padrão WebAuthn, um jeito de proibir o rosto. O que foi feito: a interface e os
textos falam só em digital. Para garantir digital de verdade, a pessoa não deve cadastrar rosto no aparelho.

## 1. Supabase (painel de produção)

Atenção: este trecho foi escrito sem acesso ao seu painel. Os valores abaixo são os que o código exige; o
nome exato do menu pode ser diferente do que está aqui.

1. Abra o projeto de produção em supabase.com e vá em **Authentication**.
2. Procure a opção **Passkeys** (ou **WebAuthn**). Ela pode estar em **Sign In / Providers** ou em uma seção
   própria. Se não existir em lugar nenhum, o recurso ainda não está liberado para o seu projeto: nesse caso
   pare aqui e me avise, porque nada do resto funciona sem ele.
3. Ligue a opção e preencha:
   - **Relying Party ID** (RP ID): `institutolucia.org` (só o domínio, sem `https://` e sem barra).
   - **Origens permitidas** (RP origins): `https://institutolucia.org,android:apk-key-hash:kO-IAXzLg7D8O13oQj6j_wi-oM_k_xHv7-mK0-RuXgI`.
     A segunda origem é o próprio aplicativo: dentro do APK, o Android assina o pedido com a impressão do certificado
     (convertida em base64url), não com o endereço do site. Sem ela, a digital funciona no Chrome e falha no aplicativo.
     O valor acima é o do certificado de teste (debug); quando houver versão da loja, acrescente a dela, separada por vírgula.
     Para calcular a partir da impressão SHA-256 (`AA:BB:…`): `node -e "console.log('android:apk-key-hash:'+Buffer.from('AABB…'.replace(/:/g,''),'hex').toString('base64url'))"`.
     Se o site também responde em `www`, acrescente `https://www.institutolucia.org`.
   - **Nome exibido** (display name): `Instituto Lúcia` (é o que o Android mostra na janela da digital).
4. Salve.
5. Se a proteção contra robôs (CAPTCHA) estiver ligada em Authentication, não precisa mudar nada: o botão da
   digital envia a mesma resposta do desafio que o formulário de senha.

Não é preciso mexer no banco de dados nem rodar SQL.

## 2. Aplicativo Android (Android Studio)

O WebView vem com chaves de acesso desligadas. Dentro do APK, sem estes dois passos, o botão da digital
não aparece ou falha.

**a) Dependência** (`app/build.gradle`):

```gradle
implementation "androidx.webkit:webkit:1.12.1"
```

**b) Ligar o recurso**, na `MainActivity`, logo depois de configurar o WebView:

```kotlin
if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
    WebSettingsCompat.setWebAuthenticationSupport(
        webView.settings,
        WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP
    )
}
```

**c) Não troque o "user agent" do WebView.** O site reconhece o aplicativo pelo trecho `; wv)` que o Android
põe ali sozinho; é isso que liga o visual de aplicativo.

## 3. Ligar o aplicativo ao domínio (assetlinks.json)

O Android só deixa o APK usar chaves de `institutolucia.org` se o site declarar que o APK é dele.

1. Descubra a impressão SHA-256 do certificado que assina o APK:
   - assinatura própria: `keytool -list -v -keystore SEU_ARQUIVO.jks -alias SEU_ALIAS`
   - Play Store com assinatura do Google: Play Console → Integridade do app → Assinatura do app.
2. Crie neste repositório o arquivo `public/.well-known/assetlinks.json`, trocando os dois valores em maiúsculas:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
    "target": {
      "namespace": "android_app",
      "package_name": "NOME.DO.PACOTE",
      "sha256_cert_fingerprints": ["AA:BB:CC:…"]
    }
  }
]
```

3. Publique o site e confira que `https://institutolucia.org/.well-known/assetlinks.json` abre e mostra o arquivo.

O APK de teste (debug) e o de produção têm assinaturas diferentes: liste as duas impressões enquanto testa.

## Como testar

1. No Chrome do celular (fora do APK), entre com a senha, vá em Minha conta e cadastre a digital. Se isso
   funcionar, o passo 1 está certo.
2. Saia e use "Entrar com a digital".
3. Repita dentro do APK. Se funcionar no Chrome e falhar no APK, o problema está nos passos 2 ou 3.

## Se der erro

A tela mostra o motivo técnico em letra pequena, abaixo da mensagem.

| O que aparece | Causa provável |
| --- | --- |
| O botão não aparece | Aparelho sem digital e sem bloqueio de tela; ou, no APK, falta o passo 2 |
| `SecurityError` ou "RP ID" / "invalid domain" | RP ID ou origem errados no Supabase; ou falta o `assetlinks.json` (no APK) |
| `404` ou "not found" ao cadastrar | Passkeys desligadas no projeto Supabase |
| `captcha_failed` | A resposta do desafio venceu: recarregue a tela e tente de novo |
| "Leitura da digital cancelada" | A pessoa fechou a janela, ou não há chave deste site no aparelho |

## Se o celular for perdido ou trocado

A senha continua valendo. A pessoa entra com a senha no aparelho novo, remove o antigo em Minha conta e
cadastra a digital de novo.
