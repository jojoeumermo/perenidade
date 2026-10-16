// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O envio dos e-mails automáticos que o banco deixou na fila: o desenho de cada e-mail e uma rodada de envio pelo Resend.
// Usado por dois lugares: a função "enviar-emails" do Supabase (que o próprio banco chama de minuto em minuto) e a
// rotina de reserva do GitHub (scripts/enviar-emails.mjs). Só usa fetch, para rodar igual no Node e no Deno.

export const RESEND = "https://api.resend.com/emails";

const escapar = (texto) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** O texto em parágrafos de HTML: tudo escapado, só os endereços https viram links. */
function paragrafos(texto, estiloLink = "") {
  const estilo = estiloLink ? ` style="${estiloLink}"` : "";
  return escapar(texto)
    .split(/\n{2,}/)
    .map((bloco) => bloco.replace(/(https:\/\/[^\s<]+)/g, `<a href="$1"${estilo}>$1</a>`).replace(/\n/g, "<br>"));
}

const SERIFA = "'EB Garamond',Georgia,'Times New Roman',serif";
const CARTAZ = "Inter,'Helvetica Neue',Arial,sans-serif";
const ARQUIVO = "'IBM Plex Mono',Consolas,'Courier New',monospace";

/**
 * Todo e-mail do instituto com a mesma cara: faixa vinho com o nome, o assunto como título, o texto em serifa, endereço
 * sozinho num parágrafo vira botão vermelho e a assinatura que o banco põe no fim vira o rodapé. Tabelas e estilo na
 * linha, que é o que os leitores de e-mail respeitam. Tudo o que vem do texto é escapado.
 */
export function html(texto, assunto = "Instituto Lúcia") {
  const corte = texto.lastIndexOf("\n\n— Instituto Lúcia");
  const corpo = (corte >= 0 ? texto.slice(0, corte) : texto).trim();
  const blocos = paragrafos(corpo, "color:#6e1f1a;text-decoration:underline").map((p) => {
    const sozinho = /^<a href="(https:[^"]+)"[^>]*>[^<]+<\/a>$/.exec(p);
    if (sozinho) {
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px"><tr><td bgcolor="#c21f16" style="background:#c21f16;border:3px solid #1f1a14"><a href="${sozinho[1]}" style="display:inline-block;padding:14px 22px;font-family:${CARTAZ};font-size:14px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#ffffff;text-decoration:none">Abrir o link &rarr;</a></td></tr></table><p style="margin:0 0 18px;font-family:${ARQUIVO};font-size:12px;line-height:1.5;color:#5a4e3c;word-break:break-all">${p}</p>`;
    }
    return `<p style="margin:0 0 18px;font-family:${SERIFA};font-size:18px;line-height:1.55;color:#1f1a14">${p}</p>`;
  }).join("");
  const titulo = escapar(assunto);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${titulo}</title>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;600&amp;family=IBM+Plex+Mono&amp;family=Inter:wght@800&amp;display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#f4ecd8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4ecd8" style="background:#f4ecd8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#fbf7ee;border:1px solid #c9bb9b">
