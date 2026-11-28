import { STORAGE_KEYS, URLS } from "./shared/constants.js";

console.log("BACKGROUND CARREGADO");

chrome.action.onClicked.addListener(async () => {
    await chrome.tabs.create({
        url: chrome.runtime.getURL("app/index.html")
    });
});

chrome.runtime.onMessage.addListener((mensagem, _remetente, responder) => {
    if (mensagem?.tipo !== "LEVO_AUTO_INICIAR_CTE_APOS_PEDAGIO") return false;

    autoIniciarCteAposPedagio()
        .then((resultado) => responder(resultado))
        .catch((erro) => {
            console.error("Falha ao auto-iniciar CTE.", erro);
            responder({ ok: false, erro: erro.message || String(erro) });
        });

    return true;
});

async function autoIniciarCteAposPedagio() {
    const storage = await chrome.storage.local.get([
        STORAGE_KEYS.sessao,
        STORAGE_KEYS.servicoAtual,
        STORAGE_KEYS.repomPedagioEmitido
    ]);
    const sessao = storage[STORAGE_KEYS.sessao];
    const servico = storage[STORAGE_KEYS.servicoAtual];
    const pedagio = storage[STORAGE_KEYS.repomPedagioEmitido];

    if (!sessao?.expiraEm || Date.now() >= sessao.expiraEm || sessao.is_admin !== true) {
        return { ok: false, motivo: "usuario_sem_permissao" };
    }

    if (!servico?.autoIniciarCte) {
        return { ok: false, motivo: "auto_iniciar_desativado" };
    }

    if (!servico?.caminhao?.transportadora) {
        return { ok: false, motivo: "transportadora_nao_encontrada" };
    }

    if (!pedagio?.numeroPedagio || !pedagio?.numeroMeioPagamento || !pedagio?.valor || !pedagio?.empresa) {
        return { ok: false, motivo: "dados_pedagio_incompletos" };
    }

    const agora = Date.now();
    const autoConfirmarCte = Boolean(servico.autoConfirmarCte);
    const servicoSeguro = {
        ...servico,
        autoConfirmarCte,
        autoIniciarCte: true
    };

    await chrome.storage.local.set({
        [STORAGE_KEYS.simplesCtePendente]: {
            criadoEm: agora,
            atualizadoEm: agora,
            etapa: "selecionar_empresa",
            usuario: sessao.nome,
            semPedagio: false,
            autoConfirmarCte,
            transportadora: servico.caminhao.transportadora,
            placa: servico.codigo || servico.caminhao.placa || "",
            caminhao: servico.caminhao,
            gruposCte: servico.gruposCte || servico.gruposProdutores || [],
            indiceGrupoCteAtual: 0,
            grupoCte: servico.grupoCte || null,
            servico: servicoSeguro,
            pedagio
        }
    });

    const abas = await chrome.tabs.query({ url: "*://app.simplescte.com.br/*" });
    const abaExistente = abas.find((aba) => aba.active) || abas[0];

    if (abaExistente?.id) {
        await chrome.tabs.update(abaExistente.id, {
            active: true,
            url: URLS.simplesCteVisaoGeral
        });

        if (abaExistente.windowId) {
            await chrome.windows.update(abaExistente.windowId, { focused: true });
        }
    } else {
        await chrome.tabs.create({ url: URLS.simplesCteVisaoGeral });
    }

    return { ok: true };
}
