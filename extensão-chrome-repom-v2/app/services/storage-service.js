import { STORAGE_KEYS } from "../../shared/constants.js";

export async function obterServicoAtual() {
    const storage = await chrome.storage.local.get(STORAGE_KEYS.servicoAtual);
    return storage[STORAGE_KEYS.servicoAtual] || null;
}

export async function obterPedagioEmitido() {
    const storage = await chrome.storage.local.get(STORAGE_KEYS.repomPedagioEmitido);
    return storage[STORAGE_KEYS.repomPedagioEmitido] || null;
}

export async function obterHistoricoPedagiosUsuario(usuario) {
    const storage = await chrome.storage.local.get(STORAGE_KEYS.historicoPedagios);
    const historico = storage[STORAGE_KEYS.historicoPedagios] || {};

    return Array.isArray(historico[usuario]) ? historico[usuario] : [];
}

export async function salvarServicoAtual(servico) {
    await chrome.storage.local.set({
        [STORAGE_KEYS.servicoAtual]: servico
    });
}

export async function salvarServicoRepomPendente(servico, sessao) {
    const agora = Date.now();
    const servicoComUsuario = {
        ...servico,
        usuario: sessao.nome
    };

    await chrome.storage.local.set({
        [STORAGE_KEYS.servicoAtual]: servicoComUsuario,
        [STORAGE_KEYS.repomPendente]: servicoComUsuario,
        [STORAGE_KEYS.repomPedagioEmitido]: null,
        [STORAGE_KEYS.repomLogin]: {
            criadoEm: agora,
            atualizadoEm: agora,
            origem: "fazer_repom",
            usuario: sessao.nome,
            etapa: "inicio",
            tentativas: 1,
            usuarioEnviado: false,
            senhaEnviada: false
        },
        [STORAGE_KEYS.repomPosLogin]: {
            criadoEm: agora,
            atualizadoEm: agora,
            origem: "fazer_repom",
            usuario: sessao.nome
        }
    });
}

export async function salvarSimplesCtePendente(servico, pedagio, sessao) {
    const agora = Date.now();

    await chrome.storage.local.set({
        [STORAGE_KEYS.simplesCtePendente]: {
            criadoEm: agora,
            atualizadoEm: agora,
            etapa: "selecionar_empresa",
            usuario: sessao.nome,
            semPedagio: Boolean(servico.semPedagio || !pedagio),
            transportadora: servico.caminhao?.transportadora || "",
            placa: servico.codigo || servico.caminhao?.placa || "",
            caminhao: servico.caminhao || null,
            gruposCte: servico.gruposCte || servico.gruposProdutores || [],
            indiceGrupoCteAtual: 0,
            grupoCte: servico.grupoCte || null,
            servico,
            pedagio
        }
    });
}

export async function limparServicoTemporario() {
    await chrome.storage.local.remove([
        STORAGE_KEYS.servicoAtual,
        STORAGE_KEYS.repomPendente,
        STORAGE_KEYS.repomPedagioEmitido
    ]);
}
