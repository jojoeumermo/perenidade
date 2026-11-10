// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O endereço próprio da Escola (lib/escola/endereco.ts): o que abre no host dela, o que volta ao site e o que o site
// manda para lá. Roda no Node: `npm run testar:escola-endereco`.
import { caminhoDoSiteParaEscola, hostDaEscola, rotaNaEscola, siteVistoDaEscola } from "../lib/escola/endereco.ts";

let certos = 0;
const falhas = [];
const igual = (nome, a, b) => (JSON.stringify(a) === JSON.stringify(b) ? certos++ : falhas.push(`${nome}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`));
const BASE = "https://escola.institutolucia.org";

igual("host escola.*", hostDaEscola("escola.institutolucia.org"), true);
igual("host escola.localhost com porta", hostDaEscola("escola.localhost:3107"), true);
igual("host do site não é da Escola", hostDaEscola("institutolucia.org", BASE), false);
igual("host vazio", hostDaEscola(""), false);

igual("raiz vai para a Escola", rotaNaEscola("/"), { tipo: "redirecionar", destino: "/pt/escola" });
igual("só o idioma vai para a Escola", rotaNaEscola("/en"), { tipo: "redirecionar", destino: "/en/escola" });
igual("a Escola segue", rotaNaEscola("/pt/escola/nucleo"), { tipo: "seguir" });
igual("a Escola sem idioma ganha o pt", rotaNaEscola("/escola/nucleo"), { tipo: "redirecionar", destino: "/pt/escola/nucleo" });
igual("entrar abre no host da Escola", rotaNaEscola("/pt/entrar"), { tipo: "seguir" });
igual("o manifesto abre na Escola", rotaNaEscola("/pt/escola/manifesto"), { tipo: "seguir" });
igual("o entrar da Escola abre na Escola", rotaNaEscola("/pt/escola/entrar"), { tipo: "seguir" });
igual("o resto do site volta ao site", rotaNaEscola("/pt/trilhas/x"), { tipo: "site", destino: "/pt/trilhas/x" });
igual("o painel volta ao site", rotaNaEscola("/painel"), { tipo: "site", destino: "/pt/painel" });

igual("sem a variável, o site não manda para lá", caminhoDoSiteParaEscola("/pt/escola", "", ""), null);
igual("com a variável, a Escola vai para lá", caminhoDoSiteParaEscola("/pt/escola/nucleo", "?a=1", BASE), `${BASE}/pt/escola/nucleo?a=1`);
igual("o chamado de militantes vai para a Escola", caminhoDoSiteParaEscola("/pt/escola/militantes", "", BASE), `${BASE}/pt/escola/militantes`);
igual("o manifesto vai para a Escola", caminhoDoSiteParaEscola("/pt/escola/manifesto", "", BASE), `${BASE}/pt/escola/manifesto`);
igual("outra página fica no site", caminhoDoSiteParaEscola("/pt/escolas", "", BASE), null);

igual("o site visto da Escola", siteVistoDaEscola("https:", "escola.institutolucia.org", new URL("https://x.org")).href, "https://institutolucia.org/");

console.log(`escola-endereco: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
