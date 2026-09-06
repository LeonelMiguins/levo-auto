import { STORAGE_KEYS } from "../../shared/constants.js";
import { normalizar } from "../../shared/text.js";

const INTERVALO_BUSCA_MS = 200;
const TIMEOUT_AUTOCOMPLETE_MS = 8000;
const FORNECEDOR_VALE_PEDAGIO = "REPOM S.A.";
const RESPONSAVEIS_VALE_PEDAGIO = {
    PLUSVAL: "PLUSVAL AGROAVICOLA LTDA 04 - Cascavel/PR - 35.030.372/0005-79",
    PLUMA: "PLUMA AGRO AVICOLA LTDA 49 - Cascavel/PR - 04.656.883/0028-63"
};

const modaisPreparados = new WeakSet();

export function escutarValePedagioSimplesCte() {
    if (window.__levoAutoValePedagioListener) return;

    window.__levoAutoValePedagioListener = true;

    observarModalValePedagio();

    const observer = new MutationObserver(observarModalValePedagio);
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    window.__levoAutoValePedagioInterval = setInterval(observarModalValePedagio, 1000);
}

async function observarModalValePedagio() {
    const modal = encontrarModalValePedagio();

    document.getElementById("levo-auto-vale-pedagio-flutuante")?.remove();

    if (!modal || modaisPreparados.has(modal)) return;
    if (modal.querySelector("[data-levo-auto-vale-pedagio]")) {
        modaisPreparados.add(modal);
        return;
    }

    await sleep(250);

    if (inserirBotaoAutoPreencher(modal)) {
        modaisPreparados.add(modal);
        console.log("Botao Auto-preencher Vale-Pedagio inserido dentro do modal do Simples CTE.");
    }
}

function inserirBotaoAutoPreencher(modal) {
    const acoes = encontrarAreaAcoesValePedagio(modal);

    if (!acoes || modal.querySelector("[data-levo-auto-vale-pedagio]")) return false;

    const botao = criarBotaoAutoPreencher();

    botao.addEventListener("click", async () => {
        await executarPreenchimentoValePedagio(modal, botao);
    });

    acoes.prepend(botao);

    return true;
}

function criarBotaoAutoPreencher() {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.dataset.levoAutoValePedagio = "true";
    botao.textContent = "Auto-preencher";
    botao.style.cssText = [
        "border:1px solid #d6a100",
        "background:#ffd24a",
        "color:#2b2200",
        "border-radius:8px",
        "font-weight:700",
        "font-size:14px",
        "padding:10px 14px",
        "cursor:pointer",
        "box-shadow:0 2px 8px rgba(214,161,0,.25)",
        "z-index:2147483647"
    ].join(";");

    return botao;
}

async function executarPreenchimentoValePedagio(modal, botao) {
    try {
        atualizarBotaoProcessando(botao, "Lendo dados...");

        const dados = await obterDadosValePedagio();

        if (!dados.valido) {
            atualizarBotaoErro(botao, "Dados indisponiveis");
            console.warn("Dados do Repom/Pedagio indisponiveis para preencher Vale-Pedagio no Simples CTE.", dados);
            return;
        }

        const ok = await preencherValePedagio(modal, dados, botao);

        if (ok) {
            atualizarBotaoSucesso(botao, "Preenchido");
            return;
        }

        atualizarBotaoErro(botao, "Erro ao preencher");
    } catch (error) {
        atualizarBotaoErro(botao, "Erro no script");
        console.error("Erro inesperado ao preencher Vale-Pedagio no Simples CTE.", error);
    }
}

