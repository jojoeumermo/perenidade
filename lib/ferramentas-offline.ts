// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Baixar para o WhatsApp" também nas ferramentas (Etapa 3, B17): a calculadora, o laboratório leve ou a conta vira um
// .html único, com o próprio código dentro (sem nada de fora: sem rede, sem fonte, sem imagem), que abre sem internet
// num celular antigo e cabe numa mensagem (menos de 1 MB; as daqui têm poucos KB).
//
// Só entram as ferramentas que NÃO dependem de servidor nem de biblioteca pesada e cuja conta cabe em poucas linhas
// (a calculadora, os juros compostos, as bases numéricas, o conversor de unidades, a escala cartográfica e o
// cronômetro). Editor de código, simulações (PhET), pronúncia (voz do aparelho), dicionários (arquivos grandes),
// gráficos, resolvedor, tabela periódica e as ferramentas com valores de lei (que mudam e pedem o site) ficam de fora:
// para elas o botão não aparece (temVersaoOffline devolve false).
//
// O código dentro do arquivo é ES5 de propósito (var, function, sem seta nem template): roda em navegador de celular
// de 2014. Cada ferramenta separa o "núcleo" (a conta, sem tela) da "cola" (a tela): o teste roda só o núcleo no Node.
// Sem os atalhos "@/" de propósito: os roteiros de conferência rodam este arquivo direto no Node.
import { ESTILO, escapar, LIMITE_DO_ARQUIVO } from "./arquivo-unico.ts";

export { LIMITE_DO_ARQUIVO };

export const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;
export type IdiomaOffline = (typeof IDIOMAS)[number];

