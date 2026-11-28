import { STORAGE_KEYS, REPOM_LOGIN_TEMPO_MAX_MS, SESSAO_DURACAO_MS } from "../../shared/constants.js";
import { inferirEmpresaRepom } from "../../shared/empresas.js";

export async function obterAutomacaoPendente() {
    const storage = await chrome.storage.local.get(STORAGE_KEYS.repomPendente);
    return storage[STORAGE_KEYS.repomPendente] || null;
}

export async function obterSessaoExtensao() {
    const storage = await chrome.storage.local.get(STORAGE_KEYS.configuracaoRepom);
    const configuracao = storage[STORAGE_KEYS.configuracaoRepom] || {};
    return {
        nome: "Auto-Pedágio",
        expiraEm: Date.now() + SESSAO_DURACAO_MS,
        repom: configuracao.credenciais || {}
    };
}

export async function obterCredenciaisRepom(sessao, dados) {
    const empresa = inferirEmpresaRepom(dados);
    const credenciais = sessao?.repom?.[empresa];

    if (!empresa || !credenciais?.login || !credenciais?.senha) {
        console.warn("Credenciais REPOM não configuradas para a empresa emissora.", { empresa });
        return null;
    }

    return { empresa, usuario: sessao.nome, ...credenciais };
}

export async function obterPedidoAutoLogin() {
    const storage = await chrome.storage.local.get(STORAGE_KEYS.repomLogin);
    const pedido = storage[STORAGE_KEYS.repomLogin];
    if (!pedido) return null;
    if (Date.now() - pedido.criadoEm > REPOM_LOGIN_TEMPO_MAX_MS) {
        await limparPedidoAutoLogin();
        return null;
    }
    return pedido;
}

export async function atualizarPedidoAutoLogin(mudancas) {
    const pedido = await obterPedidoAutoLogin();
    if (!pedido) return;
    return chrome.storage.local.set({
        [STORAGE_KEYS.repomLogin]: { ...pedido, atualizadoEm: Date.now(), ...mudancas }
    });
}

export function limparPedidoAutoLogin() {
    return chrome.storage.local.remove(STORAGE_KEYS.repomLogin);
}

export function limparRetomadaPosLogin() {
    return chrome.storage.local.remove(STORAGE_KEYS.repomPosLogin);
}
