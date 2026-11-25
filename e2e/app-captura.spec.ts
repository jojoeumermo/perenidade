// TEMPORÁRIO (validação do PR #65): capturas de tela do app instalado e do site, para conferir os pixels antes de publicar.
// Sai do ramo por commit próprio antes do master. Roda só com CAPTURA_ROTULO definido (workflow captura-app.yml), contra o
// banco de teste local (npm run dev:local), sem segredo e sem tocar em produção.
//   CAPTURA_ROTULO=app CAPTURA_GRUPO=tudo      → app instalado (?app=instituto) + site/Alumia no navegador
//   CAPTURA_ROTULO=base CAPTURA_GRUPO=site     → só o site/Alumia (ramo-base, que não tem as rotas /app)
import { expect, test, type Page } from "@playwright/test";
import { abrir } from "./ajuda";

test.describe.configure({ timeout: 240_000 });
test.skip(!process.env.CAPTURA_ROTULO, "só roda no workflow de captura");

const ROTULO = process.env.CAPTURA_ROTULO ?? "x";
const TUDO = process.env.CAPTURA_GRUPO === "tudo";
const AULA = "/pt/trilhas/historia-antiga/pre-historia-os-primeiros-seres-humanos";

async function fotoGeral(page: Page, nome: string, cheia = false) {
  await page.waitForTimeout(800);
  // O indicador do servidor de desenvolvimento do Next não existe em produção: sai das capturas do app (as do site ficam como na base, para a comparação).
  await page.screenshot({ path: `test-results/capturas/${ROTULO}-${nome}.png`, fullPage: cheia, ...(nome.startsWith("site-") ? {} : { style: "nextjs-portal { display: none !important }" }) });
}
const foto = fotoGeral;
const atributo = (page: Page, a: string) => page.evaluate((n) => document.documentElement.hasAttribute(n), a);

// O aplicativo instalado é reconhecido pelo <html data-app>, posto pelo prefsScript (lib/prefs-script.ts) no modo standalone, no
// navegador embutido ("; wv)") ou com navigator.standalone. O Playwright não emula o display-mode: o teste usa o "; wv)" no UA.
const UA_APP = "Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36";
const CELULAR = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } as const;

// Páginas do site e da Alumia no navegador comum (sem ?app): são as que NÃO podem mudar.
const SITE: [string, string][] = [
  ["inicio", "/pt"], ["trilhas", "/pt/trilhas"], ["aula", AULA], ["busca", "/pt/busca"], ["jogos", "/pt/jogos"],
  ["acervo", "/pt/acervo"], ["alumia", "/pt/alumia"], ["apoie", "/pt/apoie"], ["laboratorios", "/pt/laboratorios"],
];

test.describe("site no navegador do celular (390 px)", () => {
  test.use(CELULAR);
  for (const [nome, caminho] of SITE) {
    test(`celular ${nome}`, async ({ page }) => {
      await abrir(page, caminho);
      await foto(page, `site-celular-${nome}`);
      expect(await atributo(page, "data-sem-alumia")).toBe(false);
    });
  }
});

test.describe("site no navegador do computador (1280 px)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  for (const [nome, caminho] of SITE.slice(0, 5)) {
    test(`computador ${nome}`, async ({ page }) => {
      await abrir(page, caminho);
      console.log(`DESKTOP ${nome} html=${await page.evaluate(() => Array.from(document.documentElement.attributes).map((x) => x.name + (x.value ? "=" + x.value.slice(0, 20) : "")).join(" "))} header=${await page.evaluate(() => { const h = document.querySelector("header"); return h ? JSON.stringify({ d: getComputedStyle(h).display, v: getComputedStyle(h).visibility, t: getComputedStyle(h).transform, p: getComputedStyle(h).position, y: Math.round(h.getBoundingClientRect().top), sy: window.scrollY, c: h.className.slice(0, 60) }) : "sem"; })}`);
      await foto(page, `site-computador-${nome}`);
    });
  }
});

