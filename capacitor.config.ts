// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Configuração do Capacitor (docs/APP-LOJA.md). Está PRONTA, MAS NÃO PUBLICADA: o Capacitor não está nas dependências
// do projeto e a pasta android/ não existe no repositório (gera-se na máquina de quem publica, passo a passo no
// documento). Publicar na Play Store tem taxa única da loja e é decisão do Jonathan (plano, Etapa 11).
//
// Escolha: o aplicativo é um WebView que abre o site em produção (server.url). O site já é um PWA com casca de app
// (docs/APP.md); o pacote nativo só dá o ícone na loja, a tela de abertura e o botão "voltar" do Android. Um build
// estático não serve: o site tem páginas dinâmicas, rotas de API e o banco (Supabase), e sairia do ar a cada mudança.
//
// Sem import de "@capacitor/cli" de propósito: o tipo está escrito aqui embaixo para o `tsc` do site não depender de
// um pacote que não está instalado. Ao instalar o Capacitor, dá para trocar por `import type { CapacitorConfig }`.

interface ConfiguracaoDoCapacitor {
  appId: string;
  appName: string;
  /** Pasta com um index.html mínimo (o aplicativo só mostra o site; esta pasta existe porque o Capacitor exige uma). */
  webDir: string;
  server?: { url?: string; cleartext?: boolean; allowNavigation?: string[]; androidScheme?: string };
  android?: { appendUserAgent?: string; allowMixedContent?: boolean; webContentsDebuggingEnabled?: boolean };
  plugins?: Record<string, Record<string, unknown>>;
}

// O endereço de produção. Pode ser trocado por uma variável na hora de gerar o pacote de teste
// (APP_URL=http://10.0.2.2:3000 npx cap sync, que é o localhost do computador visto pelo emulador do Android).
const endereco = process.env.APP_URL ?? "https://institutolucia.org";

const config: ConfiguracaoDoCapacitor = {
  // Identificador do pacote na loja. NÃO muda depois da primeira publicação.
  appId: "org.institutolucia.app",
  appName: "Instituto Lúcia",
  webDir: "app-loja/www",
  server: {
    url: endereco,
    // Só o site do Instituto abre dentro do aplicativo; qualquer outro endereço abre no navegador do aparelho.
    allowNavigation: ["institutolucia.org", "*.institutolucia.org"],
    // Sem tráfego em texto puro, exceto no teste local pedido de propósito.
    cleartext: endereco.startsWith("http://"),
  },
  android: {
    // O site liga o visual de aplicativo (<html data-app>) quando o agente de usuário tem "; wv)" (lib/prefs.ts; o WebView
    // do Android já traz isso sozinho). "InstitutoLuciaApp/2" é só uma marca de versão da casca (e2e/s24.spec.ts imita os dois).
    appendUserAgent: "InstitutoLuciaApp/2",
    allowMixedContent: false,
    // Depurar pelo chrome://inspect só em teste local; na loja fica desligado.
    webContentsDebuggingEnabled: endereco.startsWith("http://"),
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0, backgroundColor: "#ffffff" },
  },
};

export default config;
