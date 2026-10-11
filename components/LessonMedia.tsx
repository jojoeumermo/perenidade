// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { previewFile } from "@/lib/upload";
import { useI18n } from "./I18n";

/** Servidores de vídeo livres (PeerTube) aceitos além dos dois grandes. Lista em NEXT_PUBLIC_VIDEO_HOSTS, separada por vírgula. */
export const videoHosts = (process.env.NEXT_PUBLIC_VIDEO_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter((host) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host));

interface Embed {
  src: string;
  host: string;
}

/** Só endereços de vídeo conhecidos viram quadro embutido; qualquer outro vira um link comum. */
export function embedOf(address: string): Embed | null {
  let url: URL;
  try {
    url = new URL(address.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const id = /^[A-Za-z0-9_-]{6,40}$/;
  if (host === "youtube.com" || host === "m.youtube.com") {
    const video = url.pathname === "/watch" ? url.searchParams.get("v") : /^\/(embed|shorts|live)\/([^/]+)/.exec(url.pathname)?.[2];
    return video && id.test(video) ? { src: `https://www.youtube-nocookie.com/embed/${video}`, host: "YouTube" } : null;
  }
  if (host === "youtu.be") {
    const video = url.pathname.slice(1);
    return id.test(video) ? { src: `https://www.youtube-nocookie.com/embed/${video}`, host: "YouTube" } : null;
  }
  if (host === "vimeo.com") {
    const video = /^\/(\d{6,12})/.exec(url.pathname)?.[1];
    return video ? { src: `https://player.vimeo.com/video/${video}?dnt=1`, host: "Vimeo" } : null;
  }
  if (videoHosts.includes(host)) {
    const video = /^\/(?:w|videos\/watch|videos\/embed)\/([A-Za-z0-9-]{8,40})/.exec(url.pathname)?.[1];
    return video ? { src: `https://${host}/videos/embed/${video}`, host } : null;
  }
  return null;
}

/**
 * Vídeo de aula. Nada é carregado do outro site até a pessoa pedir: quem não clica não é visto por ele
 * e não gasta dados. Primeira linha do bloco: o endereço do vídeo; segunda (opcional): o título.
 */
export function VideoEmbed({ spec }: { spec: string }) {
  const { t } = useI18n();
  const [address = "", ...rest] = spec.split("\n").map((line) => line.trim());
  const caption = rest.join(" ").trim();
  const embed = embedOf(address);
  const [loaded, setLoaded] = useState(false);
  const safe = /^https:\/\/[^\s<>"']+$/.test(address);

  if (!embed) {
    return safe ? (
      <p>
        <a href={address} target="_blank" rel="noopener noreferrer nofollow">
          ▶ {caption || t.lesson.videoOpen}
        </a>
      </p>
    ) : null;
  }
  return (
    <div className="no-print my-6">
      {loaded ? (
        <iframe
          src={embed.src}
          title={caption || embed.host}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          className="aspect-video w-full border-2 border-ink bg-black"
        />
      ) : (
        <button type="button" onClick={() => setLoaded(true)} className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-3 border-2 border-ink bg-ink px-6 text-center font-sans text-parchment hover:bg-oxblood">
          <span aria-hidden className="text-5xl">▶</span>
          <span className="text-lg font-semibold">{caption || t.lesson.videoOpen}</span>
          <span className="text-sm opacity-90">{t.lesson.videoLoad.replace("{host}", embed.host)}</span>
        </button>
      )}
      <p className="!mt-2 font-sans text-sm text-ink-soft">
        {t.lesson.videoNote}{" "}
        <a href={address} target="_blank" rel="noopener noreferrer nofollow">
          {t.lesson.videoOpen} ↗
        </a>
      </p>
    </div>
  );
}

/** Imagem que a equipe enviou e ainda não foi publicada: só quem tem acesso ao painel consegue vê-la. */
export function PendingImage({ path, alt, caption }: { path: string; alt: string; caption?: string }) {
  const { t } = useI18n();
  const [src, setSrc] = useState("");

  useEffect(() => {
    let cancelled = false;
    let created = "";
    previewFile(path)
      .then((address) => {
        created = address;
        if (cancelled) URL.revokeObjectURL(address);
        else setSrc(address);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [path]);

  return (
    <span className="figura">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={alt} /> : <span className="block border border-dashed border-rule p-6 text-center font-sans text-sm text-ink-soft">{alt}</span>}
      <span className="legenda">
        {caption ? `${caption} · ` : ""}
        {t.lesson.imagePending}
      </span>
    </span>
  );
}
