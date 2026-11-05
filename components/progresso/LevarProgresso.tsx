// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import type { TextosDoProgressoQr } from "@/i18n/progresso-qr";
import { BackendError, rpc } from "@/lib/backend";
import { entraNaCopia } from "@/lib/estudo";
import {
  abrirPacote, cabeNoQr, codigoDigitavel, juntarDados, lerCodigoDigitado, lerQr, LIMITE_DO_SERVIDOR, montarDados, novoId, qrComCodigo, qrComPacote, selarPacote,
} from "@/lib/progresso-qr";
import { KEYS, setItem } from "@/lib/storage";

const acao = "cursor-pointer border-2 border-ink px-5 py-2.5 font-medium hover:border-oxblood hover:text-oxblood";
const campo = "mt-1 block w-full rounded-md border border-rule bg-parchment px-3 py-2 font-mono text-ink";

// O que viaja é o que a cópia de segurança de Meus dados já leva (as chaves do site e as de estudo). A sessão da conta, o nome e a
// marca do aparelho não vão: são credencial, não dado de estudo (a mesma regra de components/DataPanel.tsx).
const fora: string[] = [KEYS.session, KEYS.name, KEYS.seen, KEYS.site, KEYS.device];
const portateis: string[] = Object.values(KEYS).filter((chave) => !fora.includes(chave));
const permitida = (chave: string) => portateis.includes(chave) || entraNaCopia(chave);

/** O armazenamento do navegador, avisando os componentes quando algo muda (a lista de aulas concluídas, por exemplo). */
const armazenamento = {
  getItem: (chave: string) => {
    try {
      return localStorage.getItem(chave);
    } catch {
      return null;
    }
  },
  setItem: (chave: string, valor: string) => setItem(chave, valor),
};

const temCamera = () => typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";

/** Um QR desenhado no próprio aparelho (a biblioteca só é baixada quando a pessoa pede o QR; nada sai para fora). */
function Qr({ texto, descricao }: { texto: string; descricao: string }) {
  const [imagem, setImagem] = useState("");
  useEffect(() => {
    let cancelado = false;
    import("qrcode")
      .then((qrcode) => qrcode.toDataURL(texto, { errorCorrectionLevel: "M", margin: 2, width: 280, color: { dark: "#1f1a14", light: "#ffffff" } }))
      .then((url) => !cancelado && setImagem(url))
      .catch(() => !cancelado && setImagem(""));
    return () => {
      cancelado = true;
    };
  }, [texto]);
  if (!imagem) return <div aria-hidden className="h-[280px] w-[280px] bg-parchment-deep" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imagem} alt={descricao} width={280} height={280} className="border border-rule bg-white" />;
}

type Detector = { detect: (fonte: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

/**
 * Lê um QR com a câmera. Usa o leitor do próprio navegador (BarcodeDetector) quando existe; senão, uma biblioteca pequena e
 * aberta (jsQR, Apache-2.0) baixada só agora, por dynamic import. A imagem da câmera nunca sai do aparelho.
 */
function Leitor({ t, aoLer, fechar }: { t: TextosDoProgressoQr; aoLer: (texto: string) => void; fechar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [aviso, setAviso] = useState("");
  const aoLerRef = useRef(aoLer);
  useEffect(() => {
    aoLerRef.current = aoLer;
  }, [aoLer]);
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
        const Nativo = (window as unknown as { BarcodeDetector?: new (opcoes: { formats: string[] }) => Detector }).BarcodeDetector;
        let ler: () => Promise<string | null>;
        if (Nativo) {
          const detector = new Nativo({ formats: ["qr_code"] });
          ler = async () => (await detector.detect(video.current!))[0]?.rawValue ?? null;
        } else {
          const { default: jsQR } = await import("jsqr");
          const tela = document.createElement("canvas");
          const contexto = tela.getContext("2d", { willReadFrequently: true });
          ler = async () => {
            const v = video.current;
            if (!v || !contexto || !v.videoWidth) return null;
            const escala = Math.min(1, 640 / v.videoWidth);
            tela.width = Math.round(v.videoWidth * escala);
            tela.height = Math.round(v.videoHeight * escala);
            contexto.drawImage(v, 0, 0, tela.width, tela.height);
            const imagem = contexto.getImageData(0, 0, tela.width, tela.height);
            return jsQR(imagem.data, imagem.width, imagem.height, { inversionAttempts: "dontInvert" })?.data ?? null;
          };
        }
        const volta = async () => {
          if (parado || !video.current) return;
          try {
            const valor = await ler();
            if (valor) {
              aoLerRef.current(valor);
              return;
            }
          } catch {
            // a câmera ainda está abrindo
          }
          relogio = window.setTimeout(volta, 250);
        };
        void volta();
      } catch {
        setAviso(t.erroCamera);
      }
    })();
    return () => {
      parado = true;
      window.clearTimeout(relogio);
      fluxo?.getTracks().forEach((faixa) => faixa.stop());
    };
  }, [t.erroCamera]);
  return (
    <div className="space-y-2">
      <video ref={video} muted playsInline className="aspect-square w-full max-w-xs bg-ink object-cover" aria-label={t.cameraAviso} />
      <p className="flex flex-wrap gap-4 text-xs">
        <span className="text-ink-soft">{t.cameraAviso}</span>
        <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={fechar}>
          {t.fecharCamera}
        </button>
      </p>
      {aviso && (
        <p role="alert" className="text-oxblood">
          {aviso}
        </p>
      )}
    </div>
  );
}

