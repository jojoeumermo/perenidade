// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";

export interface TrackOption {
  slug: string;
  title: string;
  area: string;
  /** Aulas do roteiro que ainda não foram escritas. */
  planned: { slug: string; title: string }[];
  /** Aulas do roteiro já escritas. */
  ready: number;
}

const cache = new Map<string, Promise<TrackOption[]>>();

/** Trilhas e aulas em preparação. O arquivo é grande, então só é baixado por quem abre um formulário. */
export function useTrackOptions(lang: string): TrackOption[] {
  const [tracks, setTracks] = useState<TrackOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!cache.has(lang)) {
      cache.set(
        lang,
        fetch(`/${lang}/roteiros.json`)
          .then((response) => (response.ok ? (response.json() as Promise<TrackOption[]>) : []))
          .catch(() => []),
      );
    }
    void cache.get(lang)!.then((data) => {
      if (!cancelled) setTracks(data);
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);
  return tracks;
}
