// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A casca do chat (onda R3, item 1.2): um projeto Next ESTÁTICO, separado do site, que vai DENTRO do app (Android hoje; o computador
// usa a mesma saída). Leva o chat inteiro (o motor de cifra, as telas do chat) e nada da rede social: o app não baixa código de chave
// de lugar nenhum. A rede social abre fora da casca (no Android, numa tela sem ponte com o nativo).
//
// Monta com `node casca/montar.mjs` (copia os WebAssembly do chat para casca/public/cifra e roda o `next build` aqui dentro). A saída
// vai para casca/saida (o `webDir` do capacitor.config.ts). Os imports de ../lib e ../components entram por caminho ("externalDir").
// A checagem de tipos é a do projeto inteiro (`npm run typecheck` na raiz já inclui casca/**): aqui ela não roda de novo.
import { createHash } from "node:crypto";
import path from "node:path";
import type { NextConfig } from "next";

const raiz = path.resolve(import.meta.dirname, "..");

/**
 * Build reproduzível em QUALQUER pasta: o número de cada módulo do webpack sai do nome do módulo SEM a pasta onde o repositório
 * está. O "deterministic" do webpack tira a pasta do caminho, mas não de dentro do pedido do carregador do Next (a lista de
 * módulos do cliente vai codificada no endereço), e duas montagens do mesmo commit em pastas diferentes davam números diferentes
 * (achado por scripts/testar-r3-android-build.mjs). Aqui a pasta é tirada em todas as formas em que aparece (crua, com barras
 * trocadas, em JSON e codificada para endereço) antes do resumo. Número repetido: o seguinte livre, na ordem do nome (fixa).
 */
function semPasta(texto: string): string {
  const formas = new Set<string>();
  for (const r of [raiz, raiz.replace(/\\/g, "/"), raiz.replace(/\//g, "\\")]) {
    formas.add(r);
    formas.add(JSON.stringify(r).slice(1, -1));
    formas.add(encodeURIComponent(r));
    formas.add(encodeURIComponent(JSON.stringify(r).slice(1, -1)));
  }
  let s = texto;
  for (const f of [...formas].sort((a, b) => b.length - a.length)) s = s.split(f).join("<raiz>");
  return s;
}

interface Modulo {
  identifier(): string;
}
interface Compilacao {
  chunkGraph: { getModuleId(m: Modulo): unknown; setModuleId(m: Modulo, id: number): void };
  hooks: { moduleIds: { tap(nome: string, f: (modulos: Iterable<Modulo>) => void): void } };
}
interface Compilador {
  hooks: { compilation: { tap(nome: string, f: (c: Compilacao) => void): void } };
}

const numerosSemPasta = {
  apply(compilador: Compilador) {
    compilador.hooks.compilation.tap("NumerosSemPasta", (c) => {
      c.hooks.moduleIds.tap("NumerosSemPasta", (modulos) => {
        const usados = new Set<number>();
        const lista = [...modulos]
          .filter((m) => c.chunkGraph.getModuleId(m) === null)
          .map((m) => ({ m, chave: semPasta(m.identifier()) }))
          .sort((a, b) => (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0));
        for (const { m, chave } of lista) {
          let id = parseInt(createHash("sha256").update(chave).digest("hex").slice(0, 8), 16) % 1_000_000;
          while (usados.has(id)) id = (id + 1) % 1_000_000;
          usados.add(id);
          c.chunkGraph.setModuleId(m, id);
        }
      });
    });
  },
};

const config: NextConfig = {
  output: "export",
  distDir: "saida",
  // Sem nada que dependa de servidor: imagens sem otimizador, sem barra no fim (o WebView abre /index.html).
  images: { unoptimized: true },
  trailingSlash: false,
  // A identidade do build NÃO pode variar entre duas montagens iguais (build reproduzível): id fixo pela versão do app.
  generateBuildId: async () => `casca-${process.env.ALUMIA_APP_VERSAO ?? "0.1.0"}`,
  experimental: { externalDir: true },
  turbopack: { root: raiz },
  outputFileTracingRoot: raiz,
  typescript: { ignoreBuildErrors: true },
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  webpack(cfg: { optimization: { moduleIds?: unknown }; plugins: unknown[] }) {
    cfg.optimization.moduleIds = false;
    cfg.plugins.push(numerosSemPasta);
    return cfg;
  },
};

export default config;