/** As frases da tela do arquivo, nos seis idiomas (o título da ferramenta vem do dicionário do site). */
const FRASES: Record<IdiomaOffline, Record<string, string>> = {
  pt: {
    value: "Valor", result: "Resultado", invalid: "Confira os números digitados.", from: "De", to: "Para", tooBig: "Número grande demais para esta conta.",
    calcExpr: "Conta (use + − × ÷ e parênteses)", calcHint: "Exemplo: (12 + 8) × 3 ÷ 4",
    initial: "Valor inicial", monthly: "Depósito por mês", rate: "Taxa de juros (%)", perMonth: "ao mês", perYear: "ao ano", months: "Meses",
    total: "Total no fim", invested: "Total que você colocou", simple: "Com juros simples seria",
    category: "Grandeza", cLength: "Comprimento", cMass: "Massa", cVolume: "Volume", cTime: "Tempo", cTemp: "Temperatura",
    modeReal: "Do mapa para o terreno", modeMap: "Do terreno para o mapa", modeScale: "Achar a escala", scaleN: "Escala 1 : ", onMap: "No mapa", onGround: "No terreno",
    start: "Iniciar", pause: "Pausar", lap: "Volta", reset: "Zerar", laps: "Voltas",
  },
  en: {
    value: "Value", result: "Result", invalid: "Check the numbers you typed.", from: "From", to: "To", tooBig: "Number too large for this calculation.",
    calcExpr: "Calculation (use + - × ÷ and parentheses)", calcHint: "Example: (12 + 8) × 3 ÷ 4",
    initial: "Starting amount", monthly: "Deposit per month", rate: "Interest rate (%)", perMonth: "per month", perYear: "per year", months: "Months",
    total: "Total at the end", invested: "Total you put in", simple: "With simple interest it would be",
    category: "Quantity", cLength: "Length", cMass: "Mass", cVolume: "Volume", cTime: "Time", cTemp: "Temperature",
    modeReal: "From map to ground", modeMap: "From ground to map", modeScale: "Find the scale", scaleN: "Scale 1 : ", onMap: "On the map", onGround: "On the ground",
    start: "Start", pause: "Pause", lap: "Lap", reset: "Reset", laps: "Laps",
  },
  es: {
    value: "Valor", result: "Resultado", invalid: "Revisa los números escritos.", from: "De", to: "A", tooBig: "Número demasiado grande para esta cuenta.",
    calcExpr: "Cuenta (usa + - × ÷ y paréntesis)", calcHint: "Ejemplo: (12 + 8) × 3 ÷ 4",
    initial: "Valor inicial", monthly: "Depósito por mes", rate: "Tasa de interés (%)", perMonth: "al mes", perYear: "al año", months: "Meses",
    total: "Total al final", invested: "Total que pusiste", simple: "Con interés simple sería",
    category: "Magnitud", cLength: "Longitud", cMass: "Masa", cVolume: "Volumen", cTime: "Tiempo", cTemp: "Temperatura",
    modeReal: "Del mapa al terreno", modeMap: "Del terreno al mapa", modeScale: "Hallar la escala", scaleN: "Escala 1 : ", onMap: "En el mapa", onGround: "En el terreno",
    start: "Iniciar", pause: "Pausar", lap: "Vuelta", reset: "Reiniciar", laps: "Vueltas",
  },
  fr: {
    value: "Valeur", result: "Résultat", invalid: "Vérifiez les nombres saisis.", from: "De", to: "Vers", tooBig: "Nombre trop grand pour ce calcul.",
    calcExpr: "Calcul (utilisez + - × ÷ et des parenthèses)", calcHint: "Exemple : (12 + 8) × 3 ÷ 4",
    initial: "Montant de départ", monthly: "Dépôt par mois", rate: "Taux d'intérêt (%)", perMonth: "par mois", perYear: "par an", months: "Mois",
    total: "Total à la fin", invested: "Total versé", simple: "En intérêts simples, ce serait",
    category: "Grandeur", cLength: "Longueur", cMass: "Masse", cVolume: "Volume", cTime: "Temps", cTemp: "Température",
    modeReal: "De la carte au terrain", modeMap: "Du terrain à la carte", modeScale: "Trouver l'échelle", scaleN: "Échelle 1 : ", onMap: "Sur la carte", onGround: "Sur le terrain",
    start: "Démarrer", pause: "Pause", lap: "Tour", reset: "Remise à zéro", laps: "Tours",
  },
  ru: {
    value: "Значение", result: "Результат", invalid: "Проверьте введённые числа.", from: "Из", to: "В", tooBig: "Слишком большое число для этого расчёта.",
    calcExpr: "Выражение (используйте + - × ÷ и скобки)", calcHint: "Пример: (12 + 8) × 3 ÷ 4",
    initial: "Начальная сумма", monthly: "Взнос в месяц", rate: "Процентная ставка (%)", perMonth: "в месяц", perYear: "в год", months: "Месяцев",
    total: "Итого в конце", invested: "Всего вы внесли", simple: "При простых процентах было бы",
    category: "Величина", cLength: "Длина", cMass: "Масса", cVolume: "Объём", cTime: "Время", cTemp: "Температура",
    modeReal: "С карты на местность", modeMap: "С местности на карту", modeScale: "Найти масштаб", scaleN: "Масштаб 1 : ", onMap: "На карте", onGround: "На местности",
    start: "Старт", pause: "Пауза", lap: "Круг", reset: "Сброс", laps: "Круги",
  },
  zh: {
    value: "数值", result: "结果", invalid: "请检查输入的数字。", from: "从", to: "到", tooBig: "数字太大，无法计算。",
    calcExpr: "算式（可用 + - × ÷ 和括号）", calcHint: "例：(12 + 8) × 3 ÷ 4",
    initial: "起始金额", monthly: "每月存入", rate: "利率 (%)", perMonth: "每月", perYear: "每年", months: "月数",
    total: "期末总额", invested: "你投入的总额", simple: "按单利计算则是",
    category: "量", cLength: "长度", cMass: "质量", cVolume: "体积", cTime: "时间", cTemp: "温度",
    modeReal: "从地图到实地", modeMap: "从实地到地图", modeScale: "求比例尺", scaleN: "比例尺 1 : ", onMap: "地图上", onGround: "实地",
    start: "开始", pause: "暂停", lap: "分段", reset: "清零", laps: "分段记录",
  },
};