async function obterDadosValePedagio() {
    const storage = await chrome.storage.local.get([
        STORAGE_KEYS.servicoAtual,
        STORAGE_KEYS.repomPedagioEmitido,
        STORAGE_KEYS.simplesCtePendente
    ]);
    const servico = storage[STORAGE_KEYS.servicoAtual] || storage[STORAGE_KEYS.simplesCtePendente]?.servico || {};
    const pedagio = storage[STORAGE_KEYS.repomPedagioEmitido] || storage[STORAGE_KEYS.simplesCtePendente]?.pedagio || {};
    const empresa = inferirEmpresa(servico, pedagio);
    const responsavel = RESPONSAVEIS_VALE_PEDAGIO[empresa] || "";
    const placa = normalizarPlaca(servico.codigo || servico.placa || servico.caminhao?.placa || storage[STORAGE_KEYS.simplesCtePendente]?.placa);

    return {
        valido: Boolean(pedagio.numeroMeioPagamento && pedagio.valor && responsavel),
        fornecedor: FORNECEDOR_VALE_PEDAGIO,
        responsavel,
        eixos: placa === "MJD9E08" ? "3" : "4",
        numeroMeioPagamento: String(pedagio.numeroMeioPagamento || "").replace(/\D/g, ""),
        valorFormatado: formatarMoedaBr(pedagio.valor),
        empresa,
        placa,
        servico,
        pedagio
    };
}

async function preencherValePedagio(modal, dados, botao) {
    const campoFornecedor = encontrarInputPorPlaceholder(modal, "SELECIONE SEU FORNECEDOR DE VALE PEDAGIO");
    const campoResponsavel = encontrarInputPorPlaceholder(modal, "DIGITE PARA BUSCAR OU PRESSIONE");
    const campoEixos = encontrarInputPorPlaceholder(modal, "0");
    const campoComprovante = encontrarInputPorPlaceholder(modal, "000000000");
    const campoValor = encontrarInputPorPlaceholder(modal, "R$ 0,00");

    const camposOk = campoFornecedor && campoResponsavel && campoEixos && campoComprovante && campoValor;

    if (!camposOk) {
        console.warn("Campos do modal Dados do Vale-Pedagio nao encontrados.", {
            campos: listarCamposModal(modal),
            dados
        });
        return false;
    }

    atualizarBotaoProcessando(botao, "Fornecedor...");
    const fornecedorOk = await preencherFornecedorVale(campoFornecedor);

    atualizarBotaoProcessando(botao, "Responsavel...");
    const responsavelOk = await preencherAutocomplete(campoResponsavel, dados.responsavel);

    atualizarBotaoProcessando(botao, "Eixos...");
    const eixosOk = await preencherEixos(campoEixos, dados.eixos);

    atualizarBotaoProcessando(botao, "Numero...");
    await preencherInputTexto(campoComprovante, dados.numeroMeioPagamento);

    atualizarBotaoProcessando(botao, "Valor...");
    await preencherInputTexto(campoValor, dados.valorFormatado);

    atualizarBotaoProcessando(botao, "Validando...");
    const fornecedorFinalOk = await garantirFornecedorValePreenchido(campoFornecedor);

    if (!fornecedorOk || !responsavelOk || !eixosOk || !fornecedorFinalOk) {
        console.warn("Nem todos os campos de autocomplete do Vale-Pedagio foram confirmados.", {
            fornecedorOk,
            fornecedorFinalOk,
            responsavelOk,
            eixosOk,
            campos: listarCamposModal(modal),
            dados
        });
        return false;
    }

    console.log("Dados do Vale-Pedagio preenchidos automaticamente no Simples CTE.", {
        fornecedor: dados.fornecedor,
        responsavel: dados.responsavel,
        eixos: dados.eixos,
        numeroMeioPagamento: dados.numeroMeioPagamento,
        valor: dados.valorFormatado
    });

    return true;
}

function atualizarBotaoProcessando(botao, texto) {
    botao.disabled = true;
    botao.textContent = texto;
    botao.style.background = "#ffd24a";
    botao.style.borderColor = "#d6a100";
    botao.style.color = "#2b2200";
}

function atualizarBotaoSucesso(botao, texto) {
    botao.disabled = false;
    botao.textContent = texto;
    botao.style.background = "#087443";
    botao.style.borderColor = "#087443";
    botao.style.color = "#fff";
}

