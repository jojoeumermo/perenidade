// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { BadgeCheck, Camera, Check, KeyRound, MonitorSmartphone, RotateCcw, ShieldAlert, ShieldCheck, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BackendError, rpc } from "@/lib/backend";
import { type Aberto, type Alerta, type Chaveiro, chaveiroDe, aparelhosMigrados, recomecar } from "@/lib/chaveiro";
import { desempacotar } from "@/lib/mensagem";
import { chaveDeRecuperacaoValida, codigoDeSeguranca, codigoEmGrupos, lerQrDaSeguranca, lerQrDoPedido, novaChaveDeRecuperacao, qrDaSeguranca, qrDoPedido } from "@/lib/sigilo";
import { Aviso, data, dataHora, rotulo, textoDoErro, useLista } from "./comum";
import { Formatado } from "./Formatado";
import { Botao, Cartao, Faixa, Selo, confirmarFrase } from "./ui";

/** O texto cifrado precisa caber no banco (4000 caracteres); acento e emoji ocupam mais do que uma letra simples. */
export const LIMITE_CIFRADO = 12000;
export const ANTIGA = "Mensagem antiga, da época da frase da equipe. Ela não abre mais e some sozinha em até 30 dias.";
export const SEM_CHAVE = "Esta mensagem ainda não abre neste aparelho. A chave chega assim que alguém da conversa estiver com o painel aberto.";

/** O chaveiro deste aparelho, pronto para cifrar e abrir. Na primeira vez, cria e registra o par de chaves do aparelho. */
export function useChaveiro(usuario: string) {
  const [estado, setEstado] = useState<{ chaveiro: Chaveiro | null; erro: string }>({ chaveiro: null, erro: "" });
  const [, setVersao] = useState(0);
  useEffect(() => {
    let cancelado = false;
    let parar = () => {};
    chaveiroDe(usuario).then(
      (chaveiro) => {
        if (cancelado) return;
        setEstado({ chaveiro, erro: "" });
        // Aprovação, identidade de colega que mudou, verificação: a tela se refaz.
        parar = chaveiro.ouvir(() => setVersao((n) => n + 1));
      },
      (erro) => !cancelado && setEstado({ chaveiro: null, erro: textoDoErro(erro) }),
    );
    return () => {
      cancelado = true;
      parar();
    };
  }, [usuario]);
  return estado;
}

export interface Cifrado {
  /** Identificador único do item (a mensagem). */
  id: string;
  conversa: string;
  corpo: string;
  contexto: string;
  /** Quem escreveu, para conferir a assinatura. */
  autor: string | null;
}

/**
 * Abre neste aparelho os textos cifrados. Para cada item: o texto aberto com a autoria conferida; null enquanto a chave não
 * chegou (é tentado de novo a cada quinze segundos, até algum colega repassar a chave); ausente enquanto ainda está abrindo.
 */
export function useAbertos(chaveiro: Chaveiro | null, itens: Cifrado[]) {
  const [abertos, setAbertos] = useState<Record<string, Aberto | null>>({});
  const [rodada, setRodada] = useState(0);
  const faltam = itens.filter((item) => !abertos[item.id]);
  const assinatura = faltam.map((item) => item.id).join(",");
  const esperando = faltam.some((item) => abertos[item.id] === null);
  const lista = useRef(faltam);
  useEffect(() => {
    lista.current = faltam;
  });

  useEffect(() => {
    if (!chaveiro || !assinatura || chaveiro.estado !== "aprovado") return;
    let cancelado = false;
    void Promise.all(
      lista.current.map(async (item) => {
        if (item.corpo.startsWith("c1.")) return [item.id, { texto: ANTIGA, autoria: "sem_assinatura" } as Aberto] as const;
        return [item.id, await chaveiro.abrir(item.conversa, item.corpo, item.contexto, item.autor).catch(() => null)] as const;
      }),
    ).then((pares) => {
      if (!cancelado) setAbertos((antes) => ({ ...antes, ...Object.fromEntries(pares) }));
    });
    return () => {
      cancelado = true;
    };
  }, [chaveiro, assinatura, rodada]);

  useEffect(() => {
    if (!esperando) return;
    const relogio = window.setTimeout(() => setRodada((n) => n + 1), 15_000);
    return () => window.clearTimeout(relogio);
  }, [esperando, rodada]);

  return abertos;
}

