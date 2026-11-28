import { URLS } from "../../shared/constants.js";

export async function abrirOuReutilizarAbaRepom() {
    const abas = await chrome.tabs.query({
        url: "*://www.repom.com.br/*"
    });

    const abaExistente = abas.find((aba) => aba.active) || abas[0];

    if (!abaExistente?.id) {
        const abaCriada = await chrome.tabs.create({ url: URLS.repomRoteiro });

        return {
            tab: abaCriada,
            reutilizada: false
        };
    }

    await chrome.tabs.update(abaExistente.id, {
        active: true,
        url: URLS.repomRoteiro
    });

    if (abaExistente.windowId) {
        await chrome.windows.update(abaExistente.windowId, {
            focused: true
        });
    }

    return {
        tab: abaExistente,
        reutilizada: true
    };
}
