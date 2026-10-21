// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A moldura das ferramentas novas: "Como usar" em três linhas, as atividades guiadas e, quando o texto explicativo foi
// preparado com ajuda de IA, o aviso de que está em revisão. Os exercícios estão em português.

export function ComoUsar({ passos, atividades, revisao = false, fonte }: { passos: [string, string, string]; atividades: string[]; revisao?: boolean; fonte?: React.ReactNode }) {
  return (
    <div className="mt-6 grid gap-4 font-sans text-sm md:grid-cols-2">
      <section className="rounded-md border-2 border-ink/20 bg-parchment-deep p-4">
        <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-oxblood">Como usar</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">{passos.map((p) => <li key={p}>{p}</li>)}</ol>
      </section>
      <section className="rounded-md border-2 border-dashed border-ink/30 p-4">
        <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-oxblood">Atividades</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">{atividades.map((p) => <li key={p}>{p}</li>)}</ol>
      </section>
      {(revisao || fonte) && (
        <p className="border-l-4 border-gold pl-3 text-xs text-ink-soft md:col-span-2">
          {revisao && <><strong>Explicações preparadas com ajuda de IA, em revisão pela equipe.</strong> </>}
          {fonte}
        </p>
      )}
    </div>
  );
}

/** Voz do navegador (síntese, nunca reconhecimento). Algumas vozes do sistema podem ser processadas fora do aparelho. */
export function falar(texto: string, lang: string, rate = 0.85) {
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = lang;
    u.rate = rate;
    const voz = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)) && v.localService);
    if (voz) u.voice = voz;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}
export const AVISO_DE_VOZ = "A voz é a do seu navegador. Algumas vozes do sistema são processadas fora do aparelho; nada do que você digita é enviado por este site.";