<tr><td bgcolor="#6e1f1a" style="background:#6e1f1a;padding:24px 30px"><div style="font-family:${SERIFA};font-size:24px;font-weight:600;color:#f4ecd8">&#9733; Instituto Lúcia</div><div style="font-family:${ARQUIVO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#f0cf8e;padding-top:6px">Conhecimento é do povo</div></td></tr>
<tr><td style="padding:30px 30px 6px"><div style="font-family:${SERIFA};font-size:28px;font-weight:600;line-height:1.15;color:#1f1a14;padding-bottom:20px">${titulo}</div>${blocos}</td></tr>
<tr><td style="padding:0 30px 28px"><div style="border-top:2px solid #1f1a14;padding-top:12px;font-family:${ARQUIVO};font-size:12px;line-height:1.5;color:#5a4e3c">Instituto Lúcia &middot; escola livre e gratuita &middot; <a href="https://institutolucia.org" style="color:#6e1f1a;text-decoration:none">institutolucia.org</a></div></td></tr>
</table></td></tr></table></body></html>`;
}


/**
 * A edição do boletim com a cara do Jornal: a palavra de ordem, o cabeçalho em cartaz (uma imagem, porque os leitores
 * de e-mail não desenham a cunha nem a estrela), o fio do expediente, a manchete em letra pesada e o texto em serifa.
 * Quem escreve manda só assunto e texto; o desenho vem sempre daqui. Tudo em tabelas e estilo na linha, que é o que
 * os leitores de e-mail respeitam. O rodapé que o banco põe no texto (a partir do "---") vira o rodapé do desenho.
 */
export function boletim(email, quando = new Date()) {
  let origem;
  try {
    const sair = new URL(email.sair);
    if (sair.protocol !== "https:") throw new Error();
    origem = sair.origin;
  } catch {
    return html(email.texto, email.assunto);
  }
  const corte = email.texto.lastIndexOf("\n\n---\n");
  const corpo = (corte >= 0 ? email.texto.slice(0, corte) : email.texto).trim();
  const data = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(quando);
  const resumo = escapar(corpo.replace(/\s+/g, " ").slice(0, 140));
  const assunto = escapar(email.assunto);
  const jornal = `${origem}/pt/jornal`;
  const sair = escapar(email.sair);
  const host = escapar(new URL(origem).host);
  const texto = paragrafos(corpo, "color:#6e1f1a;text-decoration:underline")
    .map((p) => `<p style="margin:0 0 18px;font-family:${SERIFA};font-size:19px;line-height:1.55;color:#1f1a14">${p}</p>`)
    .join("");
  const estrela = '<span style="color:#6e1f1a">&#9733;</span>';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${assunto}</title>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;600&amp;family=IBM+Plex+Mono&amp;family=Inter:ital,wght@0,400;0,700;0,800;1,900&amp;display=swap" rel="stylesheet">
<style>@media (max-width:620px){.manchete{font-size:30px!important}.bloco{padding:22px 18px!important}}</style></head>
<body style="margin:0;padding:0;background:#f4ecd8">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${resumo}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4ecd8" style="background:#f4ecd8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
<tr><td style="padding:0 2px 6px;font-family:${ARQUIVO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5a4e3c">Proletários de todos os países, uni-vos!</td></tr>
<tr><td bgcolor="#c21f16" style="background:#c21f16"><a href="${jornal}" style="display:block;text-decoration:none"><img src="${origem}/imagens/email/jornal.png" width="600" alt="JORNAL REVOLUCIONÁRIO LÚCIA" style="display:block;width:100%;max-width:600px;height:auto;border:0;color:#ffffff;font-family:${CARTAZ};font-size:30px;font-style:italic;font-weight:900;line-height:1.2"></a></td></tr>
<tr><td style="padding:7px 4px;border-bottom:7px double #1f1a14;font-family:${CARTAZ};font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#1f1a14">Imprensa popular, feita por voluntários &nbsp;${estrela}&nbsp; <span style="text-transform:none">${host}</span> &nbsp;${estrela}&nbsp; Gratuito</td></tr>
<tr><td style="height:22px;line-height:22px;font-size:0">&nbsp;</td></tr>
<tr><td class="bloco" bgcolor="#1f1a14" style="background:#1f1a14;padding:28px 28px 30px;border-left:8px solid #c21f16">
<div style="font-family:${ARQUIVO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#d4a24c;padding-bottom:12px">Boletim &middot; ${escapar(data)}</div>
<div class="manchete" style="font-family:${CARTAZ};font-size:38px;font-style:italic;font-weight:900;line-height:1.02;letter-spacing:-.5px;text-transform:uppercase;color:#f4ecd8">${assunto}</div>
</td></tr>
<tr><td class="bloco" style="padding:28px 6px 8px">${texto}</td></tr>
<tr><td style="padding:0 6px 30px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#c21f16" style="background:#c21f16;border:3px solid #1f1a14"><a href="${jornal}" style="display:inline-block;padding:13px 20px;font-family:${CARTAZ};font-size:13px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#ffffff;text-decoration:none">Ler o jornal no site &rarr;</a></td></tr></table></td></tr>
<tr><td style="padding:14px 6px 0;border-top:7px double #1f1a14;font-family:${CARTAZ};font-size:12px;line-height:1.6;color:#5a4e3c">Você recebe este boletim porque pediu no site do Instituto Lúcia. Ninguém vê o endereço de ninguém, e nenhum anúncio vem junto.<br><a href="${sair}" style="color:#6e1f1a;text-decoration:underline">Sair da lista</a> &nbsp;&middot;&nbsp; <a href="${origem}" style="color:#5a4e3c;text-decoration:none">${host}</a></td></tr>
</table></td></tr></table></body></html>`;
}

/** Monta o pedido de um e-mail para o serviço de envio. */
export function pedido(email, { remetente, resposta }) {
  // Só o boletim tem link de saída, e só ele vai com o desenho do Jornal.
  const corpo = { from: remetente, to: [email.para], subject: email.assunto, text: email.texto, html: email.sair ? boletim(email) : html(email.texto, email.assunto) };
  if (resposta) corpo.reply_to = resposta;
  // Boletim: o leitor de e-mail mostra o botão "cancelar inscrição", que leva ao mesmo link de saída do texto.
  if (email.sair) corpo.headers = { "List-Unsubscribe": `<${email.sair}>` };
  return corpo;
}

/**
 * Uma rodada: pega a fila, envia um por um e devolve ao banco o resultado de cada e-mail.
 * @param {{ chamar: (funcao: string, argumentos?: object) => Promise<unknown>, buscar?: typeof fetch, chave: string, remetente: string, resposta?: string, pausa?: number, limite?: number }} o
 */
export async function rodada({ chamar, buscar = fetch, chave, remetente, resposta = "", pausa = 600, limite = 50 }) {
  const fila = await chamar("emails_pendentes", { p_limite: limite });
  const contagem = { enviados: 0, falhas: 0, erros: {} };
  for (const email of Array.isArray(fila) ? fila : []) {
    let erro = "";
    try {
      const r = await buscar(RESEND, {
        method: "POST",
        // A chave de idempotência é o próprio e-mail: se a rodada cair no meio e o e-mail for pego de novo, o serviço não manda duas vezes.
        headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json", "Idempotency-Key": `lucia-${email.id}` },
        body: JSON.stringify(pedido(email, { remetente, resposta })),
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) erro = r.status === 429 ? "limite" : r.status === 401 || r.status === 403 ? "chave_recusada" : r.status === 422 ? "recusado" : `http_${r.status}`;
    } catch (falha) {
      erro = falha?.name === "TimeoutError" || falha?.name === "AbortError" ? "tempo_esgotado" : "sem_conexao";
    }
    await chamar("email_resultado", { p_id: email.id, p_ok: !erro, p_erro: erro });
    if (erro) {
      contagem.falhas++;
      contagem.erros[erro] = (contagem.erros[erro] ?? 0) + 1;
      // Chave errada ou limite estourado: insistir agora só gasta tentativas. O resto espera a próxima rodada.
      if (erro === "chave_recusada" || erro === "limite") break;
    } else {
      contagem.enviados++;
    }
    if (pausa) await new Promise((fim) => setTimeout(fim, pausa));
  }
  return contagem;
}
