// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { can, type Me, rpc } from "@/lib/backend";
import { CONSULTA_DO_CONSELHO, type Profissional } from "@/lib/saude";
import { TERMO_SAUDE, textoDoTermo } from "@/lib/termos";
import { CartaoDoProfissional } from "../saude/Vitrine";
import { Aviso, botao, botaoClaro, campo, dataHora, rotulo, textoDoErro, useAcao, useLista } from "./comum";

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
}
const SITUACAO: Record<PerfilDoPainel["status"], string> = { rascunho: "rascunho", aguardando: "esperando a coordenação", publicado: "publicado", suspenso: "suspenso", removido: "removido a pedido" };
const CONSELHOS = ["CRP", "CRM", "COREN", "CRN", "CREFITO", "CRESS", "CRO", "CRFa", "CREF", "CRF", "CRBM"];
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

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

function MeuPerfil() {
  const perfil = useLista<PerfilDoPainel>("saude_meu");
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [termo, setTermo] = useState({ nome: "", registro: "", marcadas: [] as number[] });
  const p = perfil.dados;
  if (!p) return <Aviso texto={perfil.erro} />;
  const f = form ?? {
    nome: p.nome, profissao: p.profissao, conselho: p.conselho || "CRP", uf: p.uf, registro: p.registro, abordagem: p.abordagem, areas: p.areas.join(", "),
    modalidade: p.modalidade ?? "online", cidade: p.cidade ?? "", valor: p.valor ?? "social", bio: p.bio,
    whatsapp: p.contatos.whatsapp ?? "", instagram: p.contatos.instagram ?? "", email: p.contatos.email ?? "", site: p.contatos.site ?? "",
    foto: p.foto_guardada, foto_autorizada: p.foto_autorizada ? "1" : "",
  };
  const mudar = (k: string, v: string) => setForm({ ...f, [k]: v });
  const termoEmDia = p.termo_versao === p.termo_vigente;
  // As cláusulas que pedem marcação uma a uma (natureza de mural, voluntariado, responsabilidade, dados, imagem, emergência, publicidade, remoção).
  const criticas = [1, 2, 4, 6, 7, 8, 9, 10];

  async function salvar() {
    setOcupado(true);
    setAviso("");
    try {
      const r = await rpc<{ ok: boolean; motivo?: string }>("saude_salvar", {
        p: { ...f, areas: f.areas.split(",").map((x) => x.trim()).filter(Boolean), contatos: { whatsapp: f.whatsapp, instagram: f.instagram, email: f.email, site: f.site }, foto_autorizada: f.foto_autorizada === "1", foto: f.foto },
      });
      setAviso(r.ok ? "Salvo ✓ O perfil sai do ar até a coordenação conferir de novo (ela foi avisada)." : (r.motivo ?? "Não deu para salvar."));
      if (r.ok) {
        setForm(null);
        perfil.recarregar();
      }
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }
  async function aceitarTermo() {
    setOcupado(true);
    try {
      await rpc("saude_termo_aceitar", { p_texto: textoDoTermo(TERMO_SAUDE, [`Nome digitado: ${termo.nome.trim()}`, `Registro informado: ${termo.registro.trim()}`]), p_nome: termo.nome.trim(), p_registro: termo.registro.trim() });
      perfil.recarregar();
      setAviso("Termo aceito ✓ Ele fica guardado com a data e o texto exato.");
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }
  async function foto(arquivo?: File) {
    if (!arquivo || !/^image\/(jpeg|png|webp)$/.test(arquivo.type) || arquivo.size > 15 * 1024 * 1024) return setAviso("Escolha uma foto JPG, PNG ou WebP de até 15 MB.");
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
    setAviso("Este navegador não gravou a foto em WebP. Tente outro navegador.");
  }

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
      </div>

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

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="painel-cartao p-5">
          <h3 className="font-serif text-2xl font-semibold">Dados do cartão</h3>
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
            <label className="block sm:col-span-2">Sobre você (até 900 caracteres)<textarea value={f.bio} onChange={(e) => mudar("bio", e.target.value)} maxLength={900} rows={5} className={campo} /><span className="text-xs text-ink-soft">Sem preço, sem promessa de cura ou resultado, sem “o melhor”, sem depoimento de paciente, sem CPF ou endereço residencial.</span></label>
          </div>
          <h4 className="mt-5 font-semibold">Contato que você autoriza</h4>
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
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.foto_autorizada === "1"} onChange={(e) => mudar("foto_autorizada", e.target.checked ? "1" : "")} />Autorizo o uso da minha foto na vitrine (posso desfazer quando quiser)</label>
          </div>
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

function Fila() {
  const fila = useLista<{ desligada: boolean; perfis: PerfilDoPainel[] }>("saude_fila");
  const acao = useAcao(fila.recarregar);
  const [datas, setDatas] = useState<Record<string, { data: string; nota: string }>>({});
  const hoje = new Date().toISOString().slice(0, 10);
  const d = fila.dados;
  return (
    <section className="space-y-5">
      <header>
        <p className={rotulo}>Saúde Solidária · coordenação</p>
        <h2 className="font-serif text-3xl font-semibold">Profissionais da vitrine</h2>
        <p className="mt-1 max-w-3xl text-ink-soft">Um perfil só aparece com tudo em dia: cargo de profissional de saúde, termo vigente aceito, registro conferido no conselho há menos de 180 dias, texto aprovado pelo próprio profissional e publicação aqui. Qualquer item que falhar tira o perfil na hora. Para dar o cargo: Voluntários e convites › Confiar função › Profissional de saúde.</p>
      </header>
      <Aviso texto={fila.erro || acao.aviso} />
      {d && (
        <div className={`max-w-3xl border-2 p-4 ${d.desligada ? "border-[#c21f16] bg-parchment-deep" : "border-ink"}`}>
          <p className="font-semibold">Chave geral: {d.desligada ? "vitrine DESLIGADA (ninguém aparece)" : "vitrine ligada"}</p>
          <p className="mt-1 text-sm text-ink-soft">Use em emergência (denúncia grave, dúvida jurídica): desliga a vitrine inteira na hora, sem publicar o site de novo.</p>
          <button type="button" className={`mt-2 ${d.desligada ? botao : botaoClaro}`} disabled={acao.ocupado} onClick={() => { if (d.desligada || window.confirm("Desligar a vitrine inteira agora?")) void acao.agir("saude_chave", { p_desligar: !d.desligada }, d.desligada ? "Vitrine ligada." : "Vitrine desligada."); }}>{d.desligada ? "Ligar a vitrine" : "Desligar a vitrine"}</button>
        </div>
      )}
      {d?.perfis.length === 0 && <p className="text-ink-soft">Nenhum profissional no painel ainda. (Os perfis publicados pelo arquivo content/saude/profissionais.json aparecem direto na vitrine.)</p>}
      <ul className="space-y-4">
        {d?.perfis.map((p) => {
          const consulta = CONSULTA_DO_CONSELHO[p.conselho.toUpperCase()];
          const v = datas[p.id] ?? { data: hoje, nota: "" };
          return (
            <li key={p.id} className="painel-cartao grid gap-4 p-4 lg:grid-cols-[16rem_1fr]">
              <CartaoDoProfissional p={p} />
              <div>
                <p className={rotulo}>{SITUACAO[p.status]} · atualizado em {dataHora(p.atualizado_em)}</p>
                <p className="mt-1">{p.apto ? "✓ Aparecendo na vitrine." : `Falta: ${p.faltam.join("; ")}.`}</p>
                <p className="mt-1 text-sm text-ink-soft">Termo: {p.termo_versao ? `versão ${p.termo_versao}` : "não aceito"} · Registro conferido em: {p.verificado_em ?? "nunca"} · Texto aprovado em: {p.texto_aprovado_em ? dataHora(p.texto_aprovado_em) : "nunca"}</p>
                <div className="mt-3 border-t border-rule pt-3">
                  <p className="font-semibold">Conferir o registro</p>
                  <p className="text-sm text-ink-soft">{consulta ? <>Consulte em <a href={consulta} target="_blank" rel="noopener noreferrer" className="underline">{consulta}</a></> : "Consulte no site do conselho regional"}, guarde a captura da tela com você e anote aqui a data e o que encontrou.</p>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <label className="block text-sm">Data da consulta<input type="date" max={hoje} value={v.data} onChange={(e) => setDatas({ ...datas, [p.id]: { ...v, data: e.target.value } })} className={campo} /></label>
                    <label className="block flex-1 text-sm">O que encontrou<input value={v.nota} onChange={(e) => setDatas({ ...datas, [p.id]: { ...v, nota: e.target.value } })} maxLength={500} placeholder="Registro ativo, sem restrição" className={campo} /></label>
                    <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => acao.agir("saude_decidir", { p_usuario: p.id, p_acao: "verificar", p_verificado_em: v.data, p_nota: v.nota }, "Conferência registrada.")}>Registrar a conferência</button>
                  </div>
                </div>
                <p className="mt-3 flex flex-wrap gap-2">
                  {p.status !== "publicado" && p.status !== "removido" && <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("saude_decidir", { p_usuario: p.id, p_acao: "publicar" }, "Publicado: aparece assim que tudo estiver em dia.")}>Publicar</button>}
                  {p.status === "publicado" && <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => { const nota = window.prompt("Motivo (vai para o profissional):", "") ?? ""; void acao.agir("saude_decidir", { p_usuario: p.id, p_acao: "aguardar", p_nota: nota }, "Devolvido para ajuste."); }}>Devolver para ajuste</button>}
                  {p.status !== "suspenso" && p.status !== "removido" && <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => { const nota = window.prompt("Motivo da suspensão (vai para o profissional):", "") ?? ""; void acao.agir("saude_decidir", { p_usuario: p.id, p_acao: "suspender", p_nota: nota }, "Suspenso."); }}>Suspender</button>}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
