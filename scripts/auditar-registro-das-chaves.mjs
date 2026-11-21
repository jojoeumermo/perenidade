// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O auditor de fora do registro público das chaves do chat (supabase/migracoes/20261113-chat-transparencia.sql). Roda todo dia
// numa máquina do GitHub (.github/workflows/registro-das-chaves.yml), sem conta e sem segredo: baixa o registro inteiro pelas
// duas funções públicas (rede_kt_ponta e rede_kt_trecho), refaz a corrente de resumos SHA-256 desde a primeira linha e compara
// com a cópia que ele mesmo publicou nos dias anteriores, FORA do servidor (o arquivo chaves/corrente.txt do ramo
// "transparencia" deste repositório).
//
// O buraco que ele fecha: um aparelho que nunca viu o registro não consegue notar um passado reescrito (o servidor pode trocar
// uma linha antiga e refazer todos os resumos dali em diante; a corrente nova fecha). Com a cópia de fora, qualquer linha já
// publicada que mude, ou some, acusa. E quem conversa pode comparar o "ponto conferido" do aparelho (número e começo do
// resumo, na tela do código de segurança) com a linha do mesmo número na cópia de fora.
//
// Escrito de novo, sem importar o código do site (lib/rede/chat/transparencia.ts): um auditor que usasse o mesmo código que
// audita herdaria o mesmo erro. O teste (scripts/testar-auditor-das-chaves.mjs) confere que as três contas (banco, aparelho e
// auditor) dão o mesmo resumo.
//
// A cópia guarda só o número e o resumo de cada linha: nem o resumo da conta, nem a chave, nem o dia.
//
// Uso:  SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/auditar-registro-das-chaves.mjs --corrente <arquivo>
//   Sem o arquivo, começa uma cópia nova. Saída 0: tudo confere (o arquivo ganha as linhas novas). Saída 1: o registro não
//   confere (o arquivo NÃO é mexido; o relatório vai para auditoria-das-chaves.md). Saída 2: não deu para baixar o registro.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** O resumo "anterior" da primeira linha: 43 "A" e "=" (o mesmo do banco e do aparelho). */
export const COMECO = `${"A".repeat(43)}=`;
const RESUMO = /^[A-Za-z0-9+/]{43}=$/;
const DIA = /^\d{4}-\d{2}-\d{2}$/;
/** O banco devolve até 1000 linhas por trecho. Teto de trechos por rodada, para um servidor que não pare de mandar. */
const MAIOR_NUMERO_DE_TRECHOS = 20_000;

/**
 * O resumo de uma linha, a partir do resumo da anterior: SHA-256 de "anterior|seq|quem|identidade|versao|dia", em base64. As linhas
 * da onda R2 trazem o tipo ("conta", "aparelho", "aparelho-fora", "passes") e o tipo entra no resumo, depois do número
 * (interno.rede_kt_resumo2); as do chat do beta vêm sem tipo ou com "olm".
 */
export function resumoDaLinha(anterior, l) {
  const tipo = l.tipo === undefined || l.tipo === "olm" ? "" : `${l.tipo}|`;
  return createHash("sha256").update(`${anterior}|${l.seq}|${tipo}${l.quem}|${l.identidade}|${l.versao}|${l.dia}`, "utf8").digest("base64");
}

const falha = (codigo, detalhe) => Object.assign(new Error(`${codigo}: ${detalhe}`), { codigo });

/** Baixa o registro inteiro, trecho por trecho, até a ponta que o servidor anunciou. Lança "registro_estranho" se algo não fecha. */
export async function baixarRegistro(transporte) {
  const ponta = await transporte.ponta();
  if (!ponta || !Number.isSafeInteger(ponta.seq) || ponta.seq < 0 || typeof ponta.resumo !== "string" || !RESUMO.test(ponta.resumo)) {
    throw falha("registro_estranho", "a ponta não tem o formato esperado");
  }
  const linhas = [];
  let trechos = 0;
  while (linhas.length < ponta.seq) {
    if (++trechos > MAIOR_NUMERO_DE_TRECHOS) throw falha("registro_estranho", "trechos demais");
    const trecho = await transporte.trecho(linhas.length);
    if (!Array.isArray(trecho) || trecho.length === 0) throw falha("registro_estranho", `o trecho depois da linha ${linhas.length} veio vazio, mas a ponta é ${ponta.seq}`);
    for (const l of trecho) {
      if (linhas.length >= ponta.seq) break;
      linhas.push(l);
    }
  }
  return { ponta, linhas };
}

