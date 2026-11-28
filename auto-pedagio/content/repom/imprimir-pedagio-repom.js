import { isPaginaImpressaoRepom } from "./paginas-repom.js";

export async function abrirImpressaoPedagioRepom() {
    if (!isPaginaImpressaoRepom()) return false;

    const chave = `auto-pedagio-impressao-repom:${location.pathname}${location.search}`;
    if (sessionStorage.getItem(chave)) return true;

    const botao = await aguardarBotaoImprimir(5000);
    if (!botao) {
        console.warn("Botão Imprimir não encontrado na página do REPOM.");
        return false;
    }

    sessionStorage.setItem(chave, String(Date.now()));
    botao.scrollIntoView?.({ behavior: "instant", block: "center" });
    botao.click();
    console.log("Janela de impressão do vale-pedágio aberta.");
    return true;
}

async function aguardarBotaoImprimir(timeout) {
    const inicio = Date.now();
    while (Date.now() - inicio < timeout) {
        const botao = document.querySelector("#BtnPrint, input[type='button'][value='Imprimir']");
        if (botao && !botao.disabled) return botao;
        await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return null;
}