interface Ferramenta {
  /** O corpo da tela (HTML com ids; os textos vêm de data-t="chave"). */
  corpo: string;
  /** A conta, sem tela: roda no navegador e no Node (o teste). Define funções soltas. */
  nucleo: string;
  /** A cola entre a tela e o núcleo (só no navegador). Tem à mão: $(id), F(número), L (as frases), LANG. */
  cola: string;
}

const AJUDAS = String.raw`
function $(i){return document.getElementById(i)}
function ler(i){var v=String($(i).value).replace(",",".");return v===""?NaN:Number(v)}
function F(n,d){if(typeof n!=="number"||!isFinite(n))return "";try{return n.toLocaleString(LANG,{maximumFractionDigits:d==null?4:d})}catch(e){return String(Math.round(n*10000)/10000)}}
function textos(){var a=document.querySelectorAll("[data-t]");for(var i=0;i<a.length;i++){a[i].textContent=L[a[i].getAttribute("data-t")]||""}}
function ao(ids,f){for(var i=0;i<ids.length;i++){var e=$(ids[i]);e.addEventListener("input",f);e.addEventListener("change",f)}}
`;

const FERRAMENTAS: Record<string, Ferramenta> = {
  calculadora: {
    corpo: String.raw`<label><span data-t="calcExpr"></span><input id="e" type="text" inputmode="decimal" autocomplete="off" value="(12 + 8) × 3 ÷ 4"></label><p class="dica" data-t="calcHint"></p><p class="res" role="status" id="r"></p>`,
    nucleo: String.raw`
function calcular(texto){
  var s=String(texto).replace(/,/g,".").replace(/[×x]/g,"*").replace(/[÷:]/g,"/").replace(/[−–]/g,"-");
  if(!/^[0-9+\-*\/().\s]+$/.test(s)||/[*\/]{2}/.test(s.replace(/\s/g,"")))return NaN;
  try{var v=Function('"use strict";return ('+s+')')();return typeof v==="number"&&isFinite(v)?v:NaN}catch(e){return NaN}
}`,
    cola: String.raw`function atualizar(){var v=calcular($("e").value);$("r").textContent=isFinite(v)?F(v,10):L.invalid}ao(["e"],atualizar);atualizar();`,
  },
  "juros-compostos": {
    corpo: String.raw`<div class="grade"><label><span data-t="initial"></span><input id="c" inputmode="decimal" value="1000"></label><label><span data-t="monthly"></span><input id="d" inputmode="decimal" value="100"></label><label><span data-t="rate"></span><input id="t" inputmode="decimal" value="1"></label><label><span>&nbsp;</span><select id="p"><option value="m" data-t="perMonth"></option><option value="a" data-t="perYear"></option></select></label><label><span data-t="months"></span><input id="n" inputmode="numeric" value="24"></label></div><p class="res" role="status" id="r"></p>`,
    nucleo: String.raw`
function juros(capital,deposito,taxa,anual,meses){
  meses=Math.floor(meses);
  if(!isFinite(capital)||!isFinite(deposito)||!isFinite(taxa)||!isFinite(meses)||capital<0||deposito<0||taxa<0||taxa>1000||meses<1||meses>1200)return null;
  var i=anual?Math.pow(1+taxa/100,1/12)-1:taxa/100,total=capital,m;
  for(m=1;m<=meses;m++){total=total*(1+i)+deposito}
  if(!isFinite(total))return null;
  return{total:total,investido:capital+deposito*meses,simples:capital*(1+i*meses)+deposito*(meses+(i*meses*(meses-1))/2)};
}`,
    cola: String.raw`function atualizar(){var r=juros(ler("c"),ler("d"),ler("t"),$("p").value==="a",ler("n"));$("r").innerHTML=r?"<b>"+L.total+":</b> "+F(r.total,2)+"<br>"+L.invested+": "+F(r.investido,2)+"<br>"+L.simple+": "+F(r.simples,2):L.invalid}ao(["c","d","t","p","n"],atualizar);atualizar();`,
  },
  "bases-numericas": {
    corpo: String.raw`<div class="grade"><label><span data-t="value"></span><input id="v" autocomplete="off" autocapitalize="characters" value="255"></label><label><span data-t="from"></span><select id="a"><option>2</option><option>8</option><option selected>10</option><option>16</option></select></label><label><span data-t="to"></span><select id="b"><option>2</option><option>8</option><option>10</option><option selected>16</option></select></label></div><p class="res" role="status" id="r"></p>`,
    nucleo: String.raw`
function converterBase(texto,de,para){
  var s=String(texto).replace(/\s/g,"").toLowerCase();
  if(!s||s.length>60)return null;
  var digitos="0123456789abcdefghijklmnopqrstuvwxyz",v=0,i,d;
  for(i=0;i<s.length;i++){d=digitos.indexOf(s.charAt(i));if(d<0||d>=de)return null;v=v*de+d;if(v>9007199254740991)return "grande"}
  return v.toString(para).toUpperCase();
}`,
    cola: String.raw`function atualizar(){var r=converterBase($("v").value,Number($("a").value),Number($("b").value));$("r").textContent=r==null?L.invalid:(r==="grande"?L.tooBig:r)}ao(["v","a","b"],atualizar);atualizar();`,
  },
  "conversor-de-unidades": {
    corpo: String.raw`<div class="grade"><label><span data-t="category"></span><select id="g"></select></label><label><span data-t="value"></span><input id="v" inputmode="decimal" value="1"></label><label><span data-t="from"></span><select id="a"></select></label><label><span data-t="to"></span><select id="b"></select></label></div><p class="res" role="status" id="r"></p>`,
    nucleo: String.raw`
var UNIDADES={
  cLength:{mm:0.001,cm:0.01,m:1,km:1000,"in":0.0254,ft:0.3048,yd:0.9144,mi:1609.344},
  cMass:{mg:0.000001,g:0.001,kg:1,t:1000,oz:0.028349523125,lb:0.45359237},
  cVolume:{mL:0.001,L:1,"m³":1000,"gal(US)":3.785411784},
  cTime:{s:1,min:60,h:3600,d:86400},
  cTemp:{"°C":1,"°F":1,K:1}
};
function converterUnidade(valor,grandeza,de,para){
  var u=UNIDADES[grandeza];
  if(!u||!(de in u)||!(para in u)||!isFinite(valor))return NaN;
  if(grandeza==="cTemp"){
    var k=de==="°C"?valor+273.15:(de==="°F"?(valor-32)*5/9+273.15:valor);
    if(k<0)return NaN;
    return para==="°C"?k-273.15:(para==="°F"?(k-273.15)*9/5+32:k);
  }
  return valor*u[de]/u[para];
}`,
    cola: String.raw`
function opcoes(id,lista,sel){var h="",i;for(i=0;i<lista.length;i++){h+="<option value=\""+lista[i]+"\""+(i===sel?" selected":"")+">"+lista[i]+"</option>"}$(id).innerHTML=h}
function nomes(){var h="",k;for(k in UNIDADES){h+="<option value=\""+k+"\">"+L[k]+"</option>"}$("g").innerHTML=h}
function unidades(){var l=[],k;for(k in UNIDADES[$("g").value]){l.push(k)}opcoes("a",l,l.length>2?2:0);opcoes("b",l,l.length>3?3:1);atualizar()}
function atualizar(){var r=converterUnidade(ler("v"),$("g").value,$("a").value,$("b").value);$("r").textContent=isFinite(r)?F(ler("v"),6)+" "+$("a").value+" = "+F(r,6)+" "+$("b").value:L.invalid}
nomes();$("g").addEventListener("change",unidades);ao(["v","a","b"],atualizar);unidades();`,
  },
  "escala-cartografica": {
    corpo: String.raw`<div class="grade"><label><span data-t="result"></span><select id="m"><option value="real" data-t="modeReal"></option><option value="mapa" data-t="modeMap"></option><option value="escala" data-t="modeScale"></option></select></label><label><span data-t="scaleN"></span><input id="n" inputmode="numeric" value="100000"></label><label><span data-t="onMap"></span><input id="a" inputmode="decimal" value="5"></label><label><span>cm / m / km</span><select id="ua"><option>cm</option><option>m</option><option>km</option></select></label><label><span data-t="onGround"></span><input id="b" inputmode="decimal" value="5"></label><label><span>cm / m / km</span><select id="ub"><option>cm</option><option>m</option><option selected>km</option></select></label></div><p class="res" role="status" id="r"></p>`,
    nucleo: String.raw`
var EM_CM={cm:1,m:100,km:100000};
function escalaMapaParaReal(medida,uMapa,n,uReal){return medida*EM_CM[uMapa]*n/EM_CM[uReal]}
function escalaRealParaMapa(medida,uReal,n,uMapa){return medida*EM_CM[uReal]/n/EM_CM[uMapa]}
function escalaAchar(mapa,uMapa,real,uReal){return real*EM_CM[uReal]/(mapa*EM_CM[uMapa])}`,
    cola: String.raw`function atualizar(){var m=$("m").value,n=ler("n"),a=ler("a"),b=ler("b"),ua=$("ua").value,ub=$("ub").value,r;
if(m==="real"){r=n>0?escalaMapaParaReal(a,ua,n,ub):NaN;$("r").textContent=isFinite(r)?F(a)+" "+ua+" → "+F(r)+" "+ub:L.invalid}
else if(m==="mapa"){r=n>0?escalaRealParaMapa(b,ub,n,ua):NaN;$("r").textContent=isFinite(r)?F(b)+" "+ub+" → "+F(r)+" "+ua:L.invalid}
else{r=a>0?escalaAchar(a,ua,b,ub):NaN;$("r").textContent=isFinite(r)&&r>0?"1 : "+F(r,0):L.invalid}}
ao(["m","n","a","b","ua","ub"],atualizar);atualizar();`,
  },
  cronometro: {
    corpo: String.raw`<p class="res" id="r" role="timer" aria-live="off">0:00.0</p><p class="botoes"><button type="button" id="i" data-t="start"></button> <button type="button" id="v" data-t="lap"></button> <button type="button" id="z" data-t="reset"></button></p><ol id="l"></ol>`,
    nucleo: String.raw`
function formatarTempo(ms){
  if(!isFinite(ms)||ms<0)ms=0;
  var d=Math.floor(ms/100)%10,s=Math.floor(ms/1000)%60,m=Math.floor(ms/60000)%60,h=Math.floor(ms/3600000);
  return (h>0?h+":"+(m<10?"0":"")+m:String(m))+":"+(s<10?"0":"")+s+"."+d;
}`,
    cola: String.raw`var rodando=false,base=0,acum=0,tick=null,voltas=0;
function agora(){return acum+(rodando?new Date().getTime()-base:0)}
function mostrar(){$("r").textContent=formatarTempo(agora())}
$("i").onclick=function(){if(rodando){acum=agora();rodando=false;clearInterval(tick);$("i").textContent=L.start}else{base=new Date().getTime();rodando=true;tick=setInterval(mostrar,100);$("i").textContent=L.pause}mostrar()};
$("v").onclick=function(){if(!rodando&&acum===0)return;voltas++;var li=document.createElement("li");li.textContent=L.lap+" "+voltas+": "+formatarTempo(agora());$("l").insertBefore(li,$("l").firstChild)};
$("z").onclick=function(){rodando=false;clearInterval(tick);acum=0;voltas=0;$("l").innerHTML="";$("i").textContent=L.start;mostrar()};`,
  },
};

