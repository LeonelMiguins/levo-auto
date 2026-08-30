export function isPaginaLoginRepom() {
    return location.pathname.includes("/Repom.Usuario.Web/Account/Logar");
}

export function isPaginaErroRepom() {
    return location.pathname.includes("/Express/Erro.asp");
}

export function isPaginaRoteiroRepom() {
    return location.href.includes("ViagemRoteiro.asp");
}

export function isPaginaMostraRepom() {
    return location.href.includes("ViagemMostra.asp");
}

export function isPaginaImpressaoRepom() {
    return location.href.includes("ImprimeVPR.asp");
}

export function isPaginaAutomacaoRepom() {
    return isPaginaRoteiroRepom() || isPaginaMostraRepom();
}
