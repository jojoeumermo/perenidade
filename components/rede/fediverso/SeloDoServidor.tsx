// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { preencher } from "@/lib/rede/preencher";
import { Icone } from "../publicar/alumia2/icones";

/**
 * A pílula com o globo que marca gente de fora (pranchas computador-inicio e celular-conversa-fediverso): no computador
 * "do Fediverso · mastodon.social"; no celular só o servidor. `rotulo` é o texto com {servidor} (cartao.doFediverso); sem ele, ou
 * com `curto`, aparece só o servidor em qualquer largura. Serve ao cartão, ao fio e aos avisos.
 */
export function SeloDoServidor({ servidor, rotulo, curto = false, className = "" }: { servidor: string; rotulo?: string; curto?: boolean; className?: string }) {
  if (!servidor) return null;
  const inteiro = rotulo && !curto ? preencher(rotulo, { servidor }) : null;
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--al-superficie-2)] px-1.5 py-0.5 text-[0.6875rem] font-semibold text-[var(--al-texto-2)] ${className}`.trim()}>
      <Icone nome="fediverso" className="h-3.5 w-3.5 shrink-0" />
      {inteiro ? (
        <>
          <span className="truncate md:hidden">{servidor}</span>
          <span className="hidden truncate md:inline">{inteiro}</span>
        </>
      ) : (
        <span className="truncate">{servidor}</span>
      )}
    </span>
  );
}

export default SeloDoServidor;
