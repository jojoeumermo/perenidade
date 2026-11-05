// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { getClient, leads, type Me, rpc, signOut } from "@/lib/backend";
import { marcaDesteAparelho } from "@/lib/device";
import { senhaVazada } from "@/lib/senha";
import { getItem, KEYS, setItem } from "@/lib/storage";
import { SenhaCampo, senhaForte } from "../SenhaCampo";
import { Avatar, AVATARES } from "./Avatar";
import { ArrowRight, Check, ChevronDown, ChevronRight, Circle, Download, EyeOff, History, LogOut, MonitorSmartphone, Printer, TriangleAlert, Upload } from "lucide-react";
import { Aviso, dataHora, oQueFaz, papeis, textoDoErro, useAcao, useLista } from "./comum";
import { IdiomaDoPainel } from "./Idioma";
import { minutosOcioso, OPCOES_OCIOSO } from "./ocioso";
import { FaixaDeEmail } from "./FaixaDeEmail";
import { CuidadoNaConta } from "./Cuidado";
import { Oficios } from "./Biblioteca";
import { Digital, SegundoFator } from "./Seguranca";
import { MoldeConfiguracao } from "./moldes";
import { Abas, Area, Botao, Campo, Cartao, confirmarFrase, Esqueleto, Faixa, ItemDeLista, Lista, Marca, Selecao, Selo, Vazio } from "./ui";

// O manual (Ajuda) só carrega quando a aba abre.
const Ajuda = dynamic(() => import("./Ajuda").then((m) => m.Ajuda), { ssr: false });

type Aba = "perfil" | "assinatura" | "seguranca" | "privacidade" | "aparelhos" | "atividade" | "cuidado" | "ajuda";

interface Protecao {
  segundo_fator: boolean;
  segundo_fator_desde: string | null;
  codigos_restantes: number;
  codigos_gerados_em: string | null;
  sessao_dias: number;
}

