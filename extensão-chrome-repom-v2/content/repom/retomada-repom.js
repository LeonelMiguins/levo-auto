import { executarRoteiroAuto } from "../../automation/repom-etapa-01.js";
import { REPOM_LOGIN_TEMPO_MAX_MS, STORAGE_KEYS, URLS } from "../../shared/constants.js";
import { isPaginaAutomacaoRepom, isPaginaErroRepom, isPaginaLoginRepom } from "./paginas-repom.js";
import { obterAutomacaoPendente } from "./storage-repom.js";

export async function retomarAposLogin() {
    if (isPaginaLoginRepom() || isPaginaErroRepom()) return false;

    const storage = await chrome.storage.local.get([
        STORAGE_KEYS.repomPosLogin,
        STORAGE_KEYS.repomPendente
    ]);
    const retorno = storage[STORAGE_KEYS.repomPosLogin];
    const dadosPendentes = storage[STORAGE_KEYS.repomPendente];

    if (!retorno || !dadosPendentes) return false;

    if (Date.now() - retorno.criadoEm > REPOM_LOGIN_TEMPO_MAX_MS) {
        await chrome.storage.local.remove(STORAGE_KEYS.repomPosLogin);
        return false;
    }

    await chrome.storage.local.remove(STORAGE_KEYS.repomPosLogin);

    if (!location.href.includes("ViagemRoteiro.asp")) {
        location.href = URLS.repomRoteiro;
        return true;
    }

    await executarRoteiroAuto(dadosPendentes);
    return true;
}

export async function continuarAutomacaoPendente() {
    if (!isPaginaAutomacaoRepom()) return;

    const dadosPendentes = await obterAutomacaoPendente();

    if (!dadosPendentes) return;

    await executarRoteiroAuto(dadosPendentes);
}
