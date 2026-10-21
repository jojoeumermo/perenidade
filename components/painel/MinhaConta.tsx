// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { getClient, leads, type Me, rpc, signOut } from "@/lib/backend";
import { marcaDesteAparelho } from "@/lib/device";
import { senhaVazada } from "@/lib/senha";
import { getItem, KEYS, setItem } from "@/lib/storage";
import { SenhaCampo, senhaForte } from "../SenhaCampo";
import { Avatar, AVATARES } from "./Avatar";
import { Abas, Aviso, botao, botaoClaro, campo, dataHora, elo, oQueFaz, papeis, textoDoErro, useAcao, useLista } from "./comum";
import { IdiomaDoPainel } from "./Idioma";
import { minutosOcioso, OPCOES_OCIOSO } from "./ocioso";
import { Digital, SegundoFator } from "./Seguranca";

type Aba = "perfil" | "seguranca" | "privacidade" | "aparelhos" | "atividade";

interface Protecao {
  segundo_fator: boolean;
  segundo_fator_desde: string | null;
  codigos_restantes: number;
  codigos_gerados_em: string | null;
  sessao_dias: number;
}

const cartao = "painel-cartao p-5";
const perigo = "painel-botao cursor-pointer bg-oxblood px-5 py-2.5 font-semibold text-parchment hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

