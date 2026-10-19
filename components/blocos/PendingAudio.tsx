// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { previewFile } from "@/lib/upload";

/** Gravação enviada que ainda não foi publicada: quem está no painel ouve pela cópia do depósito fechado. */
export function PendingAudio({ path }: { path: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let cancelado = false;
    let criado = "";
    previewFile(path)
      .then((endereco) => {
        criado = endereco;
        if (cancelado) URL.revokeObjectURL(endereco);
        else setSrc(endereco);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
      if (criado) URL.revokeObjectURL(criado);
    };
  }, [path]);
  return src ? <audio controls preload="none" src={src} className="h-9" /> : <span className="font-mono text-xs text-ink-soft">🎙 …</span>;
}
