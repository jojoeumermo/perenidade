// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getClient, type Me, porNivel } from "@/lib/backend";
import { Aviso, botao, botaoClaro, campo, papeis } from "./comum";

/**
 * A faixa de assinatura de e-mail de quem está na equipe, em Minha conta: duas versões (a clássica, em papel claro, e a
 * faixa preta, no desenho dos lambe-lambes), com nome, função e e-mail que a pessoa pode mudar. Sai de três jeitos:
 * copiada como assinatura pronta para colar no Gmail ou no Tutamail (HTML com o estilo em cada elemento, que é o único
 * que os programas de e-mail respeitam), o código HTML puro e uma imagem PNG desenhada aqui mesmo.
 */

type Versao = "classica" | "preta";
type Dados = { nome: string; funcao: string; email: string };

const SITE = "https://institutolucia.org";
const MARCA = `${SITE}/marca-192.png`;
const INSTA = "@institutoluciaorg";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** O HTML da assinatura: tabela simples, cores e letras em cada elemento, a marca vinda do site. */
function htmlDa(versao: Versao, d: Dados): string {
  const nome = esc(d.nome || "Seu nome");
  const funcao = esc(d.funcao || "Voluntário");
  const email = esc(d.email);
  if (versao === "classica") {
    return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#ffffff;font-family:Georgia,'Times New Roman',serif;color:#1f1a14">
<tr>
<td style="padding:14px 20px 14px 4px;vertical-align:middle"><img src="${MARCA}" width="72" height="72" alt="Instituto Lúcia" style="display:block;border:0;border-radius:50%"></td>
<td style="padding:14px 22px 14px 0;vertical-align:middle;border-right:2px solid #c21f16">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:3px;color:#1f1a14">INSTITUTO</div>
<div style="font-size:26px;line-height:1.05;color:#6e1f1a">Lúcia</div>
</td>
<td style="padding:14px 0 14px 22px;vertical-align:middle">
<div style="font-size:24px;line-height:1.1;color:#6e1f1a">${nome}</div>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;color:#5a4e3c;text-transform:uppercase;padding-top:4px">${funcao}</div>
${email ? `<div style="padding-top:6px"><a href="mailto:${email}" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#6e1f1a;text-decoration:none">${email}</a></div>` : ""}
<div style="padding-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:12px"><a href="${SITE}" style="color:#1f1a14;font-weight:bold;text-decoration:none">institutolucia.org</a> <span style="color:#c21f16">&#9733;</span> <a href="https://www.instagram.com/institutoluciaorg/" style="color:#1f1a14;text-decoration:none">${INSTA}</a></div>
</td>
</tr>
</table>`;
  }
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#1f1a14;border-top:4px solid #c21f16;font-family:Georgia,'Times New Roman',serif;color:#f4ecd8">
<tr>
<td style="padding:16px 18px;vertical-align:middle"><img src="${MARCA}" width="60" height="60" alt="Instituto Lúcia" style="display:block;border:0;border-radius:50%"></td>
<td style="padding:16px 22px 16px 0;vertical-align:middle">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:900;font-style:italic;text-transform:uppercase;line-height:1;color:#f4ecd8">${nome}</div>
<div style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:2px;color:#e0837a;text-transform:uppercase;padding-top:6px;white-space:nowrap">${funcao} &middot; Instituto Lúcia</div>
${email ? `<div style="padding-top:8px"><a href="mailto:${email}" style="font-family:'Courier New',Courier,monospace;font-size:13px;color:#f4ecd8;text-decoration:none">${email}</a></div>` : ""}
</td>
<td style="padding:16px 18px;vertical-align:middle;background:#c21f16;font-family:Arial,Helvetica,sans-serif;font-weight:900;font-style:italic;text-transform:uppercase;line-height:0.95;font-size:15px;color:#ffffff">
<a href="${SITE}" style="color:#ffffff;text-decoration:none">O saber<br>é do povo</a>
<div style="font-family:'Courier New',Courier,monospace;font-style:normal;font-weight:normal;text-transform:none;font-size:11px;padding-top:6px">${INSTA}</div>
</td>
</tr>
</table>`;
}

/** A mesma faixa desenhada num canvas, para baixar como imagem (o dobro do tamanho, para ficar nítida). */
async function desenhar(versao: Versao, d: Dados): Promise<Blob | null> {
  const raiz = getComputedStyle(document.documentElement);
  const serif = raiz.getPropertyValue("--font-serif-display").trim() || "Georgia, serif";
  const sans = raiz.getPropertyValue("--font-ui").trim() || "Arial, sans-serif";
  const mono = raiz.getPropertyValue("--font-archive").trim() || "monospace";
  await document.fonts.ready;
  const marca = new Image();
  marca.src = "/marca-192.png";
  await marca.decode().catch(() => undefined);
  const e = 2;
  const w = versao === "classica" ? 720 : 760;
  const h = versao === "classica" ? 150 : 132;
  const tela = document.createElement("canvas");
  tela.width = w * e;
  tela.height = h * e;
  const c = tela.getContext("2d");
  if (!c) return null;
  c.scale(e, e);
  const nome = d.nome || "Seu nome";
  const funcao = (d.funcao || "Voluntário").toUpperCase();
  const cortar = (t: string, max: number) => {
    let s = t;
    while (c.measureText(s).width > max && s.length > 3) s = s.slice(0, -2);
    return s === t ? t : `${s.trimEnd()}…`;
  };
  if (versao === "classica") {
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, w, h);
    if (marca.complete) {
      c.save();
      c.beginPath();
      c.arc(54, 75, 40, 0, Math.PI * 2);
      c.clip();
      c.drawImage(marca, 14, 35, 80, 80);
      c.restore();
    }
    c.fillStyle = "#1f1a14";
    c.font = `bold 11px ${sans}`;
    c.letterSpacing = "3px";
    c.fillText("INSTITUTO", 112, 66);
    c.letterSpacing = "0px";
    c.fillStyle = "#6e1f1a";
    c.font = `30px ${serif}`;
    c.fillText("Lúcia", 112, 98);
    c.fillStyle = "#c21f16";
    c.fillRect(112, 106, 26, 3);
    c.fillRect(232, 26, 2, 98);
    c.fillStyle = "#6e1f1a";
    c.font = `28px ${serif}`;
    c.fillText(cortar(nome, 460), 256, 58);
    c.fillStyle = "#c21f16";
    c.fillRect(256, 68, 440, 1.5);
    c.fillStyle = "#5a4e3c";
    c.font = `600 11px ${sans}`;
    c.letterSpacing = "2.5px";
    c.fillText(cortar(funcao, 440), 256, 88);
    c.letterSpacing = "0px";
    c.fillStyle = "#6e1f1a";
    c.font = `bold 15px ${sans}`;
    if (d.email) c.fillText(cortar(d.email, 440), 256, 110);
    c.fillStyle = "#1f1a14";
    c.font = `bold 12px ${sans}`;
    c.fillText(`institutolucia.org  ★  ${INSTA}`, 256, 130);
  } else {
    c.fillStyle = "#1f1a14";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#c21f16";
    c.fillRect(0, 0, w, 5);
    c.fillRect(w - 180, 5, 180, h - 5);
    if (marca.complete) {
      c.save();
      c.beginPath();
      c.arc(52, 70, 32, 0, Math.PI * 2);
      c.clip();
      c.drawImage(marca, 20, 38, 64, 64);
      c.restore();
    }
    c.fillStyle = "#f4ecd8";
    c.font = `italic 900 24px ${sans}`;
    c.fillText(cortar(nome.toUpperCase(), 470), 104, 60);
    c.fillStyle = "#e0837a";
    c.font = `11px ${mono}`;
    c.letterSpacing = "2px";
    c.fillText(cortar(`${funcao} · INSTITUTO LÚCIA`, 470), 104, 82);
    c.letterSpacing = "0px";
    c.fillStyle = "#f4ecd8";
    c.font = `13px ${mono}`;
    if (d.email) c.fillText(cortar(d.email, 470), 104, 104);
    c.fillStyle = "#ffffff";
    c.font = `italic 900 19px ${sans}`;
    c.fillText("O SABER", w - 160, 58);
    c.fillText("É DO POVO", w - 160, 80);
    c.font = `11px ${mono}`;
    c.fillText(INSTA, w - 160, 104);
  }
  return new Promise((ok) => tela.toBlob(ok, "image/png"));
}

