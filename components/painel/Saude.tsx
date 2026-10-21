// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { can, type Me, rpc } from "@/lib/backend";
import { CONSULTA_DO_CONSELHO, type Profissional } from "@/lib/saude";
import { TERMO_SAUDE, textoDoTermo } from "@/lib/termos";
import { abrirArquivoDaSaude, cleanImage, sendSaudeFile, UploadError, uploadMessages } from "@/lib/upload";
import { CartaoDoProfissional } from "../saude/Vitrine";
import { Aviso, botao, botaoClaro, campo, dataHora, dia, rotulo, textoDoErro, useAcao, useLista } from "./comum";

interface PerfilDoPainel extends Profissional {
  status: "rascunho" | "aguardando" | "publicado" | "suspenso" | "removido";
  foto_autorizada: boolean;
  foto_guardada: string;
  texto_aprovado_em: string | null;
  termo_versao: string | null;
  termo_vigente: string;
  verificacao_nota: string;
  atualizado_em: string;
  apto: boolean;
  faltam: string[];
  assinatura_arquivo: string;
  assinatura_sha256: string;
  assinatura_versao: string | null;
  assinatura_enviada_em: string | null;
  assinatura_conferida_em: string | null;
  verificacao_arquivo: string;
  verificacao_link: string;
  verificacao_situacao: string;
  proxima_revisao: string | null;
}
interface Passo {
  acao: string;
  em: string;
  por: string;
  detalhe: Record<string, unknown>;
}
const SITUACAO: Record<PerfilDoPainel["status"], string> = { rascunho: "rascunho", aguardando: "esperando a coordenação", publicado: "publicado", suspenso: "suspenso", removido: "removido a pedido" };
const CONSELHOS = ["CRP", "CRM", "COREN", "CRN", "CREFITO", "CRESS", "CRO", "CRFa", "CREF", "CRF", "CRBM"];
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
/** O assinador e o validador oficiais do governo federal (assinatura eletrônica avançada pela conta gov.br). */
const ASSINADOR = "https://assinador.iti.br/";
const VALIDADOR = "https://validar.iti.gov.br/";
const NOMES_DOS_PASSOS: Record<string, string> = {
  perfil_salvo_e_aprovado: "Perfil salvo e aprovado pelo profissional",
  perfil_editado_pela_coordenacao: "Texto ajustado pela coordenação",
  texto_aprovado: "Texto aprovado pelo profissional",
  termo_aceito: "Termo aceito no painel",
  assinatura_enviada: "Termo assinado no gov.br enviado",
  assinatura_conferida: "Assinatura gov.br conferida",
  assinatura_devolvida: "Assinatura gov.br devolvida",
  verificacao_anexada: "Prova da consulta ao conselho anexada",
  verificar: "Registro conferido no conselho",
  publicar: "Publicado",
  aguardar: "Devolvido para ajuste",
  suspender: "Suspenso",
  removido_a_pedido: "Removido a pedido do profissional",
};

type Campos = Record<string, string>;
const camposDe = (p: PerfilDoPainel): Campos => ({
  nome: p.nome, profissao: p.profissao, conselho: p.conselho || "CRP", uf: p.uf, registro: p.registro, abordagem: p.abordagem, areas: p.areas.join(", "),
  modalidade: p.modalidade ?? "online", cidade: p.cidade ?? "", valor: p.valor ?? "social", bio: p.bio,
  whatsapp: p.contatos.whatsapp ?? "", instagram: p.contatos.instagram ?? "", email: p.contatos.email ?? "", site: p.contatos.site ?? "",
  foto: p.foto_guardada, foto_autorizada: p.foto_autorizada ? "1" : "",
});
const paraEnviar = (f: Campos) => ({
  ...f, areas: f.areas.split(",").map((x) => x.trim()).filter(Boolean), contatos: { whatsapp: f.whatsapp, instagram: f.instagram, email: f.email, site: f.site },
  foto_autorizada: f.foto_autorizada === "1", foto: f.foto,
});

/** A seção Saúde Solidária do painel: o perfil do próprio profissional e, para a coordenação, a fila e a chave geral. */
export function SaudeNoPainel({ me }: { me: Me }) {
  const coordena = can(me, "coordenacao", "vice");
  const profissional = me.papeis.some((p) => p.papel === "saude");
  return (
    <div className="space-y-10">
      {profissional && <MeuPerfil />}
      {coordena && <Fila />}
    </div>
  );
}