/** Como uma mensagem aberta aparece, com a marca da autoria. */
export function TextoAberto({ aberto, antiga = false }: { aberto: Aberto | null | undefined; antiga?: boolean }) {
  if (aberto === null) return <span className="italic opacity-80">{SEM_CHAVE}</span>;
  if (!aberto) return <span>…</span>;
  if (antiga) return <span className="italic opacity-80">{aberto.texto}</span>;
  return (
    <>
      <Formatado texto={desempacotar(aberto.texto).texto} />
      {aberto.autoria === "invalida" && (
        // Sem role="alert": isto aparece dentro do histórico, e cada mensagem assim interromperia o leitor de tela ao abrir a conversa.
        <span className="mt-1 block border-l-2 border-[var(--pn-erro)] pl-2 text-xs font-semibold not-italic text-[var(--pn-erro)]">Não foi possível verificar o autor desta mensagem: a assinatura não confere com a identidade de quem aparece como autor.</span>
      )}
      {aberto.autoria === "sem_identidade" && <span className="mt-1 block text-[0.65rem] not-italic opacity-70">Autor ainda sem identidade conhecida neste aparelho.</span>}
      {/* Mensagem nova sem a assinatura do autor: quem tem a chave da conversa e escreve no banco poderia tê-la posto em nome de outro. */}
      {aberto.autoria === "sem_assinatura" && <span className="mt-1 block text-[0.65rem] font-semibold not-italic opacity-80">Mensagem sem assinatura do autor: não dá para confirmar quem escreveu.</span>}
    </>
  );
}

/**
 * Enquanto o painel está aberto, este aparelho repassa as chaves que tem para aparelhos de colegas que ainda não as
 * receberam (alguém que entrou num grupo, um celular novo aprovado). É o que faz a conversa abrir para quem chegou depois.
 * Um aparelho pendente, em vez disso, pergunta de tempos em tempos se já foi aprovado.
 */
export function Repasse({ usuario }: { usuario: string }) {
  const { chaveiro } = useChaveiro(usuario);
  useEffect(() => {
    if (!chaveiro) return;
    const repassar = () => {
      if (document.visibilityState !== "visible") return;
      if (chaveiro.estado === "aprovado") void chaveiro.repassar().catch(() => undefined);
      else void chaveiro.atualizarEstado().catch(() => undefined);
    };
    repassar();
    const relogio = window.setInterval(repassar, chaveiro.estado === "aprovado" ? 30_000 : 5_000);
    return () => window.clearInterval(relogio);
  }, [chaveiro, chaveiro?.estado]);
  return null;
}

/** Cifra e envia; se a chave foi trocada nesse meio-tempo (alguém saiu), cifra de novo com a nova e tenta mais uma vez. */
export async function enviarCifrado<T = unknown>(chaveiro: Chaveiro, conversa: string, texto: string, contexto: string, enviar: (corpo: string) => Promise<T>): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    const corpo = await chaveiro.cifrar(conversa, texto, contexto);
    if (corpo.length > LIMITE_CIFRADO) throw new BackendError("mensagem_longa");
    try {
      return await enviar(corpo);
    } catch (erro) {
      if (tentativa > 0 || !(erro instanceof BackendError) || erro.code !== "chave_desatualizada") throw erro;
    }
  }
}

// ───────────────────────────── QR: desenhar e ler ─────────────────────────────

/**
 * Um QR desenhado no próprio aparelho (nada sai para fora). As duas cores do QR são do código, não da interface: tinta
 * escura sobre branco puro, para qualquer câmera ler (como um documento impresso).
 */
