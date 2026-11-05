// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ReactNode } from "react";
import { cx } from "./cx";

/** Uma tecla (Ctrl K, Esc, ↵), em mono, com a borda de baixo um pouco mais grossa. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cx("pn-kbd", className)}>{children}</kbd>;
}
