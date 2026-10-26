// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Leva as regras do Mural de Saúde (content/saude/regras.json, o único lugar onde elas são escritas) para o banco: a
// lista de bloqueio, as categorias e a versão do termo viram o bloco gerado de supabase/install.sql, entre as marcas
// "mural-de-saude". Depois, é só rodar o install.sql de novo.
//
//   npm run mural:sincronizar            → reescreve o bloco
//   node scripts/mural-saude-sincronizar.mjs --conferir   → só confere (sai com erro se o bloco estiver velho)
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const arquivoSql = path.join(raiz, "supabase/install.sql");
const regras = JSON.parse(fs.readFileSync(path.join(raiz, "content/saude/regras.json"), "utf8"));
const INICIO = "-- >>> mural-de-saude (gerado por scripts/mural-saude-sincronizar.mjs a partir de content/saude/regras.json: não edite à mão)";
const FIM = "-- <<< mural-de-saude";

/** Só o que o banco usa: nada de textos de tela. */
export function regrasDoBanco() {
  return {
    termoVersao: regras.termoVersao,
    sobreMaximo: regras.sobreMaximo,
    categorias: regras.categorias,
    publicos: Object.keys(regras.publicos),
    idiomas: regras.idiomas,
    bloqueio: regras.bloqueio,
    padroesEspeciais: regras.padroesEspeciais,
  };
}

export function blocoGerado() {
  const json = JSON.stringify(regrasDoBanco());
  if (json.includes("$regras$")) throw new Error("O texto das regras não pode conter $regras$.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(regras.termoVersao)) throw new Error("termoVersao precisa ser AAAA-MM-DD.");
  return [
    INICIO,
    `create or replace function interno.saude_regras() returns jsonb language sql immutable as $$ select $regras$${json}$regras$::jsonb $$;`,
    `create or replace function interno.saude_termo_vigente() returns text language sql immutable as $$ select '${regras.termoVersao}'::text $$;`,
    FIM,
  ].join("\n");
}

const conferir = process.argv.includes("--conferir");
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const sql = fs.readFileSync(arquivoSql, "utf8");
  const i = sql.indexOf("-- >>> mural-de-saude");
  const j = sql.indexOf(FIM);
  if (i < 0 || j < i) {
    console.error("Não achei as marcas do bloco mural-de-saude em supabase/install.sql.");
    process.exit(1);
  }
  const atual = sql.slice(i, j + FIM.length);
  const novo = blocoGerado();
  if (conferir) {
    if (atual !== novo) {
      console.error("O bloco mural-de-saude de supabase/install.sql está diferente de content/saude/regras.json. Rode: npm run mural:sincronizar");
      process.exit(1);
    }
    console.log("Mural de Saúde: o banco e content/saude/regras.json estão iguais.");
  } else {
    fs.writeFileSync(arquivoSql, sql.slice(0, i) + novo + sql.slice(j + FIM.length));
    console.log(atual === novo ? "Nada mudou." : "Bloco mural-de-saude atualizado em supabase/install.sql. Rode o install.sql de novo no banco.");
  }
}
