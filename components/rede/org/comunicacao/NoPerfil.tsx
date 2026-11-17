// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O que a comunicação da organização (onda 12, frente 12E) mostra na cabeça do perfil: o domínio verificado (só organização com
// selo, depois da prova) e o pedido do boletim (na Alumia e, se a pessoa quiser, por e-mail). Ninguém vê quem pediu o boletim.
import { useEffect, useId, useState } from "react";
import { clienteDaComunicacao } from "@/lib/rede/cliente-org-comunicacao";
import { dataCurta } from "@/lib/rede/org/contagem";
import type { DominioVerificado, MeuBoletim } from "@/lib/rede/org/comunicacao";
import { preencher } from "@/lib/rede/preencher";
import { fraseDaComunicacao, useTextosDaComunicacao } from "@/lib/rede/textos-org-comunicacao";
import { Botao } from "../../ui/Botao";
import "./comunicacao.css";

/** O domínio que a organização provou ser dela. O link sai sem o endereço de quem clica (noreferrer) e sem seguir por robôs. */
export function DominioNoPerfil({ handle, lang }: { handle: string; lang: string }) {
  const t = useTextosDaComunicacao(lang);
  const [d, setD] = useState<DominioVerificado | null>(null);
  useEffect(() => {
    let vivo = true;
    clienteDaComunicacao().dominio(handle).then((r) => vivo && setD(r), () => undefined);
    return () => {
      vivo = false;
    };
  }, [handle]);
  if (!t || !d) return null;
  return (
    <span className="o12-dominio-perfil" title={preencher(t.perfil.dominioTitulo, { data: dataCurta(d.desde, lang) })}>
      <span className="o12-dominio-perfil-marca" aria-hidden="true" />
      <span className="o12-dominio-perfil-rotulo">{t.perfil.dominio}</span>
      <a href={`https://${d.dominio}`} rel="me noreferrer nofollow" target="_blank">{d.dominio}</a>
    </span>
  );
}

/** Pedir o boletim desta organização (só para quem é membro da Alumia; o banco devolve nulo para os outros). */
export function BoletimNoPerfil({ handle, lang }: { handle: string; lang: string }) {
  const t = useTextosDaComunicacao(lang);
  const id = useId();
  const [b, setB] = useState<MeuBoletim | null>(null);
  const [email, setEmail] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    clienteDaComunicacao().meuBoletim(handle).then((r) => {
      if (!vivo) return;
      setB(r);
      setEmail(Boolean(r?.email));
    }, () => undefined);
    return () => {
      vivo = false;
    };
  }, [handle]);
  if (!t || !b) return null;

  async function mudar(sim: boolean, comEmail: boolean) {
    setOcupado(true);
    setErro("");
    try {
      const r = await clienteDaComunicacao().assinarBoletim(handle, sim, comEmail);
      setB(r);
      setEmail(r.email);
    } catch (e) {
      setErro(fraseDaComunicacao(t!, e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="o12-boletim-perfil" aria-labelledby={`${id}-b`} data-assino={b.assino ? "" : undefined}>
      <div className="o12-boletim-perfil-texto">
        <h2 id={`${id}-b`} className="al-cond">{t.perfil.boletim}</h2>
        <p>{b.assino ? (b.email ? t.perfil.assinoEmail : t.perfil.assino) : t.perfil.boletimAjuda}</p>
      </div>
      <div className="o12-boletim-perfil-acoes">
        {/* Primeiro assinar na Alumia; só depois a opção do e-mail (a linha inteira, com o rótulo, é o alvo de 44 px). */}
        {b.assino ? (
          <>
            <label className="o12-check">
              <input type="checkbox" checked={email} disabled={ocupado} onChange={(e) => void mudar(true, e.target.checked)} />
              {t.perfil.porEmail}
            </label>
            <Botao variante="contorno" tamanho="p" pilula disabled={ocupado} onClick={() => void mudar(false, false)}>{t.perfil.parar}</Botao>
          </>
        ) : (
          <Botao variante="dourado" tamanho="p" pilula disabled={ocupado} onClick={() => void mudar(true, false)}>{t.perfil.naAlumia}</Botao>
        )}
      </div>
      {b.assino && email ? <p className="al-perfil-nota o12-boletim-perfil-nota">{t.perfil.emailNota}</p> : null}
      {erro ? <p className="al-perfil-erro" role="alert">{erro}</p> : null}
    </section>
  );
}
