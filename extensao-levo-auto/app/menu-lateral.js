import { STORAGE_KEYS } from "../shared/constants.js";

const botaoMenu = document.querySelector("#btnMenu");
const menu = document.querySelector("#menuLateral");
const botaoFechar = document.querySelector("#btnFecharMenu");
const opcoesAdmin = document.querySelector("#opcoesAdministradorMenu");
const modoTestePedagio = document.querySelector("#modoTestePedagio");
const statusModoTeste = document.querySelector("#modoTestePedagioStatus");

modoTestePedagio.addEventListener("change", alternarModoTestePedagio);

async function atualizarOpcaoPedagioTeste() {
    const storage = await chrome.storage.local.get([
        STORAGE_KEYS.sessao,
        STORAGE_KEYS.modoTestePedagio
    ]);
    const sessao = storage[STORAGE_KEYS.sessao];
    const adminValido = sessao?.is_admin === true && Date.now() < sessao.expiraEm;

    if (!adminValido) {
        opcoesAdmin.hidden = true;
        modoTestePedagio.checked = false;
        await chrome.storage.local.remove([STORAGE_KEYS.modoTestePedagio, STORAGE_KEYS.pedagioTeste]);
        return;
    }

    opcoesAdmin.hidden = false;
    modoTestePedagio.checked = storage[STORAGE_KEYS.modoTestePedagio] === true;
}

atualizarOpcaoPedagioTeste();

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[STORAGE_KEYS.sessao]) {
        atualizarOpcaoPedagioTeste();
    }
});

async function alternarModoTestePedagio() {
    const storage = await chrome.storage.local.get(STORAGE_KEYS.sessao);
    const sessao = storage[STORAGE_KEYS.sessao];

    if (sessao?.is_admin !== true || Date.now() >= sessao.expiraEm) {
        modoTestePedagio.checked = false;
        statusModoTeste.textContent = "Apenas administradores com sessão válida podem usar esta opção.";
        await chrome.storage.local.remove([STORAGE_KEYS.modoTestePedagio, STORAGE_KEYS.pedagioTeste]);
        return;
    }

    if (!modoTestePedagio.checked) {
        await chrome.storage.local.remove([STORAGE_KEYS.modoTestePedagio, STORAGE_KEYS.pedagioTeste]);
        statusModoTeste.textContent = "Modo de teste desativado; dados fictícios removidos.";
        return;
    }

    const agora = Date.now();
    const final = String(agora).slice(-6);
    const pedagioTeste = {
        numeroPedagio: `TESTE-${final}`,
        numeroMeioPagamento: `999999${final}`,
        valor: 0.01,
        empresa: "PLUMA",
        usuario: sessao.nome,
        teste: true,
        capturadoEm: agora
    };

    await chrome.storage.local.set({
        [STORAGE_KEYS.modoTestePedagio]: true,
        [STORAGE_KEYS.pedagioTeste]: pedagioTeste
    });
    statusModoTeste.textContent = `Dados fictícios gerados (${pedagioTeste.numeroPedagio}, R$ 0,01).`;
}

botaoMenu.addEventListener("click", () => {
    if (menu.open) return;
    menu.showModal();
    botaoMenu.setAttribute("aria-expanded", "true");
    atualizarOpcaoPedagioTeste().catch((erro) => {
        console.error("Nao foi possivel atualizar as opcoes do menu.", erro);
    });
});

botaoFechar.addEventListener("click", () => menu.close());

menu.addEventListener("click", (evento) => {
    const limites = menu.getBoundingClientRect();
    if (evento.target === menu && (
        evento.clientX < limites.left || evento.clientX > limites.right ||
        evento.clientY < limites.top || evento.clientY > limites.bottom
    )) {
        menu.close();
    }
});

menu.addEventListener("close", () => {
    botaoMenu.setAttribute("aria-expanded", "false");
    botaoMenu.focus();
});