function atualizarBotaoErro(botao, texto) {
    botao.disabled = false;
    botao.textContent = texto;
    botao.style.background = "#b42318";
    botao.style.borderColor = "#b42318";
    botao.style.color = "#fff";
}

async function preencherAutocomplete(input, texto, opcoes = {}) {
    if (valorCampoConfere(input, texto)) return true;

    await preencherInputTexto(input, texto);

    const opcao = opcoes.exato
        ? await aguardarOpcaoAutocompleteExata(texto, opcoes.timeout || TIMEOUT_AUTOCOMPLETE_MS)
        : await aguardarOpcaoAutocomplete(texto, opcoes.timeout || TIMEOUT_AUTOCOMPLETE_MS);

    if (opcao) {
        await clicarElemento(opcao);
        await sleep(450);
        input.blur?.();
    }

    return aguardarValorAutocomplete(input, texto, 3500);
}

async function preencherFornecedorVale(input) {
    if (valorFornecedorValeConfere(input)) return true;

    await abrirOpcoesAutocomplete(input);

    let opcao = await aguardarOpcaoAutocomplete("REPOM", 2500);

    if (!opcao) {
        await preencherInputTextoDigitando(input, "REPOM");
        opcao = await aguardarOpcaoAutocomplete("REPOM", 7000);
    }

    if (opcao) {
        await clicarElemento(opcao);
        await sleep(650);
        input.blur?.();
    } else {
        await confirmarCampoComTeclado(input);
    }

    return aguardarValorFornecedorVale(input, 3500);
}

async function garantirFornecedorValePreenchido(input) {
    if (await aguardarValorFornecedorVale(input, 700)) return true;

    return preencherFornecedorVale(input);
}

async function garantirAutocompletePreenchido(input, texto, opcoes = {}) {
    if (await aguardarValorAutocomplete(input, texto, 600)) return true;

    await preencherAutocomplete(input, texto, opcoes);
    input.blur?.();
    await sleep(350);

    return aguardarValorAutocomplete(input, texto, opcoes.timeout || 3500);
}

async function preencherEixos(input, eixos) {
    if (valorCampoConfere(input, eixos)) return true;

    await abrirOpcoesAutocomplete(input);

    const opcao = await aguardarOpcaoEixos(eixos, 3500);

    if (opcao) {
        await clicarElemento(opcao);
        await sleep(250);
    } else {
        await preencherInputTexto(input, eixos);
        await confirmarCampoComTeclado(input);
    }

    return aguardarValorCampo(input, eixos, 2500);
}

async function abrirOpcoesAutocomplete(input) {
    input.scrollIntoView?.({
        behavior: "instant",
        block: "center"
    });
    await sleep(100);
    input.focus?.();
    input.click?.();

    const botaoAbrir = input.closest(".MuiInputBase-root, .MuiAutocomplete-root, .MuiFormControl-root")
        ?.querySelector("button[aria-label='Open'], .MuiAutocomplete-popupIndicator");

    botaoAbrir?.click?.();
    await sleep(250);
}

