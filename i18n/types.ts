import type pt from "./pt.json";

/** O português é o dicionário de origem; scripts/conferir-i18n.mjs garante que os outros têm as mesmas chaves. */
export type Dict = typeof pt;