/** A frase certa para cada erro do servidor ou do pacote. */
function textoDoErro(erro: unknown, t: TextosDoProgressoQr): string {
  const codigo = erro instanceof BackendError ? erro.message : erro instanceof Error ? erro.message : "";
  if (/sem_servico|banco_desatualizado/.test(codigo)) return t.erroServico;
  if (/sem_conexao/.test(codigo)) return t.erroConexao;
  if (/muitos_pedidos/.test(codigo)) return t.erroMuitos;
  if (/servico_cheio/.test(codigo)) return t.erroCheio;
  if (/pacote_grande|grande_demais/.test(codigo)) return t.erroGrande;
  return t.erroFalha;
}

interface Origem {
  qr: string;
  /** O código para digitar; só existe quando o pacote foi para o servidor (o pacote dentro do QR é grande demais para digitar). */
  codigo: string | null;
}

/**
 * Levar o progresso e as anotações para outro aparelho, sem conta (lib/progresso-qr.ts). Tudo é cifrado aqui, no aparelho; o
 * servidor só entra quando o pacote não cabe no QR, e então só guarda o texto cifrado (a chave nunca vai).
 */
export function LevarProgresso({ t }: { t: TextosDoProgressoQr }) {
  const [origem, setOrigem] = useState<Origem | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [codigo, setCodigo] = useState("");

  async function gerar() {
    setOcupado(true);
    setAviso({ texto: t.preparando, erro: false });
    setOrigem(null);
    try {
      const dados = montarDados(localStorage, permitida);
      if (Object.keys(dados).length === 0) {
        setAviso({ texto: t.vazio, erro: true });
        return;
      }
      const { chave, pacote } = await selarPacote(dados);
      const dentro = qrComPacote(chave, pacote);
      if (cabeNoQr(dentro)) {
        setOrigem({ qr: dentro, codigo: null });
        setAviso({ texto: t.modoDentro, erro: false });
        return;
      }
      if (pacote.length > LIMITE_DO_SERVIDOR) {
        setAviso({ texto: t.erroGrande, erro: true });
        return;
      }
      // Não cabe: o pacote JÁ CIFRADO espera no servidor; só o código dele e a chave vão no QR (a chave não é enviada).
      let id = novoId();
      for (let tentativa = 0; ; tentativa++) {
        try {
          await rpc<{ ok: boolean }>("progresso_qr_guardar", { p_id: id, p_blob: pacote });
          break;
        } catch (erro) {
          if (tentativa < 2 && erro instanceof BackendError && /id_em_uso/.test(erro.message)) {
            id = novoId();
            continue;
          }
          throw erro;
        }
      }
      setOrigem({ qr: qrComCodigo(id, chave), codigo: codigoDigitavel(id, chave) });
      setAviso({ texto: t.modoServidor, erro: false });
    } catch (erro) {
      setAviso({ texto: textoDoErro(erro, t), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  function esquecer() {
    setOrigem(null);
    setAviso(null);
  }

  const receber = useCallback(
    async (texto: string, digitado: boolean) => {
      setLendo(false);
      setOcupado(true);
      setOrigem(null);
      setAviso({ texto: t.ocupado, erro: false });
      try {
        const qr = lerQr(texto);
        const digitou = digitado ? lerCodigoDigitado(texto) : null;
        const lido = qr ?? (digitou ? ({ tipo: "codigo", id: digitou.id, chave: digitou.chave } as const) : null);
        if (!lido) {
          setAviso({ texto: digitado ? t.erroCodigo : t.erroAbrir, erro: true });
          return;
        }
        let pacote: string;
        if (lido.tipo === "pacote") pacote = lido.pacote;
        else {
          const r = await rpc<{ achou: boolean; blob?: string }>("progresso_qr_buscar", { p_id: lido.id });
          if (!r.achou || !r.blob) {
            setAviso({ texto: t.erroNaoAchou, erro: true });
            return;
          }
          pacote = r.blob;
        }
        const dados = await abrirPacote(lido.chave, pacote);
        if (!dados) {
          setAviso({ texto: t.erroAbrir, erro: true });
          return;
        }
        const n = juntarDados(dados, armazenamento, permitida);
        window.dispatchEvent(new Event("lucia:estudo"));
        setCodigo("");
        setAviso({ texto: n > 0 ? fill(t.feito, { n }) : t.nada, erro: false });
      } catch (erro) {
        setAviso({ texto: textoDoErro(erro, t), erro: true });
      } finally {
        setOcupado(false);
      }
    },
    [t],
  );

  return (
    <section className="mt-10 border-t border-rule pt-6 font-sans text-sm" aria-labelledby="levar-progresso">
      <h2 id="levar-progresso" className="font-serif text-2xl font-semibold">
        {t.titulo}
      </h2>
      <p className="mt-2 text-ink-soft">{t.lead}</p>
      <p className="mt-2 text-ink-soft">{t.segredo}</p>
      <div className="mt-6 grid gap-8 sm:grid-cols-2">
        <div>
          <h3 className="font-semibold">{t.enviarTitulo}</h3>
          <p className="mt-1 text-ink-soft">{t.enviarTexto}</p>
          <button type="button" className={`${acao} mt-3`} disabled={ocupado} onClick={() => void gerar()}>
            {t.enviarBotao}
          </button>
          {origem && (
            <div className="mt-4 space-y-3">
              <Qr texto={origem.qr} descricao={t.qrAlt} />
              {origem.codigo && (
                <p>
                  <span className="block text-ink-soft">{t.codigoRotulo}</span>
                  <span className="mt-1 block font-mono text-base tracking-wide">{origem.codigo}</span>
                </p>
              )}
              <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={esquecer}>
                {t.esquecer}
              </button>
            </div>
          )}
        </div>
        <div>
          <h3 className="font-semibold">{t.receberTitulo}</h3>
          <p className="mt-1 text-ink-soft">{t.receberTexto}</p>
          {lendo ? (
            <div className="mt-3">
              <Leitor t={t} aoLer={(texto) => void receber(texto, false)} fechar={() => setLendo(false)} />
            </div>
          ) : (
            <>
              {temCamera() && (
                <button type="button" className={`${acao} mt-3`} disabled={ocupado} onClick={() => setLendo(true)}>
                  {t.lerQr}
                </button>
              )}
              <form
                className="mt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void receber(codigo, true);
                }}
              >
                <label className="block">
                  {t.codigoCampo}
                  <input value={codigo} onChange={(e) => setCodigo(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={60} className={campo} />
                </label>
                <button type="submit" className={`${acao} mt-3`} disabled={ocupado || codigo.trim() === ""}>
                  {t.codigoBotao}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      <p role={aviso?.erro ? "alert" : "status"} className={`mt-4 ${aviso?.erro ? "text-oxblood" : "text-ink-soft"}`}>
        {aviso?.texto ?? ""}
      </p>
    </section>
  );
}