async function aguardarOpcaoAutocomplete(texto, timeout) {
    const inicio = Date.now();

    while (Date.now() - inicio < timeout) {
        const opcao = encontrarOpcaoAutocomplete(texto);

        if (opcao) return opcao;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

function encontrarOpcaoAutocomplete(texto) {
    const busca = normalizarBusca(texto);
    const palavras = busca.split(/\s+/).filter((palavra) => palavra.length > 1);

    return Array.from(document.querySelectorAll([
        "[role='option']",
        "[role='listbox'] *",
        ".MuiAutocomplete-popper *",
        ".MuiAutocomplete-option",
        ".MuiMenuItem-root",
        ".MuiPaper-root li"
    ].join(",")))
        .filter(isVisivel)
        .map((elemento) => ({
            elemento: encontrarElementoClicavelOpcao(elemento),
            texto: normalizarBusca(elemento.textContent),
            tamanho: textoLimpo(elemento.textContent).length
        }))
        .filter((item) =>
            item.texto.includes(busca) ||
            palavras.every((palavra) => item.texto.includes(palavra))
        )
        .sort((a, b) => a.tamanho - b.tamanho)[0]?.elemento || null;
}

async function aguardarOpcaoAutocompleteExata(texto, timeout) {
    const inicio = Date.now();
    const busca = normalizarBusca(texto);
    const buscaCompacta = compactarBusca(texto);

    while (Date.now() - inicio < timeout) {
        const opcao = Array.from(document.querySelectorAll([
            "[role='option']",
            "[role='listbox'] *",
            ".MuiAutocomplete-popper *",
            ".MuiAutocomplete-option",
            ".MuiMenuItem-root",
            ".MuiPaper-root li"
        ].join(",")))
            .filter(isVisivel)
            .find((elemento) => {
                const textoOpcao = normalizarBusca(elemento.textContent);
                const textoCompacto = compactarBusca(elemento.textContent);

                return textoOpcao === busca || textoCompacto === buscaCompacta;
            });

        if (opcao) return encontrarElementoClicavelOpcao(opcao);

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

async function aguardarOpcaoEixos(eixos, timeout) {
    const inicio = Date.now();
    const busca = normalizarBusca(eixos);

    while (Date.now() - inicio < timeout) {
        const opcao = Array.from(document.querySelectorAll([
            "[role='option']",
            "[role='listbox'] *",
            ".MuiAutocomplete-popper *",
            ".MuiAutocomplete-option",
            ".MuiMenuItem-root",
            ".MuiPaper-root li"
        ].join(",")))
            .filter(isVisivel)
            .map((elemento) => ({
                elemento: encontrarElementoClicavelOpcao(elemento),
                texto: normalizarBusca(elemento.textContent)
            }))
            .find((item) => item.texto === busca || item.texto.startsWith(`${busca} `) || item.texto.includes(`${busca} EIX`));

        if (opcao?.elemento) return opcao.elemento;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

function encontrarModalValePedagio() {
    const titulo = Array.from(document.querySelectorAll("h1, h2, h3, h4, span, div, p"))
        .filter(isVisivel)
        .find((elemento) => normalizarBusca(elemento.textContent).includes("DADOS DO VALE PEDAGIO"));
    const modalPorTitulo = encontrarContainerModal(titulo);

    if (modalPorTitulo && isVisivel(modalPorTitulo)) return modalPorTitulo;

    const modalPorCamposGlobais = encontrarModalPorCamposGlobais();

    if (modalPorCamposGlobais) return modalPorCamposGlobais;

    const modalPorCampos = Array.from(document.querySelectorAll(".MuiDialog-paper, .MuiPaper-root, .MuiDialogContent-root, [role='dialog'], form"))
        .filter(isVisivel)
        .find((elemento) =>
            encontrarInputPorPlaceholder(elemento, "SELECIONE SEU FORNECEDOR DE VALE PEDAGIO") &&
            encontrarInputPorPlaceholder(elemento, "000000000") &&
            encontrarInputPorPlaceholder(elemento, "R$ 0,00")
        );

    if (modalPorCampos) return encontrarContainerModal(modalPorCampos) || modalPorCampos;

    return Array.from(document.querySelectorAll(".MuiDialog-paper, .MuiPaper-root, .MuiDialogContent-root, [role='dialog'], form"))
        .filter(isVisivel)
        .find((elemento) => normalizarBusca(elemento.textContent).includes("DADOS DO VALE PEDAGIO")) || null;
}

function encontrarModalPorCamposGlobais() {
    const campoFornecedor = encontrarInputPorPlaceholder(document, "SELECIONE SEU FORNECEDOR DE VALE PEDAGIO");
    const campoComprovante = encontrarInputPorPlaceholder(document, "000000000");
    const campoValor = encontrarInputPorPlaceholder(document, "R$ 0,00");

    if (!campoFornecedor || !campoComprovante || !campoValor) return null;

    return encontrarContainerModal(campoFornecedor) ||
        encontrarContainerModal(campoComprovante) ||
        encontrarContainerComum([campoFornecedor, campoComprovante, campoValor]);
}

function encontrarContainerModal(elemento) {
    return elemento?.closest?.(".MuiDialog-paper, .MuiPaper-root, [role='dialog'], .line-modal-dialog, form") || null;
}

function encontrarContainerComum(elementos) {
    const [primeiro, ...restante] = elementos;
    let atual = primeiro?.parentElement || null;

    while (atual && atual !== document.body) {
        if (restante.every((elemento) => atual.contains(elemento)) && isVisivel(atual)) {
            return atual;
        }

        atual = atual.parentElement;
    }

    return document.body;
}

function encontrarAreaAcoesValePedagio(modal) {
    const acoes = Array.from(modal.querySelectorAll(".MuiDialogActions-root, [class*='DialogActions']"))
        .filter(isVisivel)
        .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];

    if (acoes) return acoes;

    const botaoAdicionar = Array.from(modal.querySelectorAll("button"))
        .filter(isVisivel)
        .find((botao) => normalizarBusca(botao.textContent).includes("ADICIONAR"));

    if (botaoAdicionar?.parentElement) return botaoAdicionar.parentElement;

    const form = modal.querySelector("form");

    if (form && isVisivel(form)) return form;

    return modal;
}

function encontrarInputPorPlaceholder(raiz, placeholder) {
    const busca = normalizarBusca(placeholder);

    return Array.from(raiz.querySelectorAll("input"))
        .filter(isVisivel)
        .filter((input) => !input.disabled && !input.readOnly)
        .find((input) => normalizarBusca(input.placeholder).includes(busca)) || null;
}

async function preencherInputTexto(input, texto) {
    input.scrollIntoView?.({
        behavior: "instant",
        block: "center"
    });
    await sleep(120);
    input.focus?.();
    setValorNativo(input, "");
    dispararEventos(input);
    await sleep(80);
    setValorNativo(input, texto);
    input.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: texto
    }));
    dispararEventos(input, ["change"]);
    await sleep(150);
}

async function preencherInputTextoDigitando(input, texto) {
    input.scrollIntoView?.({
        behavior: "instant",
        block: "center"
    });
    await sleep(120);
    input.focus?.();
    setValorNativo(input, "");
    dispararEventos(input);
    await sleep(100);

    let acumulado = "";

    for (const caractere of texto) {
        acumulado += caractere;
        input.dispatchEvent(new KeyboardEvent("keydown", {
            key: caractere,
            bubbles: true
        }));
        setValorNativo(input, acumulado);
        input.dispatchEvent(new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: caractere
        }));
        input.dispatchEvent(new KeyboardEvent("keyup", {
            key: caractere,
            bubbles: true
        }));
        await sleep(80);
    }

    dispararEventos(input, ["change"]);
    await sleep(250);
}

