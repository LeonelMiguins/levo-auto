export function formatarNumero(valor, sufixo = "") {
    if (!valor) return "-";
    return `${Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}${sufixo}`;
}

export function formatarKm(valor) {
    if (!valorExiste(valor)) return "-";
    return `${Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

export function formatarMoeda(valor) {
    if (!valor) return "-";
    return Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

export function formatarHora(timestamp) {
    return new Date(timestamp).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

export function valorExiste(valor) {
    return valor !== null && valor !== undefined && valor !== "";
}
