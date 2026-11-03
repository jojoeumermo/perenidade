// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Locale } from "@/i18n/config";
import type { TextosDaVida } from "@/i18n/escola/vida";
import type { VozPublica } from "@/lib/escola/vida";

/**
 * As vozes publicadas com autorização, com a transcrição visível ao lado de cada áudio, apelido e ofício, sem foto. Sem
 * JavaScript o navegador ainda toca o áudio. Lista vazia mostra o estado vazio (que explica como uma voz entra).
 */
export function ListaDeVozes({ vozes, s }: { vozes: VozPublica[]; s: TextosDaVida["vozes"]["publicadas"]; lang?: Locale }) {
  if (vozes.length === 0)
    return (
      <p className="vida-aviso" data-vozes-vazio="">
        {s.vazio}
      </p>
    );
  return (
    <ul className="vida-lista" data-vozes-publicadas="">
      {vozes.map((v) => (
        <li key={v.id}>
          <p className="font-semibold">
            {v.apelido} · <span className="vida-nota">{v.oficio}</span>
          </p>
          <audio className="vida-audio" controls preload="none" src={v.arquivo} />
          <p className="vida-nota">
            <span className="font-semibold">{s.transcricao}.</span> <span lang="pt">{v.transcricao}</span>
          </p>
          <p className="vida-nota">{s.autorizada}</p>
        </li>
      ))}
    </ul>
  );
}