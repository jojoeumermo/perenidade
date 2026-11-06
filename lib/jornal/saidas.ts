// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os prazos das matérias do Jornal ("sai_do_ar_em"), lidos direto dos arquivos de content/jornal/ para o proxy.ts
// responder 410 no endereço de uma matéria que saiu do ar, mesmo que a página pronta (estática) ainda não tenha sido
// refeita. Lê só a linha do campo no cabeçalho, sem o leitor de YAML, e guarda o resultado: o conteúdo só muda a cada
// publicação, que reinicia o servidor. Sem a pasta (ou sem permissão de leitura), não há prazo: o site segue normal e a
// própria página, ao ser refeita (revalidate), deixa a matéria de fora.
import fs from "node:fs";
import path from "node:path";
import { instanteDeSaida } from "@/lib/jornal/validade";

let guardado: Map<string, string> | null = null;

/** slug → instante ISO em que a matéria sai do ar (só as que têm prazo). */
export function prazosDoJornal(): Map<string, string> {
  if (guardado) return guardado;
  const prazos = new Map<string, string>();
  try {
    const pasta = path.join(process.cwd(), "content", "jornal");
    for (const nome of fs.readdirSync(pasta)) {
      // Só os originais ("slug.md"); as traduções ("slug.en.md") herdam o prazo do original.
      const m = /^([a-z0-9-]+)\.md$/.exec(nome);
      if (!m) continue;
      const texto = fs.readFileSync(path.join(pasta, nome), "utf8").replace(/^\uFEFF/, "");
      const cabecalho = /^---\r?\n([\s\S]*?)\r?\n---/.exec(texto)?.[1] ?? "";
      const linha = /^sai_do_ar_em:[ \t]*["']?([^"'\r\n#]+?)["']?[ \t]*(?:#.*)?$/m.exec(cabecalho);
      const instante = linha ? instanteDeSaida(linha[1]) : null;
      if (instante) prazos.set(m[1], instante);
    }
  } catch {
    // sem a pasta: nenhum prazo
  }
  guardado = prazos;
  return prazos;
}
