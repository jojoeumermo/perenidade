// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

/**
 * Ícones de perfil. Os predefinidos são desenhos nossos, no traço dos cartazes construtivistas (vermelho, creme e
 * preto): qualquer pessoa escolhe um. A liderança pode subir uma imagem pequena (webp, até 40 KB) em vez deles.
 */
export const AVATARES: { id: string; nome: string; d: string; cheio?: boolean }[] = [
  { id: "estrela", nome: "Estrela", d: "M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.7L12 17.5l-5.9 3.3 1.3-6.7L2.5 9.5l6.6-.8z", cheio: true },
  { id: "punho", nome: "Punho erguido", d: "M9 21v-5.5M15 21v-5.5M7 15.5V9a1.5 1.5 0 013 0V7a1.5 1.5 0 013 0v1a1.5 1.5 0 013 0v1.5a1.5 1.5 0 013 0v6a5 5 0 01-5 5h-4a5 5 0 01-5-5z" },
  { id: "engrenagem", nome: "Engrenagem", d: "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" },
  { id: "trigo", nome: "Espiga de trigo", d: "M12 22V8M12 8c-3 0-4-2-4-4 2 0 4 1 4 4zm0 0c3 0 4-2 4-4-2 0-4 1-4 4zm0 5c-3 0-4-2-4-4 2 0 4 1 4 4zm0 0c3 0 4-2 4-4-2 0-4 1-4 4zm0 5c-3 0-4-2-4-4 2 0 4 1 4 4zm0 0c3 0 4-2 4-4-2 0-4 1-4 4z" },
  { id: "livro", nome: "Livro aberto", d: "M3 5.5c3-1 6-1 9 1 3-2 6-2 9-1v13c-3-1-6-1-9 1-3-2-6-2-9-1zM12 6.5v13" },
  { id: "pomba", nome: "Pomba", d: "M3 12c4 1 7 0 9-3l2-4 1 4 6 1-5 2c-1 4-4 7-9 7l-2 2v-3c-1 0-2-1-2-6z" },
  { id: "bandeira", nome: "Bandeira", d: "M5 22V3M5 4h13l-3 4 3 4H5" },
  { id: "locomotiva", nome: "Locomotiva", d: "M3 16h18M5 16V9h7V6h4v3h3v7M8 20a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm8 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM14 4h4" },
  { id: "satelite", nome: "Satélite", d: "M12 12a3 3 0 100-6 3 3 0 000 6zM12 12l7 8M12 12l-8 6M12 12l5-9M12 12l-9-3" },
  { id: "fabrica", nome: "Fábrica", d: "M3 21V10l5 3v-3l5 3v-3l5 3V5h3v16zM7 17h2M12 17h2M17 17h2" },
  { id: "tocha", nome: "Tocha", d: "M10 22h4l1-9H9zM12 2c2 3 4 4 4 7a4 4 0 01-8 0c0-2 1-3 2-4 0 2 1 3 2 3 1-2 0-4 0-6z" },
  { id: "martelo", nome: "Martelo", d: "M3 21l9-9M12 12l-3-3 5-5 3 3 3-3 2 2-5 5 1 1-3 3z" },
  { id: "lapis", nome: "Lápis", d: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" },
  { id: "microfone", nome: "Microfone", d: "M12 15a4 4 0 004-4V6a4 4 0 00-8 0v5a4 4 0 004 4zM6 11a6 6 0 0012 0M12 17v4M9 21h6" },
  { id: "globo", nome: "Globo", d: "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" },
  { id: "folha", nome: "Folha", d: "M20 4C9 4 4 10 4 20c10 0 16-5 16-16zM4 20L16 8" },
];

const CORES = ["#c21f16", "#17130e", "#6e1f1a", "#8a5a16"];
const corDe = (nome: string) => CORES[[...nome].reduce((n, c) => n + c.charCodeAt(0), 0) % CORES.length];

export const iniciaisDe = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");

/** O rosto de uma pessoa: o ícone escolhido, a imagem subida ou as iniciais. */
export function Avatar({ nome, avatar, className = "h-10 w-10", texto = "" }: { nome: string; avatar?: string | null; className?: string; texto?: string }) {
  const base = `flex shrink-0 items-center justify-center overflow-hidden ${className}`;
  if (avatar?.startsWith("data:image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatar} alt="" className={`${base} object-cover`} />;
  }
  const pre = avatar?.startsWith("p:") ? AVATARES.find((a) => a.id === avatar.slice(2)) : null;
  if (pre) {
    return (
      <span aria-hidden className={base} style={{ background: corDe(nome) }}>
        <svg viewBox="0 0 24 24" className="h-[70%] w-[70%]" fill={pre.cheio ? "#f4ecd8" : "none"} stroke="#f4ecd8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={pre.d} /></svg>
      </span>
    );
  }
  return (
    <span aria-hidden className={`${base} bg-ink font-semibold text-parchment ${texto}`}>
      {iniciaisDe(nome)}
    </span>
  );
}

/** Reduz uma imagem a um quadrado pequeno em webp (até 40 KB, o limite do banco). Tudo no aparelho. */
export async function imagemParaAvatar(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => erro(new Error("imagem"));
      i.src = url;
    });
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    const tela = document.createElement("canvas");
    tela.width = 128;
    tela.height = 128;
    tela.getContext("2d")!.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, 128, 128);
    for (const q of [0.85, 0.7, 0.5, 0.3]) {
      const dado = tela.toDataURL("image/webp", q);
      if (dado.length <= 40000) return dado;
    }
    throw new Error("grande");
  } finally {
    URL.revokeObjectURL(url);
  }
}
