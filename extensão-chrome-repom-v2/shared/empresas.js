import { normalizar } from "./text.js";

export function inferirEmpresa(emitente) {
    const texto = normalizar(emitente);

    if (texto.includes("PLUSVAL")) return "PLUSVAL";
    if (texto.includes("PLUMA")) return "PLUMA";
    if (texto.includes("DIPLOMATA")) return "DIPLOMATA";

    return "";
}

export function inferirEmpresaRepom(dados) {
    const texto = normalizar([
        dados?.resumo?.emitente,
        dados?.nfs?.[0]?.emitente,
        dados?.emitente,
        dados?.produtorKm?.empresa
    ].filter(Boolean).join(" "));

    if (texto.includes("PLUSVAL")) return "plusval";
    if (texto.includes("PLUMA")) return "pluma";

    return "";
}