/** Os campos do cartão: os mesmos para o profissional e para a coordenação editar. */
function CamposDoPerfil({ f, mudar, aviso }: { f: Campos; mudar: (k: string, v: string) => void; aviso: (texto: string) => void }) {
  async function foto(arquivo?: File) {
    if (!arquivo || !/^image\/(jpeg|png|webp)$/.test(arquivo.type) || arquivo.size > 15 * 1024 * 1024) return aviso("Escolha uma foto JPG, PNG ou WebP de até 15 MB.");
    const img = await createImageBitmap(arquivo);
    const c = document.createElement("canvas");
    // Retrato 4:5, 400 × 500, regravado (sai sem localização, aparelho e autor).
    c.width = 400;
    c.height = 500;
    const escala = Math.max(400 / img.width, 500 / img.height);
    const w = img.width * escala;
    const h = img.height * escala;
    c.getContext("2d")!.drawImage(img, (400 - w) / 2, Math.min(0, (500 - h) / 4), w, h);
    for (const q of [0.82, 0.7, 0.55, 0.4]) {
      const dado = c.toDataURL("image/webp", q);
      if (dado.startsWith("data:image/webp") && dado.length <= 60000) return mudar("foto", dado);
    }
    aviso("Este navegador não gravou a foto em WebP. Tente outro navegador.");
  }
  return (
    <>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">Nome como aparece<input value={f.nome} onChange={(e) => mudar("nome", e.target.value)} maxLength={80} className={campo} /></label>
        <label className="block">Profissão<input value={f.profissao} onChange={(e) => mudar("profissao", e.target.value)} maxLength={60} placeholder="Psicóloga, médico, nutricionista…" className={campo} /></label>
        <label className="block">Conselho<select value={f.conselho} onChange={(e) => mudar("conselho", e.target.value)} className={campo}>{CONSELHOS.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="block">UF do registro<select value={f.uf} onChange={(e) => mudar("uf", e.target.value)} className={campo}><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select></label>
        <label className="block sm:col-span-2">Número de registro<input value={f.registro} onChange={(e) => mudar("registro", e.target.value)} maxLength={30} placeholder="05/12345" className={campo} /></label>
        <label className="block sm:col-span-2">Abordagem ou especialidade<input value={f.abordagem} onChange={(e) => mudar("abordagem", e.target.value)} maxLength={120} className={campo} /></label>
        <label className="block sm:col-span-2">Áreas de atendimento (separadas por vírgula)<input value={f.areas} onChange={(e) => mudar("areas", e.target.value)} placeholder="ansiedade, luto, adolescentes" className={campo} /></label>
        <label className="block">Modalidade<select value={f.modalidade} onChange={(e) => mudar("modalidade", e.target.value)} className={campo}><option value="online">On-line</option><option value="presencial">Presencial</option><option value="ambas">On-line e presencial</option></select></label>
        <label className="block">Cidade (se presencial)<input value={f.cidade} onChange={(e) => mudar("cidade", e.target.value)} maxLength={80} className={campo} /></label>
        <label className="block sm:col-span-2">Valor<select value={f.valor} onChange={(e) => mudar("valor", e.target.value)} className={campo}><option value="gratuito">Gratuito</option><option value="social">Valor social</option><option value="ambos">Gratuito ou valor social</option></select><span className="text-xs text-ink-soft">Sem números: o valor é combinado direto com cada pessoa.</span></label>
        <label className="block sm:col-span-2">Sobre (até 900 caracteres)<textarea value={f.bio} onChange={(e) => mudar("bio", e.target.value)} maxLength={900} rows={5} className={campo} /><span className="text-xs text-ink-soft">Sem preço, sem promessa de cura ou resultado, sem “o melhor”, sem depoimento de paciente, sem CPF ou endereço residencial.</span></label>
      </div>
      <h4 className="mt-5 font-semibold">Contato autorizado</h4>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="block">WhatsApp profissional (com DDD)<input value={f.whatsapp} onChange={(e) => mudar("whatsapp", e.target.value)} placeholder="+55 21 90000-0000" className={campo} /></label>
        <label className="block">Instagram<input value={f.instagram} onChange={(e) => mudar("instagram", e.target.value)} placeholder="@seuperfil" className={campo} /></label>
        <label className="block">E-mail profissional<input type="email" value={f.email} onChange={(e) => mudar("email", e.target.value)} className={campo} /></label>
        <label className="block">Site ou agenda (https)<input type="url" value={f.site} onChange={(e) => mudar("site", e.target.value)} placeholder="https://…" className={campo} /></label>
      </div>
      <h4 className="mt-5 font-semibold">Foto</h4>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className={`${botaoClaro} cursor-pointer`}>Escolher foto<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void foto(e.target.files?.[0]); e.target.value = ""; }} /></label>
        {f.foto && <button type="button" className={botaoClaro} onClick={() => mudar("foto", "")}>Tirar a foto</button>}
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.foto_autorizada === "1"} onChange={(e) => mudar("foto_autorizada", e.target.checked ? "1" : "")} />Uso da foto na vitrine autorizado pelo profissional (pode desfazer quando quiser)</label>
      </div>
    </>
  );
}

