// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, frente android (itens 1.2, 2.3 e os itens de app da Parte 4), SEM aparelho: lê o manifesto, o código nativo, a
// configuração do Capacitor e (se já montada) a casca, e confere o que precisa valer em todo pacote:
//   - nada na cópia de segurança do sistema; sem texto puro; nenhum filtro de link; a casca não exportada; um só nome ligado;
//   - FLAG_SECURE e a foto da troca de apps desligada; teclado sem aprendizado; notificação sem conteúdo e secreta na tela bloqueada;
//   - o cofre no Keystore (StrongBox quando há), não exportável, contagem gravada com commit() antes de conferir;
//   - nenhuma página remota com a ponte (sem server.url, sem allowNavigation; a casca bloqueia o que não é dela; a rede social em
//     outro processo, sem ponte, sem acesso a arquivos);
//   - nenhuma chave de assinatura no projeto; o pacote de lançamento sem assinatura, sem git e sem o bloco do Google;
//   - a casca montada: CSP sem script de fora nem 'unsafe-eval'; o chat está dentro do pacote.
// Uso: node scripts/testar-r3-android-manifesto.mjs
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const existe = (c) => fs.existsSync(path.join(raiz, c));
let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));

const JAVA = "android/app/src/main/java/org/institutolucia/app";
const man = ler("android/app/src/main/AndroidManifest.xml");
const semComentarios = man.replace(/<!--[\s\S]*?-->/g, "");
const cfg = ler("capacitor.config.ts");
const main = ler(`${JAVA}/MainActivity.java`);
const app = ler(`${JAVA}/AlumiaApp.java`);
const cofre = ler(`${JAVA}/AlumiaCofre.java`);
const rede = ler(`${JAVA}/RedeActivity.java`);
const redeCodigo = rede.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const campo = ler(`${JAVA}/CampoSemAprendizado.java`);
const gradle = ler("android/app/build.gradle");
const raizGradle = ler("android/build.gradle");

