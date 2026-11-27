import React from "react";
import { createRoot } from "react-dom/client";
import { LaboratorioTri } from "@/components/enem/LaboratorioTri";
import pt from "@/i18n/estudo/pt.json";
createRoot(document.getElementById("root")!).render(<LaboratorioTri s={(pt as any).enem.tri} hrefProvas="#" />);
