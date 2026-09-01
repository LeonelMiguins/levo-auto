import { SESSAO_DURACAO_MS, STORAGE_KEYS } from "../../shared/constants.js";
import { normalizar } from "../../shared/text.js";

export function criarSessao(usuario, agora = Date.now()) {
    return {
        nome: usuario.nome,
        is_admin: Boolean(usuario.is_admin),
        loginEm: agora,
        expiraEm: agora + SESSAO_DURACAO_MS,
        repom: {
            plusval: {
                login: usuario.login_repom_plusval || "",
                senha: usuario.senha_repom_plusval || ""
            },
            pluma: {
                login: usuario.login_repom_pluma || "",
                senha: usuario.senha_repom_pluma || ""
            }
        }
    };
}

export async function obterSessaoValida(usuarios = []) {
    const storage = await chrome.storage.local.get(STORAGE_KEYS.sessao);
    const sessao = storage[STORAGE_KEYS.sessao];

    if (!sessao?.expiraEm || Date.now() >= sessao.expiraEm) {
        await chrome.storage.local.remove(STORAGE_KEYS.sessao);
        return null;
    }

    const usuarioAtual = usuarios.find((usuario) =>
        normalizar(usuario.nome) === normalizar(sessao.nome)
    );

    if (!usuarioAtual) return sessao;

    const sessaoAtualizada = criarSessao(usuarioAtual, sessao.loginEm || Date.now());
    sessaoAtualizada.expiraEm = sessao.expiraEm;

    await chrome.storage.local.set({
        [STORAGE_KEYS.sessao]: sessaoAtualizada
    });

    return sessaoAtualizada;
}

export async function salvarSessao(sessao) {
    await chrome.storage.local.set({
        [STORAGE_KEYS.sessao]: sessao
    });
}

export async function limparSessao() {
    await chrome.storage.local.remove(STORAGE_KEYS.sessao);
}
