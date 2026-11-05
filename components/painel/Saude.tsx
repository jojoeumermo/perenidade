// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ExternalLink, FileText, ImageUp, LogOut, Power, PowerOff, Send, ShieldCheck, Undo2, Upload } from "lucide-react";
import { useState } from "react";
import { can, type Me, rpc } from "@/lib/backend";
import { categoria, categoriaLigada, conferirCampos, conselhosLigados, NOME_DO_CAMPO, NOME_VITRINE, REGRAS, TEXTOS } from "@/lib/mural-saude";
import { CONSULTA_DO_CONSELHO, type Profissional } from "@/lib/saude";
import { TERMO_SAUDE, textoDoTermo } from "@/lib/termos";
import { abrirArquivoDaSaude, cleanImage, sendSaudeFile, UploadError, uploadMessages } from "@/lib/upload";
import { CartaoDoProfissional } from "../saude/Vitrine";
import { Aviso, dataHora, dia, textoDoErro, useAcao, useLista } from "./comum";
import { Area, Botao, CabecalhoDeSecao, Campo, Cartao, confirmarFrase, Esqueleto, Faixa, Marca, perguntarTexto, Selecao, Selo, type TomDoSelo, Vazio } from "./ui";
import { SaudeRegras } from "./SaudeRegras";

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
  categoria_ligada: boolean;
  aviso_politico_em: string | null;
  bloqueio: { motivo: string; sugestao: string; campo: string } | null;
}
interface Passo {
  acao: string;
  em: string;
  por: string;
  detalhe: Record<string, unknown>;
}
const SITUACAO: Record<PerfilDoPainel["status"], string> = { rascunho: "rascunho", aguardando: "esperando a coordenação", publicado: "publicado", suspenso: "suspenso", removido: "removido a pedido" };
/** O tom do selo de cada situação (a palavra diz; a cor só acompanha). */
const TOM_DA_SITUACAO: Record<PerfilDoPainel["status"], TomDoSelo> = { rascunho: "neutro", aguardando: "aviso", publicado: "ok", suspenso: "erro", removido: "neutro" };
const PUBLICOS = REGRAS.publicos as Record<string, string>;
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
  texto_bloqueado: "Texto barrado pelo filtro de publicidade (regra e campo, sem o texto)",
  aviso_politico_lido: "Aviso sobre o posicionamento do Instituto lido",
  aguardando_novo_aceite: "Termo novo: esperando um novo aceite",
  verificar: "Registro conferido no conselho",
  publicar: "Publicado",
  aguardar: "Devolvido para ajuste",
  suspender: "Suspenso",
  removido_a_pedido: "Removido a pedido do profissional",
};

type Campos = Record<string, string>;
const camposDe = (p: PerfilDoPainel): Campos => ({
  nome: p.nome, profissao: p.profissao, conselho: p.conselho || "CRP", uf: p.uf, registro: p.registro, abordagem: p.abordagem, areas: p.areas.join(", "),
  modalidade: p.modalidade ?? "online", cidade: p.cidade ?? "", estado: p.estado ?? "", publico: (p.publico ?? []).join(","), idiomas: (p.idiomas ?? []).join(","), bio: p.bio,
  whatsapp: p.contatos.whatsapp ?? "", instagram: p.contatos.instagram ?? "", email: p.contatos.email ?? "", site: p.contatos.site ?? "",
  foto: p.foto_guardada, foto_autorizada: p.foto_autorizada ? "1" : "",
});
const paraEnviar = (f: Campos) => ({
  ...f, areas: f.areas.split(",").map((x) => x.trim()).filter(Boolean), contatos: { whatsapp: f.whatsapp, instagram: f.instagram, email: f.email, site: f.site },
  publico: f.publico.split(",").filter(Boolean), idiomas: f.idiomas.split(",").filter(Boolean),
  foto_autorizada: f.foto_autorizada === "1", foto: f.foto,
});

