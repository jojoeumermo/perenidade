// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Um verificador ortográfico pequeno no jeito do Hunspell: lê o .aff (prefixos, sufixos, condições, tabela REP e
// TRY) e o .dic, e confere cada palavra tirando um prefixo e/ou um sufixo na hora, em vez de gerar todas as formas
// de antemão (o dicionário de português geraria milhões). Feito para o dicionário VERO de pt-BR; testado em
// scripts/testar-chines.mjs.

interface Regra {
  flag: string;
  tira: string;
  poe: string;
  condicao: RegExp;
  cruza: boolean;
}

export interface Corretor {
  correta(palavra: string): boolean;
  sugestoes(palavra: string, limite?: number): string[];
}

const condicao = (c: string, fim: boolean) => (c === "." ? /.*/ : new RegExp(fim ? `${c}$` : `^${c}`, "u"));

export function criarCorretor(aff: string, dic: string): Corretor {
  const sufixos = new Map<string, Regra[]>();
  const prefixos = new Map<string, Regra[]>();
  const rep: [string, string][] = [];
  let tentar = "";
  let proibida = "";
  let semSugestao = "";
  const cruzado = new Map<string, boolean>();
  for (const bruta of aff.split(/\r?\n/)) {
    const linha = bruta.replace(/\s+#.*$/, "").trim();
    if (!linha || linha.startsWith("#")) continue;
    const p = linha.split(/\s+/);
    if (p[0] === "TRY") tentar = p[1] ?? "";
    else if (p[0] === "FORBIDDENWORD") proibida = p[1] ?? "";
    else if (p[0] === "NOSUGGEST") semSugestao = p[1] ?? "";
    else if (p[0] === "REP" && p.length >= 3) rep.push([p[1].replace(/_/g, " "), p[2].replace(/_/g, " ")]);
    else if ((p[0] === "SFX" || p[0] === "PFX") && p.length === 4 && /^[YN]$/.test(p[2])) cruzado.set(`${p[0]}${p[1]}`, p[2] === "Y");
    else if ((p[0] === "SFX" || p[0] === "PFX") && p.length >= 5) {
      const fim = p[0] === "SFX";
      const poe = p[3] === "0" ? "" : p[3].split("/")[0];
      const regra: Regra = { flag: p[1], tira: p[2] === "0" ? "" : p[2], poe, condicao: condicao(p[4], fim), cruza: cruzado.get(`${p[0]}${p[1]}`) ?? false };
      const mapa = fim ? sufixos : prefixos;
      mapa.set(poe, [...(mapa.get(poe) ?? []), regra]);
    }
  }
  const palavras = new Map<string, string>();
  const linhas = dic.split(/\r?\n/);
  for (let i = 1; i < linhas.length; i++) {
    const l = linhas[i].split(/\s/)[0];
    if (!l) continue;
    const barra = l.indexOf("/");
    const w = barra < 0 ? l : l.slice(0, barra);
    const f = barra < 0 ? "" : l.slice(barra + 1);
    palavras.set(w, (palavras.get(w) ?? "") + f);
  }
  const temFlag = (w: string, flag?: string) => {
    const f = palavras.get(w);
    if (f === undefined) return false;
    if (proibida && f.includes(proibida)) return false;
    return flag ? f.includes(flag) : true;
  };
  /** Tira um sufixo (e, se pedido, confere outra flag no radical para o prefixo cruzado). */
  const porSufixo = (w: string, flagExtra?: string) => {
    for (let k = 0; k <= w.length - 1; k++) {
      const poe = w.slice(w.length - k);
      const regras = sufixos.get(poe);
      if (!regras) continue;
      for (const r of regras) {
        if (flagExtra && !r.cruza) continue;
        const radical = w.slice(0, w.length - k) + r.tira;
        if (radical && r.condicao.test(radical) && temFlag(radical, r.flag) && (!flagExtra || temFlag(radical, flagExtra))) return true;
      }
    }
    return false;
  };
  const conhecida = (w: string) => {
    if (temFlag(w)) {
      const f = palavras.get(w) ?? "";
      return !(f && proibida && f.includes(proibida));
    }
    if (porSufixo(w)) return true;
    for (let k = 1; k < w.length; k++) {
      const regras = prefixos.get(w.slice(0, k));
      if (!regras) continue;
      for (const r of regras) {
        const radical = r.tira + w.slice(k);
        if (!r.condicao.test(radical)) continue;
        if (temFlag(radical, r.flag)) return true;
        if (r.cruza && porSufixo(radical, r.flag)) return true;
      }
    }
    return false;
  };
  const correta = (palavra: string): boolean => {
    const w = palavra.replace(/’/g, "'");
    if (!w) return true;
    if (conhecida(w)) return true;
    const minuscula = w.toLocaleLowerCase("pt-BR");
    if (minuscula !== w) {
      if (conhecida(minuscula)) return true;
      const capital = minuscula[0].toLocaleUpperCase("pt-BR") + minuscula.slice(1);
      if (capital !== w && conhecida(capital)) return true;
    }
    // Palavra com hífen que não está inteira no dicionário: vale se cada parte estiver.
    if (w.includes("-")) return w.split("-").every((parte) => parte && correta(parte));
    return false;
  };
  const sugerivel = (w: string) => correta(w) && !(semSugestao && (palavras.get(w) ?? "").includes(semSugestao));
  const sugestoes = (palavra: string, limite = 6) => {
    const base = palavra.toLocaleLowerCase("pt-BR");
    const maiuscula = palavra[0] !== palavra[0]?.toLocaleLowerCase("pt-BR");
    const achadas: string[] = [];
    const tenta = (c: string) => { if (c && c !== base && !achadas.includes(c) && sugerivel(c)) achadas.push(c); };
    for (const [de, para] of rep) {
      let i = base.indexOf(de);
      while (i >= 0) { tenta(base.slice(0, i) + para + base.slice(i + de.length)); i = base.indexOf(de, i + 1); }
    }
    const letras = [...new Set([...tentar.toLocaleLowerCase("pt-BR")])];
    for (let i = 0; i < base.length; i++) for (const l of letras) tenta(base.slice(0, i) + l + base.slice(i + 1));
    for (let i = 0; i <= base.length; i++) for (const l of letras) tenta(base.slice(0, i) + l + base.slice(i));
    for (let i = 0; i < base.length; i++) tenta(base.slice(0, i) + base.slice(i + 1));
    for (let i = 0; i < base.length - 1; i++) tenta(base.slice(0, i) + base[i + 1] + base[i] + base.slice(i + 2));
    const fim = achadas.slice(0, limite);
    return maiuscula ? fim.map((s) => s[0].toLocaleUpperCase("pt-BR") + s.slice(1)) : fim;
  };
  return { correta, sugestoes };
}