test.describe("navegador do computador abre /pt/app (1280 px)", () => {
  test.skip(!TUDO, "o ramo-base não tem as rotas do app");
  test.use({ viewport: { width: 1280, height: 800 } });
  test("o navegador comum que abre /pt/app é levado ao site", async ({ page }) => {
    await abrir(page, "/pt/app");
    await page.waitForTimeout(2500);
    console.log("URL final no navegador comum:", page.url());
    await foto(page, "navegador-pede-app");
  });
});

// Duas formas de ser o app: "standalone" = UA comum, sem query, com matchMedia(display-mode: standalone) e navigator.standalone
// verdadeiros ANTES de qualquer script da página (como o navegador faz no app instalado); "wv" = navegador embutido ("; wv)").
// São simulações em navegador de teste: não substituem um aparelho com o app instalado.
const SIMULA_STANDALONE = () => {
  const original = window.matchMedia.bind(window);
  window.matchMedia = (q: string) => {
    const m = original(q);
    if (!/display-mode:\s*(standalone|minimal-ui)/.test(q)) return m;
    return new Proxy(m, { get: (t, k) => (k === "matches" ? /standalone/.test(q) : typeof (t as never)[k] === "function" ? ((t as never)[k] as () => unknown).bind(t) : (t as never)[k]) });
  };
  Object.defineProperty(navigator, "standalone", { get: () => true });
};
const VARIANTES = [
  { id: "standalone", ua: undefined as string | undefined, simula: true },
  { id: "wv", ua: UA_APP, simula: false },
  // Celular em navegador comum (toque, 390 px, sem standalone): a partir de 25/11 veste o mesmo visual do app e mantém a Alumia.
  { id: "navegador", ua: undefined as string | undefined, simula: false },
];