/** O histórico de um perfil (o que ficou guardado para sempre). Só busca quando alguém abre. */
function Registro({ usuario }: { usuario?: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <details className="mt-3" onToggle={(e) => setAberto((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-sm font-semibold">Registro de tudo o que aconteceu com este perfil</summary>
      <p className="mt-1 text-xs text-ink-soft">Guardado para sempre: ninguém altera nem apaga, nem a coordenação.</p>
      {aberto && <PassosDoRegistro usuario={usuario} />}
    </details>
  );
}

function PassosDoRegistro({ usuario }: { usuario?: string }) {
  const lista = useLista<Passo[]>("saude_registro_listar", usuario ? { p_usuario: usuario } : {}, { quieta: true });
  if (lista.erro) return <Aviso texto={lista.erro} />;
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {(lista.dados ?? []).map((x, i) => (
        <li key={i} className="border-l-2 border-rule pl-2"><strong>{NOMES_DOS_PASSOS[x.acao] ?? x.acao}</strong> · {dataHora(x.em)}{x.por ? ` · por ${x.por}` : ""}{typeof x.detalhe.nota === "string" && x.detalhe.nota ? ` · “${x.detalhe.nota}”` : ""}</li>
      ))}
      {lista.dados?.length === 0 && <li className="text-ink-soft">Nada registrado ainda.</li>}
    </ul>
  );
}

/** Abre a versão para imprimir do termo aceito (salvar como PDF e assinar no gov.br). */
async function imprimirTermo(): Promise<string> {
  const aceites = await rpc<{ termo: string; versao: string; texto: string; sha256: string; aceito_em: string; dados: Record<string, string> }[]>("termos_meus");
  const a = aceites.find((x) => x.termo === "saude" && x.versao === TERMO_SAUDE.versao);
  if (!a) return "Aceite o termo no painel antes de baixar a versão para assinar.";
  const janela = window.open("", "_blank", "noopener=no");
  if (!janela) return "O navegador bloqueou a janela. Libere janelas para institutolucia.org e tente de novo.";
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  janela.document.title = `Termo Saúde Solidária ${a.versao}`;
  janela.document.body.innerHTML = `<main style="font:15px/1.5 Georgia,serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#111">
    <p style="font:12px monospace">Instituto Lúcia · Saúde Solidária · versão ${esc(a.versao)}</p>
    <div style="white-space:pre-wrap">${esc(a.texto)}</div>
    <hr><p style="font:12px monospace">Aceito no painel em ${esc(new Date(a.aceito_em).toLocaleString("pt-BR"))} (horário do aparelho).<br>
    Nome digitado: ${esc(a.dados.nome_digitado ?? "")} · Registro: ${esc(a.dados.registro ?? "")}<br>
    Resumo SHA-256 do texto aceito: ${esc(a.sha256)}</p>
    <p style="font:12px sans-serif">Salve esta página como PDF (Imprimir › Salvar como PDF), assine em assinador.iti.br com a sua conta gov.br (nível prata ou ouro) e envie o PDF assinado pelo painel.</p></main>`;
  janela.focus();
  janela.print();
  return "";
}

function MeuPerfil() {
  const perfil = useLista<PerfilDoPainel>("saude_meu");
  const [form, setForm] = useState<Campos | null>(null);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [termo, setTermo] = useState({ nome: "", registro: "", marcadas: [] as number[] });
  const p = perfil.dados;
  if (!p) return <Aviso texto={perfil.erro} />;
  const f = form ?? camposDe(p);
  const mudar = (k: string, v: string) => setForm({ ...f, [k]: v });
  const termoEmDia = p.termo_versao === p.termo_vigente;
  const assinaturaEmDia = !!p.assinatura_arquivo && p.assinatura_versao === p.termo_vigente;
  // As cláusulas que pedem marcação uma a uma (natureza de mural, voluntariado, responsabilidade, dados, imagem, emergência, publicidade, remoção).
  const criticas = [1, 2, 4, 6, 7, 8, 9, 10];
  const esperandoAprovacao = p.texto_aprovado_em === null && p.status !== "rascunho";

  async function fazer(acao: () => Promise<string>) {
    setOcupado(true);
    setAviso("");
    try {
      setAviso(await acao());
    } catch (erro) {
      setAviso(erro instanceof UploadError ? (uploadMessages[erro.message] ?? uploadMessages.envio) : textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }
  const salvar = () => fazer(async () => {
    const r = await rpc<{ ok: boolean; motivo?: string }>("saude_salvar", { p: paraEnviar(f) });
    if (!r.ok) return r.motivo ?? "Não deu para salvar.";
    setForm(null);
    perfil.recarregar();
    return "Salvo ✓ O perfil sai do ar até a coordenação conferir de novo (ela foi avisada).";
  });
  const aceitarTermo = () => fazer(async () => {
    await rpc("saude_termo_aceitar", { p_texto: textoDoTermo(TERMO_SAUDE, [`Nome digitado: ${termo.nome.trim()}`, `Registro informado: ${termo.registro.trim()}`]), p_nome: termo.nome.trim(), p_registro: termo.registro.trim() });
    perfil.recarregar();
    return "Termo aceito ✓ Agora baixe a versão para assinar no gov.br (logo abaixo).";
  });
  const enviarAssinatura = (arquivo?: File) => fazer(async () => {
    if (!arquivo) return "";
    if (arquivo.type && arquivo.type !== "application/pdf") return "Envie o PDF assinado (arquivo .pdf).";
    const { path, sha256 } = await sendSaudeFile(arquivo, "pdf");
    await rpc("saude_assinatura_enviar", { p_arquivo: path, p_sha256: sha256 });
    perfil.recarregar();
    return "PDF assinado enviado ✓ A coordenação vai conferir a assinatura no validador do governo.";
  });

  return (
    <section className="space-y-6">
      <header>
        <p className={rotulo}>Saúde Solidária · seu perfil</p>
        <h2 className="font-serif text-3xl font-semibold">Seu cartão na vitrine</h2>
        <p className="mt-1 max-w-3xl text-ink-soft">A vitrine é um mural de contatos: as pessoas veem o seu cartão e falam direto com você. O instituto não agenda, não intermedeia e não recebe dado de paciente. O seu cartão só aparece quando tudo abaixo estiver em dia.</p>
      </header>
      <Aviso texto={aviso} />
      <div className="painel-cartao max-w-3xl p-4">
        <p><strong>Situação:</strong> {SITUACAO[p.status]}{p.apto ? " · aparecendo na vitrine" : ""}</p>
        {p.faltam.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-ink-soft">{p.faltam.map((x) => <li key={x}>Falta: {x}</li>)}</ul>}
        {p.verificacao_nota && <p className="mt-2 text-sm">Recado da coordenação: {p.verificacao_nota}</p>}
        <Registro />
      </div>

      {esperandoAprovacao && (
        <section className="max-w-3xl border-4 border-[#c21f16] bg-parchment p-5">
          <h3 className="font-serif text-2xl font-semibold">A coordenação ajustou o seu cartão</h3>
          <p className="mt-1 text-sm">Confira a prévia ao lado. O texto é seu: ele só volta ao ar se você aprovar. Se não concordar, mude os campos e salve, ou escreva para a coordenação.</p>
          <button type="button" className={`mt-3 ${botao}`} disabled={ocupado} onClick={() => void fazer(async () => { await rpc("saude_aprovar_texto"); perfil.recarregar(); return "Texto aprovado ✓"; })}>Aprovo o texto como está</button>
        </section>
      )}

      {!termoEmDia && (
        <section className="max-w-3xl border-4 border-[#c21f16] bg-parchment p-5">
          <h3 className="font-serif text-2xl font-semibold">{TERMO_SAUDE.titulo}</h3>
          <p className="mt-1 text-sm text-ink-soft">Versão {TERMO_SAUDE.versao} · rascunho em revisão jurídica. Marque cada cláusula destacada, digite o seu nome completo e o registro, e confirme.</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            {TERMO_SAUDE.clausulas.map((c, i) => (
              <li key={c}>
                {criticas.includes(i) ? (
                  <label className="flex items-start gap-2"><input type="checkbox" checked={termo.marcadas.includes(i)} onChange={(e) => setTermo({ ...termo, marcadas: e.target.checked ? [...termo.marcadas, i] : termo.marcadas.filter((x) => x !== i) })} className="mt-1" /><span>{c}</span></label>
                ) : c}
              </li>
            ))}
          </ol>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">Nome completo<input value={termo.nome} onChange={(e) => setTermo({ ...termo, nome: e.target.value })} maxLength={120} className={campo} /></label>
            <label className="block">Número de registro<input value={termo.registro} onChange={(e) => setTermo({ ...termo, registro: e.target.value })} maxLength={40} className={campo} /></label>
          </div>
          <button type="button" className={`mt-4 ${botao}`} disabled={ocupado || termo.nome.trim().length < 5 || termo.registro.trim().length < 3 || !criticas.every((i) => termo.marcadas.includes(i))} onClick={() => void aceitarTermo()}>Li e aceito o termo</button>
        </section>
      )}

      {termoEmDia && (
        <section className="painel-cartao max-w-3xl p-5">
          <h3 className="font-serif text-2xl font-semibold">Termo assinado no gov.br</h3>
          {assinaturaEmDia ? (
            <p className="mt-1">✓ PDF assinado enviado em {p.assinatura_enviada_em ? dataHora(p.assinatura_enviada_em) : "—"}. {p.assinatura_conferida_em ? `Assinatura conferida pela coordenação em ${dataHora(p.assinatura_conferida_em)}.` : "Esperando a coordenação conferir a assinatura."}</p>
          ) : (
            <p className="mt-1 text-ink-soft">Além do aceite no painel, o termo vai assinado com a sua conta gov.br (assinatura eletrônica avançada, gratuita). Três passos:</p>
          )}
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
            <li><button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => void fazer(imprimirTermo)}>Baixar o termo que você aceitou</button> (abre a versão para imprimir: escolha “Salvar como PDF”).</li>
            <li>Assine o PDF em <a href={ASSINADOR} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">assinador.iti.br</a> com a sua conta gov.br (nível prata ou ouro) e baixe o arquivo assinado.</li>
            <li>
              <label className={`${botaoClaro} inline-block cursor-pointer`}>{assinaturaEmDia ? "Enviar outro PDF assinado" : "Enviar o PDF assinado"}<input type="file" accept="application/pdf" className="sr-only" disabled={ocupado} onChange={(e) => { void enviarAssinatura(e.target.files?.[0]); e.target.value = ""; }} /></label>
              <span className="ml-2 text-xs text-ink-soft">Fica no depósito fechado: só você e a coordenação abrem.</span>
            </li>
          </ol>
        </section>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="painel-cartao p-5">
          <h3 className="font-serif text-2xl font-semibold">Dados do cartão</h3>
          <CamposDoPerfil f={f} mudar={mudar} aviso={setAviso} />
          <p className="mt-5 flex flex-wrap gap-3">
            <button type="button" className={botao} disabled={ocupado || f.nome.trim().length < 2 || f.profissao.trim().length < 2 || !f.registro.trim()} onClick={() => void salvar()}>Salvar e aprovar este texto</button>
            {p.status !== "removido" && <button type="button" className={botaoClaro} disabled={ocupado} onClick={async () => { if (window.confirm("Sair da vitrine agora? O cartão some na hora.")) { await rpc("saude_sair").catch(() => null); perfil.recarregar(); } }}>Sair da vitrine</button>}
          </p>
          <p className="mt-2 text-xs text-ink-soft">Salvar conta como a sua aprovação do texto final. Toda mudança tira o cartão do ar até a coordenação conferir de novo.</p>
        </section>
        <aside>
          <p className={rotulo}>Prévia</p>
          <div className="mt-2">
            <CartaoDoProfissional p={{ ...p, ...f, conselho: f.conselho, areas: f.areas.split(",").map((x) => x.trim()).filter(Boolean), modalidade: f.modalidade as Profissional["modalidade"], valor: f.valor as Profissional["valor"], contatos: { whatsapp: f.whatsapp, instagram: f.instagram }, foto: f.foto_autorizada === "1" ? f.foto : "" }} />
          </div>
        </aside>
      </div>
    </section>
  );
}

/** Abre um arquivo do depósito "saude" numa aba (o PDF assinado ou a captura da consulta). */
function BotaoArquivo({ caminho, nome, aviso }: { caminho: string; nome: string; aviso: (t: string) => void }) {
  if (!caminho) return null;
  return (
    <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={async () => {
      try {
        window.open(await abrirArquivoDaSaude(caminho), "_blank", "noopener");
      } catch {
        aviso("Não foi possível abrir o arquivo.");
      }
    }}>{nome}</button>
  );
}

function EditarPeloCoordenacao({ p, depois }: { p: PerfilDoPainel; depois: () => void }) {
  const [f, setF] = useState<Campos>(() => camposDe(p));
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  return (
    <details className="mt-3 border-t border-rule pt-3">
      <summary className="cursor-pointer font-semibold">Editar o cartão</summary>
      <p className="mt-1 text-sm text-ink-soft">O conteúdo continua sendo do profissional: ao salvar, o cartão sai do ar e só volta depois que ele aprovar o texto no painel dele (ele é avisado).</p>
      <Aviso texto={aviso} />
      <CamposDoPerfil f={f} mudar={(k, v) => setF({ ...f, [k]: v })} aviso={setAviso} />
      <button type="button" className={`mt-4 ${botao}`} disabled={ocupado} onClick={async () => {
        setOcupado(true);
        try {
          const r = await rpc<{ ok: boolean; motivo?: string }>("saude_editar", { p_usuario: p.id, p: paraEnviar(f) });
          setAviso(r.ok ? "Salvo ✓ Esperando a aprovação do profissional." : (r.motivo ?? "Não deu para salvar."));
          if (r.ok) depois();
        } catch (erro) {
          setAviso(textoDoErro(erro));
        } finally {
          setOcupado(false);
        }
      }}>Salvar e pedir a aprovação do profissional</button>
    </details>
  );
}

function Fila() {
  const fila = useLista<{ desligada: boolean; perfis: PerfilDoPainel[] }>("saude_fila");
  const acao = useAcao(fila.recarregar);
  const [datas, setDatas] = useState<Record<string, { data: string; nota: string; link: string; situacao: string; arquivo: string }>>({});
  const [avisoArquivo, setAvisoArquivo] = useState("");
  const hoje = new Date().toISOString().slice(0, 10);
  const daquiA30 = new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().slice(0, 10);
  const d = fila.dados;
  const vencendo = (d?.perfis ?? []).filter((p) => p.proxima_revisao && p.proxima_revisao <= daquiA30).sort((a, b) => (a.proxima_revisao ?? "").localeCompare(b.proxima_revisao ?? ""));

  async function anexarCaptura(id: string, arquivo?: File) {
    if (!arquivo) return;
    setAvisoArquivo("");
    try {
      const pdf = arquivo.type === "application/pdf";
      const { blob, extension } = pdf ? { blob: arquivo as Blob, extension: "pdf" as const } : await cleanImage(arquivo);
      const { path } = await sendSaudeFile(blob, extension);
      setDatas((atual) => ({ ...atual, [id]: { ...(atual[id] ?? { data: hoje, nota: "", link: "", situacao: "" }), arquivo: path } }));
      setAvisoArquivo("Captura guardada ✓ Registre a conferência para ela ficar no perfil.");
    } catch (erro) {
      setAvisoArquivo(erro instanceof UploadError ? (uploadMessages[erro.message] ?? uploadMessages.envio) : textoDoErro(erro));
    }
  }

  return (
    <section className="space-y-5">
      <header>
        <p className={rotulo}>Saúde Solidária · coordenação</p>
        <h2 className="font-serif text-3xl font-semibold">Profissionais da vitrine</h2>
        <p className="mt-1 max-w-3xl text-ink-soft">Um perfil só aparece com tudo em dia: cargo de profissional de saúde, termo vigente aceito, termo assinado no gov.br e conferido aqui, registro conferido no conselho há menos de 180 dias, texto aprovado pelo próprio profissional e publicação. Qualquer item que falhar tira o perfil na hora. Para dar o cargo: Voluntários e convites › Confiar função › Profissional de saúde.</p>
      </header>
      <Aviso texto={fila.erro || acao.aviso || avisoArquivo} />
      {d && (
        <div className={`max-w-3xl border-2 p-4 ${d.desligada ? "border-[#c21f16] bg-parchment-deep" : "border-ink"}`}>
          <p className="font-semibold">Chave geral: {d.desligada ? "vitrine DESLIGADA (ninguém aparece)" : "vitrine ligada"}</p>
          <p className="mt-1 text-sm text-ink-soft">Use em emergência (denúncia grave, dúvida jurídica): desliga a vitrine inteira na hora, sem publicar o site de novo. Vale também para os cartões publicados pelo arquivo do site.</p>
          <button type="button" className={`mt-2 ${d.desligada ? botao : botaoClaro}`} disabled={acao.ocupado} onClick={() => { if (d.desligada || window.confirm("Desligar a vitrine inteira agora?")) void acao.agir("saude_chave", { p_desligar: !d.desligada }, d.desligada ? "Vitrine ligada." : "Vitrine desligada."); }}>{d.desligada ? "Ligar a vitrine" : "Desligar a vitrine"}</button>
        </div>
      )}
      {vencendo.length > 0 && (
        <div className="max-w-3xl border-l-4 border-oxblood bg-parchment-deep px-4 py-3 text-sm">
          <strong>Conferências vencendo nos próximos 30 dias:</strong> {vencendo.map((p) => `${p.nome} (${dia(p.proxima_revisao ?? "")})`).join(", ")}. Registro vencido tira o cartão do ar sozinho.
        </div>
      )}
      {d?.perfis.length === 0 && <p className="text-ink-soft">Nenhum profissional no painel ainda. (Os perfis publicados pelo arquivo content/saude/profissionais.json aparecem direto na vitrine.)</p>}
      <ul className="space-y-4">
        {d?.perfis.map((p) => {
          const consulta = CONSULTA_DO_CONSELHO[p.conselho.toUpperCase()];
          const v = datas[p.id] ?? { data: hoje, nota: "", link: consulta ?? "", situacao: "", arquivo: "" };
          const mudar = (k: string, valor: string) => setDatas({ ...datas, [p.id]: { ...v, [k]: valor } });
          return (
            <li key={p.id} className="painel-cartao grid gap-4 p-4 lg:grid-cols-[16rem_1fr]">
              <CartaoDoProfissional p={p} />
              <div>
                <p className={rotulo}>{SITUACAO[p.status]} · atualizado em {dataHora(p.atualizado_em)}</p>
                <p className="mt-1">{p.apto ? "✓ Aparecendo na vitrine." : `Falta: ${p.faltam.join("; ")}.`}</p>
                <p className="mt-1 text-sm text-ink-soft">Termo: {p.termo_versao ? `versão ${p.termo_versao}` : "não aceito"} · Registro conferido em: {p.verificado_em ? dia(p.verificado_em) : "nunca"}{p.proxima_revisao ? ` (próxima até ${dia(p.proxima_revisao)})` : ""} · Texto aprovado em: {p.texto_aprovado_em ? dataHora(p.texto_aprovado_em) : "esperando o profissional"}</p>

                <div className="mt-3 border-t border-rule pt-3">
                  <p className="font-semibold">Assinatura gov.br</p>
                  {p.assinatura_arquivo ? (
                    <div className="text-sm">
                      <p>PDF enviado em {p.assinatura_enviada_em ? dataHora(p.assinatura_enviada_em) : "—"} (termo versão {p.assinatura_versao}) · <BotaoArquivo caminho={p.assinatura_arquivo} nome="abrir o PDF" aviso={setAvisoArquivo} /></p>
                      <p className="mt-1 font-mono text-xs text-ink-soft">SHA-256: {p.assinatura_sha256}</p>
                      <p className="mt-1">Confira em <a href={VALIDADOR} target="_blank" rel="noopener noreferrer" className="underline">validar.iti.gov.br</a>: a assinatura precisa ser válida, do próprio profissional, e o texto precisa ser o do termo vigente.</p>
                      <p className="mt-2 flex flex-wrap gap-2">
                        {!p.assinatura_conferida_em && <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => acao.agir("saude_assinatura_conferir", { p_usuario: p.id, p_ok: true, p_nota: "" }, "Assinatura conferida.")}>Assinatura válida: marcar conferida</button>}
                        {p.assinatura_conferida_em && <span>✓ Conferida em {dataHora(p.assinatura_conferida_em)}.</span>}
                        <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => { const nota = window.prompt("O que está errado na assinatura (vai para o profissional):", "") ?? ""; void acao.agir("saude_assinatura_conferir", { p_usuario: p.id, p_ok: false, p_nota: nota }, "Devolvido ao profissional."); }}>Devolver</button>
                      </p>
                    </div>
                  ) : <p className="text-sm text-ink-soft">O profissional ainda não enviou o termo assinado.</p>}
                </div>

                <div className="mt-3 border-t border-rule pt-3">
                  <p className="font-semibold">Conferir o registro no conselho</p>
                  <p className="text-sm text-ink-soft">{consulta ? <>Consulte em <a href={consulta} target="_blank" rel="noopener noreferrer" className="underline">{consulta}</a></> : "Consulte no site do conselho regional"}, tire uma captura da tela e anexe aqui com a data e o que encontrou.</p>
                  {(p.verificacao_situacao || p.verificacao_arquivo) && <p className="mt-1 text-sm">Última prova: {p.verificacao_situacao || "—"}{p.verificacao_link && <> · <a href={p.verificacao_link} target="_blank" rel="noopener noreferrer" className="underline">endereço consultado</a></>} · <BotaoArquivo caminho={p.verificacao_arquivo} nome="abrir a captura" aviso={setAvisoArquivo} /></p>}
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="block text-sm">Data da consulta<input type="date" max={hoje} value={v.data} onChange={(e) => mudar("data", e.target.value)} className={campo} /></label>
                    <label className="block text-sm">Situação encontrada<input value={v.situacao} onChange={(e) => mudar("situacao", e.target.value)} maxLength={120} placeholder="Ativo, sem restrição" className={campo} /></label>
                    <label className="block text-sm sm:col-span-2">Endereço consultado (https)<input value={v.link} onChange={(e) => mudar("link", e.target.value)} placeholder="https://…" className={campo} /></label>
                    <label className="block text-sm sm:col-span-2">Observação<input value={v.nota} onChange={(e) => mudar("nota", e.target.value)} maxLength={500} className={campo} /></label>
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-2">
                    <label className={`${botaoClaro} cursor-pointer`}>{v.arquivo ? "Trocar a captura" : "Anexar a captura (imagem ou PDF)"}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => { void anexarCaptura(p.id, e.target.files?.[0]); e.target.value = ""; }} /></label>
                    {v.arquivo && <span className="text-sm">✓ captura pronta</span>}
                    <button type="button" className={botao} disabled={acao.ocupado} onClick={async () => {
                      if (await acao.agir("saude_decidir", { p_usuario: p.id, p_acao: "verificar", p_verificado_em: v.data, p_nota: v.nota }, "Conferência registrada.")) {
                        if (v.arquivo || v.link || v.situacao) await acao.agir("saude_verificacao_anexar", { p_usuario: p.id, p_arquivo: v.arquivo, p_link: v.link, p_situacao: v.situacao }, "Conferência e prova registradas.");
                      }
                    }}>Registrar a conferência</button>
                  </p>
                </div>

                <p className="mt-3 flex flex-wrap gap-2">
                  {p.status !== "publicado" && p.status !== "removido" && <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("saude_decidir", { p_usuario: p.id, p_acao: "publicar" }, "Publicado: aparece assim que tudo estiver em dia.")}>Publicar</button>}
                  {p.status === "publicado" && <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => { const nota = window.prompt("Motivo (vai para o profissional):", "") ?? ""; void acao.agir("saude_decidir", { p_usuario: p.id, p_acao: "aguardar", p_nota: nota }, "Devolvido para ajuste."); }}>Devolver para ajuste</button>}
                  {p.status !== "suspenso" && p.status !== "removido" && <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => { const nota = window.prompt("Motivo da suspensão (vai para o profissional):", "") ?? ""; void acao.agir("saude_decidir", { p_usuario: p.id, p_acao: "suspender", p_nota: nota }, "Suspenso."); }}>Suspender</button>}
                </p>
                <EditarPeloCoordenacao p={p} depois={fila.recarregar} />
                <Registro usuario={p.id} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
