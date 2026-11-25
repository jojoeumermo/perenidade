// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// O script das preferências, que roda inline antes da primeira pintura. Mora aqui, sem "use client", para o servidor poder ler o
// texto exato: a página do chat (lib/rede/chat/origem.ts) libera este script pelo hash dele na política de scripts.
import { KEYS } from "./chaves";
import { scriptDoApp, hostDoEndereco } from "./rede/app-do-instituto";
import { ALUMIA_URL } from "./rede/alumia";

/** Leitores de tinta eletrônica (Kindle, Kobo e parentes): o site entra sozinho no visual próprio para eles. */
export const readerDevice = /Kindle|Silk|EBRD|E-?Reader|Kobo|PocketBook|Tolino|Onyx|BOOX|E Ink/i;

/**
 * A página é da Alumia? No endereço próprio (alumia.institutolucia.org, alumia.localhost) ou em /<idioma>/alumia. A mesma conta
 * roda no script inline (texto abaixo) e em lib/prefs.ts (naAlumia), para os dois decidirem igual.
 */
export const naAlumiaJs = `(location.hostname.indexOf("alumia.")===0||location.pathname.split("/")[2]==="alumia")`;

// Prompt 5 (E7): no site do instituto (Escola e painel incluídos) o modo leve liga SOZINHO com aparelho fraco (pouca memória:
// navigator.deviceMemory ≤ 2) ou com economia de dados (Save-Data, prefers-reduced-data), enquanto a pessoa não escolher. Na Alumia
// ele não liga sozinho (lá o foco é a experiência, A17 e A20): continua só como escolha no botão de acessibilidade.
export const prefsScript = `(function(){${scriptDoApp(hostDoEndereco(ALUMIA_URL))}try{var d=document.documentElement;if(matchMedia("(display-mode: standalone), (display-mode: minimal-ui)").matches||navigator.userAgent.indexOf("; wv)")>-1||navigator.standalone===true||(!${naAlumiaJs}&&matchMedia("(pointer: coarse) and (max-width: 768px)").matches&&!${readerDevice}.test(navigator.userAgent))){d.setAttribute("data-app","");var c=function(){var m=document.querySelector('meta[name="viewport"]');if(m&&m.content.indexOf("viewport-fit")<0)m.content+=", viewport-fit=cover, interactive-widget=resizes-content";return m};if(!c())document.addEventListener("DOMContentLoaded",c)}}catch(e){}try{var d=document.documentElement;if(${readerDevice}.test(navigator.userAgent)){d.setAttribute("data-leitor","");d.setAttribute("data-eink","")}}catch(e){}try{var d=document.documentElement,t=localStorage.getItem("${KEYS.theme}");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);var p=JSON.parse(localStorage.getItem("${KEYS.a11y}")||"{}");if(p.scale>100)d.style.fontSize=p.scale+"%";if(p.scale>=130)d.setAttribute("data-escala",String(p.scale));if(p.spacing&&p.lines===undefined&&p.letters===undefined){p.lines=2;p.letters=1}[["contrast","contrast"],["eink","eink"],["focus","focus"],["black","black"],["light","light"],["pacote","pacote"],["dyslexia","dislexia"],["links","links"],["motion","parado"],["cursor","cursor"],["fortes","fortes"]].forEach(function(k){if(p[k[0]])d.setAttribute("data-"+k[1],"")});[["lines","linhas"],["letters","letras"],["guide","guia"],["color","cor"]].forEach(function(k){if(p[k[0]])d.setAttribute("data-"+k[1],String(p[k[0]]))});if(p.lines||p.letters)d.setAttribute("data-spacing","");var al=${naAlumiaJs};if(al)d.setAttribute("data-na-alumia","");if(p.light===undefined&&!al&&((navigator.connection&&navigator.connection.saveData)||(navigator.deviceMemory>0&&navigator.deviceMemory<=2)||matchMedia("(prefers-reduced-data: reduce)").matches))d.setAttribute("data-light","")}catch(e){}})()`;
