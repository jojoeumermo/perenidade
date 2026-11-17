// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import { contaSegura, type AparelhoConectado } from "@/lib/rede/seguranca/cliente";
import { Icone } from "../publicar/alumia2/icones";
import { Botao } from "../ui/Botao";
import { diaLegivel, nomeDoAparelho, por, textoDoErro, type T } from "./base";

type Estado = { tipo: "carregando" } | { tipo: "indisponivel" } | { tipo: "pronto"; aparelhos: AparelhoConectado[] };

/**
 * Os aparelhos com a conta aberta (sessões do serviço de contas): navegador, sistema, o dia em que entrou e o da última atividade.
 * Nunca o endereço de rede. Cada um pode ser desconectado; "todos os outros" pede uma confirmação curta. Este aparelho não sai por
 * aqui (para sair dele, o Sair; para sair de tudo, o pânico).
 */
export function ListaDeAparelhos({ t, lang, aoMudar }: { t: T; lang: string; aoMudar?: (n: number) => void }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);

  const aplicar = useCallback(
    (r: { disponivel: boolean; aparelhos: AparelhoConectado[] }) => {
      if (!r.disponivel) return setEstado({ tipo: "indisponivel" });
      setEstado({ tipo: "pronto", aparelhos: r.aparelhos });
      aoMudar?.(r.aparelhos.length);
    },
    [aoMudar],
  );
  const falhou = useCallback(
    (e: unknown) => {
      setEstado({ tipo: "indisponivel" });
      setNota({ texto: textoDoErro(t, e), erro: true });
    },
    [t],
  );
  const carregar = () => contaSegura.aparelhos().then(aplicar, falhou);

  useEffect(() => {
    let vivo = true;
    contaSegura.aparelhos().then((r) => vivo && aplicar(r), (e) => vivo && falhou(e));
    return () => {
      vivo = false;
    };
  }, [aplicar, falhou]);

  async function desconectar(id?: string) {
    setOcupado(id ?? "todos");
    setNota(null);
    try {
      await contaSegura.desconectar(id);
      setNota({ texto: id ? t.aparelhos.desconectado : t.aparelhos.desconectados });
      setConfirmando(false);
      await carregar();
    } catch (e) {
      setNota({ texto: textoDoErro(t, e), erro: true });
    } finally {
      setOcupado(null);
    }
  }

  if (estado.tipo === "carregando") {
    return (
      <ul className="sg-aparelhos" aria-busy="true" aria-label={t.carregando}>
        {[0, 1].map((i) => (
          <li key={i} className="sg-aparelho sg-aparelho-esqueleto" />
        ))}
      </ul>
    );
  }
  if (estado.tipo === "indisponivel") {
    return (
      <>
        <p className="sg-cinza">{t.aparelhos.indisponivel}</p>
        {nota && <p role="status" className={nota.erro ? "sg-nota sg-nota-erro" : "sg-nota"}>{nota.texto}</p>}
      </>
    );
  }

  const outros = estado.aparelhos.filter((a) => !a.este);
  return (
    <>
      <ul className="sg-aparelhos">
        {estado.aparelhos.map((a) => (
          <li key={a.id} className="sg-aparelho" data-este={a.este || undefined}>
            <span className="sg-aparelho-icone" aria-hidden>
              <Icone nome={a.sistema === "android" || a.sistema === "ios" ? "celular" : "aparelho"} className="h-5 w-5" />
            </span>
            <div className="sg-aparelho-corpo">
              <p className="sg-aparelho-nome">
                {nomeDoAparelho(t, a)}
                {a.este && <span className="sg-marca sg-marca-este al-cond">{t.aparelhos.este}</span>}
              </p>
              {!a.confirmado && (
                <p className="sg-aparelho-sem-codigo">
                  <span className="sg-marca sg-marca-alerta">{t.aparelhos.semCodigo}</span> {t.aparelhos.semCodigoAjuda}
                </p>
              )}
              <p className="sg-aparelho-dias">
                <span>{por(t.aparelhos.ultima, { dia: diaLegivel(t, lang, a.ultima) })}</span>
                <span aria-hidden> · </span>
                <span>{por(t.aparelhos.desde, { dia: diaLegivel(t, lang, a.desde) })}</span>
              </p>
            </div>
            {!a.este && (
              <Botao variante="contorno" tamanho="p" className="sg-aparelho-sair" disabled={ocupado !== null} aria-busy={ocupado === a.id || undefined} onClick={() => void desconectar(a.id)}>
                {t.aparelhos.desconectar}
              </Botao>
            )}
          </li>
        ))}
      </ul>

      {outros.length === 0 ? (
        <p className="sg-cinza sg-so">
          <Icone nome="visto" className="h-4 w-4" grosso />
          {t.aparelhos.so}
        </p>
      ) : confirmando ? (
        <div className="sg-confirma" role="group" aria-label={t.aparelhos.desconectarOutros}>
          <p>{t.aparelhos.confirmarOutros}</p>
          <div className="sg-acoes">
            <Botao variante="primario" tamanho="m" disabled={ocupado !== null} aria-busy={ocupado === "todos" || undefined} onClick={() => void desconectar()}>
              {t.aparelhos.confirmar}
            </Botao>
            <Botao variante="fantasma" tamanho="m" onClick={() => setConfirmando(false)}>{t.aparelhos.cancelar}</Botao>
          </div>
        </div>
      ) : (
        <div className="sg-acoes">
          <Botao variante="contorno" tamanho="m" icone={<Icone nome="sair" className="h-4 w-4" />} disabled={ocupado !== null} onClick={() => setConfirmando(true)}>
            {t.aparelhos.desconectarOutros}
          </Botao>
        </div>
      )}
      {nota && <p role="status" className={nota.erro ? "sg-nota sg-nota-erro" : "sg-nota"}>{nota.texto}</p>}
    </>
  );
}
