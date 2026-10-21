// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o pinyin com acentos, a leitura do CC-CEDICT e a busca (lib/ferramentas/chines.ts) e o corretor ortográfico
// com o dicionário VERO de português do Brasil. Uso: npm run testar:chines
import fs from "node:fs";
import zlib from "node:zlib";
import { criarCorretor } from "../lib/ferramentas/hunspell.ts";
import { buscar, lerLinha, pinyinComAcento, semTom, silabaComAcento } from "../lib/ferramentas/chines.ts";
import { palavrasDoTexto } from "../lib/ferramentas/ortografia.ts";

let certos = 0;
const falhas = [];
const confere = (nome, cond) => (cond ? certos++ : falhas.push(nome));

confere("hao3 → hǎo", silabaComAcento("hao3") === "hǎo");
confere("ni3 hao3 → nǐ hǎo", pinyinComAcento("ni3 hao3") === "nǐ hǎo");
confere("o tom vai no o de ou: dou4 → dòu", silabaComAcento("dou4") === "dòu");
confere("na última vogal: gui4 → guì, liu2 → liú", silabaComAcento("gui4") === "guì" && silabaComAcento("liu2") === "liú");
confere("ü: lv4 e lu:4 → lǜ", silabaComAcento("lv4") === "lǜ" && silabaComAcento("lu:4") === "lǜ");
confere("tom neutro: ma5 → ma", silabaComAcento("ma5") === "ma");
confere("maiúscula: Bei3 → Běi", silabaComAcento("Bei3") === "Běi");
confere("sem tom", semTom("nǐ hǎo") === "ni hao");
const linha = lerLinha("你好 你好 [ni3 hao3] /hello/hi/");
confere("linha do CC-CEDICT", JSON.stringify(linha) === JSON.stringify(["你好", "", "ni3 hao3", "hello / hi"]));
confere("tradicional diferente fica guardado", lerLinha("學生 学生 [xue2 sheng5] /student/")[1] === "學生");
const dic = [["妈", "媽", "ma1", "mum / mother"], ["马", "馬", "ma3", "horse"], ["吗", "嗎", "ma5", "question particle"], ["你好", "", "ni3 hao3", "hello / hi"], ["你", "", "ni3", "you"]];
confere("busca por caractere, o exato primeiro", buscar(dic, "你")[0][0] === "你" && buscar(dic, "你").length === 2);
confere("busca por pinyin sem tom acha os três ma", buscar(dic, "ma").length === 3);
confere("busca por pinyin com acento acha só o certo", buscar(dic, "mǎ").length === 1 && buscar(dic, "mǎ")[0][0] === "马");
confere("busca por pinyin com número", buscar(dic, "ma3")[0][0] === "马");
confere("busca por palavra em inglês", buscar(dic, "horse")[0][0] === "马");
confere("busca de frase em pinyin", buscar(dic, "nihao")[0][0] === "你好");

const meta = JSON.parse(fs.readFileSync("public/dados/chines/meta.json", "utf8"));
confere("dicionário com mais de 100 mil entradas e licença registrada", meta.cedict.entradas > 100000 && meta.cedict.licenca === "CC BY-SA 4.0");
confere("os traços têm a licença ao lado", fs.existsSync("public/dados/chines/hanzi/ARPHICPL.TXT") && fs.existsSync(`public/dados/chines/hanzi/${"你".codePointAt(0).toString(16)}.json`));

confere("palavras do texto, com hífen e acento", JSON.stringify(palavrasDoTexto("Ação, guarda-chuva e 3 casas.").map((p) => p.palavra)) === JSON.stringify(["Ação", "guarda-chuva", "e", "casas"]));
const inicio = Date.now();
const corretor = criarCorretor(zlib.gunzipSync(fs.readFileSync("public/dados/ortografia/pt-br.aff.gzip")).toString("utf8"), zlib.gunzipSync(fs.readFileSync("public/dados/ortografia/pt-br.dic.gzip")).toString("utf8"));
const tempo = Date.now() - inicio;
confere("palavras certas passam", ["casa", "ação", "trabalhadores", "educação", "coração", "Brasil", "Casas", "falávamos", "refazer", "guarda-chuva", "inconstitucionalmente"].every((w) => corretor.correta(w)));
confere("palavras erradas são apontadas", ["caza", "exeção", "trabalhadoris", "concerteza"].every((w) => !corretor.correta(w)));
confere("sugere a palavra certa", corretor.sugestoes("caza").includes("casa") && corretor.sugestoes("exeção").includes("exceção"));

console.log(`chinês e ortografia: ${certos} conferências certas, ${falhas.length} falhas (o dicionário carregou em ${tempo} ms)`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
