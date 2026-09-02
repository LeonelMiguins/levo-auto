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

export async function limparEtapasAutomacao() {
    await chrome.storage.local.remove([
        STORAGE_KEYS.repomPendente,
        STORAGE_KEYS.repomPedagioEmitido,
        STORAGE_KEYS.simplesCtePendente,
        STORAGE_KEYS.mdfePendente
    ]);
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
            autoConfirmarCte: Boolean(servico.autoConfirmarCte),
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

export async function salvarMdfePendente(servico, sessao) {
    const agora = Date.now();

    await chrome.storage.local.set({
        [STORAGE_KEYS.mdfePendente]: {
            criadoEm: agora,
            atualizadoEm: agora,
            etapa: "selecionar_empresa",
            usuario: sessao.nome,
            transportadora: servico.caminhao?.transportadora || "",
            placa: servico.codigo || servico.caminhao?.placa || "",
            cidadeDestino: servico.cidade || servico.resumo?.municipio || "",
            emitente: servico.resumo?.emitente || servico.nfs?.[0]?.emitente || "",
            produtor: servico.resumo?.produtor || servico.grupoCte?.produtor || "",
            produtores: extrairProdutoresServico(servico),
            notas: servico.resumo?.notas || servico.chavesAcesso || [],
            servico
        }
    });
}

function extrairProdutoresServico(servico) {
    const grupos = servico.gruposCte || servico.gruposProdutores || servico.resumo?.produtores || [];
    const produtores = [
        servico.grupoCte?.produtor,
        servico.resumo?.produtor,
        ...grupos.map((grupo) => grupo?.produtor)
    ].filter(Boolean);

    return Array.from(new Set(produtores));
}

export async function limparServicoTemporario() {
    await chrome.storage.local.remove([
        STORAGE_KEYS.servicoAtual,
        STORAGE_KEYS.repomPendente,
        STORAGE_KEYS.repomPedagioEmitido,
        STORAGE_KEYS.simplesCtePendente,
        STORAGE_KEYS.mdfePendente
    ]);
}
