// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Material da auditoria: abre cada seção (e cada aba) do painel com uma conta de teste e anota erro na tela e chamada
// ao banco que falhou. Só para o banco de teste local (npm run dev:local); nunca em produção.
//
// Como usar, no console do navegador (ou pela ferramenta de JavaScript do navegador embutido):
//   1. Abra http://localhost:3201/pt (site do dev:local) e cole este arquivo inteiro.
//   2. Entre como uma conta de teste: await __entrar("mediador", true)   — o segundo argumento confirma o segundo
//      fator (use true para coord, vice, curadora e mediador). A chave anônima de teste sai de:
//      node -e 'import("./scripts/backend-local.mjs").then((m) => console.log(m.CHAVE_ANON))'
//      e vai em __chave antes de entrar: window.__chave = "...".
//   3. Abra /pt/painel, cole o arquivo de novo e rode: __iniciar()   — o percurso leva um ou dois minutos.
//   4. Leia o resultado: __resultado   (por seção: "ok" ou "PROBLEMA" com o erro da tela e as chamadas que falharam).
// Os únicos erros esperados no console são de /auth/v1/passkeys, que o banco de teste não simula.

window.__entrar = async (conta, fator, porta = 54420) => {
  const base = `http://127.0.0.1:${porta}`;
  const pedir = (caminho, token, corpo) =>
    fetch(base + caminho, { method: "POST", headers: { apikey: window.__chave, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo ?? {}) }).then((r) => r.json());
  let sessao = await pedir("/auth/v1/token?grant_type=password", window.__chave, { email: `${conta}@local`, password: "x" });
  if (fator) {
    const novo = await pedir("/auth/v1/factors", sessao.access_token, { factor_type: "totp" });
    sessao = await pedir(`/auth/v1/factors/${novo.id}/verify`, sessao.access_token, { code: "123456" });
  }
  localStorage.setItem("lucia:sessao", JSON.stringify(sessao));
  return sessao.user.email;
};

window.__percorrer = async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  performance.setResourceTimingBufferSize(10000);
  const estavel = async (titulo) => {
    for (let i = 0; i < 40 && titulo && document.querySelector("h1")?.innerText !== titulo; i++) await esperar(150);
    let antes = "";
    let iguais = 0;
    for (let i = 0; i < 60 && iguais < 4; i++) {
      await esperar(250);
      const agora = document.querySelector(".max-w-5xl")?.innerText ?? "";
      if (agora === antes && !/Carregando/.test(agora)) iguais++;
      else iguais = 0;
      antes = agora;
    }
  };
  const ruim = /Você não tem permissão[^.]*\.|Algo deu errado[^.]*\.|Entre na sua conta[^.]*\.|Não encontrado\.|Sem conexão[^.]*\.|Confira o campo[^.]*\.|Carregando/g;
  const botoes = () => [...document.querySelectorAll('nav[aria-label="Seções do painel"] button')];
  await estavel();
  const saida = {};
  for (const nome of botoes().map((b) => b.querySelector("span").textContent)) {
    performance.clearResourceTimings();
    botoes().find((b) => b.querySelector("span").textContent === nome).click();
    await estavel(nome);
    const area = document.querySelector(".max-w-5xl");
    const erros = new Set((area.innerText.match(ruim) || []).map((e) => `início: ${e}`));
    const abas = [...area.querySelectorAll("[role=tablist] button")].map((b) => b.textContent.trim());
    for (let i = 0; i < abas.length; i++) {
      const aba = [...area.querySelectorAll("[role=tablist] button")][i];
      if (!aba) continue;
      aba.click();
      await esperar(300);
      await estavel(nome);
      for (const e of area.innerText.match(ruim) || []) erros.add(`${abas[i]}: ${e}`);
    }
    const rede = [...new Set(performance.getEntriesByType("resource").filter((e) => e.name.includes("/rest/v1/rpc/") && e.responseStatus >= 400).map((e) => `${e.name.split("/rpc/")[1]} ${e.responseStatus}`))];
    saida[nome] = (erros.size || rede.length ? `PROBLEMA ${[...erros, ...rede.map((r) => `rede: ${r}`)].join(" ; ")}` : "ok") + (abas.length ? ` [abas: ${abas.join("/")}]` : "");
  }
  return { quem: document.querySelector("aside .truncate")?.textContent, saida };
};

window.__iniciar = () => {
  window.__resultado = "rodando";
  window.__percorrer().then((r) => (window.__resultado = r)).catch((e) => (window.__resultado = `falhou: ${e.message}`));
  return "iniciado";
};