/** O botão que abre a escolha de arquivo (o campo de arquivo fica escondido dentro do rótulo, como antes). */
function BotaoDeArquivo({ texto, aceita, desligado, escolher, simbolo: Simbolo = Upload }: { texto: string; aceita: string; desligado?: boolean; escolher: (arquivo?: File) => void; simbolo?: typeof Upload }) {
  return (
    <label className="pn-botao cursor-pointer focus-within:outline-2 focus-within:outline-offset-2">
      <Simbolo aria-hidden />
      {texto}
      <input
        type="file"
        accept={aceita}
        className="sr-only"
        disabled={desligado}
        onChange={(e) => {
          escolher(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );
}

/** A seção do Mural de Saúde no painel: o perfil do próprio profissional e, para a coordenação, a fila e a chave geral. */
export function SaudeNoPainel({ me }: { me: Me }) {
  // Quem cuida da vitrine: a coordenação e o representante do Departamento de Saúde (o banco confere de novo).
  const coordena = can(me, "coordenacao", "vice") || me.papeis.some((p) => p.papel === "representante" && p.disciplina === "saude");
  const profissional = me.papeis.some((p) => p.papel === "saude");
  return (
    <div className="pn-tela" style={{ gap: "2.5rem" }}>
      {profissional && <MeuPerfil />}
      {coordena && <Fila />}
      {can(me, "coordenacao", "vice") && <SaudeRegras />}
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
  const cat = categoria(f.conselho);
  const conselhos = [...new Set([...conselhosLigados(), f.conselho].filter(Boolean))];
  const lista = (campo: string) => f[campo].split(",").filter(Boolean);
  const alternar = (campo: string, valor: string, marcado: boolean) => mudar(campo, (marcado ? [...lista(campo), valor] : lista(campo).filter((x) => x !== valor)).join(","));
  const bloqueio = conferirCampos({ nome: f.nome, abordagem: f.abordagem, areas: f.areas, cidade: f.cidade, bio: f.bio });
  return (
    <div className="pn-secao">
      {!categoriaLigada(f.conselho) && <Faixa tom="aviso">{TEXTOS.categoriaDesligada}</Faixa>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo rotulo="Nome completo ou nome social" value={f.nome} onChange={(e) => mudar("nome", e.target.value)} maxLength={80} ajuda="Sem “Dr.” ou “Dra.”: o mural ainda não confere título de doutorado." />
        </div>
        <Selecao rotulo="Conselho" value={f.conselho} onChange={(e) => mudar("conselho", e.target.value)}>
          {conselhos.map((c) => (
            <option key={c} value={c}>
              {c}
              {categoriaLigada(c) ? "" : " (categoria ainda fechada no mural)"}
            </option>
          ))}
        </Selecao>
        <Selecao rotulo="Profissão" value={f.profissao} onChange={(e) => mudar("profissao", e.target.value)}>
          <option value="">—</option>
          {(cat?.profissoes ?? []).map((x) => (
            <option key={x}>{x}</option>
          ))}
        </Selecao>
        <div>
          <Campo rotulo="Número de registro" value={f.registro} onChange={(e) => mudar("registro", e.target.value)} maxLength={30} placeholder={cat?.exemploDoRegistro ?? "05/12345"} />
          <p className="pn-ajuda">
            Região/número, sem a sigla: aparece como “{f.conselho} {f.registro || cat?.exemploDoRegistro}”.
          </p>
        </div>
        <Selecao rotulo="UF do registro" value={f.uf} onChange={(e) => mudar("uf", e.target.value)}>
          <option value="">—</option>
          {UFS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </Selecao>
        <div className="sm:col-span-2">
          <Campo rotulo="Abordagem teórica (opcional)" value={f.abordagem} onChange={(e) => mudar("abordagem", e.target.value)} maxLength={120} />
        </div>
        <div className="sm:col-span-2">
          <Campo rotulo="Áreas de atuação, separadas por vírgula (opcional)" value={f.areas} onChange={(e) => mudar("areas", e.target.value)} placeholder="ansiedade, luto, orientação profissional" />
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="pn-rotulo">Público atendido (opcional)</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(PUBLICOS).map(([k, nome]) => (
              <Marca key={k} rotulo={nome} checked={lista("publico").includes(k)} onChange={(e) => alternar("publico", k, e.target.checked)} />
            ))}
          </div>
        </fieldset>
        <Selecao rotulo="Modalidade" value={f.modalidade} onChange={(e) => mudar("modalidade", e.target.value)}>
          <option value="online">On-line</option>
          <option value="presencial">Presencial</option>
          <option value="ambas">On-line e presencial</option>
        </Selecao>
        <Campo rotulo="Cidade (se presencial)" value={f.cidade} onChange={(e) => mudar("cidade", e.target.value)} maxLength={80} />
        <Selecao rotulo="Estado (se presencial)" value={f.estado} onChange={(e) => mudar("estado", e.target.value)}>
          <option value="">—</option>
          {UFS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </Selecao>
        <fieldset className="sm:col-span-2">
          <legend className="pn-rotulo">Idiomas de atendimento (opcional)</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {REGRAS.idiomas.map((x) => (
              <Marca key={x} rotulo={x} checked={lista("idiomas").includes(x)} onChange={(e) => alternar("idiomas", x, e.target.checked)} />
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <Area rotulo={`Sobre meu trabalho (até ${REGRAS.sobreMaximo} caracteres)`} value={f.bio} onChange={(e) => mudar("bio", e.target.value)} maxLength={REGRAS.sobreMaximo} rows={4} />
          <p className="pn-ajuda">
            {TEXTOS.orientacaoDoSobre} ({f.bio.length}/{REGRAS.sobreMaximo})
          </p>
        </div>
      </div>
      {bloqueio && (
        <Faixa tom="aviso" titulo={`${NOME_DO_CAMPO[bloqueio.campo] ?? bloqueio.campo}:`}>
          <p>{bloqueio.motivo}</p>
          <p className="mt-1">Sugestão: {bloqueio.sugestao}</p>
        </Faixa>
      )}
      <h4 className="pn-rotulo-mono">Contato autorizado</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="WhatsApp profissional (com DDD)" value={f.whatsapp} onChange={(e) => mudar("whatsapp", e.target.value)} placeholder="+55 21 90000-0000" />
        <Campo rotulo="Instagram" value={f.instagram} onChange={(e) => mudar("instagram", e.target.value)} placeholder="@seuperfil" />
        <Campo rotulo="E-mail profissional" type="email" value={f.email} onChange={(e) => mudar("email", e.target.value)} />
        <Campo rotulo="Site ou agenda (https)" type="url" value={f.site} onChange={(e) => mudar("site", e.target.value)} placeholder="https://…" />
      </div>
      <h4 className="pn-rotulo-mono">Foto (opcional)</h4>
      <p className="pn-ajuda">{TEXTOS.orientacaoDaFoto}</p>
      <div className="flex flex-wrap items-center gap-3">
        <BotaoDeArquivo texto="Escolher foto" aceita="image/jpeg,image/png,image/webp" simbolo={ImageUp} escolher={(arquivo) => void foto(arquivo)} />
        {f.foto && <Botao onClick={() => mudar("foto", "")}>Tirar a foto</Botao>}
        <Marca rotulo="Uso da foto no mural autorizado pelo profissional (pode desfazer quando quiser)" checked={f.foto_autorizada === "1"} onChange={(e) => mudar("foto_autorizada", e.target.checked ? "1" : "")} />
      </div>
    </div>
  );
}

/** O histórico de um perfil (o que ficou guardado para sempre). Só busca quando alguém abre. */
function Registro({ usuario }: { usuario?: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <details className="mt-3" onToggle={(e) => setAberto((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-sm font-semibold">Registro de tudo o que aconteceu com este perfil</summary>
      <p className="pn-ajuda mt-1">Guardado para sempre: ninguém altera nem apaga, nem a coordenação.</p>
      {aberto && <PassosDoRegistro usuario={usuario} />}
    </details>
  );
}

function PassosDoRegistro({ usuario }: { usuario?: string }) {
  const lista = useLista<Passo[]>("saude_registro_listar", usuario ? { p_usuario: usuario } : {}, { quieta: true });
  if (lista.erro) return <Aviso texto={lista.erro} />;
  if (!lista.dados) return <Esqueleto linhas={2} />;
  return (
    <ol className="mt-2 space-y-1 text-sm">
      {lista.dados.map((x, i) => (
        <li key={i} className="border-l-2 border-rule pl-2">
          <strong>{NOMES_DOS_PASSOS[x.acao] ?? x.acao}</strong> · {dataHora(x.em)}
          {x.por ? ` · por ${x.por}` : ""}
          {typeof x.detalhe.nota === "string" && x.detalhe.nota ? ` · “${x.detalhe.nota}”` : ""}
        </li>
      ))}
      {lista.dados.length === 0 && <li className="text-ink-soft">Nada registrado ainda.</li>}
    </ol>
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
  janela.document.title = `Termo ${NOME_VITRINE} ${a.versao}`;
  // A versão de imprimir é documento (folha branca, tinta preta), não a interface do painel.
  janela.document.body.innerHTML = `<main style="font:15px/1.5 Georgia,serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#111">
    <p style="font:12px monospace">Instituto Lúcia · ${esc(NOME_VITRINE)} · versão ${esc(a.versao)}</p>
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
  const [termo, setTermo] = useState({ nome: "", registro: "", marcadas: [] as number[], etica: false, politica: false });
  const p = perfil.dados;
  if (!p) return perfil.erro ? <Aviso texto={perfil.erro} /> : <Esqueleto forma="cartoes" linhas={2} />;
  const f = form ?? camposDe(p);
  const mudar = (k: string, v: string) => setForm({ ...f, [k]: v });
  const termoEmDia = p.termo_versao === p.termo_vigente;
  const assinaturaEmDia = !!p.assinatura_arquivo && p.assinatura_versao === p.termo_vigente;
  // As cláusulas que pedem marcação uma a uma (natureza de mural, independência política, nome fora de política,
  // publicidade, responsabilidade, condições, dados, foto, emergência, ocultação e remoção).
  const criticas = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11];
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
    const r = await rpc<{ ok: boolean; motivo?: string; sugestao?: string }>("saude_salvar", { p: paraEnviar(f) });
    if (!r.ok) return [r.motivo ?? "Não deu para salvar.", r.sugestao ? `Sugestão: ${r.sugestao}` : ""].filter(Boolean).join(" ");
    setForm(null);
    perfil.recarregar();
    return "Salvo ✓ O perfil sai do ar até a coordenação conferir de novo (ela foi avisada).";
  });
  const aceitarTermo = () => fazer(async () => {
    await rpc("saude_termo_aceitar", {
      p_texto: textoDoTermo(TERMO_SAUDE, [`Nome digitado: ${termo.nome.trim()}`, `Registro informado: ${termo.registro.trim()}`, `Declaração: ${TEXTOS.declaracaoEtica}`, `Declaração: ${TEXTOS.declaracaoPolitica}`]),
      p_nome: termo.nome.trim(), p_registro: termo.registro.trim(), p_etica: termo.etica, p_politica: termo.politica,
    });
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

  if (!p.aviso_politico_em) {
    return (
      <Cartao variante="destaque" className="max-w-2xl">
        <div className="pn-secao">
          <CabecalhoDeSecao rotulo={NOME_VITRINE} titulo={TEXTOS.avisoPolitico.titulo} />
          <p className="text-lg">{TEXTOS.avisoPolitico.texto}</p>
          <p>
            <a href="/pt/sobre" target="_blank" rel="noopener" className="pn-elo inline-flex items-center gap-1">
              {TEXTOS.avisoPolitico.link}
              <ExternalLink aria-hidden width={14} height={14} />
            </a>
          </p>
          <Aviso texto={aviso} />
          <div>
            <Botao variante="principal" disabled={ocupado} carregando={ocupado} onClick={() => void fazer(async () => { await rpc("saude_aviso_ciente"); perfil.recarregar(); return ""; })}>
              {TEXTOS.avisoPolitico.botao}
            </Botao>
          </div>
        </div>
      </Cartao>
    );
  }

  return (
    <section className="pn-tela">
      <CabecalhoDeSecao
        rotulo={`${NOME_VITRINE} · seu perfil`}
        titulo="Seu cartão no mural"
        sobre="O mural é só um mural de contatos: as pessoas veem o seu cartão e falam direto com você. O instituto não agenda, não intermedeia, não indica e não recebe dado de paciente. O seu cartão só aparece quando tudo abaixo estiver em dia, e o conteúdo dele é de sua responsabilidade perante o seu conselho."
      />
      <Aviso texto={aviso} />
      <Cartao as="div" className="max-w-3xl">
        <div className="pn-secao">
          <p className="flex flex-wrap items-center gap-2">
            <strong>Situação:</strong>
            <Selo tom={TOM_DA_SITUACAO[p.status]} ponto>
              {SITUACAO[p.status]}
            </Selo>
            {p.apto && <span>{" · aparecendo no mural"}</span>}
          </p>
          {!p.categoria_ligada && <p className="text-sm">{TEXTOS.categoriaDesligada}</p>}
          {p.bloqueio && (
            <Faixa tom="aviso" titulo="Texto fora das regras de publicidade:">
              {p.bloqueio.motivo} Sugestão: {p.bloqueio.sugestao}
            </Faixa>
          )}
          {p.faltam.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-ink-soft">
              {p.faltam.map((x) => (
                <li key={x}>Falta: {x}</li>
              ))}
            </ul>
          )}
          {p.verificacao_nota && <Faixa tom="info">Recado da coordenação: {p.verificacao_nota}</Faixa>}
          <Registro />
        </div>
      </Cartao>

      {esperandoAprovacao && (
        <Cartao variante="alerta" className="max-w-3xl" nivelDoTitulo={3} titulo="A coordenação ajustou o seu cartão" sobre="Confira a prévia ao lado. O texto é seu: ele só volta ao ar se você aprovar. Se não concordar, mude os campos e salve, ou escreva para a coordenação.">
          <div>
            <Botao variante="principal" disabled={ocupado} onClick={() => void fazer(async () => { await rpc("saude_aprovar_texto"); perfil.recarregar(); return "Texto aprovado ✓"; })}>
              Aprovo o texto como está
            </Botao>
          </div>
        </Cartao>
      )}

      {!termoEmDia && (
        <Cartao variante="alerta" className="max-w-3xl" nivelDoTitulo={3} titulo={TERMO_SAUDE.titulo} sobre={`Versão ${TERMO_SAUDE.versao} · rascunho em revisão jurídica. Marque cada cláusula destacada, digite o seu nome completo e o registro, e confirme.`}>
          <div className="pn-secao">
            <ol className="list-decimal space-y-2 pl-5">
              {TERMO_SAUDE.clausulas.map((c, i) => (
                <li key={c}>
                  {criticas.includes(i) ? (
                    <label className="flex items-start gap-2">
                      <input type="checkbox" checked={termo.marcadas.includes(i)} onChange={(e) => setTermo({ ...termo, marcadas: e.target.checked ? [...termo.marcadas, i] : termo.marcadas.filter((x) => x !== i) })} className="mt-1" />
                      <span>{c}</span>
                    </label>
                  ) : (
                    c
                  )}
                </li>
              ))}
            </ol>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Nome completo" value={termo.nome} onChange={(e) => setTermo({ ...termo, nome: e.target.value })} maxLength={120} />
              <Campo rotulo="Número de registro" value={termo.registro} onChange={(e) => setTermo({ ...termo, registro: e.target.value })} maxLength={40} />
            </div>
            <div className="space-y-2 border-t border-rule pt-3">
              <Marca rotulo={TEXTOS.declaracaoEtica} checked={termo.etica} onChange={(e) => setTermo({ ...termo, etica: e.target.checked })} />
              <Marca rotulo={TEXTOS.declaracaoPolitica} checked={termo.politica} onChange={(e) => setTermo({ ...termo, politica: e.target.checked })} />
            </div>
            <div>
              <Botao
                variante="principal"
                simbolo={ShieldCheck}
                disabled={ocupado || termo.nome.trim().length < 5 || termo.registro.trim().length < 3 || !termo.etica || !termo.politica || !criticas.every((i) => termo.marcadas.includes(i))}
                onClick={() => void aceitarTermo()}
              >
                Li e aceito o termo
              </Botao>
            </div>
          </div>
        </Cartao>
      )}

      {termoEmDia && (
        <Cartao className="max-w-3xl" nivelDoTitulo={3} titulo="Termo assinado no gov.br">
          <div className="pn-secao">
            {assinaturaEmDia ? (
              <Faixa tom={p.assinatura_conferida_em ? "ok" : "info"}>
                ✓ PDF assinado enviado em {p.assinatura_enviada_em ? dataHora(p.assinatura_enviada_em) : "—"}. {p.assinatura_conferida_em ? `Assinatura conferida pela coordenação em ${dataHora(p.assinatura_conferida_em)}.` : "Esperando a coordenação conferir a assinatura."}
              </Faixa>
            ) : (
              <p className="pn-ajuda">Além do aceite no painel, o termo vai assinado com a sua conta gov.br (assinatura eletrônica avançada, gratuita). Três passos:</p>
            )}
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>
                <Botao variante="discreto" pequeno simbolo={FileText} onClick={() => void fazer(imprimirTermo)}>
                  Baixar o termo que você aceitou
                </Botao>{" "}
                (abre a versão para imprimir: escolha “Salvar como PDF”).
              </li>
              <li>
                Assine o PDF em{" "}
                <a href={ASSINADOR} target="_blank" rel="noopener noreferrer" className="pn-elo">
                  assinador.iti.br
                </a>{" "}
                com a sua conta gov.br (nível prata ou ouro) e baixe o arquivo assinado.
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <BotaoDeArquivo texto={assinaturaEmDia ? "Enviar outro PDF assinado" : "Enviar o PDF assinado"} aceita="application/pdf" desligado={ocupado} escolher={(arquivo) => void enviarAssinatura(arquivo)} />
                <span className="pn-ajuda">Fica no depósito fechado: só você e a coordenação abrem.</span>
              </li>
            </ol>
          </div>
        </Cartao>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Cartao
          nivelDoTitulo={3}
          titulo="Dados do cartão"
          rodape={
            <div className="pn-secao">
              <div className="flex flex-wrap gap-2">
                <Botao variante="principal" disabled={ocupado || f.nome.trim().length < 2 || f.profissao.trim().length < 2 || !f.registro.trim()} carregando={ocupado} onClick={() => void salvar()}>
                  Salvar e aprovar este texto
                </Botao>
                {p.status !== "removido" && (
                  <Botao
                    simbolo={LogOut}
                    disabled={ocupado}
                    onClick={async () => {
                      if (await confirmarFrase("Sair do mural agora? O cartão some na hora.")) {
                        await rpc("saude_sair").catch(() => null);
                        perfil.recarregar();
                      }
                    }}
                  >
                    Sair do mural
                  </Botao>
                )}
              </div>
              <p className="pn-ajuda">Salvar conta como a sua aprovação do texto final. Toda mudança tira o cartão do ar até a coordenação conferir de novo.</p>
            </div>
          }
        >
          <CamposDoPerfil f={f} mudar={mudar} aviso={setAviso} />
        </Cartao>
        <aside aria-label="Prévia" className="pn-secao">
          <p className="pn-rotulo-mono">Prévia</p>
          <CartaoDoProfissional p={{ ...p, ...f, conselho: f.conselho, areas: f.areas.split(",").map((x) => x.trim()).filter(Boolean), modalidade: f.modalidade as Profissional["modalidade"], publico: f.publico.split(",").filter(Boolean), idiomas: f.idiomas.split(",").filter(Boolean), contatos: { whatsapp: f.whatsapp, instagram: f.instagram }, foto: f.foto_autorizada === "1" ? f.foto : "" }} />
        </aside>
      </div>
    </section>
  );
}

/** Abre um arquivo do depósito "saude" numa aba (o PDF assinado ou a captura da consulta). */
function BotaoArquivo({ caminho, nome, aviso }: { caminho: string; nome: string; aviso: (t: string) => void }) {
  if (!caminho) return null;
  return (
    <Botao
      variante="discreto"
      pequeno
      simbolo={ExternalLink}
      onClick={async () => {
        try {
          window.open(await abrirArquivoDaSaude(caminho), "_blank", "noopener");
        } catch {
          aviso("Não foi possível abrir o arquivo.");
        }
      }}
    >
      {nome}
    </Botao>
  );
}

function EditarPeloCoordenacao({ p, depois }: { p: PerfilDoPainel; depois: () => void }) {
  const [f, setF] = useState<Campos>(() => camposDe(p));
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  return (
    <details className="mt-3 border-t border-rule pt-3">
      <summary className="cursor-pointer font-semibold">Editar o cartão</summary>
      <div className="pn-secao mt-2">
        <p className="pn-ajuda">O conteúdo continua sendo do profissional: ao salvar, o cartão sai do ar e só volta depois que ele aprovar o texto no painel dele (ele é avisado).</p>
        <Aviso texto={aviso} />
        <CamposDoPerfil f={f} mudar={(k, v) => setF({ ...f, [k]: v })} aviso={setAviso} />
        <div>
          <Botao
            simbolo={Send}
            disabled={ocupado}
            carregando={ocupado}
            onClick={async () => {
              setOcupado(true);
              try {
                const r = await rpc<{ ok: boolean; motivo?: string; sugestao?: string }>("saude_editar", { p_usuario: p.id, p: paraEnviar(f) });
                setAviso(r.ok ? "Salvo ✓ Esperando a aprovação do profissional." : [r.motivo ?? "Não deu para salvar.", r.sugestao ? `Sugestão: ${r.sugestao}` : ""].filter(Boolean).join(" "));
                if (r.ok) depois();
              } catch (erro) {
                setAviso(textoDoErro(erro));
              } finally {
                setOcupado(false);
              }
            }}
          >
            Salvar e pedir a aprovação do profissional
          </Botao>
        </div>
      </div>
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
    <section className="pn-tela">
      <CabecalhoDeSecao
        rotulo={`${NOME_VITRINE} · coordenação`}
        titulo="Profissionais do mural"
        sobre="Um perfil só aparece com tudo em dia: cargo de profissional de saúde, termo vigente aceito, termo assinado no gov.br e conferido aqui, registro conferido no conselho há menos de 180 dias, texto aprovado pelo próprio profissional e publicação. Por cima disso, as regras de publicidade do mural: categoria aberta (por ora, só psicologia), as duas declarações do termo vigente e o texto passando pelo filtro. Qualquer item que falhar tira o perfil na hora. Para dar o cargo: Voluntários e convites › Confiar função › Profissional de saúde."
      />
      {fila.erro && (
        <Faixa tom="erro" acao={<Botao pequeno onClick={fila.recarregar}>Tentar de novo</Botao>}>
          {fila.erro}
        </Faixa>
      )}
      <Aviso texto={acao.aviso || avisoArquivo} />
      {!d && !fila.erro && <Esqueleto forma="cartoes" linhas={2} />}
      {d && (
        // A chave geral é uma ação na hora (sem formulário a guardar): fica num cartão próprio, em alerta quando desligada.
        <Cartao
          variante={d.desligada ? "alerta" : "padrao"}
          className="max-w-3xl"
          nivelDoTitulo={3}
          titulo={`Chave geral: ${d.desligada ? "mural DESLIGADO (ninguém aparece)" : "mural ligado"}`}
          sobre="Use em emergência (denúncia grave, dúvida jurídica): desliga o mural inteiro na hora, sem publicar o site de novo. Vale também para os cartões publicados pelo arquivo do site."
        >
          <div>
            <Botao
              variante={d.desligada ? "principal" : "padrao"}
              perigo={!d.desligada}
              simbolo={d.desligada ? Power : PowerOff}
              disabled={acao.ocupado}
              onClick={async () => {
                if (d.desligada || (await confirmarFrase("Desligar o mural inteiro agora?"))) void acao.agir("saude_chave", { p_desligar: !d.desligada }, d.desligada ? "Mural ligado." : "Mural desligado.");
              }}
            >
              {d.desligada ? "Ligar o mural" : "Desligar o mural"}
            </Botao>
          </div>
        </Cartao>
      )}
      {vencendo.length > 0 && (
        <Faixa tom="aviso" className="max-w-3xl" titulo="Conferências vencendo nos próximos 30 dias:">
          {vencendo.map((p) => `${p.nome} (${dia(p.proxima_revisao ?? "")})`).join(", ")}. Registro vencido tira o cartão do ar sozinho.
        </Faixa>
      )}
      {d?.perfis.length === 0 && <Vazio titulo="Nenhum profissional no painel ainda. (Os perfis publicados pelo arquivo do site só aparecem com o termo vigente aceito.)" />}
      {d?.perfis.map((p) => {
        const consulta = CONSULTA_DO_CONSELHO[p.conselho.toUpperCase()];
        const v = datas[p.id] ?? { data: hoje, nota: "", link: consulta ?? "", situacao: "", arquivo: "" };
        const mudar = (k: string, valor: string) => setDatas({ ...datas, [p.id]: { ...v, [k]: valor } });
        return (
          <Cartao key={p.id} as="article" aria-label={p.nome}>
            <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
              <CartaoDoProfissional p={p} />
              <div className="pn-secao">
                <p className="flex flex-wrap items-center gap-2">
                  <Selo tom={TOM_DA_SITUACAO[p.status]} ponto>
                    {SITUACAO[p.status]}
                  </Selo>
                  <span className="pn-rotulo-mono">atualizado em {dataHora(p.atualizado_em)}</span>
                </p>
                {p.apto ? <Faixa tom="ok">✓ Aparecendo no mural.</Faixa> : <Faixa tom="aviso">{`Falta: ${p.faltam.join("; ")}.`}</Faixa>}
                {p.bloqueio && <p className="text-sm">Texto fora das regras: {p.bloqueio.motivo}</p>}
                <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                  <Selo tom={p.termo_versao ? "ok" : "aviso"}>Termo: {p.termo_versao ? `versão ${p.termo_versao}` : "não aceito"}</Selo>
                  <Selo tom={p.verificado_em ? "ok" : "aviso"}>
                    Registro conferido em: {p.verificado_em ? dia(p.verificado_em) : "nunca"}
                    {p.proxima_revisao ? ` (próxima até ${dia(p.proxima_revisao)})` : ""}
                  </Selo>
                  <Selo tom={p.texto_aprovado_em ? "ok" : "aviso"}>Texto aprovado em: {p.texto_aprovado_em ? dataHora(p.texto_aprovado_em) : "esperando o profissional"}</Selo>
                </p>

                <div className="pn-secao border-t border-rule pt-3">
                  <p className="font-semibold">Assinatura gov.br</p>
                  {p.assinatura_arquivo ? (
                    <div className="pn-secao text-sm">
                      <p className="flex flex-wrap items-center gap-1">
                        PDF enviado em {p.assinatura_enviada_em ? dataHora(p.assinatura_enviada_em) : "—"} (termo versão {p.assinatura_versao}) · <BotaoArquivo caminho={p.assinatura_arquivo} nome="abrir o PDF" aviso={setAvisoArquivo} />
                      </p>
                      <p className="break-all font-mono text-xs text-ink-soft">SHA-256: {p.assinatura_sha256}</p>
                      <p>
                        Confira em{" "}
                        <a href={VALIDADOR} target="_blank" rel="noopener noreferrer" className="pn-elo">
                          validar.iti.gov.br
                        </a>
                        : a assinatura precisa ser válida, do próprio profissional, e o texto precisa ser o do termo vigente.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {!p.assinatura_conferida_em && (
                          <Botao simbolo={ShieldCheck} disabled={acao.ocupado} onClick={() => acao.agir("saude_assinatura_conferir", { p_usuario: p.id, p_ok: true, p_nota: "" }, "Assinatura conferida.")}>
                            Assinatura válida: marcar conferida
                          </Botao>
                        )}
                        {p.assinatura_conferida_em && <Selo tom="ok">✓ Conferida em {dataHora(p.assinatura_conferida_em)}.</Selo>}
                        <Botao
                          simbolo={Undo2}
                          disabled={acao.ocupado}
                          onClick={async () => {
                            const nota = (await perguntarTexto("O que está errado na assinatura (vai para o profissional):", "")) ?? "";
                            void acao.agir("saude_assinatura_conferir", { p_usuario: p.id, p_ok: false, p_nota: nota }, "Devolvido ao profissional.");
                          }}
                        >
                          Devolver
                        </Botao>
                      </div>
                    </div>
                  ) : (
                    <p className="pn-ajuda">O profissional ainda não enviou o termo assinado.</p>
                  )}
                </div>

                <div className="pn-secao border-t border-rule pt-3">
                  <p className="font-semibold">Conferir o registro no conselho</p>
                  <p className="pn-ajuda">
                    {consulta ? (
                      <>
                        Consulte em{" "}
                        <a href={consulta} target="_blank" rel="noopener noreferrer" className="pn-elo">
                          {consulta}
                        </a>
                      </>
                    ) : (
                      "Consulte no site do conselho regional"
                    )}
                    , tire uma captura da tela e anexe aqui com a data e o que encontrou.
                  </p>
                  {(p.verificacao_situacao || p.verificacao_arquivo) && (
                    <p className="flex flex-wrap items-center gap-1 text-sm">
                      Última prova: {p.verificacao_situacao || "—"}
                      {p.verificacao_link && (
                        <>
                          {" "}
                          ·{" "}
                          <a href={p.verificacao_link} target="_blank" rel="noopener noreferrer" className="pn-elo">
                            endereço consultado
                          </a>
                        </>
                      )}{" "}
                      · <BotaoArquivo caminho={p.verificacao_arquivo} nome="abrir a captura" aviso={setAvisoArquivo} />
                    </p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Campo rotulo="Data da consulta" type="date" max={hoje} value={v.data} onChange={(e) => mudar("data", e.target.value)} />
                    <Campo rotulo="Situação encontrada" value={v.situacao} onChange={(e) => mudar("situacao", e.target.value)} maxLength={120} placeholder="Ativo, sem restrição" />
                    <div className="sm:col-span-2">
                      <Campo rotulo="Endereço consultado (https)" value={v.link} onChange={(e) => mudar("link", e.target.value)} placeholder="https://…" />
                    </div>
                    <div className="sm:col-span-2">
                      <Campo rotulo="Observação" value={v.nota} onChange={(e) => mudar("nota", e.target.value)} maxLength={500} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <BotaoDeArquivo texto={v.arquivo ? "Trocar a captura" : "Anexar a captura (imagem ou PDF)"} aceita="image/jpeg,image/png,image/webp,application/pdf" escolher={(arquivo) => void anexarCaptura(p.id, arquivo)} />
                    {v.arquivo && <Selo tom="ok">✓ captura pronta</Selo>}
                    <Botao
                      variante="principal"
                      simbolo={ShieldCheck}
                      disabled={acao.ocupado}
                      onClick={async () => {
                        if (await acao.agir("saude_decidir", { p_usuario: p.id, p_acao: "verificar", p_verificado_em: v.data, p_nota: v.nota }, "Conferência registrada.")) {
                          if (v.arquivo || v.link || v.situacao) await acao.agir("saude_verificacao_anexar", { p_usuario: p.id, p_arquivo: v.arquivo, p_link: v.link, p_situacao: v.situacao }, "Conferência e prova registradas.");
                        }
                      }}
                    >
                      Registrar a conferência
                    </Botao>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-rule pt-3">
                  {p.status !== "publicado" && p.status !== "removido" && (
                    <Botao simbolo={Send} disabled={acao.ocupado} onClick={() => acao.agir("saude_decidir", { p_usuario: p.id, p_acao: "publicar" }, "Publicado: aparece assim que tudo estiver em dia.")}>
                      Publicar
                    </Botao>
                  )}
                  {p.status === "publicado" && (
                    <Botao
                      simbolo={Undo2}
                      disabled={acao.ocupado}
                      onClick={async () => {
                        const nota = (await perguntarTexto("Motivo (vai para o profissional):", "")) ?? "";
                        void acao.agir("saude_decidir", { p_usuario: p.id, p_acao: "aguardar", p_nota: nota }, "Devolvido para ajuste.");
                      }}
                    >
                      Devolver para ajuste
                    </Botao>
                  )}
                  {p.status !== "suspenso" && p.status !== "removido" && (
                    <Botao
                      perigo
                      variante="discreto"
                      simbolo={PowerOff}
                      disabled={acao.ocupado}
                      onClick={async () => {
                        const nota = (await perguntarTexto("Motivo da suspensão (vai para o profissional):", "")) ?? "";
                        void acao.agir("saude_decidir", { p_usuario: p.id, p_acao: "suspender", p_nota: nota }, "Suspenso.");
                      }}
                    >
                      Suspender
                    </Botao>
                  )}
                </div>
                <EditarPeloCoordenacao p={p} depois={fila.recarregar} />
                <Registro usuario={p.id} />
              </div>
            </div>
          </Cartao>
        );
      })}
    </section>
  );
}
