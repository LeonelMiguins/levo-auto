import { REPOM_LOGIN_TEMPO_MAX_MS, STORAGE_KEYS } from "../../shared/constants.js";
import { inferirEmpresaRepom } from "../../shared/empresas.js";
import { normalizar } from "../../shared/text.js";

export async function obterAutomacaoPendente() {
    const storage = await chrome.storage.local.get(STORAGE_KEYS.repomPendente);
    return storage[STORAGE_KEYS.repomPendente] || null;
}

export async function obterSessaoExtensao() {
    const storage = await chrome.storage.local.get(STORAGE_KEYS.sessao);
    const sessao = storage[STORAGE_KEYS.sessao];

    if (!sessao?.expiraEm || Date.now() >= sessao.expiraEm) {
        await chrome.storage.local.remove(STORAGE_KEYS.sessao);
        return null;
    }

    return sessao;
}

export async function carregarUsuarios() {
    const resposta = await fetch(chrome.runtime.getURL("data/users.json"));
    const texto = await resposta.text();

    if (!texto.trim()) return [];

    const dados = JSON.parse(texto);

    if (Array.isArray(dados)) return dados;
    if (Array.isArray(dados?.users)) return dados.users;

    if (dados && typeof dados === "object") {
        return Object.values(dados);
    }

    return [];
}

export async function obterUsuarioAtual(sessao) {
    const usuarios = await carregarUsuarios();

    return usuarios.find((usuario) =>
        normalizar(usuario.nome) === normalizar(sessao?.nome)
    ) || null;
}

export async function obterCredenciaisRepom(sessao, dados) {
    const empresa = inferirEmpresaRepom(dados);
    const usuarioAtual = await obterUsuarioAtual(sessao);
    const credenciaisAtuais = usuarioAtual && empresa
        ? {
            login: usuarioAtual[`login_repom_${empresa}`] || "",
            senha: usuarioAtual[`senha_repom_${empresa}`] || ""
        }
        : null;
    const credenciais = credenciaisAtuais?.login || credenciaisAtuais?.senha
        ? credenciaisAtuais
        : sessao?.repom?.[empresa];

    if (!empresa || !credenciais?.login || !credenciais?.senha) {
        console.warn("Credenciais do Repom nao encontradas para o servico pendente.", {
            empresa,
            usuario: sessao?.nome
        });
        return null;
    }

    return {
        empresa,
        usuario: usuarioAtual?.nome || sessao.nome,
        ...credenciais
    };
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
        [STORAGE_KEYS.repomLogin]: {
            ...pedido,
            atualizadoEm: Date.now(),
            ...mudancas
        }
    });
}

export function limparPedidoAutoLogin() {
    return chrome.storage.local.remove(STORAGE_KEYS.repomLogin);
}

export function limparRetomadaPosLogin() {
    return chrome.storage.local.remove(STORAGE_KEYS.repomPosLogin);
}