const ESTILO_EXTRA =
  "label{display:block;margin:.6rem 0;font:600 15px/1.3 sans-serif}label span{display:block;margin-bottom:.2rem}" +
  "input,select{box-sizing:border-box;width:100%;font:18px Georgia,serif;padding:.5rem;border:2px solid #1f1a14;background:#fffdf8;color:#1f1a14}" +
  "button{font:600 17px sans-serif;padding:.6rem 1rem;border:2px solid #1f1a14;background:#fffdf8;color:#1f1a14;border-radius:0}" +
  ".grade{display:grid;gap:0 1rem;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))}.res{font:700 1.5rem/1.4 Georgia,serif;margin:1rem 0;overflow-wrap:anywhere}" +
  ".dica{font:14px sans-serif;color:#5a4e3c}@media(prefers-color-scheme:dark){input,select,button{background:#221c15;color:#efe4c8;border-color:#efe4c8}.dica{color:#c9bb9a}}";

/** As ferramentas que viram arquivo único. */
export const FERRAMENTAS_OFFLINE: readonly string[] = Object.keys(FERRAMENTAS);

/** Esta ferramenta tem versão offline? Quando não, a página não mostra o botão. */
export const temVersaoOffline = (id: string): boolean => Object.prototype.hasOwnProperty.call(FERRAMENTAS, id);