for (const v of VARIANTES) test.describe(`app instalado (390 px, ${v.id})`, () => {
  test.skip(!TUDO, "o ramo-base não tem as rotas do app");
  test.use({ ...CELULAR, ...(v.ua ? { userAgent: v.ua } : {}) });
  test.beforeEach(async ({ page }) => {
    if (v.simula) await page.addInitScript(SIMULA_STANDALONE);
  });
  const foto = (page: Page, nome: string, cheia = false) => fotoGeral(page, `${v.id}-${nome}`, cheia);

  test("primeira abertura do app: sem modal de apoio", async ({ page }) => {
    await page.goto("/pt/app");
    await page.waitForLoadState("networkidle");
    await foto(page, "app-primeira-abertura");
    expect(await atributo(page, "data-app")).toBe(true);
    expect(await atributo(page, "data-sem-alumia")).toBe(v.id !== "navegador");
    await expect(page.locator(".shell-abas")).toBeVisible();
    console.log(`${v.id}: URL ${page.url()}, data-app presente, shell visível`);
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  });

  test("as quatro abas: tocar e conferir cada hub", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("lucia:aviso", JSON.stringify({ apoio: Date.now() })));
    await page.goto("/pt/app");
    await page.waitForLoadState("networkidle");
    await foto(page, "app-1-inicio");
    await foto(page, "app-1-inicio-cheia", true);
    for (const [aba, nome] of [["/pt/app/estudar", "2-estudar"], ["/pt/app/jogos", "3-jogos"], ["/pt/app/eu", "4-eu"]] as const) {
      await page.locator(`.shell-abas a[href="${aba}"]`).first().click();
      console.log(`TAB ${aba} ${v.id} data-app=${await atributo(page, "data-app")} mq=${await page.evaluate(() => matchMedia("(pointer: coarse) and (max-width: 768px)").matches)} url=${page.url()}`);
      await page.waitForURL(new RegExp(`${aba}$`));
      await page.waitForLoadState("networkidle");
      await foto(page, `app-${nome}`);
      await foto(page, `app-${nome}-cheia`, true);
    }
    // nenhuma aba mostra a Alumia no app instalado; no navegador do celular só o cartão da aba Eu (a última aberta) leva a ela
    await expect(page.locator('a[href*="/alumia"]:visible')).toHaveCount(v.id === "navegador" ? 1 : 0);
  });

  test("jornadas dentro do app: aula, busca, apoie, laboratórios", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("lucia:aviso", JSON.stringify({ apoio: Date.now() })));
    await page.goto("/pt/app");
    await page.waitForLoadState("networkidle");
    for (const [nome, caminho] of [["trilhas", "/pt/trilhas"], ["aula", AULA], ["busca", "/pt/busca"], ["apoie", "/pt/apoie"], ["laboratorios", "/pt/laboratorios"], ["alumia-no-app", "/pt/alumia"]] as const) {
      await page.goto(`${caminho}`);
      await page.waitForLoadState("networkidle");
      console.log(`no app, ${caminho} termina em ${page.url()}`);
      await foto(page, `app-jornada-${nome}`);
    }
  });

  test("busca própria do app: digitar, abrir aula no leitor do app, voltar", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("lucia:aviso", JSON.stringify({ apoio: Date.now() })));
    await page.goto("/pt/app/estudar");
    await page.waitForLoadState("networkidle");
    await page.locator(".shell-acoes a").first().click();
    await page.waitForURL(/\/app\/estudar\/buscar/);
    await page.locator('input[type="search"], input[type="text"]').first().fill("pré-história");
    const aula = page.locator('a[href*="/app/estudar/ir/"]').first();
    await expect(aula).toBeVisible({ timeout: 20000 });
    await foto(page, "app-busca-resultados");
    await aula.click();
    await page.waitForURL((u) => /\/app\/estudar\/[^/]+\/[^/]+(\/[^/]+)?$/.test(u.pathname) && !u.pathname.includes("/estudar/ir/"));
    await page.waitForLoadState("networkidle");
    console.log(`BUSCA abriu ${page.url()} data-app=${await atributo(page, "data-app")}`);
    await foto(page, "app-busca-aberto");
    await page.goBack();
    await page.waitForURL(/\/app\/estudar\/buscar/);
    await expect(page.locator(".shell-abas, .shell-topo").first()).toBeVisible();
  });

  test("aula do ENEM: bloco de questões oficiais no pé do leitor", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("lucia:aviso", JSON.stringify({ apoio: Date.now() })));
    await page.goto("/pt/app/estudar/enem/enem-por-area/ciencias-humanas-filosofia-e-sociologia");
    await page.waitForLoadState("networkidle");
    const bloco = page.locator('section[aria-labelledby="questoes-oficiais"]');
    await expect(bloco).toHaveCount(1);
    await bloco.scrollIntoViewIfNeeded();
    await foto(page, "app-enem-questoes");
    await expect(bloco.locator("a").first()).toHaveAttribute("href", /\/enem\/praticar\?q=/);
  });

  test("caderno do app: no fim da rolagem nenhum controle fica sob a barra de abas ou o botão flutuante", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("lucia:aviso", JSON.stringify({ apoio: Date.now() })));
    await page.goto("/pt/app/eu/caderno");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(600);
    await foto(page, "app-caderno-fim");
    const r = await page.evaluate(() => {
      const abas = document.querySelector(".shell-abas")?.getBoundingClientRect();
      const itens = [...document.querySelectorAll(".app-caderno-corpo button, .app-caderno-corpo a, .app-caderno-corpo input, .app-caderno-corpo textarea")].filter((e) => (e as HTMLElement).offsetParent !== null);
      const ultimo = itens[itens.length - 1]?.getBoundingClientRect();
      return { topoDasAbas: abas?.top ?? null, fimDoUltimo: ultimo?.bottom ?? null, controles: itens.length, altura: innerHeight };
    });
    console.log(`CADERNO-FIM ${JSON.stringify(r)}`);
    expect(r.controles).toBeGreaterThan(0);
    if (r.topoDasAbas !== null && r.fimDoUltimo !== null) expect(r.fimDoUltimo).toBeLessThanOrEqual(r.topoDasAbas + 1);
  });

  test("jornada própria: disciplina, trilha, aula, concluir, progresso", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("lucia:aviso", JSON.stringify({ apoio: Date.now() })));
    await page.goto("/pt/app/estudar");
    await page.waitForLoadState("networkidle");
    const hrefs = await page.locator('a.app-item-lista[href*="/app/estudar/"]').evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!));
    console.log(`JORNADA disciplinas: ${hrefs.length}`);
    for (const h of hrefs) {
      await page.goto(h);
      await page.waitForLoadState("networkidle");
      if ((await page.locator(".app-trilha-cartao").count()) > 0) break;
    }
    await foto(page, "jornada-1-disciplina");
    await page.locator(".app-trilha-cartao").first().click();
    await page.waitForURL(/\/app\/estudar\/[^/]+\/[^/]+$/);
    await page.waitForLoadState("networkidle");
    await foto(page, "jornada-2-trilha");
    await page.locator(".app-continuar-estudo").first().click();
    await page.waitForURL(/\/app\/estudar\/[^/]+\/[^/]+\/[^/]+$/);
    await page.waitForLoadState("networkidle");
    const aula1 = page.url();
    await foto(page, "jornada-3-aula-topo");
    await expect(page.locator(".app-aula h1")).toBeVisible();
    await expect(page.locator(".shell-abas")).toBeHidden();
    await expect(page.locator(".app-barra-aula")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(600);
    await foto(page, "jornada-4-aula-fim");
    const sobra = await page.evaluate(() => {
      const barra = document.querySelector(".app-barra-aula")!.getBoundingClientRect().top;
      const ult = document.querySelector(".app-aula-fim")!.getBoundingClientRect().bottom;
      return { barra: Math.round(barra), ultimo: Math.round(ult) };
    });
    console.log(`JORNADA fim da aula: ${JSON.stringify(sobra)}`);
    expect(sobra.ultimo).toBeLessThanOrEqual(sobra.barra + 1);
    await page.locator(".app-barra-aula .app-botao").click();
    await page.waitForURL((u) => u.toString() !== aula1);
    await page.waitForLoadState("networkidle");
    console.log(`JORNADA concluir: ${aula1} -> ${page.url()}`);
    await foto(page, "jornada-5-proxima-aula");
    const feitas = await page.evaluate(() => window.localStorage.getItem("lucia:concluidas"));
    console.log(`JORNADA lucia:concluidas = ${feitas}`);
    expect(feitas).toContain("/");
    await page.goto("/pt/app/eu");
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".app-resumo-progresso")).toContainText(/1/);
    await foto(page, "jornada-6-eu-progresso");
    // Progresso antigo (formato de sempre, lista de "trilha/aula" em lucia:concluidas) e nova sessão: a marca aparece e persiste.
    const idAula1 = new URL(aula1).pathname.split("/").slice(-2).join("/");
    const guardado = await page.evaluate(() => JSON.parse(window.localStorage.getItem("lucia:concluidas") ?? "[]") as string[]);
    console.log(`JORNADA concluidas: ${JSON.stringify(guardado)} (esperado conter ${idAula1})`);
    expect(guardado).toContain(idAula1);
    await page.context().clearCookies();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".app-resumo-progresso")).toContainText(/1/);
    await page.goto("/pt/app/estudar");
    await page.waitForLoadState("networkidle");
    await page.locator(".app-continuar-estudo, .app-continuar").first().waitFor({ state: "attached" }).catch(() => undefined);
    await foto(page, "jornada-7-estudar-continuar");
  });

  test("Jogos no app: abrir um jogo e voltar pela casca fecha o jogo", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("lucia:aviso", JSON.stringify({ apoio: Date.now() })));
    await page.goto("/pt/app/jogos");
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".app-jogos")).toBeVisible();
    await foto(page, "jogos-1-catalogo");
    await page.locator(".app-jogo-linha").first().click();
    await expect(page.locator("#palco-titulo")).toBeVisible();
    await foto(page, "jogos-2-jogo-aberto");
    await page.getByRole("button", { name: /Voltar aos jogos/ }).click({ timeout: 10_000 });
    await expect(page.locator(".app-jogos")).toBeVisible();
    console.log(`JOGOS voltar do palco fechou o jogo, URL ${page.url()}`);
    expect(page.url()).toMatch(/\/pt\/app\/jogos$/);
  });

  test("navegador do celular: a Alumia abre sem o visual do app e o voltar traz o app de volta", async ({ page }) => {
    test.skip(v.id !== "navegador", "só no navegador");
    await page.addInitScript(() => window.localStorage.setItem("lucia:aviso", JSON.stringify({ apoio: Date.now() })));
    await page.goto("/pt/app/eu");
    await page.waitForLoadState("networkidle");
    expect(await atributo(page, "data-app")).toBe(true);
    await page.locator("a.app-atalho-alumia").click();
    await page.waitForURL(/\/pt\/alumia/);
    await page.waitForLoadState("networkidle");
    const naAlumia = await atributo(page, "data-app");
    console.log(`NAVEGADOR na Alumia: data-app=${naAlumia} URL ${page.url()}`);
    await foto(page, "alumia-pelo-eu");
    expect(naAlumia).toBe(false);
    await page.goBack();
    await page.waitForURL(/\/pt\/app\/eu$/);
    await page.waitForLoadState("networkidle");
    console.log(`NAVEGADOR voltou: data-app=${await atributo(page, "data-app")}`);
    expect(await atributo(page, "data-app")).toBe(true);
    await foto(page, "eu-depois-da-alumia");
  });

  test("navegador do celular: decisão do visual no início, no reload, no voltar e ao girar/redimensionar", async ({ page }) => {
    test.skip(v.id !== "navegador", "só no navegador");
    await page.addInitScript(() => window.localStorage.setItem("lucia:aviso", JSON.stringify({ apoio: Date.now() })));
    const sonda = async (rotulo: string) => {
      const r = await page.evaluate(() => ({
        app: document.documentElement.hasAttribute("data-app"),
        coarse: matchMedia("(pointer: coarse)").matches,
        anyCoarse: matchMedia("(any-pointer: coarse)").matches,
        hoverNone: matchMedia("(hover: none)").matches,
        larg: matchMedia("(max-width: 768px)").matches,
        combinada: matchMedia("(pointer: coarse) and (max-width: 768px)").matches,
        pontos: navigator.maxTouchPoints,
        tela: `${screen.width}x${screen.height}`,
        janela: `${innerWidth}x${innerHeight}`,
      }));
      console.log(`SONDA ${rotulo} ${JSON.stringify(r)}`);
      return r;
    };
    await page.goto("/pt/app");
    await page.waitForLoadState("networkidle");
    expect((await sonda("carga /pt/app")).app).toBe(true);
    await page.goto("/pt/trilhas");
    await page.waitForLoadState("networkidle");
    expect((await sonda("carga /pt/trilhas (site)")).app).toBe(true);
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect((await sonda("reload")).app).toBe(true);
    await page.goBack();
    await page.waitForLoadState("networkidle");
    expect((await sonda("voltar")).app).toBe(true);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(500);
    const girado = await sonda("girado 844x390");
    expect(girado.app).toBe(true);
    await page.goto("/pt/app/estudar");
    await page.waitForLoadState("networkidle");
    const girado2 = await sonda("girado, página nova");
    await foto(page, "girado-844x390");
    console.log(`SONDA resumo girado: antes=${girado.app} nova=${girado2.app}`);
    expect(girado2.app).toBe(true);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/pt/trilhas");
    await page.waitForLoadState("networkidle");
    expect((await sonda("janela 1280x800")).app).toBe(false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    expect((await sonda("de volta a 390x844 sem recarregar")).app).toBe(true);
  });

  test("auditoria: telas do app sem 'Voltar ao site' nem link para /alumia", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("lucia:aviso", JSON.stringify({ apoio: Date.now() })));
    for (const caminho of ["/pt/app", "/pt/app/estudar", "/pt/app/jogos", "/pt/app/eu", "/pt/app/eu/caderno", "/pt/app/estudar/enem", "/pt/app/estudar/enem/enem-como-funciona", "/pt/app/estudar/enem/enem-como-funciona/como-funciona-o-enem"]) {
      await page.goto(caminho);
      await page.waitForLoadState("networkidle");
      if (caminho === "/pt/app/eu/caderno") await foto(page, "app-caderno");
      if (caminho === "/pt/app/estudar/enem") await foto(page, "app-enem-porta");
      if (caminho.endsWith("/como-funciona-o-enem")) await foto(page, "app-enem-aula");
      const texto = await page.locator("body").innerText();
      const achou = /voltar (ao|para o) site|back to the web ?site/i.test(texto);
      const alumia = await page.locator('a[href*="/alumia"]:visible').count();
      console.log(`AUDITORIA ${caminho}: voltar-ao-site=${achou} links-alumia-visiveis=${alumia}`);
      expect(achou, `${caminho}: texto "Voltar ao site"`).toBe(false);
      expect(alumia, `${caminho}: links visíveis para a Alumia`).toBe(v.id === "navegador" && caminho === "/pt/app/eu" ? 1 : 0);
    }
  });

  test("área útil, fim da rolagem, voltar e pequeno (360x640)", async ({ page }) => {
    test.skip(v.id !== "standalone", "basta numa variante");
    await page.addInitScript(() => window.localStorage.setItem("lucia:aviso", JSON.stringify({ apoio: Date.now() })));
    const medir = () =>
      page.evaluate(() => {
        const nav = document.querySelector(".shell-abas")!.getBoundingClientRect();
        const main = document.querySelector("main#conteudo")!;
        const ultimo = main.lastElementChild?.getBoundingClientRect();
        return { navTopo: Math.round(nav.top), ultimoFundo: ultimo ? Math.round(ultimo.bottom) : null, rolagemX: document.documentElement.scrollWidth - window.innerWidth, altura: window.innerHeight };
      });
    for (const tamanho of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
      await page.setViewportSize(tamanho);
      for (const [nome, caminho] of [["inicio", "/pt/app"], ["estudar", "/pt/app/estudar"], ["jogos", "/pt/app/jogos"], ["eu", "/pt/app/eu"]] as const) {
        await page.goto(caminho);
        await page.waitForLoadState("networkidle");
        await foto(page, `${tamanho.width}-${nome}-topo`);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(600);
        const m = await medir();
        console.log(`MEDIDA ${tamanho.width}x${tamanho.height} ${nome}: ${JSON.stringify(m)}`);
        await foto(page, `${tamanho.width}-${nome}-fim`);
        expect(m.rolagemX, `${nome} ${tamanho.width}: rolagem horizontal`).toBeLessThanOrEqual(1);
        if (m.ultimoFundo !== null) expect(m.ultimoFundo, `${nome} ${tamanho.width}: o fim do conteúdo fica atrás da barra`).toBeLessThanOrEqual(m.navTopo + 1);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    // Voltar: de uma disciplina para a lista, e do apoio para o Eu.
    await page.goto("/pt/app/estudar");
    await page.waitForLoadState("networkidle");
    await page.locator(".app-item-lista").first().click();
    await page.waitForURL(/\/pt\/app\/estudar\/[^/]+$/);
    await page.waitForLoadState("networkidle");
    const aoAbrir = page.url();
    await foto(page, "voltar-1-disciplina");
    await page.locator("button.shell-icone").first().click();
    await page.waitForURL(/\/pt\/app\/estudar$/);
    await page.waitForLoadState("networkidle");
    console.log(`VOLTAR estudar: abriu ${aoAbrir}, voltou para ${page.url()}`);
    await foto(page, "voltar-2-de-volta");
    expect(page.url()).toMatch(/\/pt\/app\/estudar$/);
    await page.goto("/pt/app/eu");
    await page.waitForLoadState("networkidle");
    await page.locator("a.app-atalho-apoiar").click();
    await page.waitForURL(/\/pt\/apoie/);
    await page.waitForLoadState("networkidle");
    await foto(page, "voltar-3-apoie");
    await page.locator("button.shell-icone").first().click();
    await page.waitForURL(/\/pt\/app\/eu$/);
    await page.waitForLoadState("networkidle");
    console.log(`VOLTAR eu: voltou para ${page.url()}`);
    expect(page.url()).toMatch(/\/pt\/app\/eu$/);
    // Aula: rolar até o fim e achar o botão de concluir.
    await page.goto(AULA);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(600);
    await foto(page, "aula-fim");
  });
});