// ── Manifesto ──
ok("allowBackup=\"false\"", /android:allowBackup="false"/.test(semComentarios));
ok("regras de backup e de extração (Android 12+) presentes", /android:fullBackupContent="@xml\/regras_de_backup"/.test(semComentarios) && /android:dataExtractionRules="@xml\/regras_de_extracao"/.test(semComentarios));
const extracao = ler("android/app/src/main/res/xml/regras_de_extracao.xml");
ok("a extração exclui tudo da nuvem e da transferência", /<cloud-backup>[\s\S]*domain="root"[\s\S]*<\/cloud-backup>/.test(extracao) && /<device-transfer>[\s\S]*domain="root"[\s\S]*<\/device-transfer>/.test(extracao) && !/<include/.test(extracao));
ok("a regra de backup antiga não inclui nada", !/<include/.test(ler("android/app/src/main/res/xml/regras_de_backup.xml")));
ok("sem texto puro no pacote de lançamento", /android:usesCleartextTraffic="false"/.test(semComentarios) && !/networkSecurityConfig/.test(semComentarios));
ok("ataque: nenhum filtro de link (deep link) abre o app", !/android\.intent\.action\.VIEW|android\.intent\.category\.BROWSABLE|<data\s/.test(semComentarios));
ok("a casca (MainActivity) não é exportada", /android:name="\.MainActivity"[\s\S]*?android:exported="false"/.test(semComentarios.match(/<activity\s[^>]*\.MainActivity[\s\S]*?\/>/)?.[0] ?? ""));
const aliases = [...semComentarios.matchAll(/<activity-alias([\s\S]*?)<\/activity-alias>/g)].map((m) => m[1]);
ok("três nomes na tela inicial (Instituto, Calculadora, Notas)", aliases.length === 3 && [".Padrao", ".Calculadora", ".Notas"].every((n) => aliases.some((a) => a.includes(`android:name="${n}"`))));
ok("só um nome ligado de saída (o padrão)", aliases.filter((a) => /android:enabled="true"/.test(a)).length === 1 && aliases.find((a) => a.includes(".Padrao"))?.includes('android:enabled="true"'));
ok("todo nome aponta para a casca", aliases.every((a) => a.includes('android:targetActivity=".MainActivity"')));
const redeMan = semComentarios.match(/<activity\s[^>]*\.RedeActivity[\s\S]*?\/>/)?.[0] ?? "";
ok("a rede social em outro processo e não exportada", /android:process=":rede"/.test(redeMan) && /android:exported="false"/.test(redeMan));
ok("permissões: só internet, notificação, o Bluetooth do modo sem internet e o aviso de aparelho ligado (disfarce)", [...semComentarios.matchAll(/uses-permission android:name="([^"]+)"/g)].map((m) => m[1]).sort().join() === "android.permission.BLUETOOTH_ADVERTISE,android.permission.BLUETOOTH_CONNECT,android.permission.BLUETOOTH_SCAN,android.permission.INTERNET,android.permission.POST_NOTIFICATIONS,android.permission.RECEIVE_BOOT_COMPLETED");
const receptores = [...semComentarios.matchAll(/<receiver([\s\S]*?)<\/receiver>/g)].map((m) => m[1]);
ok("um só receptor: o que reaplica o disfarce, só para o aviso de aparelho ligado (protegido, só o sistema manda)", receptores.length === 1 && /\.Reaplicar/.test(receptores[0]) && [...receptores[0].matchAll(/<action android:name="([^"]+)"/g)].map((m) => m[1]).join() === "android.intent.action.BOOT_COMPLETED");
const reaplicar = ler(`${JAVA}/Reaplicar.java`);
ok("o receptor ignora qualquer outro aviso e só reaplica o disfarce", /ACTION_BOOT_COMPLETED\.equals\(intent\.getAction\(\)\)\) return;/.test(reaplicar) && /reaplicarDisfarce/.test(reaplicar) && !/startActivity|HttpURLConnection|getBridge/.test(reaplicar));
ok("ataque: o disfarce é guardado com commit() e reaplicado ao abrir (reiniciar logo depois de trocar não volta o nome)", /putString\("disfarce", nome\)\.commit\(\)/.test(app) && /AlumiaApp\.reaplicarDisfarce\(/.test(main));
ok("ataque: nenhuma permissão de localização; a procura do Bluetooth não serve para localizar (neverForLocation)", !/LOCATION/.test(semComentarios) && /BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation"/.test(semComentarios));
ok("o Bluetooth LE não é exigido para instalar", /android\.hardware\.bluetooth_le" android:required="false"/.test(semComentarios));
// ── Auditoria interna da R3: o disfarce além do ícone, e a rede social fora da trava ──
const strings = ler("android/app/src/main/res/values/strings.xml");
const rotuloApp = semComentarios.match(/<application[\s\S]*?>/)?.[0] ?? "";
const rotuloDe = (nome) => strings.match(new RegExp(`<string name="${nome}">([^<]*)<`))?.[1];
ok("ATAQUE o rótulo da aplicação (cabeçalho das notificações, telas de licença) não é o nome real", /android:label="@string\/rotulo_do_app"/.test(rotuloApp) && !/Instituto|Lúcia|Alumia/i.test(rotuloDe("rotulo_do_app") ?? "Instituto"));
ok("ATAQUE nem o rótulo das telas (casca e rede social)", !/Instituto|Lúcia|Alumia/i.test(rotuloDe("title_activity_main") ?? "Instituto") && /android:label="@string\/rotulo_do_app"/.test(redeMan));
ok("o título da troca de apps é o do disfarce (setTaskDescription nas duas telas)", /setTaskDescription\(new ActivityManager\.TaskDescription\(nomeDoDisfarce/.test(app) && /AlumiaApp\.tituloDaTarefa\(this\)/.test(main) && /AlumiaApp\.tituloDaTarefa\(this\)/.test(redeCodigo));
ok("com o disfarce ligado, a notificação não diz \"mensagem\"", /"padrao"\.equals\(disfarceAtual\(ctx\)\) \? R\.string\.nova_mensagem : R\.string\.lembrete_neutro/.test(app) && !/mensag/i.test(rotuloDe("lembrete_neutro") ?? "mensagem"));
ok("todas as traduções têm o rótulo neutro e o lembrete", ["en", "es", "fr", "ru", "zh"].every((l) => { const x = ler(`android/app/src/main/res/values-${l}/strings.xml`); return /name="rotulo_do_app"/.test(x) && /name="lembrete_neutro"/.test(x) && !/name="title_activity_main">Instituto/.test(x); }));
ok("ATAQUE a rede social se FECHA ao sair da frente (quem pega o celular volta à casca travada, não à rede logada)", /protected void onStop\(\)[\s\S]*?if \(!isChangingConfigurations\(\)\) finish\(\);/.test(redeCodigo));
ok("a rede social com o teclado sem aprendizado", /new WebViewSemAprendizado\(this\)/.test(redeCodigo) && /IME_FLAG_NO_PERSONALIZED_LEARNING/.test(redeCodigo) && !/new WebView\(this\)/.test(redeCodigo));
ok("ATAQUE as páginas do chat do site não abrem na rede social (nativo)", /PAGINA_DO_CHAT[\s\S]*alumia\/\(\?:conversas\|aparelhos\)\|painel/.test(app) && /URLDecoder\.decode/.test(app));

// ── O transporte sem internet (contrato em lib/rede/malha/android.ts, da frente sem-internet-formal) ──
const malhaPlugin = ler(`${JAVA}/AlumiaMalha.java`);
const malhaMeio = ler(`${JAVA}/Malha.java`);
ok("AlumiaMalha registrado na casca", /registerPlugin\(AlumiaMalha\.class\)/.test(main) && /name = "AlumiaMalha"/.test(malhaPlugin));
ok("AlumiaMalha cumpre o contrato: ligar, desligar, mandar; eventos encontro, pacote, fim", ["ligar", "desligar", "mandar"].every((m) => new RegExp(`@PluginMethod\\s+public void ${m}\\(PluginCall`).test(malhaPlugin)) && ["encontro", "pacote", "fim"].every((e) => malhaPlugin.includes(`notifyListeners("${e}"`)));
ok("o pacote vai e volta em base64url sem preenchimento (o que lib/rede/malha/android.ts usa)", (malhaPlugin.match(/Base64\.URL_SAFE \| Base64\.NO_WRAP \| Base64\.NO_PADDING/g) ?? []).length >= 2);
ok("ataque: o anúncio não leva o nome do aparelho nem dado do fabricante", /setIncludeDeviceName\(false\)/.test(malhaPlugin) && !/addManufacturerData|addServiceData/.test(malhaPlugin));
ok("ataque: o endereço Bluetooth nunca sobe para o TypeScript (o par é um número da sessão)", !/e\.put\("[a-z]+", d\.getAddress\(\)\)|put\("endereco"/.test(malhaPlugin) && /Long\.toString\(proximo\+\+\)/.test(malhaMeio));
ok("sem Google Play Services no transporte (sem Nearby)", !/com\.google\.android\.gms|Nearby/.test(malhaPlugin.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")));
ok("só Android 12+ (sem pedir localização nos mais velhos)", /SDK_INT < 31[\s\S]*so_android_12/.test(malhaPlugin));
ok("teto do pacote e da fila no nativo", /MAXIMO = 8192/.test(malhaMeio) && /FILA_MAXIMA = 128/.test(malhaMeio));
ok("o Java não decide nada sobre o pacote (não lê o conteúdo, não guarda em disco)", !/SharedPreferences|FileOutputStream|getFilesDir|0x4D/.test(malhaPlugin + malhaMeio));
const depuracao = ler("android/app/src/debug/AndroidManifest.xml");
ok("texto puro só no pacote de depuração, e só para o computador do teste", /networkSecurityConfig/.test(depuracao) && /10\.0\.2\.2/.test(ler("android/app/src/debug/res/xml/rede_de_teste.xml")) && /base-config cleartextTrafficPermitted="false"/.test(ler("android/app/src/debug/res/xml/rede_de_teste.xml")));

// ── Tela, teclado, notificação ──
ok("FLAG_SECURE antes de a tela existir", /setFlags\(WindowManager\.LayoutParams\.FLAG_SECURE/.test(main) && main.indexOf("FLAG_SECURE") < main.indexOf("super.onCreate"));
ok("a foto da troca de apps desligada (Android 13+)", /setRecentsScreenshotEnabled\(false\)/.test(main));
ok("a rede social também com FLAG_SECURE", /FLAG_SECURE/.test(rede));
ok("teclado sem aprendizado no WebView da casca", /IME_FLAG_NO_PERSONALIZED_LEARNING/.test(campo) && /org\.institutolucia\.app\.CampoSemAprendizado/.test(ler("android/app/src/main/res/layout/capacitor_bridge_layout_main.xml")));
ok("campos da casca sem preencher, sem corretor e sem sugestão", /autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", spellCheck: false/.test(ler("casca/app/Casca.tsx")));
ok("notificação secreta na tela bloqueada (canal e notificação)", /setLockscreenVisibility\(NotificationCompat\.VISIBILITY_SECRET\)/.test(app) && /\.setVisibility\(NotificationCompat\.VISIBILITY_SECRET\)/.test(app));
ok("ataque: notificação sem conteúdo (nem texto, nem remetente, nem trecho)", !/setContentText|setStyle|setTicker|setSubText|BigTextStyle|MessagingStyle/.test(app) && /setContentTitle\(ctx\.getString\("padrao"\.equals\(disfarceAtual\(ctx\)\) \? R\.string\.nova_mensagem : R\.string\.lembrete_neutro\)\)/.test(app));
ok("notificar() da casca não leva texto até o nativo", /notificar\(\): Promise<void>/.test(ler("lib/rede/casca/plataforma.ts")) && /notificar: \(\) => p\.app\.notificar\(\)/.test(ler("lib/rede/casca/android.ts")));

// ── Cofre ──
ok("cofre no AndroidKeyStore, AES-256-GCM", /"AndroidKeyStore"/.test(cofre) && /setKeySize\(256\)/.test(cofre) && /BLOCK_MODE_GCM/.test(cofre));
ok("StrongBox quando o aparelho tem (e cai para o TEE)", /FEATURE_STRONGBOX_KEYSTORE/.test(cofre) && /setIsStrongBoxBacked\(strongBox\)/.test(cofre) && /StrongBoxUnavailableException/.test(cofre));
ok("iv sorteado pelo cofre e a finalidade como dado associado", /setRandomizedEncryptionRequired\(true\)/.test(cofre) && /updateAAD\(finalidade/.test(cofre));
ok("a chave só serve com o aparelho destravado", /setUnlockedDeviceRequired\(true\)/.test(cofre));
ok("ataque: a contagem é gravada com commit() (síncrono), não apply()", /putInt\("erros", erros\)\.commit\(\)/.test(cofre) && !/\.apply\(\)/.test(cofre));
ok("limite 0 ou 3 a 50 também no nativo", /n == 0 \|\| \(n >= 3 && n <= 50\)/.test(cofre));
ok("apagar tudo: a chave do cofre e os dados do app", /deleteEntry\(APELIDO\)/.test(cofre) && /clearApplicationUserData\(\)/.test(cofre));

// ── Nenhuma página remota com a ponte ──
ok("capacitor.config.ts sem server.url e sem allowNavigation", !/\burl:\s/.test(cfg.replace(/\/\/.*$/gm, "")) && !/allowNavigation:/.test(cfg.replace(/\/\/.*$/gm, "")));
ok("a casca vem do próprio pacote (webDir casca/saida, https://localhost)", /webDir:\s*"casca\/saida"/.test(cfg) && /androidScheme:\s*"https"/.test(cfg) && /hostname:\s*"localhost"/.test(cfg));
ok("nenhum plugin do npm no app", /includePlugins:\s*\[\]/.test(cfg));
ok("depuração do WebView só por pedido explícito", /webContentsDebuggingEnabled:\s*process\.env\.ALUMIA_APP_DEPURAR === "1"/.test(cfg));
ok("a casca bloqueia toda navegação que não é dela", /shouldOverrideLoad\(Uri url\)/.test(app) && /"localhost"\.equals\(url\.getHost\(\)\)\) return null;\s*return true;/.test(app));
ok("ataque: a rede social sem ponte com o nativo", !/addJavascriptInterface|getBridge|Capacitor/.test(redeCodigo));
ok("a rede social sem acesso a arquivos e com dados separados", /setAllowFileAccess\(false\)/.test(rede) && /setAllowContentAccess\(false\)/.test(rede) && /setDataDirectorySuffix\("rede"\)/.test(rede));
ok("a rede social só abre o Instituto; o resto pergunta antes", /if \(doInstituto\(base, u\)\) return false;/.test(rede) && /perguntarAntes\(u\)/.test(rede));
ok("endereço de fora só com confirmação nativa", /AlertDialog\.Builder/.test(app) && /abrirExterno/.test(app) && /"https"\.equals\(u\.getScheme\(\)\)/.test(app));
ok("a casca pergunta antes de abrir qualquer link", /window\.confirm\(/.test(ler("casca/app/Casca.tsx")) && /window\.open = \(\) => null/.test(ler("casca/app/iniciar.ts")));

// ── Assinatura e build reproduzível ──
const listar = (pasta) => (fs.existsSync(pasta) ? fs.readdirSync(pasta, { withFileTypes: true }).flatMap((e) => (e.name === "build" || e.name === ".gradle" ? [] : e.isDirectory() ? listar(path.join(pasta, e.name)) : [path.join(pasta, e.name)])) : []);
const doAndroid = listar(path.join(raiz, "android"));
ok("ataque: nenhuma chave de assinatura dentro de android/", !doAndroid.some((f) => /\.(jks|keystore|p12|pk8|pem)$/i.test(f)));
ok("sem senha de chave nem storeFile no Gradle", !/storeFile|storePassword|keyPassword|signingConfigs\s*\{/.test(gradle));
ok("pacote de lançamento sem assinatura, sem o git e sem o bloco do Google", /signingConfig null/.test(gradle) && /vcsInfo\.include false/.test(gradle) && /includeInApk = false/.test(gradle));
ok("sem Google Play Services", !/google-services|com\.google\.gms|firebase/i.test(gradle + raizGradle));
const wrapper = ler("android/gradle/wrapper/gradle-wrapper.properties");
ok("Gradle fixo com o resumo SHA-256 da distribuição", /gradle-[\d.]+-(all|bin)\.zip/.test(wrapper) && /^distributionSha256Sum=[0-9a-f]{64}$/m.test(wrapper));
ok("o que o cap sync gera fica fora do git", /app\/src\/main\/assets\/public/.test(ler("android/.gitignore")) && /capacitor-cordova-android-plugins/.test(ler("android/.gitignore")));
const ajustesCap = ler("android/capacitor.settings.gradle");
ok("ataque: o caminho do Capacitor é relativo (nenhum caminho de outra pasta ou máquina no git)", ajustesCap.includes("new File('../node_modules/@capacitor/android/capacitor')") && !/\.\.\/\.\.\/|[A-Za-z]:[\\/]/.test(ajustesCap));
ok("chaves fora do git (.gitignore da raiz)", /^\*\.jks$/m.test(ler(".gitignore")) && /^\*\.keystore$/m.test(ler(".gitignore")) && /^\/casca\/saida\/$/m.test(ler(".gitignore")));

// ── A casca montada (se existir) ──
if (existe("casca/saida/index.html")) {
  const html = ler("casca/saida/index.html");
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? "";
  const script = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
  ok("casca: CSP presente", csp.length > 0);
  ok("casca: script só do próprio pacote (sem endereço de fora, sem unsafe-eval, sem unsafe-inline)", /^script-src 'self' 'wasm-unsafe-eval'( 'sha256-[A-Za-z0-9+/=]+')*$/.test(script.trim()));
  ok("casca: nenhum quadro, objeto, base nem formulário", /frame-src 'none'/.test(csp) && /object-src 'none'/.test(csp) && /base-uri 'none'/.test(csp) && /form-action 'none'/.test(csp));
  ok("casca: nenhum <script src> de fora", !/<script[^>]+src="(https?:)?\/\//.test(html));
  const js = listar(path.join(raiz, "casca/saida/_next")).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(f, "utf8")).join("\n");
  ok("casca: o chat está DENTRO do pacote (envelope da R2)", js.includes("alumia/r2/envelope/v1"));
  ok("casca: o motor de cifra está dentro do pacote", fs.readdirSync(path.join(raiz, "casca/saida/cifra")).some((f) => /^core-crypto-[\d.]+\.wasm$/.test(f)));
  ok("casca: nenhum mapa de código", !listar(path.join(raiz, "casca/saida")).some((f) => f.endsWith(".map")));
} else {
  console.log("(casca/saida não montada: as conferências da casca ficam para depois de `node casca/montar.mjs`)");
}

// ── O site não leva o Capacitor ──
const importa = [];
const varrer = (pasta) => {
  for (const e of fs.readdirSync(path.join(raiz, pasta), { withFileTypes: true })) {
    const c = `${pasta}/${e.name}`;
    if (e.isDirectory()) varrer(c);
    else if (/\.(ts|tsx|mjs|js)$/.test(e.name) && /from\s+["']@capacitor\//.test(ler(c))) importa.push(c);
  }
};
for (const pasta of ["app", "components", "lib"]) varrer(pasta);
ok("o site (app/, components/, lib/) não importa o Capacitor", importa.length === 0);
ok("só casca/app/iniciar.ts importa o Capacitor na casca", /from "@capacitor\/core"/.test(ler("casca/app/iniciar.ts")) && !/@capacitor/.test(ler("casca/app/Casca.tsx")));

console.log(`testar-r3-android-manifesto: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  FALHOU: ${f}`);
process.exit(falhas.length ? 1 : 0);
