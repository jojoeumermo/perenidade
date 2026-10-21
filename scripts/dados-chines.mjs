// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prepara os dados de chinês que o site serve do próprio domínio (nada é buscado de fora na hora do uso):
//   1. o dicionário CC-CEDICT (MDBG, CC BY-SA 4.0), baixado de https://www.mdbg.net (cerca de 4 MB comprimido),
//      convertido para public/dados/chines/cedict.json.gzip;
//   2. os traços de um recorte de caracteres comuns do pacote hanzi-writer-data (Arphic Public License),
//      copiados sem alteração para public/dados/chines/hanzi/<código>.json, com a licença ao lado;
//   3. public/dados/chines/caracteres.json: o recorte, com pinyin e a primeira tradução de cada caractere.
// Uso: node scripts/dados-chines.mjs (rode de novo para atualizar; a data da extração vai em meta.json).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { lerLinha } from "../lib/ferramentas/chines.ts";

const raiz = path.resolve(import.meta.dirname, "..");
const destino = path.join(raiz, "public/dados/chines");
fs.mkdirSync(path.join(destino, "hanzi"), { recursive: true });
const FONTE = "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz";

const bruto = zlib.gunzipSync(Buffer.from(await (await fetch(FONTE, { headers: { "user-agent": "InstitutoLucia-dados/1.0" } })).arrayBuffer())).toString("utf8");
const versao = /#! date=(\S+)/.exec(bruto)?.[1] ?? "";
const entradas = bruto.split("\n").filter((l) => l && !l.startsWith("#")).map(lerLinha).filter(Boolean);
fs.writeFileSync(path.join(destino, "cedict.json.gzip"), zlib.gzipSync(JSON.stringify(entradas), { level: 9 }));

// O recorte de caracteres: os das aulas de chinês e das ferramentas do site, mais uma lista de caracteres de uso comum.
const COMUNS = "的一是不了人我在有他这中大来上国个到说们为子和你地出道也时年得就那要下以生会自着去之过家学对可她里后小么心多天而能好都然没日于起还发成事只作当想看文无开手十用主行方又如前所本见经头面公同三已老从动两长知民样现分将外但身些与高意进把法此实回二理美点月明其种声全工己话儿者向情部正名定女问力机给等几很业最间新什打便位因重被走电四第门相次东政海口使教西再平真听世气信北少关并内加化由却代军产入先山五太水万市眼体别处总才场师书比住员九笑性通目华报立马命张活难神数件安表原车白应路期叫死常提感金何更反合放做系计或司利受光王果亲界及今京务制解各任至清物台象记边共风战干接它许八特觉望直服毛林题建南度统色字请交爱让认算论百吃义科怎元社术结六功指思非流每青管夫连远资队跟带花快条院变联言权往展该领传近留红治决周保达办运武半候七必城父强步完革深区即求品士转量空甚众技轻程告江语英基派满式李息写呢识极令黄德收脸钱党倒未持取设始版双历越史商千片容研像找友孩站广改议形委早房音火际则首单据导影失拿网香似斯专石若兵弟谁校读志飞观争究包组造落视济喜离虽坐集编宝谈府拉黑且随格尽剑讲布杀微怕母调局根曾准团段终乐切级克精哪官示冷域孙拍尔照河答紧响雪尼续施配亚细停妈病态木室游角零午朋喝茶饭菜米鱼肉鸡蛋汤糖酒水果买卖钱块毛分店医院学校老师同学朋友爸妈哥姐弟妹儿女孩狗猫鸟马牛羊猪春夏秋冬早晚今明昨星期号点钟刻半岁冷热雨雪云风阴晴红黄蓝绿白黑书本笔纸桌椅床门窗灯车船飞机站路左右上下前后里外东南西北";
const textos = [
  ...fs.readdirSync(path.join(raiz, "content")).flatMap((d) => { const p = path.join(raiz, "content", d); return fs.statSync(p).isDirectory() ? lerTudo(p) : []; }),
  fs.readFileSync(path.join(raiz, "components/tools/novas/Linguas.tsx"), "utf8"),
];
function lerTudo(dir) {
  return fs.readdirSync(dir).flatMap((n) => { const p = path.join(dir, n); return fs.statSync(p).isDirectory() ? lerTudo(p) : /\.(md|json)$/.test(n) ? [fs.readFileSync(p, "utf8")] : []; });
}
// Só caracteres das aulas de chinês e das ferramentas (o acervo traz nomes chineses soltos que não interessam aqui).
const dasAulas = textos.filter((t) => /pinyin|mandarim|chinês|hanzi/i.test(t)).join("");
const conjunto = [...new Set([...COMUNS, ...dasAulas.match(/\p{Script=Han}/gu) ?? []])];
const pasta = path.join(raiz, "node_modules/hanzi-writer-data");
const recorte = conjunto.filter((c) => fs.existsSync(path.join(pasta, `${c}.json`)));
for (const c of recorte) fs.copyFileSync(path.join(pasta, `${c}.json`), path.join(destino, "hanzi", `${c.codePointAt(0).toString(16)}.json`));
fs.copyFileSync(path.join(pasta, "ARPHICPL.TXT"), path.join(destino, "hanzi", "ARPHICPL.TXT"));

const porCaractere = new Map();
for (const e of entradas) if ([...e[0]].length === 1 && !porCaractere.has(e[0]) && !/^(surname|variant of|old variant|used in)/i.test(e[3])) porCaractere.set(e[0], [e[2], e[3].split(" / ").slice(0, 2).join(" / ")]);
fs.writeFileSync(path.join(destino, "caracteres.json"), JSON.stringify(recorte.map((c) => [c, ...(porCaractere.get(c) ?? ["", ""])])));
fs.writeFileSync(path.join(destino, "meta.json"), JSON.stringify({ cedict: { fonte: FONTE, licenca: "CC BY-SA 4.0", autoria: "MDBG e colaboradores do CC-CEDICT", versao, extraido_em: new Date().toISOString().slice(0, 10), entradas: entradas.length }, hanzi: { fonte: "hanzi-writer-data 2.0.1 (Make Me a Hanzi)", licenca: "Arphic Public License", caracteres: recorte.length } }, null, 1));
console.log(`cedict: ${entradas.length} entradas (versão ${versao}); hanzi: ${recorte.length} caracteres de ${conjunto.length}`);
