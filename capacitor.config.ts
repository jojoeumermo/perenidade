// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Configuração do Capacitor do app de Android (docs/APP-LOJA.md). Onda R3, item 1.2: o app deixou de ser um WebView que abre o
// site. Agora ele leva DENTRO do pacote a casca do chat (casca/, um projeto estático montado por `node casca/montar.mjs`), com o
// motor de cifra e as telas do chat: nenhum código de chave vem de servidor. Por isso:
//   - SEM `server.url` e SEM `allowNavigation`: nenhuma página remota no WebView que tem a ponte com o nativo;
//   - a rede social abre FORA da casca, numa tela própria do app (RedeActivity) com um WebView SEM ponte, em outro processo;
//   - as rotas do Instituto saem pelo HTTP nativo do Capacitor (sem `Origin`), chamado pela casca; o fetch do WebView fica só para o
//     serviço de contas, limitado pela política de segurança da casca;
//   - a depuração pelo chrome://inspect fica desligada (liga só com ALUMIA_APP_DEPURAR=1, num pacote de teste).
// A chave de assinatura NUNCA fica no projeto: o build sai sem assinatura e é assinado à parte (docs/APP-LOJA.md).
//
// Sem import de "@capacitor/cli" de propósito: o tipo está escrito aqui embaixo para o `tsc` do site não depender do CLI.

interface ConfiguracaoDoCapacitor {
  appId: string;
  appName: string;
  webDir: string;
  server?: { url?: string; cleartext?: boolean; allowNavigation?: string[]; androidScheme?: string; hostname?: string };
  android?: { appendUserAgent?: string; allowMixedContent?: boolean; webContentsDebuggingEnabled?: boolean; captureInput?: boolean };
  plugins?: Record<string, Record<string, unknown>>;
  includePlugins?: string[];
}

const config: ConfiguracaoDoCapacitor = {
  // Identificador do pacote na loja. NÃO muda depois da primeira publicação.
  appId: "org.institutolucia.app",
  appName: "Instituto Lúcia",
  webDir: "casca/saida",
  // Nenhum plugin do npm entra no app: só os nativos próprios (AlumiaCofre, AlumiaApp), registrados na MainActivity. Os pacotes
  // @capacitor/app e @capacitor/local-notifications estão nas dependências, mas a notificação sem conteúdo e a ida para o fundo são
  // do AlumiaApp (VISIBILITY_SECRET na tela bloqueada, que o plugin genérico não garante).
  includePlugins: [],
  server: {
    // A casca é servida pelo próprio app, em https://localhost (contexto seguro para o WebCrypto e o OPFS do motor do chat).
    androidScheme: "https",
    hostname: "localhost",
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: process.env.ALUMIA_APP_DEPURAR === "1",
    // Os campos de texto passam pelo WebView próprio do app (CampoSemAprendizado), que pede ao teclado para não aprender.
    captureInput: false,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0, backgroundColor: "#f8f5ee" },
    // O fetch do WebView NÃO é trocado pelo HTTP nativo em tudo: só a casca escolhe o que sai pelo nativo (lib/rede/casca/android.ts).
    CapacitorHttp: { enabled: false },
    CapacitorCookies: { enabled: false },
  },
};

export default config;