/**
 * Refaz a corrente desde a primeira linha. Devolve os problemas (vazio: confere) e o resumo de cada linha (número → resumo).
 * Confere: números seguidos a partir de 1, cada resumo refeito igual ao publicado, os campos no formato do banco, a versão da
 * chave de cada conta só subindo, e a última linha igual à ponta.
 */
export function conferirCorrente({ ponta, linhas }) {
  const problemas = [];
  const resumos = new Map();
  const versoes = new Map();
  let anterior = COMECO;
  for (const [i, l] of linhas.entries()) {
    const esperado = i + 1;
    if (!l || l.seq !== esperado) {
      problemas.push(`a linha ${esperado} veio com o número ${l?.seq}`);
      break;
    }
    if (typeof l.quem !== "string" || !RESUMO.test(l.quem) || typeof l.identidade !== "string" || !l.identidade
        || !Number.isSafeInteger(l.versao) || l.versao < 1 || typeof l.dia !== "string" || !DIA.test(l.dia) || typeof l.resumo !== "string" || !RESUMO.test(l.resumo)) {
      problemas.push(`a linha ${esperado} não tem o formato do registro`);
      break;
    }
    const refeito = resumoDaLinha(anterior, l);
    if (refeito !== l.resumo) {
      problemas.push(`a corrente não fecha na linha ${esperado} (o resumo publicado não é o resumo da linha)`);
      break;
    }
    // A versão só sobe dentro do mesmo tipo de chave (a do chat do beta e a identidade da conta da R2 contam à parte; aparelhos e
    // passes não têm versão que suba).
    const tipo = l.tipo === undefined || l.tipo === "olm" ? "olm" : l.tipo;
    if (tipo === "olm" || tipo === "conta") {
      const antes = versoes.get(`${tipo}:${l.quem}`);
      if (antes !== undefined && l.versao <= antes) problemas.push(`a linha ${esperado} volta a versão da chave de uma conta (${antes} para ${l.versao})`);
      versoes.set(`${tipo}:${l.quem}`, l.versao);
    }
    resumos.set(l.seq, l.resumo);
    anterior = l.resumo;
  }
  if (!problemas.length) {
    if (linhas.length !== ponta.seq) problemas.push(`a ponta diz ${ponta.seq} linhas e vieram ${linhas.length}`);
    else if (anterior !== ponta.resumo) problemas.push("o resumo da ponta não é o da última linha");
  }
  return { problemas, resumos };
}

/** Lê a cópia de fora: uma linha "número resumo" por linha do registro; "#" começa comentário. Lança se o arquivo foi mexido. */
export function lerCorrente(texto) {
  const publicado = new Map();
  let ultimo = 0;
  for (const [i, bruta] of String(texto ?? "").split(/\r?\n/).entries()) {
    const linha = bruta.trim();
    if (!linha || linha.startsWith("#")) continue;
    const m = /^([1-9][0-9]{0,15}) ([A-Za-z0-9+/]{43}=)$/.exec(linha);
    if (!m) throw falha("copia_estranha", `a linha ${i + 1} da cópia não tem o formato "número resumo"`);
    const seq = Number(m[1]);
    if (seq !== ultimo + 1) throw falha("copia_estranha", `a cópia pula do ${ultimo} para o ${seq}`);
    publicado.set(seq, m[2]);
    ultimo = seq;
  }
  return publicado;
}

/** O que mudou entre a cópia de fora e o registro de hoje. Vazio: o passado é o mesmo. */
export function compararComACopia(publicado, resumos, ponta) {
  const problemas = [];
  for (const [seq, resumo] of publicado) {
    if (seq > ponta.seq) {
      problemas.push(`o registro encolheu: a cópia de fora vai até a linha ${publicado.size} e o registro de hoje termina na ${ponta.seq}`);
      break;
    }
    if (resumos.get(seq) !== resumo) {
      problemas.push(`o passado mudou: a linha ${seq} não é a mesma que foi publicada fora do servidor`);
      break;
    }
  }
  return problemas;
}