async function clicarElemento(elemento) {
    elemento.scrollIntoView?.({
        behavior: "instant",
        block: "center"
    });
    await sleep(120);
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((tipo) => {
        elemento.dispatchEvent(new MouseEvent(tipo, {
            bubbles: true,
            cancelable: true,
            view: window
        }));
    });
}

function encontrarElementoClicavelOpcao(elemento) {
    return elemento.closest?.("[role='option'], .MuiAutocomplete-option, .MuiMenuItem-root, li, button") || elemento;
}

async function confirmarCampoComTeclado(input) {
    ["ArrowDown", "Enter", "Tab"].forEach((key) => {
        input.dispatchEvent(new KeyboardEvent("keydown", {
            key,
            code: key,
            bubbles: true
        }));
    });
    await sleep(150);
    input.blur?.();
}

function dispararEventos(elemento, eventos = ["input", "change"]) {
    eventos.forEach((evento) => {
        elemento.dispatchEvent(new Event(evento, { bubbles: true }));
    });
}

function setValorNativo(elemento, valor) {
    const prototype = elemento instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor?.set) {
        descriptor.set.call(elemento, valor);
        return;
    }

    elemento.value = valor;
}

function inferirEmpresa(servico, pedagio) {
    const texto = normalizar([
        servico.resumo?.emitente,
        servico.nfs?.[0]?.emitente,
        servico.emitente,
        pedagio.empresa
    ].filter(Boolean).join(" "));

    if (texto.includes("PLUMA")) return "PLUMA";
    if (texto.includes("PLUSVAL")) return "PLUSVAL";
    return "";
}