export function Qr({ texto, rotulo: descricao }: { texto: string; rotulo: string }) {
  const [imagem, setImagem] = useState("");
  useEffect(() => {
    let cancelado = false;
    import("qrcode")
      .then((qrcode) => qrcode.toDataURL(texto, { errorCorrectionLevel: "M", margin: 1, width: 220, color: { dark: "#1f1a14", light: "#ffffff" } }))
      .then((url) => !cancelado && setImagem(url))
      .catch(() => !cancelado && setImagem(""));
    return () => {
      cancelado = true;
    };
  }, [texto]);
  if (!imagem) return <div aria-hidden className="pn-esqueleto h-[220px] w-[220px]" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imagem} alt={descricao} width={220} height={220} className="rounded-md border border-rule" />;
}

type Detector = { detect: (fonte: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
const temLeitor = () => typeof window !== "undefined" && "BarcodeDetector" in window && typeof navigator.mediaDevices?.getUserMedia === "function";

/** Lê um QR com a câmera, quando o navegador sabe (Chrome e Safari recentes). Senão, não aparece: o código digitado serve. */
export function LeitorDeQr({ aoLer, fechar }: { aoLer: (texto: string) => void; fechar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [aviso, setAviso] = useState("");
  useEffect(() => {
    let fluxo: MediaStream | null = null;
    let relogio = 0;
    let parado = false;
    (async () => {
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (parado || !video.current) return;
        video.current.srcObject = fluxo;
        await video.current.play();
        const Leitor = (window as unknown as { BarcodeDetector: new (opcoes: { formats: string[] }) => Detector }).BarcodeDetector;
        const leitor = new Leitor({ formats: ["qr_code"] });
        const ler = async () => {
          if (parado || !video.current) return;
          try {
            const achados = await leitor.detect(video.current);
            const valor = achados[0]?.rawValue;
            if (valor) {
              aoLer(valor);
              return;
            }
          } catch {
            // a câmera ainda está abrindo
          }
          relogio = window.setTimeout(ler, 300);
        };
        void ler();
      } catch {
        setAviso("Não foi possível abrir a câmera. Digite o código.");
      }
    })();
    return () => {
      parado = true;
      window.clearTimeout(relogio);
      fluxo?.getTracks().forEach((faixa) => faixa.stop());
    };
  }, [aoLer]);
  return (
    <div className="space-y-2">
      <video ref={video} muted playsInline className="aspect-square w-full max-w-xs rounded-md bg-[var(--pn-texto)] object-cover" aria-label="Câmera para ler o código" />
      <p className="flex flex-wrap items-center gap-4 text-xs">
        <span className="pn-ajuda inline-flex items-center gap-1.5"><Camera aria-hidden className="h-4 w-4" />Aponte para o código do outro aparelho.</span>
        <Botao variante="discreto" pequeno onClick={fechar}>Digitar em vez disso</Botao>
      </p>
      <Aviso texto={aviso} />
    </div>
  );
}

// ───────────────────────────── Aparelho pendente ─────────────────────────────

/**
 * A tela de um aparelho que ainda não foi aprovado: mostra o código (e o QR) para a pessoa aprovar de um aparelho já aprovado,
 * aceita a chave de recuperação, e tem a saída de emergência de quem perdeu todos os aparelhos.
 */
export function AparelhoPendente({ chaveiro }: { chaveiro: Chaveiro }) {
  const [chave, setChave] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmaRecomeco, setConfirmaRecomeco] = useState(false);
  const codigo = chaveiro.codigoDePedido;

  async function recuperar() {
    setOcupado(true);
    setAviso("");
    try {
      if (!(await chaveiro.recuperar(chave))) setAviso("Esta chave de recuperação não abre a sua cópia. Confira letra por letra.");
      else setAviso("Identidade recuperada. As conversas vão abrir em instantes.");
    } catch (erro) {
      setAviso(erro instanceof BackendError && erro.code === "sem_copia" ? "Não existe cópia de recuperação guardada para a sua conta." : textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  async function recomecarIdentidade() {
    setOcupado(true);
    setAviso("");
    try {
      await recomecar(chaveiro.usuario);
      window.location.reload();
    } catch (erro) {
      setAviso(textoDoErro(erro));
      setOcupado(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-5">
      <div className="pn-cabecalho" data-nivel={2}>
        <div className="pn-cabecalho-texto">
          <p className="pn-cabecalho-rotulo">Aparelho novo</p>
          <h2 className="pn-cabecalho-titulo">
            <span aria-hidden className="pn-cabecalho-icone"><MonitorSmartphone aria-hidden /></span>
            <span>Este aparelho ainda não foi aprovado</span>
          </h2>
          <p className="pn-cabecalho-sobre">
            As conversas só abrem em aparelhos que você aprovou. Abra o painel num aparelho que já funciona, vá em Conversas → Aparelhos, escolha este aparelho e digite o código abaixo (ou leia o QR). Até lá, nenhuma chave chega aqui.
          </p>
        </div>
      </div>
      {codigo ? (
        <Cartao as="div" variante="destaque" className="flex flex-wrap items-center gap-6">
          <Qr texto={qrDoPedido(codigo, chaveiro.publica)} rotulo="Código deste aparelho, para ler com a câmera de um aparelho aprovado" />
          <div>
            <p className={rotulo}>Código de aprovação</p>
            <p className="mt-1 font-mono text-3xl tracking-[0.3em]" aria-label={`Código ${codigo.split("").join(" ")}`}>
              {codigo.slice(0, 4)} {codigo.slice(4)}
            </p>
            <p className="pn-ajuda mt-2 max-w-xs">O código vale por um dia e só serve para este aparelho. Ninguém do instituto vai pedir esse código a você.</p>
          </div>
        </Cartao>
      ) : (
        <p role="status" className={rotulo}>Preparando o código…</p>
      )}
      <details className="pn-cartao">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold"><KeyRound aria-hidden className="h-4 w-4" />Tenho a chave de recuperação</summary>
        <p className="pn-ajuda mt-2">Se você guardou a chave de recuperação (oito grupos de quatro letras), ela restaura a sua identidade aqui, sem precisar de outro aparelho.</p>
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void recuperar(); }}>
          <label className="pn-rotulo block min-w-64 flex-1">
            Chave de recuperação
            <input value={chave} onChange={(e) => setChave(e.target.value)} autoComplete="off" spellCheck={false} placeholder="ABCD-EFGH-…" className="pn-campo mt-1 font-mono uppercase" />
          </label>
          <Botao type="submit" variante="principal" simbolo={KeyRound} carregando={ocupado} disabled={!chaveDeRecuperacaoValida(chave)}>Recuperar</Botao>
        </form>
      </details>
      <details className="pn-cartao pn-cartao-alerta">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold"><ShieldAlert aria-hidden className="h-4 w-4" />Perdi todos os aparelhos e não tenho a chave de recuperação</summary>
        <p className="pn-ajuda mt-2">
          Recomeçar a identidade remove todos os aparelhos antigos da conta e cria uma identidade nova neste. As conversas trocam de chave; o que foi escrito antes não abre mais aqui, e os colegas que tinham verificado você vão ver o aviso de que a sua chave de segurança mudou.
        </p>
        {confirmaRecomeco ? (
          <Botao perigo className="mt-3" simbolo={RotateCcw} carregando={ocupado} onClick={() => void recomecarIdentidade()}>
            Confirmar: recomeçar a identidade
          </Botao>
        ) : (
          <Botao className="mt-3" simbolo={RotateCcw} onClick={() => setConfirmaRecomeco(true)}>Recomeçar a identidade</Botao>
        )}
      </details>
      <Aviso texto={aviso} />
    </div>
  );
}

// ───────────────────────────── Aparelhos e aprovação ─────────────────────────────

interface Aparelho {
  id: string;
  rotulo: string;
  criado_em: string;
  visto_em: string;
  aprovado_em: string | null;
  estado: "aprovado" | "pendente";
}

/** Os aparelhos que abrem as conversas desta conta: aprovar os novos, remover os perdidos (remover troca a chave de todas as conversas). */
export function Aparelhos({ chaveiro }: { chaveiro: Chaveiro }) {
  const lista = useLista<Aparelho[]>("chat_aparelhos_meus");
  const [aviso, setAviso] = useState("");
  const [aprovando, setAprovando] = useState<Aparelho | null>(null);
  const [migrados] = useState(() => aparelhosMigrados(chaveiro.usuario));
  const pendentes = lista.dados?.filter((aparelho) => aparelho.estado === "pendente") ?? [];
  const { recarregar } = lista;
  // Aparelho novo pedindo aprovação aparece sozinho, sem recarregar.
  useEffect(() => {
    const relogio = window.setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, 20_000);
    return () => window.clearInterval(relogio);
  }, [recarregar]);

  async function remover(aparelho: Aparelho) {
    if (!(await confirmarFrase(`Remover "${aparelho.rotulo || "aparelho sem nome"}"? Ele deixa de abrir as conversas, e as conversas trocam de chave.`))) return;
    setAviso("");
    try {
      await rpc("chat_aparelho_remover", { p_id: aparelho.id });
      lista.recarregar();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  return (
    <details className="text-xs text-ink-soft" open={pendentes.length > 0 || migrados.length > 0 || undefined}>
      <summary className="inline-flex cursor-pointer flex-wrap items-center gap-1.5 hover:text-ink">
        <MonitorSmartphone aria-hidden className="h-3.5 w-3.5" />
        Aparelhos com acesso às suas conversas{lista.dados ? ` (${lista.dados.length})` : ""}
        {pendentes.length > 0 && <Selo tom="bordo" className="ml-1">{pendentes.length} para aprovar</Selo>}
      </summary>
      {migrados.length > 0 && (
        <Faixa tom="bordo" className="mt-2">
          Este aparelho passou a guardar a identidade das suas conversas e aprovou os seus aparelhos de antes: {migrados.map((item) => item.rotulo || "aparelho sem nome").join(", ")}. Não reconhece algum? Remova-o abaixo.
        </Faixa>
      )}
      <p className="mt-2">
        Cada aparelho tem a própria chave, criada no navegador, e só abre as conversas depois que você o aprova de um aparelho que já funciona. Se perder um celular ou não usar mais um computador, remova-o aqui. Remover não encerra a sessão: para isso, use “Sair de todos os aparelhos” em Minha conta.
      </p>
      <ul aria-label="Aparelhos" className="pn-lista pn-lista-plana mt-2">
        {lista.dados?.map((aparelho) => (
          <li key={aparelho.id} className="pn-item items-center">
            <MonitorSmartphone aria-hidden className="pn-item-simbolo" />
            <span className="pn-item-texto">
              <span className="pn-item-titulo">
                {aparelho.rotulo || "Aparelho sem nome"}
                {aparelho.id === chaveiro.aparelho && " (este)"}
              </span>
              <span className="pn-item-meta tabular-nums">desde {data(aparelho.criado_em)} · usado em {data(aparelho.visto_em)}</span>
            </span>
            {aparelho.estado === "pendente" && <Selo tom="aviso" ponto>aguardando aprovação</Selo>}
            <span className="pn-item-acoes">
              {aparelho.estado === "pendente" && chaveiro.estado === "aprovado" && (
                <Botao pequeno simbolo={Check} onClick={() => setAprovando(aparelho)}>Aprovar</Botao>
              )}
              {aparelho.id !== chaveiro.aparelho && (
                <Botao variante="discreto" pequeno perigo simbolo={Trash2} onClick={() => void remover(aparelho)}>Remover</Botao>
              )}
            </span>
          </li>
        ))}
      </ul>
      {aprovando && <Aprovacao chaveiro={chaveiro} aparelho={aprovando} fechar={() => { setAprovando(null); lista.recarregar(); }} />}
      <Recuperacao chaveiro={chaveiro} />
      <Aviso texto={lista.erro || aviso} />
    </details>
  );
}

/** Digitar o código (ou ler o QR) do aparelho novo e aprová-lo. */
function Aprovacao({ chaveiro, aparelho, fechar }: { chaveiro: Chaveiro; aparelho: Aparelho; fechar: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [lendo, setLendo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function aprovar(codigoDigitado: string, publicaLida?: string) {
    setOcupado(true);
    setAviso("");
    try {
      if (await chaveiro.aprovar(aparelho.id, codigoDigitado, publicaLida)) {
        setAviso("Aparelho aprovado. Ele passa a abrir as conversas em instantes.");
        window.setTimeout(fechar, 1500);
      } else setAviso("O código não confere com o que esse aparelho mostra. Confira na tela dele e tente de novo.");
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div role="dialog" aria-label={`Aprovar ${aparelho.rotulo || "aparelho"}`} className="pn-cartao pn-cartao-destaque mt-3 text-sm text-ink">
      <p className="pn-cartao-titulo">Aprovar “{aparelho.rotulo || "aparelho sem nome"}”</p>
      <p className="pn-ajuda mt-1">Digite os oito números que aparecem na tela desse aparelho. Só aprove se for você mesmo quem está entrando nele.</p>
      {lendo ? (
        <div className="mt-3">
          <LeitorDeQr
            fechar={() => setLendo(false)}
            aoLer={(texto) => {
              const lido = lerQrDoPedido(texto);
              if (!lido) return;
              setLendo(false);
              setCodigo(lido.codigo);
              void aprovar(lido.codigo, lido.publica);
            }}
          />
        </div>
      ) : (
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void aprovar(codigo); }}>
          <label className="pn-rotulo block">
            Código
            <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" placeholder="0000 0000" className="pn-campo mt-1 max-w-44 font-mono text-xl tracking-widest" />
          </label>
          <Botao type="submit" variante="principal" simbolo={Check} carregando={ocupado} disabled={codigo.length !== 8}>Aprovar</Botao>
          {temLeitor() && <Botao simbolo={Camera} onClick={() => setLendo(true)}>Ler o QR</Botao>}
          <Botao variante="discreto" onClick={fechar}>Cancelar</Botao>
        </form>
      )}
      <Aviso texto={aviso} />
    </div>
  );
}

/** A cópia de recuperação: a chave é sorteada aqui, mostrada uma vez, e nunca sai do aparelho. */
function Recuperacao({ chaveiro }: { chaveiro: Chaveiro }) {
  const situacao = useLista<{ copia: unknown; atualizado_em: string } | null>("chat_recuperacao_ler");
  const [nova, setNova] = useState<string | null>(null);
  const [anotei, setAnotei] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  if (chaveiro.estado !== "aprovado") return null;

  async function guardar() {
    const chave = novaChaveDeRecuperacao();
    setOcupado(true);
    setAviso("");
    try {
      await chaveiro.guardarCopia(chave);
      setNova(chave);
      setAnotei(false);
      situacao.recarregar();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mt-3 border-t border-rule pt-3">
      <p className="flex items-center gap-1.5 font-semibold text-ink"><KeyRound aria-hidden className="h-3.5 w-3.5" />Cópia de recuperação</p>
      <p className="mt-1">
        {situacao.dados ? `Cópia guardada em ${dataHora(situacao.dados.atualizado_em)}.` : "Nenhuma cópia guardada."} Sem a chave de recuperação, quem perde todos os aparelhos perde a identidade (os colegas veem que a sua chave mudou) e o histórico das conversas. A cópia é cifrada neste aparelho: o instituto não consegue abri-la.
      </p>
      {nova ? (
        <div role="status" className="pn-cartao pn-cartao-alerta mt-2 text-ink">
          <p className="font-semibold">Anote esta chave agora. Ela não vai aparecer de novo.</p>
          <p className="mt-2 select-all font-mono text-base tracking-wider">{nova}</p>
          <label className="pn-marca mt-2">
            <input type="checkbox" checked={anotei} onChange={(e) => setAnotei(e.target.checked)} />
            <span>Anotei num lugar seguro, fora deste aparelho.</span>
          </label>
          <Botao className="mt-2" disabled={!anotei} onClick={() => setNova(null)}>Fechar</Botao>
        </div>
      ) : (
        <Botao variante="discreto" pequeno className="mt-2" simbolo={KeyRound} carregando={ocupado} onClick={() => void guardar()}>
          {situacao.dados ? "Fazer uma cópia nova (a chave antiga deixa de valer)" : "Guardar uma cópia e gerar a chave de recuperação"}
        </Botao>
      )}
      <Aviso texto={aviso} />
    </div>
  );
}

// ───────────────────────────── Identidade dos colegas ─────────────────────────────

/** Os avisos de identidade de uma conversa, no fluxo: quem mudou, e quem está retido até você confirmar. */
export function Alertas({ chaveiro, conversa, alertas }: { chaveiro: Chaveiro; conversa: string; alertas: Alerta[] }) {
  const [ver, setVer] = useState<Alerta | null>(null);
  if (alertas.length === 0) return null;
  return (
    <div className="space-y-2" aria-live="polite">
      {alertas.map((alerta) => (
        <Faixa key={alerta.usuario} tom={alerta.tipo === "retida" ? "bordo" : "aviso"} className="mx-auto max-w-md text-xs">
          {alerta.tipo === "retida" ? (
            <>
              A chave de segurança de {alerta.nome} mudou, e você tinha verificado essa pessoa. Nada é entregue aos aparelhos novos dela até você confirmar, de preferência comparando o código de segurança pessoalmente.
            </>
          ) : (
            <>A chave de segurança de {alerta.nome} mudou (aparelhos novos ou identidade recomeçada). Se quiser ter certeza de que é a mesma pessoa, compare o código de segurança.</>
          )}
          <span className="mt-1 flex flex-wrap gap-2 font-normal">
            <Botao variante="discreto" pequeno simbolo={ShieldCheck} onClick={() => setVer(alerta)}>Ver o código de segurança</Botao>
            {alerta.tipo === "retida" ? (
              <Botao pequeno simbolo={Check} onClick={() => void chaveiro.confirmarNova(alerta.usuario)}>Confirmar a chave nova</Botao>
            ) : (
              <Botao variante="discreto" pequeno simbolo={Check} onClick={() => void chaveiro.dispensarAviso(alerta.usuario)}>Entendi</Botao>
            )}
          </span>
        </Faixa>
      ))}
      {ver && <Seguranca chaveiro={chaveiro} conversa={conversa} usuario={ver.usuario} nome={ver.nome} fechar={() => setVer(null)} />}
    </div>
  );
}

/** O código de segurança entre você e uma pessoa: sessenta números (e um QR) para comparar pessoalmente e marcar "verificado". */
export function Seguranca({ chaveiro, conversa, usuario, nome, fechar }: { chaveiro: Chaveiro; conversa: string; usuario: string; nome: string; fechar: () => void }) {
  const [codigo, setCodigo] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [aviso, setAviso] = useState("");
  const pessoa = chaveiro.pessoasDe(conversa).find((item) => item.usuario === usuario);
  const conhecida = chaveiro.conhecida(usuario);
  const minha = chaveiro.identidadePublica;
  // A identidade a comparar é a que este aparelho aceita (a retida, se houver, é a que a pessoa está decidindo aceitar).
  const dela = conhecida?.pendente ?? pessoa?.assina ?? conhecida?.assina ?? null;
  useEffect(() => {
    if (!minha || !dela) return;
    let cancelado = false;
    void codigoDeSeguranca(minha, dela).then((valor) => !cancelado && setCodigo(valor));
    return () => {
      cancelado = true;
    };
  }, [minha, dela]);

  return (
    <div role="dialog" aria-label={`Código de segurança com ${nome}`} className="pn-cartao mx-auto max-w-md text-sm text-ink">
      <p className="pn-cartao-titulo flex items-center gap-2">
        <ShieldCheck aria-hidden className="h-4 w-4 shrink-0" />
        Código de segurança com {nome}
      </p>
      <p className="pn-ajuda mt-1">
        Os sessenta números são iguais na tela de vocês dois quando as identidades são as verdadeiras. Compare pessoalmente, por telefone ou por um canal em que se reconheçam, e marque como verificado. Se alguém no meio do caminho tivesse trocado as chaves, os números seriam diferentes.
      </p>
      {!dela && <p className="mt-2 text-[var(--pn-aviso)]">{nome} ainda não tem identidade registrada (não abriu as conversas depois da atualização).</p>}
      {codigo && (
        <div className="mt-3 flex flex-wrap items-start gap-4">
          <Qr texto={qrDaSeguranca(codigo)} rotulo={`Código de segurança com ${nome}, para ler com a câmera`} />
          <p className="max-w-[14rem] font-mono text-base leading-relaxed tracking-wide" aria-label="Código de segurança">
            {codigoEmGrupos(codigo).split(" ").map((grupo, i) => (
              <span key={i} className="inline-block w-[4.4rem]">{grupo}</span>
            ))}
          </p>
        </div>
      )}
      {lendo && (
        <div className="mt-3">
          <LeitorDeQr
            fechar={() => setLendo(false)}
            aoLer={(texto) => {
              const lido = lerQrDaSeguranca(texto);
              if (!lido) return;
              setLendo(false);
              if (lido === codigo) {
                void chaveiro.marcarVerificada(usuario, true);
                setAviso("Os códigos conferem: identidade verificada.");
              } else setAviso("Os códigos NÃO conferem. Não marque como verificado e avise a coordenação.");
            }}
          />
        </div>
      )}
      <p className="mt-3 flex flex-wrap gap-2 text-xs">
        {conhecida?.verificado ? (
          <Botao variante="discreto" pequeno onClick={() => void chaveiro.marcarVerificada(usuario, false)}>Desmarcar verificado</Botao>
        ) : (
          dela && !conhecida?.pendente && <Botao variante="principal" pequeno simbolo={BadgeCheck} onClick={() => void chaveiro.marcarVerificada(usuario, true)}>Marcar como verificado</Botao>
        )}
        {temLeitor() && codigo && !lendo && <Botao pequeno simbolo={Camera} onClick={() => setLendo(true)}>Ler o QR do outro aparelho</Botao>}
        <Botao variante="discreto" pequeno simbolo={X} onClick={fechar}>Fechar</Botao>
      </p>
      <Aviso texto={aviso} />
    </div>
  );
}

/** Como a cifra funciona, em poucas linhas, para quem quiser saber. */
export function ComoFunciona() {
  return (
    <details className="text-xs text-ink-soft">
      <summary className={`${rotulo} cursor-pointer hover:text-ink`}>Sigilo</summary>
      <div className="mt-2 space-y-1.5">
        <p>Tudo é cifrado neste aparelho antes de sair, e só os aparelhos de quem participa da conversa abrem. O banco do instituto guarda apenas o texto cifrado: quem tiver acesso a ele, inclusive a coordenação, não lê as conversas.</p>
        <p>Cada aparelho novo precisa ser aprovado por um aparelho seu que já funciona, com um código. Os colegas só entregam chaves a aparelhos aprovados por você: nem quem controla o banco consegue pôr um aparelho falso na sua conta. Cada mensagem leva a sua assinatura.</p>
        <p>Quando alguém sai de um grupo, a chave é trocada na mensagem seguinte; de tempos em tempos ela é trocada de qualquer jeito. Nada fica guardado por mais de 30 dias, e a autodestruição apaga antes.</p>
        <p>Não escreva endereço, telefone nem documento de ninguém, mesmo aqui.</p>
      </div>
    </details>
  );
}