const CABECALHO = [
  "# Registro público das chaves do chat da Alumia: cópia de fora do servidor.",
  "# Uma linha por linha do registro: o número e o resumo SHA-256 (base64) da corrente até ali.",
  "# Escrito pela rotina .github/workflows/registro-das-chaves.yml; como conferir em docs/rede/CHAT-PRIVADO.md.",
];

/** O texto novo da cópia: o que já havia e as linhas novas do registro. */
export function corrente(resumos) {
  return `${[...CABECALHO, ...[...resumos].sort((a, b) => a[0] - b[0]).map(([seq, resumo]) => `${seq} ${resumo}`)].join("\n")}\n`;
}

/**
 * A auditoria inteira. Devolve { problemas, texto, novas, ponta }: `texto` é a cópia nova (só quando não há problema), `novas`
 * quantas linhas entraram desde a última cópia.
 */
export async function auditar(transporte, textoDaCopia = "") {
  const publicado = lerCorrente(textoDaCopia);
  const registro = await baixarRegistro(transporte);
  const { problemas, resumos } = conferirCorrente(registro);
  if (!problemas.length) problemas.push(...compararComACopia(publicado, resumos, registro.ponta));
  if (problemas.length) return { problemas, texto: null, novas: 0, ponta: registro.ponta };
  return { problemas, texto: corrente(resumos), novas: registro.ponta.seq - publicado.size, ponta: registro.ponta };
}

/** O transporte de verdade: as duas funções públicas pelo PostgREST, com a chave pública (anon) do projeto. */
export function transportePeloPostgrest(url, chave) {
  const base = String(url ?? "").trim().replace(/\/$/, "");
  if (!/^https:\/\/[^\s/]+$/.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error("SUPABASE_URL precisa ser um endereço https");
  if (!chave) throw new Error("falta SUPABASE_ANON_KEY");
  async function rpc(funcao, corpo) {
    const r = await fetch(`${base}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json", Accept: "application/json", "User-Agent": "AuditorDoRegistro/1.0" },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) throw new Error(`o servidor respondeu ${r.status} em ${funcao}`);
    return r.json();
  }
  return { ponta: () => rpc("rede_kt_ponta", {}), trecho: (desde) => rpc("rede_kt_trecho", { p_desde: desde }) };
}

function argumento(nome) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function saida(nome, valor) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${nome}=${valor}\n`);
}

async function principal() {
  const arquivo = argumento("corrente");
  if (!arquivo) {
    console.error("Uso: node scripts/auditar-registro-das-chaves.mjs --corrente <arquivo>");
    process.exit(2);
  }
  const copia = fs.existsSync(arquivo) ? fs.readFileSync(arquivo, "utf8") : "";
  let resultado;
  try {
    resultado = await auditar(transportePeloPostgrest(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY), copia);
  } catch (e) {
    const codigo = e?.codigo;
    // Cópia mexida ou registro com formato errado também são acusação, não tropeço de rede.
    if (codigo === "copia_estranha" || codigo === "registro_estranho") {
      resultado = { problemas: [String(e.message)], texto: null, novas: 0, ponta: null };
    } else {
      console.error(`Não deu para baixar o registro: ${e?.message ?? e}`);
      saida("problema", "rede");
      process.exit(2);
    }
  }
  if (resultado.problemas.length) {
    const relatorio = [
      "O auditor de fora do registro público das chaves do chat achou um problema:",
      "",
      ...resultado.problemas.map((p) => `- ${p}`),
      "",
      "A cópia de fora NÃO foi atualizada. Se o passado do registro mudou, o servidor pode ter mostrado uma chave falsa a alguém.",
      "Confira o banco antes de qualquer outra coisa; o que fazer está em docs/rede/CHAT-PRIVADO.md (Registro público das chaves).",
    ].join("\n");
    fs.writeFileSync("auditoria-das-chaves.md", `${relatorio}\n`);
    console.error(relatorio);
    saida("problema", "sim");
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(path.resolve(arquivo)), { recursive: true });
  fs.writeFileSync(arquivo, resultado.texto);
  console.log(`O registro confere: ${resultado.ponta.seq} linhas, ${resultado.novas} novas desde a última cópia. Ponta: ${resultado.ponta.seq} ${resultado.ponta.resumo}`);
  saida("problema", "nao");
  saida("novas", String(resultado.novas));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await principal();