function formatarMoedaBr(valor) {
    if (typeof valor === "number") {
        return valor.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    const texto = String(valor || "").trim();

    if (texto.startsWith("R$")) return texto;

    const numero = converterNumeroBr(valor);

    if (!Number.isFinite(numero)) return texto;

    return numero.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function converterNumeroBr(valor) {
    if (typeof valor === "number") return valor;

    const texto = String(valor || "")
        .replace(/[^\d,.-]/g, "")
        .trim();

    if (!texto) return NaN;

    const temVirgula = texto.includes(",");
    const temPonto = texto.includes(".");

    if (temVirgula) {
        return Number(texto.replace(/\./g, "").replace(",", "."));
    }

    if (temPonto) {
        const partes = texto.split(".");
        const ultimaParte = partes[partes.length - 1] || "";

        if (ultimaParte.length === 2) {
            return Number(texto);
        }

        return Number(texto.replace(/\./g, ""));
    }

    return Number(texto);
}

function normalizarPlaca(valor) {
    return String(valor || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function listarCamposModal(modal) {
    return Array.from(modal.querySelectorAll("input"))
        .filter(isVisivel)
        .map((input) => ({
            placeholder: input.placeholder,
            valor: input.value,
            id: input.id,
            role: input.getAttribute("role") || ""
        }));
}

function isVisivel(elemento) {
    if (!elemento) return false;

    const estilo = getComputedStyle(elemento);
    const rect = elemento.getBoundingClientRect();

    return estilo.display !== "none" &&
        estilo.visibility !== "hidden" &&
        Number(estilo.opacity || 1) > 0 &&
        rect.width > 0 &&
        rect.height > 0;
}

function textoLimpo(texto) {
    return String(texto || "").replace(/\s+/g, " ").trim();
}

async function aguardarValorAutocomplete(input, texto, timeout) {
    const inicio = Date.now();
    const esperado = normalizarBusca(texto);
    const palavras = esperado.split(/\s+/).filter((palavra) => palavra.length > 2);

    while (Date.now() - inicio < timeout) {
        const atual = normalizarBusca(input.value || input.getAttribute("value") || "");

        if (atual.includes(esperado) || palavras.every((palavra) => atual.includes(palavra))) {
            return true;
        }

        await sleep(INTERVALO_BUSCA_MS);
    }

    return false;
}

async function aguardarValorFornecedorVale(input, timeout) {
    const inicio = Date.now();

    while (Date.now() - inicio < timeout) {
        if (valorFornecedorValeConfere(input)) return true;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return false;
}

async function aguardarValorCampo(input, texto, timeout) {
    const inicio = Date.now();
    const esperado = normalizarBusca(texto);

    while (Date.now() - inicio < timeout) {
        const atual = normalizarBusca(input.value || input.getAttribute("value") || "");

        if (atual === esperado || atual.startsWith(`${esperado} `) || atual.includes(`${esperado} EIX`)) return true;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return false;
}

function valorCampoConfere(input, texto) {
    const esperado = normalizarBusca(texto);
    const atual = normalizarBusca(input.value || input.getAttribute("value") || "");

    return atual === esperado || atual.startsWith(`${esperado} `) || atual.includes(esperado);
}

function valorFornecedorValeConfere(input) {
    const atual = compactarBusca(input.value || input.getAttribute("value") || "");

    return atual.includes("REPOM");
}

function normalizarBusca(valor) {
    return normalizar(valor)
        .replace(/[^A-Z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

function compactarBusca(valor) {
    return normalizarBusca(valor).replace(/[^A-Z0-9]/g, "");
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