/** Selo de estado: palavra e cor, nunca só a cor. */
function Selo({ tipo, children }: { tipo: "ok" | "atencao" | "erro"; children: ReactNode }) {
  const cor = tipo === "ok" ? "border-ok text-ok" : tipo === "atencao" ? "border-gold text-gold" : "border-oxblood text-oxblood";
  return <span className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[0.7rem] uppercase tracking-wider ${cor}`}>{tipo === "ok" ? "✓" : tipo === "atencao" ? "!" : "✗"} {children}</span>;
}

function baixar(nome: string, conteudo: string, tipo = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([conteudo], { type: `${tipo};charset=utf-8` }));
  a.download = nome;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/**
 * Minha conta, em abas: Perfil, Segurança, Privacidade e avisos, Aparelhos e Atividade, com um resumo da proteção no
 * topo. Tudo o que a tela antiga fazia continua aqui (nome e "sobre você", ícone, privacidade nas conversas, avisos e
 * trava, senha, digital, segundo fator, aparelhos, apagar a conta), mais o que faltava.
 */
export function MinhaConta({ me, recarregar, sair, curriculo, avisosETrava }: { me: Me; recarregar: () => void; sair: () => void; curriculo?: ReactNode; avisosETrava?: ReactNode }) {
  const [aba, setAba] = useState<Aba>("perfil");
  const protecao = useLista<Protecao>("conta_protecao");
  const [chaves, setChaves] = useState<number | null>(null);
  useEffect(() => {
    let vivo = true;
    void import("@/lib/passkey").then(({ listFingerprints }) => listFingerprints().then((l) => vivo && setChaves(l.length)).catch(() => vivo && setChaves(0)));
    return () => {
      vivo = false;
    };
  }, [aba]);
  const p = protecao.dados;
  const motivos: [boolean, string][] = [
    [true, "Senha com pelo menos 12 caracteres"],
    [Boolean(p?.segundo_fator), p?.segundo_fator ? "Aplicativo autenticador ligado" : "Sem aplicativo autenticador (segundo fator)"],
    [Boolean(p && p.codigos_restantes > 0), p?.segundo_fator ? (p.codigos_restantes > 0 ? `${p.codigos_restantes} códigos de recuperação guardados` : "Sem códigos de recuperação: se perder o celular, fica sem entrar") : "Códigos de recuperação (precisam do segundo fator)"],
    [Boolean(chaves), chaves && chaves > 1 ? `${chaves} chaves de acesso (digital, rosto ou PIN)` : chaves === 1 ? "1 chave de acesso (digital, rosto ou PIN)" : "Nenhuma chave de acesso cadastrada"],
  ];
  const nota = p?.segundo_fator && p.codigos_restantes > 0 ? "boa" : p?.segundo_fator || chaves ? "media" : "fraca";
  const recarregarTudo = () => {
    protecao.recarregar();
    recarregar();
  };

  return (
    <div>
      <section className={`${cartao} mb-6`} aria-labelledby="protecao-titulo">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="protecao-titulo" className="font-serif text-xl font-semibold">Proteção da conta</h2>
          {p ? <Selo tipo={nota === "boa" ? "ok" : nota === "media" ? "atencao" : "erro"}>{nota === "boa" ? "boa" : nota === "media" ? "média" : "fraca"}</Selo> : <span className="text-xs text-ink-soft">Carregando…</span>}
        </div>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {motivos.map(([ok, texto]) => (
            <li key={texto} className={ok ? "text-ok" : "text-ink-soft"}>
              <span aria-hidden>{ok ? "✓" : "○"}</span> {texto}
            </li>
          ))}
        </ul>
        {nota !== "boa" && <button type="button" className={`mt-2 ${elo}`} onClick={() => setAba("seguranca")}>Melhorar a proteção →</button>}
      </section>

      <Abas<Aba>
        opcoes={[
          { id: "perfil", nome: "Perfil" },
          { id: "seguranca", nome: "Segurança" },
          { id: "privacidade", nome: "Privacidade e avisos" },
          { id: "aparelhos", nome: "Aparelhos" },
          { id: "atividade", nome: "Atividade" },
        ]}
        atual={aba}
        escolher={setAba}
      />
      {aba === "perfil" && <Perfil me={me} recarregar={recarregar} curriculo={curriculo} />}
      {aba === "seguranca" && <SegurancaDaConta me={me} protecao={p ?? null} recarregar={recarregarTudo} />}
      {aba === "privacidade" && <Privacidade me={me} recarregar={recarregar} sair={sair} avisosETrava={avisosETrava} />}
      {aba === "aparelhos" && <AparelhosDaConta dias={p?.sessao_dias ?? 60} />}
      {aba === "atividade" && <Atividade />}
      <div className="mt-8 border-t border-rule pt-5">
        <button type="button" className={botaoClaro} onClick={sair}>Sair do painel</button>
      </div>
    </div>
  );
}

// ───────────── Perfil ─────────────

function Perfil({ me, recarregar, curriculo }: { me: Me; recarregar: () => void; curriculo?: ReactNode }) {
  const perfil = useAcao(recarregar);
  const [nome, setNome] = useState(me.nome);
  const [bio, setBio] = useState(me.bio);
  const [tema, setTema] = useState(() => getItem(KEYS.theme) ?? "auto");
  const mudarTema = (t: string) => {
    setTema(t);
    if (t === "auto") {
      document.documentElement.removeAttribute("data-theme");
      try {
        window.localStorage.removeItem(KEYS.theme);
      } catch {
        // sem armazenamento
      }
    } else {
      document.documentElement.setAttribute("data-theme", t);
      setItem(KEYS.theme, t);
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className={cartao}>
        <h2 className="font-serif text-xl font-semibold">Como você aparece</h2>
        <p className="mt-1 text-ink-soft">O nome assina o que você publica. O seu e-mail nunca aparece.</p>
        <label className="mt-3 block">
          Nome público
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} className={campo} />
        </label>
        <label className="mt-3 block">
          Sobre você (opcional)
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} className={campo} />
        </label>
        <button type="button" className={`mt-3 ${botao}`} disabled={perfil.ocupado || !nome.trim()} onClick={() => perfil.agir("perfil_salvar", { p_nome: nome, p_bio: bio }, "Salvo ✓")}>
          {perfil.ocupado ? "Salvando…" : "Guardar"}
        </button>
        <Aviso texto={perfil.aviso} />
      </section>

      <FotoDoPerfil me={me} recarregar={recarregar} />

      <section className={cartao}>
        <h2 className="font-serif text-xl font-semibold">Suas funções</h2>
        <p className="mt-1 text-ink-soft">O que a sua conta pode fazer no painel. Quem dá e tira funções é a coordenação (ou a supervisão, para as funções de trabalho).</p>
        {me.papeis.length === 0 ? (
          <p className="mt-3 text-ink-soft">Nenhuma função ainda: você participa da comunidade e pode pedir uma função em Voluntariado.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {me.papeis.map((r) => (
              <li key={`${r.papel}-${r.disciplina ?? ""}`} className="border-l-4 border-gold pl-3">
                <p className="font-semibold">{papeis[r.papel]}{r.disciplina ? ` · ${r.disciplina}` : ""}</p>
                <p className="text-sm text-ink-soft">{oQueFaz[r.papel]}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cartao}>
        <h2 className="font-serif text-xl font-semibold">Preferências</h2>
        <label className="mt-3 block">
          Idioma do painel
          <IdiomaDoPainel className={campo} />
        </label>
        <label className="mt-3 block">
          Tema
          <select value={tema} onChange={(e) => mudarTema(e.target.value)} className={campo}>
            <option value="auto">Igual ao do aparelho</option>
            <option value="light">Claro (pergaminho)</option>
            <option value="dark">Escuro</option>
          </select>
        </label>
        <p className="mt-2 text-xs text-ink-soft">Idioma e tema ficam guardados neste aparelho.</p>
      </section>
      {curriculo}
    </div>
  );
}

/** Foto ou desenho do perfil. A foto é recortada em círculo aqui, reduzida e regravada (sai sem local, aparelho e autor). */
function FotoDoPerfil({ me, recarregar }: { me: Me; recarregar: () => void }) {
  const acao = useAcao(recarregar);
  const [imagem, setImagem] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [desloca, setDesloca] = useState({ x: 0, y: 0 });
  const [aviso, setAviso] = useState("");
  const tela = useRef<HTMLCanvasElement>(null);
  const arrasto = useRef<{ x: number; y: number } | null>(null);
  const atual = me.avatar ?? "";
  const LADO = 192;

  useEffect(() => {
    const c = tela.current;
    if (!c || !imagem) return;
    const ctx = c.getContext("2d")!;
    const base = Math.min(imagem.naturalWidth, imagem.naturalHeight) / zoom;
    const sx = (imagem.naturalWidth - base) / 2 - (desloca.x * base) / LADO;
    const sy = (imagem.naturalHeight - base) / 2 - (desloca.y * base) / LADO;
    ctx.clearRect(0, 0, LADO, LADO);
    ctx.drawImage(imagem, sx, sy, base, base, 0, 0, LADO, LADO);
  }, [imagem, zoom, desloca]);

  function abrir(arquivo: File | undefined) {
    setAviso("");
    if (!arquivo) return;
    if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type) || arquivo.size > 15_000_000) {
      setAviso("Escolha uma foto JPG, PNG ou WebP de até 15 MB.");
      return;
    }
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      setImagem(img);
      setZoom(1);
      setDesloca({ x: 0, y: 0 });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => setAviso("Não deu para abrir essa imagem.");
    img.src = url;
  }

  async function guardar() {
    const c = tela.current;
    if (!c) return;
    const saida = document.createElement("canvas");
    saida.width = 128;
    saida.height = 128;
    saida.getContext("2d")!.drawImage(c, 0, 0, 128, 128);
    for (const q of [0.85, 0.7, 0.5, 0.35]) {
      const dado = saida.toDataURL("image/webp", q);
      if (dado.length <= 40000 && dado.startsWith("data:image/webp")) {
        const r = (await acao.agir("perfil_avatar", { p_avatar: dado }, "Foto guardada ✓")) as { pendente?: boolean } | null;
        if (r?.pendente) acao.setAviso("Foto enviada ✓ Ela aparece no seu cartão depois que a coordenação aprovar (você recebe um recado).");
        recarregar();
        setImagem(null);
        return;
      }
    }
    setAviso("Este navegador não gravou a foto em WebP. Tente outro navegador.");
  }

  return (
    <section className={cartao}>
      <h2 className="font-serif text-xl font-semibold">Foto ou ícone</h2>
      <p className="mt-1 text-ink-soft">Aparece ao lado do seu nome nas conversas, na equipe e no cartão de quem ensina, nas disciplinas. A foto passa pela coordenação antes de aparecer; os ícones prontos valem na hora.</p>
      {me.foto_pendente && <p className="mt-2 border-l-4 border-gold bg-parchment-deep px-3 py-1 text-sm">Sua foto nova está esperando a aprovação da coordenação.</p>}
      <div className="mt-3 flex items-center gap-4">
        <Avatar nome={me.nome} avatar={atual} className="h-16 w-16" />
        <div className="flex flex-wrap gap-2 text-sm">
          <label className={`${botaoClaro} cursor-pointer`}>
            Enviar uma foto
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { abrir(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {atual && <button type="button" className={elo} disabled={acao.ocupado} onClick={() => acao.agir("perfil_avatar", { p_avatar: "" }, "Foto removida.")}>Remover</button>}
        </div>
      </div>
      {imagem && (
        <div className="mt-4 border border-rule p-3">
          <p className="text-sm">Arraste para enquadrar e use o controle para aproximar.</p>
          <canvas
            ref={tela}
            width={LADO}
            height={LADO}
            aria-label="Prévia do recorte em círculo"
            className="mt-2 cursor-move touch-none rounded-full border-2 border-ink"
            onPointerDown={(e) => { arrasto.current = { x: e.clientX - desloca.x, y: e.clientY - desloca.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (arrasto.current) setDesloca({ x: e.clientX - arrasto.current.x, y: e.clientY - arrasto.current.y }); }}
            onPointerUp={() => { arrasto.current = null; }}
          />
          <label className="mt-2 block text-sm">
            Aproximar
            <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="block w-48" />
          </label>
          <p className="mt-2 flex gap-3">
            <button type="button" className={botao} disabled={acao.ocupado} onClick={() => void guardar()}>Guardar a foto</button>
            <button type="button" className={elo} onClick={() => setImagem(null)}>Cancelar</button>
          </p>
        </div>
      )}
      <p className="mt-4 text-sm">Ou escolha um desenho:</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={atual === ""} title="Só as iniciais" onClick={() => acao.agir("perfil_avatar", { p_avatar: "" }, "Ícone guardado ✓")} className={`cursor-pointer border-2 p-0.5 ${atual === "" ? "border-oxblood" : "border-transparent hover:border-rule"}`}>
          <Avatar nome={me.nome} className="h-10 w-10" />
        </button>
        {AVATARES.map((a) => (
          <button key={a.id} type="button" aria-pressed={atual === `p:${a.id}`} title={a.nome} aria-label={a.nome} disabled={acao.ocupado} onClick={() => acao.agir("perfil_avatar", { p_avatar: `p:${a.id}` }, "Ícone guardado ✓")} className={`cursor-pointer border-2 p-0.5 ${atual === `p:${a.id}` ? "border-oxblood" : "border-transparent hover:border-rule"}`}>
            <Avatar nome={me.nome} avatar={`p:${a.id}`} className="h-10 w-10" />
          </button>
        ))}
      </div>
      <Aviso texto={aviso || acao.aviso} />
    </section>
  );
}

// ───────────── Segurança ─────────────

function SegurancaDaConta({ me, protecao, recarregar }: { me: Me; protecao: Protecao | null; recarregar: () => void }) {
  const [senha, setSenha] = useState("");
  const [repete, setRepete] = useState("");
  const [avisoSenha, setAvisoSenha] = useState("");
  const [trocou, setTrocou] = useState(false);
  const [codigos, setCodigos] = useState<string[] | null>(null);
  const [avisoCodigos, setAvisoCodigos] = useState("");

  async function trocarSenha() {
    setAvisoSenha("");
    if ((await senhaVazada(senha)) === true) {
      setAvisoSenha("Essa senha já apareceu em vazamentos de outros sites e é das primeiras que um invasor tenta. Escolha outra.");
      return;
    }
    try {
      const supabase = await getClient();
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      setSenha("");
      setRepete("");
      setTrocou(true);
      setAvisoSenha("Senha trocada ✓");
      await rpc("conta_evento", { p_acao: "senha_trocada" }).catch(() => null);
    } catch (erro) {
      const motivo = (erro as { code?: string }).code ?? "";
      setAvisoSenha(motivo === "weak_password" ? "O serviço de contas recusou a senha por ser fraca. Use uma frase mais longa." : "Não foi possível trocar a senha agora. Saia, entre de novo e tente outra vez.");
    }
  }

  async function sairDosOutros() {
    try {
      const supabase = await getClient();
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      await rpc("conta_evento", { p_acao: "saiu_dos_outros" }).catch(() => null);
      setAvisoSenha("Pronto: os outros aparelhos precisam entrar de novo.");
      setTrocou(false);
    } catch {
      setAvisoSenha("Não deu para sair dos outros aparelhos agora. Tente pela aba Aparelhos.");
    }
  }

  async function gerarCodigos() {
    setAvisoCodigos("");
    if (protecao?.codigos_restantes && !window.confirm("Gerar códigos novos? Os que você guardou antes deixam de valer.")) return;
    try {
      const r = await rpc<{ codigos: string[] }>("conta_codigos_gerar");
      setCodigos(r.codigos);
      recarregar();
    } catch (erro) {
      setAvisoCodigos(textoDoErro(erro));
    }
  }

  const textoDosCodigos = (lista: string[]) =>
    `Instituto Lúcia — códigos de recuperação do segundo fator\nConta: ${me.nome}\nGerados em: ${new Date().toLocaleString("pt-BR")}\n\nCada código vale uma vez. Use se perder o celular do aplicativo autenticador.\nGuarde longe do celular (papel na gaveta, gerenciador de senhas).\n\n${lista.map((c, i) => `${String(i + 1).padStart(2, " ")}. ${c}`).join("\n")}\n`;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className={cartao}>
        <h2 className="font-serif text-xl font-semibold">Senha</h2>
        <p className="mt-1 text-ink-soft">Pelo menos 12 caracteres. Frase longa vale (quatro ou cinco palavras), colar vale e gerenciador de senhas vale. Não precisa misturar símbolo e número.</p>
        <form onSubmit={(e) => { e.preventDefault(); void trocarSenha(); }}>
          <label className="mt-3 block">
            Senha nova
            <SenhaCampo value={senha} onChange={setSenha} regras pessoais={[me.nome]} className={campo} />
          </label>
          <label className="mt-3 block">
            Repita a senha
            <SenhaCampo value={repete} onChange={setRepete} className={campo} />
          </label>
          {repete !== "" && repete !== senha && <p role="alert" className="mt-2 text-oxblood">As duas senhas não são iguais.</p>}
          <button type="submit" className={`mt-3 ${botao}`} disabled={!senhaForte(senha, [me.nome]) || senha !== repete}>Trocar a senha</button>
        </form>
        <Aviso texto={avisoSenha} />
        {trocou && (
          <div className="mt-2 border border-gold p-3 text-sm">
            <p>Quer que os outros aparelhos onde a conta está aberta precisem entrar de novo, com a senha nova?</p>
            <button type="button" className={`mt-2 ${botaoClaro}`} onClick={() => void sairDosOutros()}>Sair dos outros aparelhos</button>
          </div>
        )}
      </section>

      <section className={cartao}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-xl font-semibold">Segundo fator</h2>
          {protecao && (protecao.segundo_fator ? <Selo tipo="ok">ligado</Selo> : <Selo tipo="atencao">desligado</Selo>)}
        </div>
        <p className="mt-1 text-ink-soft">Um código do aplicativo autenticador, além da senha. Quem descobre a sua senha continua do lado de fora.</p>
        {protecao?.segundo_fator_desde && <p className="mt-1 text-sm text-ink-soft">Ligado desde {dataHora(protecao.segundo_fator_desde)}.</p>}
        <div className="mt-3">
          <SegundoFator me={me} recarregar={recarregar} />
        </div>
        {protecao?.segundo_fator && (
          <div className="mt-4 border-t border-rule pt-3">
            <h3 className="font-semibold">Códigos de recuperação</h3>
            <p className="text-sm text-ink-soft">Dez códigos de uso único para entrar se você perder o celular. Aparecem uma vez só: baixe ou imprima e guarde longe do celular.</p>
            <p className="mt-1 text-sm">{protecao.codigos_restantes > 0 ? `Restam ${protecao.codigos_restantes} códigos${protecao.codigos_gerados_em ? ` (gerados em ${dataHora(protecao.codigos_gerados_em)})` : ""}.` : "Você ainda não gerou códigos."}</p>
            {codigos ? (
              <div className="mt-2 border-2 border-ink bg-parchment p-3">
                <ol className="grid grid-cols-2 gap-1 font-mono text-sm">{codigos.map((c) => <li key={c}>{c}</li>)}</ol>
                <p className="mt-2 flex flex-wrap gap-3 text-sm">
                  <button type="button" className={elo} onClick={() => baixar("instituto-lucia-codigos-de-recuperacao.txt", textoDosCodigos(codigos))}>Baixar (.txt)</button>
                  <button type="button" className={elo} onClick={() => { const w = window.open("", "_blank", "noopener,width=600,height=700"); if (w) { w.document.body.innerText = textoDosCodigos(codigos); w.print(); } }}>Imprimir</button>
                  <button type="button" className={elo} onClick={() => setCodigos(null)}>Já guardei: esconder</button>
                </p>
              </div>
            ) : (
              <button type="button" className={`mt-2 ${botaoClaro}`} disabled={!me.segundo_fator} onClick={() => void gerarCodigos()}>{protecao.codigos_restantes > 0 ? "Gerar códigos novos" : "Gerar códigos de recuperação"}</button>
            )}
            {!me.segundo_fator && <p className="mt-1 text-xs text-ink-soft">Confirme esta sessão com o código do aplicativo para gerar.</p>}
            <Aviso texto={avisoCodigos} />
          </div>
        )}
      </section>

      <section className={`${cartao} lg:col-span-2`}>
        <h2 className="font-serif text-xl font-semibold">Chave de acesso (digital, rosto ou PIN do aparelho)</h2>
        <p className="mt-1 text-ink-soft">Entre sem digitar a senha, com o desbloqueio do próprio aparelho. A chave fica só no aparelho; a senha continua valendo como reserva. Dê um nome a cada uma para reconhecer depois.</p>
        <div className="mt-3">
          <Digital />
        </div>
      </section>
    </div>
  );
}

// ───────────── Privacidade e avisos ─────────────

const NOMES_DOS_EMAILS: Record<string, string> = {
  aviso_equipe: "Avisos da equipe (mandados pela coordenação e pela supervisão)",
  inscricao_nova: "Novos pedidos de voluntariado (para quem decide)",
  certificado_pedido: "Pedidos de certificado (para quem emite)",
  chat_mensagem: "Mensagens da coordenação e do grupo do seu departamento que você ainda não leu",
};

interface MeuAceite {
  id: string;
  termo: string;
  versao: string;
  texto: string;
  sha256: string;
  aceito_em: string;
}

/** Os termos que a pessoa aceitou, com o texto exato de cada um: guardados para sempre, para ela ler quando quiser. */
function TermosQueAceitei() {
  const lista = useLista<MeuAceite[]>("termos_meus");
  const [aberto, setAberto] = useState("");
  const nomes: Record<string, string> = { voluntario: "Termo de voluntário", adesao: "Termo de adesão (horas e certificados)", saude: "Termo da vitrine Saúde Solidária" };
  return (
    <section className={cartao}>
      <h2 className="font-serif text-xl font-semibold">Termos que você aceitou</h2>
      <p className="mt-1 text-ink-soft">Cada aceite fica guardado com o texto exato, a versão e a data, para sempre: é a prova de que o seu trabalho aqui é voluntário e de como o que você publica fica livre.</p>
      {lista.dados?.length === 0 && <p className="mt-2 text-ink-soft">Nenhum aceite registrado ainda (os de antes de 20/10/2026 ficaram só com a data).</p>}
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {lista.dados?.map((a) => (
          <li key={a.id} className="py-2">
            <button type="button" className={elo} onClick={() => setAberto(aberto === a.id ? "" : a.id)}>{nomes[a.termo] ?? a.termo}, versão {a.versao}</button>
            <span className="ml-2 text-sm text-ink-soft">aceito em {dataHora(a.aceito_em)}</span>
            {aberto === a.id && (
              <>
                <pre className="mt-2 whitespace-pre-wrap border border-rule bg-parchment-deep p-3 font-sans text-sm">{a.texto}</pre>
                <p className="mt-1 break-all font-mono text-[0.65rem] text-ink-soft">SHA-256: {a.sha256}</p>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Privacidade({ me, recarregar, sair, avisosETrava }: { me: Me; recarregar: () => void; sair: () => void; avisosETrava?: ReactNode }) {
  const preferencias = useAcao(recarregar);
  const emails = useLista<{ opcoes: string[]; desligados: string[] }>("conta_emails");
  const acaoEmails = useAcao(emails.recarregar);
  const [baixando, setBaixando] = useState("");
  const [passo, setPasso] = useState<0 | 1 | 2>(0);
  const [entendi, setEntendi] = useState(false);
  const [palavra, setPalavra] = useState("");
  const [senhaApagar, setSenhaApagar] = useState("");
  const [avisoApagar, setAvisoApagar] = useState("");

  async function meusDados() {
    setBaixando("Juntando os seus dados…");
    try {
      const dados = await rpc<unknown>("conta_meus_dados");
      baixar(`instituto-lucia-meus-dados-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(dados, null, 2), "application/json");
      setBaixando("Arquivo baixado ✓");
    } catch (erro) {
      setBaixando(textoDoErro(erro));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TermosQueAceitei />
      <section className={cartao}>
        <h2 className="font-serif text-xl font-semibold">Privacidade nas conversas</h2>
        <p className="mt-1 text-ink-soft">O que os colegas veem de você. Quem esconde algo também deixa de ver o mesmo dos outros.</p>
        <label className="mt-3 flex cursor-pointer items-start gap-2">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={me.chat_visto} disabled={preferencias.ocupado} onChange={(e) => preferencias.agir("perfil_preferencias", { p_chat_visto: e.target.checked, p_chat_leitura: null }, "Salvo ✓")} />
          <span>Mostrar quando estou online e o “visto por último”</span>
        </label>
        <label className="mt-2 flex cursor-pointer items-start gap-2">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={me.chat_leitura} disabled={preferencias.ocupado} onChange={(e) => preferencias.agir("perfil_preferencias", { p_chat_visto: null, p_chat_leitura: e.target.checked }, "Salvo ✓")} />
          <span>Confirmar aos outros que li as mensagens (os tiques azuis e o “Lida por”)</span>
        </label>
        <Aviso texto={preferencias.aviso} />
        {avisosETrava}
      </section>

      <section className={cartao}>
        <h2 className="font-serif text-xl font-semibold">Avisos por e-mail</h2>
        <p className="mt-1 text-ink-soft">O que você quer receber no seu e-mail. Convites, recuperação de senha e alertas de segurança chegam sempre.</p>
        {emails.dados ? (
          <ul className="mt-3 space-y-2">
            {emails.dados.opcoes.map((op) => {
              const ligado = !emails.dados!.desligados.includes(op);
              return (
                <li key={op}>
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={ligado}
                      disabled={acaoEmails.ocupado}
                      onChange={(e) => {
                        const desligados = e.target.checked ? emails.dados!.desligados.filter((x) => x !== op) : [...emails.dados!.desligados, op];
                        acaoEmails.agir("conta_emails_salvar", { p_desligados: desligados }, "Salvo ✓");
                      }}
                    />
                    <span>{NOMES_DOS_EMAILS[op] ?? op}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-ink-soft">{emails.erro || "Carregando…"}</p>
        )}
        <Aviso texto={acaoEmails.aviso} />
      </section>

      <section className={`${cartao} lg:col-span-2`}>
        <h2 className="font-serif text-xl font-semibold">Seus dados (LGPD)</h2>
        <p className="mt-1 text-ink-soft">Você pode baixar tudo o que o painel guarda sobre você e pode apagar a sua conta. Conversas cifradas saem cifradas: só os seus aparelhos as abrem.</p>
        <p className="mt-3 flex flex-wrap items-center gap-4">
          <button type="button" className={botaoClaro} onClick={() => void meusDados()}>Baixar meus dados (.json)</button>
          <span role="status" className="text-sm text-ink-soft">{baixando}</span>
        </p>
        <div className="mt-5 border-t border-rule pt-4">
          <h3 className="font-semibold text-oxblood">Apagar minha conta</h3>
          {leads(me) ? (
            <p className="mt-1 text-sm text-ink-soft">A conta da coordenação não se apaga pelo painel: passe a coordenação adiante em Segurança e sucessão antes, se for o caso.</p>
          ) : passo === 0 ? (
            <button type="button" className={`mt-2 ${elo}`} onClick={() => setPasso(1)}>Quero apagar a minha conta…</button>
          ) : passo === 1 ? (
            <div className="mt-2 space-y-2 text-sm">
              <p>O que acontece:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Saem o seu perfil, as suas funções, os seus votos, os seus aparelhos e os seus recados.</li>
                <li>O que você já publicou (aulas, matérias, traduções) continua no acervo, sem ligação com a conta.</li>
                <li>As conversas da equipe continuam com os colegas; você perde o acesso a elas.</li>
                <li>Não tem volta: para voltar, é preciso criar outra conta e pedir as funções de novo.</li>
              </ul>
              <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={entendi} onChange={(e) => setEntendi(e.target.checked)} /> Entendi o que acontece</label>
              <p className="flex gap-3">
                <button type="button" className={botaoClaro} disabled={!entendi} onClick={() => setPasso(2)}>Continuar</button>
                <button type="button" className={elo} onClick={() => { setPasso(0); setEntendi(false); }}>Cancelar</button>
              </p>
            </div>
          ) : (
            <div className="mt-2 space-y-2 text-sm">
              <label className="block">
                Para confirmar, escreva <strong className="font-mono" translate="no">APAGAR</strong>
                <input value={palavra} onChange={(e) => setPalavra(e.target.value)} className={`${campo} max-w-xs font-mono`} autoComplete="off" />
              </label>
              <label className="block">
                E a sua senha atual
                <input type="password" value={senhaApagar} onChange={(e) => setSenhaApagar(e.target.value)} className={`${campo} max-w-xs`} autoComplete="current-password" />
              </label>
              <p className="flex gap-3">
                <button
                  type="button"
                  className={perigo}
                  disabled={palavra.trim() !== "APAGAR" || !senhaApagar}
                  onClick={async () => {
                    try {
                      await rpc("conta_apagar", { p_senha: senhaApagar });
                      sair();
                    } catch (erro) {
                      setAvisoApagar(textoDoErro(erro));
                    }
                  }}
                >
                  Apagar a minha conta agora
                </button>
                <button type="button" className={elo} onClick={() => { setPasso(0); setEntendi(false); setPalavra(""); setSenhaApagar(""); }}>Cancelar</button>
              </p>
              <Aviso texto={avisoApagar} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ───────────── Aparelhos ─────────────

interface Aparelho {
  marca: string;
  rotulo: string;
  primeiro: string;
  ultimo: string;
}

/** Depois de quanto tempo sem uso o painel se fecha neste aparelho. Fica só no navegador. */
function TempoSemUso() {
  const [minutos, setMinutos] = useState(() => minutosOcioso());
  return (
    <label className="mt-4 block max-w-md">
      <span className="font-semibold">Fechar o painel sozinho depois de quanto tempo sem uso, neste aparelho</span>
      <select
        value={minutos}
        onChange={(e) => {
          const n = Number(e.target.value);
          setItem(KEYS.painelOcioso, String(n));
          setMinutos(n);
        }}
        className={campo}
      >
        {OPCOES_OCIOSO.map(([n, nome]) => (
          <option key={n} value={n}>{nome}</option>
        ))}
      </select>
      <span className="mt-1 block text-xs text-ink-soft">Em computador de uso compartilhado, escolha 1 hora. “Nunca” só no seu próprio aparelho, com tela bloqueada.</span>
    </label>
  );
}

function AparelhosDaConta({ dias }: { dias: number }) {
  const lista = useLista<Aparelho[]>("aparelhos_meus");
  const [meu, setMeu] = useState("");
  const [aviso, setAviso] = useState("");
  useEffect(() => {
    void marcaDesteAparelho().then(setMeu);
  }, []);
  // Uma linha por navegador: o mesmo "Chrome em Android" com marcas diferentes (armazenamento limpo) vira um só.
  const grupos = new Map<string, { rotulo: string; marcas: string[]; primeiro: string; ultimo: string; este: boolean }>();
  for (const a of lista.dados ?? []) {
    const chave = a.marca === meu ? `este:${a.rotulo}` : a.rotulo || a.marca;
    const g = grupos.get(chave) ?? { rotulo: a.rotulo || "Navegador", marcas: [], primeiro: a.primeiro, ultimo: a.ultimo, este: a.marca === meu };
    g.marcas.push(a.marca);
    if (a.primeiro < g.primeiro) g.primeiro = a.primeiro;
    if (a.ultimo > g.ultimo) g.ultimo = a.ultimo;
    grupos.set(chave, g);
  }
  const linhas = [...grupos.values()].sort((a, b) => Number(b.este) - Number(a.este) || b.ultimo.localeCompare(a.ultimo));

  async function esquecer(marcas: string[]) {
    try {
      for (const m of marcas) await rpc("aparelho_esquecer", { p_marca: m });
      setAviso("Aparelho esquecido: se a conta for aberta nele de novo, você será avisado.");
      lista.recarregar();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  return (
    <section className={cartao}>
      <h2 className="font-serif text-xl font-semibold">Onde a conta está aberta</h2>
      <p className="mt-1 text-ink-soft">Não reconhece algum? Saia de todos os outros, troque a senha e avise a coordenação. Aparelhos parados há mais de {dias} dias precisam entrar de novo.</p>
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {linhas.map((g) => (
          <li key={g.marcas.join()} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span>
              <span className="font-semibold">{g.rotulo}</span> {g.este && <Selo tipo="ok">este aparelho</Selo>}
              <span className="block text-sm text-ink-soft">Primeiro acesso em {dataHora(g.primeiro)} · último em {dataHora(g.ultimo)}</span>
            </span>
            {!g.este && <button type="button" className={elo} onClick={() => void esquecer(g.marcas)}>Esquecer</button>}
          </li>
        ))}
      </ul>
      {lista.dados?.length === 0 && <p className="mt-2 text-ink-soft">Nenhum aparelho registrado ainda.</p>}
      <TempoSemUso />
      <p className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className={botao}
          onClick={async () => {
            if (!window.confirm("Sair de todos os outros aparelhos? Eles vão precisar entrar de novo com a senha. Este aparelho continua aberto.")) return;
            try {
              const supabase = await getClient();
              const { error } = await supabase.auth.signOut({ scope: "others" });
              if (error) throw error;
              await rpc("conta_evento", { p_acao: "saiu_dos_outros" }).catch(() => null);
              setAviso("Pronto: os outros aparelhos saíram.");
            } catch {
              setAviso("Não deu certo agora. Tente de novo em instantes.");
            }
          }}
        >
          Sair de todos os outros aparelhos
        </button>
        <button
          type="button"
          className={botaoClaro}
          onClick={async () => {
            if (!window.confirm("Sair de todos os aparelhos, inclusive este?")) return;
            try {
              const supabase = await getClient();
              await supabase.auth.signOut({ scope: "global" });
            } finally {
              await signOut();
            }
          }}
        >
          Sair de todos, inclusive deste
        </button>
      </p>
      <Aviso texto={aviso || lista.erro} />
    </section>
  );
}

// ───────────── Atividade ─────────────

const NOMES_DA_ATIVIDADE: Record<string, string> = {
  "auth:login": "Entrada na conta",
  "auth:logout": "Saída da conta",
  "auth:user_signedup": "Conta criada",
  "auth:user_updated_password": "Senha alterada (serviço de contas)",
  "auth:user_recovery_requested": "Pedido de nova senha por e-mail",
  "auth:user_modified": "Dados da conta alterados",
  "auth:user_confirmation_requested": "Pedido de confirmação de e-mail",
  "auth:factor_in_progress": "Cadastro do aplicativo autenticador começado",
  "auth:factor_unenrolled": "Aplicativo autenticador removido",
  "auth:challenge_created": "Código do aplicativo pedido",
  "auth:verification_attempted": "Código do aplicativo conferido",
  "auth:factor_deleted": "Aplicativo autenticador apagado",
  aparelho_novo: "Conta aberta em aparelho novo",
  segundo_fator_recuperado: "Código de recuperação usado: aplicativo removido",
  codigo_recuperacao_errado: "Código de recuperação errado",
  codigos_recuperacao_gerados: "Códigos de recuperação gerados",
  senha_trocada: "Senha trocada pelo painel",
  segundo_fator_ativado: "Aplicativo autenticador ligado",
  segundo_fator_removido: "Aplicativo autenticador desligado",
  chave_acesso_cadastrada: "Chave de acesso cadastrada",
  chave_acesso_removida: "Chave de acesso removida",
  saiu_dos_outros: "Saída de todos os outros aparelhos",
  meus_dados_baixados: "Cópia dos dados baixada",
  emails_preferencias: "Avisos por e-mail alterados",
  termo_voluntario: "Termo de voluntário aceito",
  papel_concedido: "Função recebida",
  papel_removido: "Função retirada",
  senha_redefinida: "Senha redefinida pela coordenação",
};
const SUSPEITOS = new Set(["codigo_recuperacao_errado", "segundo_fator_recuperado", "aparelho_novo", "senha_redefinida", "auth:user_recovery_requested"]);

function Atividade() {
  const lista = useLista<{ acao: string; quando: string; ip: string }[]>("conta_atividade");
  return (
    <section className={cartao}>
      <h2 className="font-serif text-xl font-semibold">Atividade recente</h2>
      <p className="mt-1 text-ink-soft">Entradas, trocas de senha e mudanças de segurança desta conta, das mais novas para as mais antigas. Viu algo que não foi você? Troque a senha, saia dos outros aparelhos e avise a coordenação.</p>
      {lista.dados ? (
        lista.dados.length === 0 ? (
          <p className="mt-3 text-ink-soft">Nada registrado ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-rule border-y border-rule text-sm">
            {lista.dados.map((e, i) => (
              <li key={`${e.acao}-${e.quando}-${i}`} className="flex flex-wrap items-baseline gap-x-3 py-2">
                <span className="font-mono text-xs text-ink-soft">{dataHora(e.quando)}</span>
                <span className={SUSPEITOS.has(e.acao) ? "font-semibold text-oxblood" : ""}>{NOMES_DA_ATIVIDADE[e.acao] ?? e.acao.replace(/^auth:/, "").replace(/_/g, " ")}</span>
                {e.ip && <span className="font-mono text-xs text-ink-soft">IP {e.ip}</span>}
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="mt-3 text-xs text-ink-soft">{lista.erro || "Carregando…"}</p>
      )}
    </section>
  );
}