// O selo de estado é o Selo de ui/ (palavra e cor, nunca só a cor): o selo local da tela antiga saiu.

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
      <Cartao className="mb-6" aria-labelledby="protecao-titulo">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="protecao-titulo" className="pn-cartao-titulo">Proteção da conta</h2>
          {p ? <Selo ponto tom={nota === "boa" ? "ok" : nota === "media" ? "aviso" : "erro"}>{nota === "boa" ? "boa" : nota === "media" ? "média" : "fraca"}</Selo> : <span className="pn-ajuda">Carregando…</span>}
        </div>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {motivos.map(([ok, texto]) => (
            <li key={texto} className={`flex items-start gap-1.5 ${ok ? "text-ok" : "text-ink-soft"}`}>
              {ok ? <Check aria-hidden width={14} height={14} className="mt-0.5 shrink-0" /> : <Circle aria-hidden width={14} height={14} className="mt-0.5 shrink-0" />} {texto}
            </li>
          ))}
        </ul>
        {nota !== "boa" && <p className="mt-2"><Botao variante="discreto" pequeno simboloFim={ArrowRight} onClick={() => setAba("seguranca")}>Melhorar a proteção</Botao></p>}
      </Cartao>

      <Abas<Aba>
        rotulo="Minha conta"
        opcoes={[
          { id: "perfil", nome: "Perfil" },
          // A faixa de e-mail é de quem está na equipe (qualquer função).
          ...(me.papeis.length > 0 ? [{ id: "assinatura" as Aba, nome: "Faixa de e-mail" }] : []),
          { id: "seguranca", nome: "Segurança" },
          { id: "privacidade", nome: "Privacidade e avisos" },
          { id: "aparelhos", nome: "Aparelhos" },
          { id: "atividade", nome: "Atividade" },
          { id: "cuidado", nome: "Cuidado" },
          { id: "ajuda", nome: "Ajuda" },
        ]}
        valor={aba}
        aoMudar={setAba}
        painel={() => (
          <div className="grid gap-6">
            {aba === "perfil" && <Perfil me={me} recarregar={recarregar} curriculo={curriculo} />}
            {aba === "perfil" && me.papeis.length > 0 && <Oficios />}
            {aba === "assinatura" && <FaixaDeEmail me={me} />}
            {aba === "seguranca" && <SegurancaDaConta me={me} protecao={p ?? null} recarregar={recarregarTudo} />}
            {aba === "privacidade" && <Privacidade me={me} recarregar={recarregar} sair={sair} avisosETrava={avisosETrava} />}
            {aba === "aparelhos" && <AparelhosDaConta dias={p?.sessao_dias ?? 60} />}
            {aba === "atividade" && <Atividade />}
            {aba === "cuidado" && <CuidadoNaConta me={me} sair={sair} />}
            {aba === "ajuda" && <Ajuda />}
          </div>
        )}
      />
      <div className="mt-8 border-t border-rule pt-5">
        <Botao simbolo={LogOut} onClick={sair}>Sair do painel</Botao>
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
    <div className="grid gap-6">
      {/* O nome e o "sobre você" no molde de configuração: guarda tudo de uma vez, só quando algo mudou. */}
      <MoldeConfiguracao
        grupos={[
          {
            id: "como-aparece",
            titulo: "Como você aparece",
            sobre: "O nome assina o que você publica. O seu e-mail nunca aparece.",
            campos: (
              <div className="mt-3 grid gap-3">
                <Campo rotulo="Nome público" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} />
                <Area rotulo="Sobre você (opcional)" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} />
                <Aviso texto={perfil.aviso} />
              </div>
            ),
          },
        ]}
        sujo={nome !== me.nome || bio !== me.bio}
        salvando={perfil.ocupado}
        aoSalvar={() => {
          // Como o antigo botão desligado: sem nome não guarda (e o rodapé não finge que está tudo guardado).
          if (!nome.trim()) {
            perfil.setAviso("Escreva o nome público antes de guardar.");
            return;
          }
          void perfil.agir("perfil_salvar", { p_nome: nome, p_bio: bio }, "Salvo ✓");
        }}
        aoDescartar={() => {
          setNome(me.nome);
          setBio(me.bio);
        }}
        rotuloSalvar="Guardar"
      />
      <div className="grid gap-6 lg:grid-cols-2">
      <FotoDoPerfil me={me} recarregar={recarregar} />

      <Cartao titulo="Suas funções" sobre="O que a sua conta pode fazer no painel. Quem dá e tira funções é a coordenação (ou a supervisão, para as funções de trabalho).">
        {me.papeis.length === 0 ? (
          <p className="pn-ajuda mt-3">Nenhuma função ainda: você participa da comunidade e pode pedir uma função em Voluntariado.</p>
        ) : (
          <div className="mt-3">
            <Lista rotulo="Suas funções">
              {me.papeis.map((r) => (
                <ItemDeLista key={`${r.papel}-${r.disciplina ?? ""}`} titulo={<>{papeis[r.papel]}{r.disciplina ? ` · ${r.disciplina}` : ""}</>} meta={oQueFaz[r.papel]} />
              ))}
            </Lista>
          </div>
        )}
      </Cartao>

      <Cartao titulo="Preferências">
        <div className="mt-3 grid gap-3">
          <label className="pn-campo-bloco">
            <span className="pn-rotulo">Idioma do painel</span>
            <IdiomaDoPainel />
          </label>
          <Selecao rotulo="Tema" value={tema} onChange={(e) => mudarTema(e.target.value)}>
            <option value="auto">Igual ao do aparelho</option>
            <option value="light">Claro (pergaminho)</option>
            <option value="dark">Escuro</option>
          </Selecao>
        </div>
        <p className="pn-ajuda mt-2">Idioma e tema ficam guardados neste aparelho.</p>
      </Cartao>
      {curriculo}
      </div>
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
    <Cartao titulo="Foto ou ícone" sobre="Aparece ao lado do seu nome nas conversas, na equipe e no cartão de quem ensina, nas disciplinas. A foto passa pela coordenação antes de aparecer; os ícones prontos valem na hora.">
      {me.foto_pendente && (
        <Faixa tom="aviso" className="mt-2">
          <p className="text-sm">Sua foto nova está esperando a aprovação da coordenação.</p>
        </Faixa>
      )}
      <div className="mt-3 flex items-center gap-4">
        <Avatar nome={me.nome} avatar={atual} className="h-16 w-16" />
        <div className="flex flex-wrap gap-2 text-sm">
          {/* O envio é um <label> com o input escondido: tem a cara do Botao e o foco aparece no rótulo inteiro. */}
          <label className="pn-botao cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--pn-foco)]">
            <Upload aria-hidden width={15} height={15} />
            Enviar uma foto
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { abrir(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {atual && <Botao variante="discreto" disabled={acao.ocupado} onClick={() => acao.agir("perfil_avatar", { p_avatar: "" }, "Foto removida.")}>Remover</Botao>}
        </div>
      </div>
      {imagem && (
        <div className="mt-4 rounded-[var(--pn-raio)] border border-rule p-3">
          <p className="text-sm">Arraste para enquadrar e use o controle para aproximar.</p>
          <canvas
            ref={tela}
            width={LADO}
            height={LADO}
            aria-label="Prévia do recorte em círculo"
            className="mt-2 cursor-move touch-none rounded-full border-2 border-[var(--pn-borda-forte)]"
            onPointerDown={(e) => { arrasto.current = { x: e.clientX - desloca.x, y: e.clientY - desloca.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (arrasto.current) setDesloca({ x: e.clientX - arrasto.current.x, y: e.clientY - arrasto.current.y }); }}
            onPointerUp={() => { arrasto.current = null; }}
          />
          <label className="mt-2 block text-sm">
            Aproximar
            <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="block w-48 accent-[var(--pn-destaque)]" />
          </label>
          <p className="mt-2 flex gap-3">
            <Botao variante="principal" disabled={acao.ocupado} onClick={() => void guardar()}>Guardar a foto</Botao>
            <Botao variante="discreto" onClick={() => setImagem(null)}>Cancelar</Botao>
          </p>
        </div>
      )}
      <p className="mt-4 text-sm">Ou escolha um desenho:</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={atual === ""} title="Só as iniciais" onClick={() => acao.agir("perfil_avatar", { p_avatar: "" }, "Ícone guardado ✓")} className={`cursor-pointer rounded-full border-2 p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pn-foco)] ${atual === "" ? "border-[var(--pn-destaque-vivo)]" : "border-transparent hover:border-rule"}`}>
          <Avatar nome={me.nome} className="h-10 w-10" />
        </button>
        {AVATARES.map((a) => (
          <button key={a.id} type="button" aria-pressed={atual === `p:${a.id}`} title={a.nome} aria-label={a.nome} disabled={acao.ocupado} onClick={() => acao.agir("perfil_avatar", { p_avatar: `p:${a.id}` }, "Ícone guardado ✓")} className={`cursor-pointer rounded-full border-2 p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pn-foco)] ${atual === `p:${a.id}` ? "border-[var(--pn-destaque-vivo)]" : "border-transparent hover:border-rule"}`}>
            <Avatar nome={me.nome} avatar={`p:${a.id}`} className="h-10 w-10" />
          </button>
        ))}
      </div>
      <Aviso texto={aviso || acao.aviso} />
    </Cartao>
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
    if (protecao?.codigos_restantes && !(await confirmarFrase("Gerar códigos novos? Os que você guardou antes deixam de valer."))) return;
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
      <Cartao titulo="Senha" sobre="Pelo menos 12 caracteres. Frase longa vale (quatro ou cinco palavras), colar vale e gerenciador de senhas vale. Não precisa misturar símbolo e número.">
        <form onSubmit={(e) => { e.preventDefault(); void trocarSenha(); }} className="mt-3 grid gap-3">
          <label className="pn-campo-bloco">
            <span className="pn-rotulo">Senha nova</span>
            <SenhaCampo value={senha} onChange={setSenha} regras pessoais={[me.nome]} className="pn-campo" />
          </label>
          <label className="pn-campo-bloco">
            <span className="pn-rotulo">Repita a senha</span>
            <SenhaCampo value={repete} onChange={setRepete} className="pn-campo" />
          </label>
          {repete !== "" && repete !== senha && <p role="alert" className="pn-erro">As duas senhas não são iguais.</p>}
          <p>
            <Botao type="submit" variante="principal" disabled={!senhaForte(senha, [me.nome]) || senha !== repete}>Trocar a senha</Botao>
          </p>
        </form>
        <Aviso texto={avisoSenha} />
        {trocou && (
          <Faixa tom="aviso" className="mt-2" acao={<Botao pequeno simbolo={LogOut} onClick={() => void sairDosOutros()}>Sair dos outros aparelhos</Botao>}>
            <p className="text-sm">Quer que os outros aparelhos onde a conta está aberta precisem entrar de novo, com a senha nova?</p>
          </Faixa>
        )}
      </Cartao>

      <Cartao
        titulo="Segundo fator"
        sobre="Um código do aplicativo autenticador, além da senha. Quem descobre a sua senha continua do lado de fora."
        acoes={protecao && (protecao.segundo_fator ? <Selo tom="ok" ponto>ligado</Selo> : <Selo tom="aviso" ponto>desligado</Selo>)}
      >
        {protecao?.segundo_fator_desde && <p className="pn-ajuda mt-1">Ligado desde {dataHora(protecao.segundo_fator_desde)}.</p>}
        <div className="mt-3">
          <SegundoFator me={me} recarregar={recarregar} />
        </div>
        {protecao?.segundo_fator && (
          <div className="mt-4 border-t border-rule pt-3">
            <h3 className="pn-cartao-titulo">Códigos de recuperação</h3>
            <p className="pn-ajuda">Dez códigos de uso único para entrar se você perder o celular. Aparecem uma vez só: baixe ou imprima e guarde longe do celular.</p>
            <p className="mt-1 text-sm">{protecao.codigos_restantes > 0 ? `Restam ${protecao.codigos_restantes} códigos${protecao.codigos_gerados_em ? ` (gerados em ${dataHora(protecao.codigos_gerados_em)})` : ""}.` : "Você ainda não gerou códigos."}</p>
            {codigos ? (
              <Cartao as="div" variante="plano" className="mt-2">
                <ol className="grid grid-cols-2 gap-1 font-mono text-sm tabular-nums" translate="no">{codigos.map((c) => <li key={c}>{c}</li>)}</ol>
                <p className="mt-2 flex flex-wrap gap-3 text-sm">
                  <Botao variante="discreto" pequeno simbolo={Download} onClick={() => baixar("instituto-lucia-codigos-de-recuperacao.txt", textoDosCodigos(codigos))}>Baixar (.txt)</Botao>
                  <Botao variante="discreto" pequeno simbolo={Printer} onClick={() => { const w = window.open("", "_blank", "width=600,height=700"); if (w) { w.document.body.innerText = textoDosCodigos(codigos); w.print(); } }}>Imprimir</Botao>
                  <Botao variante="discreto" pequeno simbolo={EyeOff} onClick={() => setCodigos(null)}>Já guardei: esconder</Botao>
                </p>
              </Cartao>
            ) : (
              <Botao disabled={!me.segundo_fator} onClick={() => void gerarCodigos()}>{protecao.codigos_restantes > 0 ? "Gerar códigos novos" : "Gerar códigos de recuperação"}</Botao>
            )}
            {!me.segundo_fator && <p className="pn-ajuda mt-1">Confirme esta sessão com o código do aplicativo para gerar.</p>}
            <Aviso texto={avisoCodigos} />
          </div>
        )}
      </Cartao>

      <Cartao className="lg:col-span-2" titulo="Chave de acesso (digital, rosto ou PIN do aparelho)" sobre="Entre sem digitar a senha, com o desbloqueio do próprio aparelho. A chave fica só no aparelho; a senha continua valendo como reserva. Dê um nome a cada uma para reconhecer depois.">
        <div className="mt-3">
          <Digital />
        </div>
      </Cartao>
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
  const nomes: Record<string, string> = { voluntario: "Termo de voluntário", adesao: "Termo de adesão (horas e certificados)", saude: "Termo do Mural de Saúde" };
  return (
    <Cartao titulo="Termos que você aceitou" sobre="Cada aceite fica guardado com o texto exato, a versão e a data, para sempre: é a prova de que o seu trabalho aqui é voluntário e de como o que você publica fica livre.">
      {lista.dados === null && !lista.erro && <Esqueleto linhas={2} />}
      {lista.erro && <Faixa tom="erro" className="mt-3" acao={<Botao pequeno onClick={lista.recarregar}>Tentar de novo</Botao>}>{lista.erro}</Faixa>}
      {lista.dados?.length === 0 && <p className="pn-ajuda mt-2">Nenhum aceite registrado ainda (os de antes de 20/10/2026 ficaram só com a data).</p>}
      <ul className="pn-lista mt-3">
        {lista.dados?.map((a) => (
          <li key={a.id} className="pn-item block">
            <Botao variante="discreto" aria-expanded={aberto === a.id} simbolo={aberto === a.id ? ChevronDown : ChevronRight} onClick={() => setAberto(aberto === a.id ? "" : a.id)}>{nomes[a.termo] ?? a.termo}, versão {a.versao}</Botao>
            <span className="pn-ajuda ml-2">aceito em {dataHora(a.aceito_em)}</span>
            {aberto === a.id && (
              <>
                <Cartao as="div" variante="plano" className="mt-2">
                  <pre className="whitespace-pre-wrap font-sans text-sm">{a.texto}</pre>
                </Cartao>
                <p className="pn-rotulo-mono mt-1 break-all">SHA-256: {a.sha256}</p>
              </>
            )}
          </li>
        ))}
      </ul>
    </Cartao>
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
      <Cartao titulo="Privacidade nas conversas" sobre="O que os colegas veem de você. Quem esconde algo também deixa de ver o mesmo dos outros.">
        <div className="mt-3 grid gap-2">
          <Marca rotulo="Mostrar quando estou online e o “visto por último”" checked={me.chat_visto} disabled={preferencias.ocupado} onChange={(e) => preferencias.agir("perfil_preferencias", { p_chat_visto: e.target.checked, p_chat_leitura: null }, "Salvo ✓")} />
          <Marca rotulo="Confirmar aos outros que li as mensagens (os tiques azuis e o “Lida por”)" checked={me.chat_leitura} disabled={preferencias.ocupado} onChange={(e) => preferencias.agir("perfil_preferencias", { p_chat_visto: null, p_chat_leitura: e.target.checked }, "Salvo ✓")} />
        </div>
        <Aviso texto={preferencias.aviso} />
        {avisosETrava}
      </Cartao>

      <Cartao titulo="Avisos por e-mail" sobre="O que você quer receber no seu e-mail. Convites, recuperação de senha e alertas de segurança chegam sempre.">
        {emails.dados ? (
          <ul className="mt-3 space-y-2">
            {emails.dados.opcoes.map((op) => {
              const ligado = !emails.dados!.desligados.includes(op);
              return (
                <li key={op}>
                  <Marca
                    rotulo={NOMES_DOS_EMAILS[op] ?? op}
                    checked={ligado}
                    disabled={acaoEmails.ocupado}
                    onChange={(e) => {
                      const desligados = e.target.checked ? emails.dados!.desligados.filter((x) => x !== op) : [...emails.dados!.desligados, op];
                      acaoEmails.agir("conta_emails_salvar", { p_desligados: desligados }, "Salvo ✓");
                    }}
                  />
                </li>
              );
            })}
          </ul>
        ) : emails.erro ? (
          <Faixa tom="erro" className="mt-3" acao={<Botao pequeno onClick={emails.recarregar}>Tentar de novo</Botao>}>{emails.erro}</Faixa>
        ) : (
          <Esqueleto linhas={3} />
        )}
        <Aviso texto={acaoEmails.aviso} />
      </Cartao>

      <Cartao className="lg:col-span-2" titulo="Seus dados (LGPD)" sobre="Você pode baixar tudo o que o painel guarda sobre você e pode apagar a sua conta. Conversas cifradas saem cifradas: só os seus aparelhos as abrem.">
        <p className="mt-3 flex flex-wrap items-center gap-4">
          <Botao simbolo={Download} onClick={() => void meusDados()}>Baixar meus dados (.json)</Botao>
          <span role="status" className="pn-ajuda">{baixando}</span>
        </p>
        <div className="mt-5 border-t border-rule pt-4">
          <h3 className="pn-cartao-titulo" style={{ color: "var(--pn-erro)" }}>Apagar minha conta</h3>
          {leads(me) ? (
            <p className="pn-ajuda mt-1">A conta da coordenação não se apaga pelo painel: passe a coordenação adiante em Segurança e sucessão antes, se for o caso.</p>
          ) : passo === 0 ? (
            <Botao variante="discreto" onClick={() => setPasso(1)}>Quero apagar a minha conta…</Botao>
          ) : passo === 1 ? (
            <div className="mt-2 space-y-2 text-sm">
              <p>O que acontece:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Saem o seu perfil, as suas funções, os seus votos, os seus aparelhos e os seus recados.</li>
                <li>O que você já publicou (aulas, matérias, traduções) continua no acervo, sem ligação com a conta.</li>
                <li>As conversas da equipe continuam com os colegas; você perde o acesso a elas.</li>
                <li>Não tem volta: para voltar, é preciso criar outra conta e pedir as funções de novo.</li>
              </ul>
              <Marca rotulo="Entendi o que acontece" checked={entendi} onChange={(e) => setEntendi(e.target.checked)} />
              <p className="flex gap-3">
                <Botao disabled={!entendi} onClick={() => setPasso(2)}>Continuar</Botao>
                <Botao variante="discreto" onClick={() => { setPasso(0); setEntendi(false); }}>Cancelar</Botao>
              </p>
            </div>
          ) : (
            <div className="mt-2 space-y-2 text-sm">
              <label className="block">
                Para confirmar, escreva <strong className="font-mono" translate="no">APAGAR</strong>
                <input value={palavra} onChange={(e) => setPalavra(e.target.value)} className="pn-campo mt-1 max-w-xs font-mono" autoComplete="off" />
              </label>
              <label className="block">
                E a sua senha atual
                <input type="password" value={senhaApagar} onChange={(e) => setSenhaApagar(e.target.value)} className="pn-campo mt-1 max-w-xs" autoComplete="current-password" />
              </label>
              <p className="flex gap-3">
                <Botao
                  perigo
                  simbolo={TriangleAlert}
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
                </Botao>
                <Botao variante="discreto" onClick={() => { setPasso(0); setEntendi(false); setPalavra(""); setSenhaApagar(""); }}>Cancelar</Botao>
              </p>
              <Aviso texto={avisoApagar} />
            </div>
          )}
        </div>
      </Cartao>
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
    <div className="mt-4 max-w-md">
      <Selecao
        rotulo="Fechar o painel sozinho depois de quanto tempo sem uso, neste aparelho"
        ajuda="Em computador de uso compartilhado, escolha 1 hora. “Nunca” só no seu próprio aparelho, com tela bloqueada."
        value={minutos}
        onChange={(e) => {
          const n = Number(e.target.value);
          setItem(KEYS.painelOcioso, String(n));
          setMinutos(n);
        }}
      >
        {OPCOES_OCIOSO.map(([n, nome]) => (
          <option key={n} value={n}>{nome}</option>
        ))}
      </Selecao>
    </div>
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
    <Cartao titulo="Onde a conta está aberta" sobre={<>Não reconhece algum? Saia de todos os outros, troque a senha e avise a coordenação. Aparelhos parados há mais de {dias} dias precisam entrar de novo.</>}>
      {lista.dados === null && !lista.erro && <Esqueleto linhas={2} />}
      {linhas.length > 0 && (
        <div className="mt-3">
          <Lista rotulo="Onde a conta está aberta">
            {linhas.map((g) => (
              <ItemDeLista
                key={g.marcas.join()}
                simbolo={MonitorSmartphone}
                titulo={g.rotulo}
                meta={<span className="tabular-nums">Primeiro acesso em {dataHora(g.primeiro)} · último em {dataHora(g.ultimo)}</span>}
                selo={g.este ? <Selo tom="ok" ponto>este aparelho</Selo> : undefined}
                acoes={!g.este ? <Botao variante="discreto" pequeno onClick={() => void esquecer(g.marcas)}>Esquecer</Botao> : undefined}
              />
            ))}
          </Lista>
        </div>
      )}
      {lista.dados?.length === 0 && <p className="pn-ajuda mt-2">Nenhum aparelho registrado ainda.</p>}
      <TempoSemUso />
      <p className="mt-4 flex flex-wrap gap-3">
        <Botao
          variante="principal"
          simbolo={LogOut}
          onClick={async () => {
            if (!(await confirmarFrase("Sair de todos os outros aparelhos? Eles vão precisar entrar de novo com a senha. Este aparelho continua aberto."))) return;
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
        </Botao>
        <Botao
          simbolo={LogOut}
          onClick={async () => {
            if (!(await confirmarFrase("Sair de todos os aparelhos, inclusive este?"))) return;
            try {
              const supabase = await getClient();
              await supabase.auth.signOut({ scope: "global" });
            } finally {
              await signOut();
            }
          }}
        >
          Sair de todos, inclusive deste
        </Botao>
      </p>
      <Aviso texto={aviso || lista.erro} />
    </Cartao>
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
    <Cartao titulo="Atividade recente" sobre="Entradas, trocas de senha e mudanças de segurança desta conta, das mais novas para as mais antigas. Viu algo que não foi você? Troque a senha, saia dos outros aparelhos e avise a coordenação.">
      {lista.dados ? (
        lista.dados.length === 0 ? (
          <Vazio simbolo={History} titulo="Nada registrado ainda." />
        ) : (
          <ul className="pn-lista mt-3 text-sm">
            {lista.dados.map((e, i) => (
              <li key={`${e.acao}-${e.quando}-${i}`} className="pn-item flex-wrap">
                <span className="pn-rotulo-mono tabular-nums">{dataHora(e.quando)}</span>
                <span className={SUSPEITOS.has(e.acao) ? "inline-flex items-center gap-1 font-semibold text-oxblood" : ""}>
                  {SUSPEITOS.has(e.acao) && <TriangleAlert aria-hidden width={13} height={13} />}
                  {NOMES_DA_ATIVIDADE[e.acao] ?? e.acao.replace(/^auth:/, "").replace(/_/g, " ")}
                </span>
                {e.ip && <span className="pn-rotulo-mono tabular-nums">IP {e.ip}</span>}
              </li>
            ))}
          </ul>
        )
      ) : lista.erro ? (
        <Faixa tom="erro" className="mt-3" acao={<Botao pequeno onClick={lista.recarregar}>Tentar de novo</Botao>}>{lista.erro}</Faixa>
      ) : (
        <Esqueleto linhas={4} />
      )}
    </Cartao>
  );
}