/** A função principal da pessoa, em palavras (a do maior nível, e a disciplina quando houver). */
function funcaoDe(me: Me) {
  const principal = porNivel(me.papeis)[0];
  if (!principal) return "Voluntário";
  return papeis[principal.papel].replace(/^Comunicação: .*/, "Departamento de Comunicação");
}

export function FaixaDeEmail({ me }: { me: Me }) {
  const [versao, setVersao] = useState<Versao>("classica");
  const [dados, setDados] = useState<Dados>({ nome: me.nome, funcao: funcaoDe(me), email: "" });
  const [aviso, setAviso] = useState("");
  const previa = useRef<HTMLDivElement>(null);
  // O e-mail vem da própria conta (só a pessoa vê o dela); dá para trocar pelo e-mail do instituto.
  useEffect(() => {
    let vivo = true;
    void getClient()
      .then((cliente) => cliente.auth.getUser())
      .then(({ data }) => {
        const email = data.user?.email;
        if (vivo && email) setDados((x) => (x.email ? x : { ...x, email }));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  const html = useMemo(() => htmlDa(versao, dados), [versao, dados]);

  async function copiarAssinatura() {
    setAviso("");
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([`${dados.nome}\n${dados.funcao} · Instituto Lúcia\n${dados.email}\ninstitutolucia.org · ${INSTA}`], { type: "text/plain" }) })]);
      setAviso("Assinatura copiada ✓ No Gmail: Configurações › Ver todas as configurações › Assinatura › Criar nova, e cole (Ctrl+V). No Tutamail: Configurações › E-mail › Assinatura de e-mail › Personalizada, e cole.");
    } catch {
      // Navegador sem cópia de HTML: seleciona a prévia para a pessoa copiar com Ctrl+C.
      const r = document.createRange();
      if (previa.current) {
        r.selectNodeContents(previa.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(r);
      }
      setAviso("Este navegador não deixou copiar sozinho: a assinatura ficou selecionada, aperte Ctrl+C e cole no seu e-mail.");
    }
  }
  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(html);
      setAviso("Código HTML copiado ✓ Use em programas que pedem a assinatura em HTML.");
    } catch {
      setAviso("Não deu para copiar o código neste navegador.");
    }
  }
  async function baixarImagem() {
    const blob = await desenhar(versao, dados);
    if (!blob) return setAviso("Não deu para gerar a imagem neste navegador.");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `assinatura-instituto-lucia-${versao}.png`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  return (
    <section className="painel-cartao p-5">
      <h2 className="font-serif text-xl font-semibold">Faixa de assinatura de e-mail</h2>
      <p className="mt-1 text-sm text-ink-soft">A sua assinatura do Instituto Lúcia, para usar nos e-mails que você manda pelo instituto. O nome, a função e o e-mail podem ser mudados aqui: nada disso é guardado nem muda a sua conta.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Versão da faixa">
        {([["classica", "Clássica (papel claro)"], ["preta", "Faixa preta (lambe-lambe)"]] as const).map(([id, nome]) => (
          <button key={id} type="button" role="radio" aria-checked={versao === id} onClick={() => setVersao(id)} className={`cursor-pointer border-2 px-3 py-1.5 text-sm font-semibold ${versao === id ? "border-ink bg-ink text-parchment" : "border-ink hover:bg-parchment"}`}>
            {nome}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold">
          Nome
          <input value={dados.nome} maxLength={60} onChange={(e) => setDados({ ...dados, nome: e.target.value })} className={campo} />
        </label>
        <label className="text-sm font-semibold">
          Função
          <input value={dados.funcao} maxLength={60} onChange={(e) => setDados({ ...dados, funcao: e.target.value })} className={campo} />
        </label>
        <label className="text-sm font-semibold">
          E-mail
          <input value={dados.email} type="email" maxLength={120} onChange={(e) => setDados({ ...dados, email: e.target.value })} className={campo} />
        </label>
      </div>
      <p className="mt-2 text-xs text-ink-soft">Dica: se você tem um e-mail do instituto, use ele aqui no lugar do pessoal.</p>
      <div className="mt-4 overflow-x-auto border-2 border-dashed border-rule bg-[#e8e4dc] p-4">
        {/* A prévia é o próprio HTML que vai para o e-mail. */}
        <div ref={previa} className="inline-block" dangerouslySetInnerHTML={{ __html: html.replaceAll(MARCA, "/marca-192.png") }} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={botao} onClick={() => void copiarAssinatura()}>Copiar para o Gmail ou o Tutamail</button>
        <button type="button" className={botaoClaro} onClick={() => void baixarImagem()}>Baixar como imagem (PNG)</button>
        <button type="button" className={botaoClaro} onClick={() => void copiarCodigo()}>Copiar o código HTML</button>
      </div>
      <Aviso texto={aviso} />
    </section>
  );
}