/** O núcleo de uma ferramenta (só a conta), para o teste rodar no Node. */
export const nucleoDe = (id: string): string => (temVersaoOffline(id) ? FERRAMENTAS[id].nucleo : "");

/** Um texto dentro de <script> sem poder fechá-lo nem abrir comentário. */
const paraScript = (valor: unknown) =>
  JSON.stringify(valor)
    .replace(/</g, "\\u003c")
    .replace(/[\u2028\u2029]/g, (x) => (x === "\u2028" ? "\\u2028" : "\\u2029"));

/** O documento inteiro da ferramenta: título, tela, código, e o rodapé com a fonte. Devolve null se a ferramenta não tem versão offline. */
export function montarFerramentaUnica({ id, titulo, descricao, url, lang, fonte, rodape }: { id: string; titulo: string; descricao?: string; url: string; lang: string; fonte: string; rodape: string }): string | null {
  if (!temVersaoOffline(id)) return null;
  const idioma: IdiomaOffline = (IDIOMAS as readonly string[]).includes(lang) ? (lang as IdiomaOffline) : "pt";
  const f = FERRAMENTAS[id];
  const frases = { ...FRASES.pt, ...FRASES[idioma] };
  return (
    `<!doctype html><html lang="${escapar(idioma)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${escapar(titulo)} — Instituto Lúcia</title><style>${ESTILO}${ESTILO_EXTRA}</style></head><body><main>` +
    `<h1>${escapar(titulo)}</h1>${descricao ? `<p>${escapar(descricao)}</p>` : ""}<section>${f.corpo}</section>` +
    `<footer><p>${escapar(rodape)}</p><p>${escapar(fonte)} <a href="${escapar(url)}">${escapar(url)}</a> · Instituto Lúcia</p></footer></main>` +
    `<script>var L=${paraScript(frases)},LANG=${paraScript(idioma === "zh" ? "zh-CN" : idioma)};${AJUDAS}${f.nucleo}\ntry{textos();${f.cola}}catch(e){}</script></body></html>`
  );
}

/** Tamanho em bytes do texto em UTF-8. */
export const tamanhoDoArquivo = (texto: string) => new TextEncoder().encode(texto).length;

/** Nome do arquivo da ferramenta: "ferramenta-juros-compostos.html". */
export const nomeDaFerramenta = (id: string) => `ferramenta-${id.replace(/[^a-z0-9-]/gi, "").slice(0, 60) || "ferramenta"}.html`;
