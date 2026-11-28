import { STORAGE_KEYS, URLS } from "../shared/constants.js";
import { normalizar } from "../shared/text.js";
import { inferirEmpresa } from "../shared/empresas.js";
import { extrairNfe } from "./services/xml-service.js";
import { buscarProdutorKm } from "./services/produtores-service.js";

const estado = { caminhoes: {}, produtoresKm: [], nfs: [], servico: null, ocupado: false };
const $ = (seletor) => document.querySelector(seletor);
const campos = {
    placa: $("#placa"),
    cidade: $("#cidade"),
    empresa: $("#empresa"),
    notas: $("#notas"),
    autoConfirmar: $("#autoConfirmar")
};

iniciar().catch((error) => setStatus(error.message || "Falha ao abrir o Auto-Pedágio.", "error"));

async function iniciar() {
    await chrome.storage.local.remove(["autoPedagioHistorico", "autoPedagioRepomPedagioEmitido"]);
    const [caminhoes, baseProdutores] = await Promise.all([
        carregarJson("data/caminhoes.json"),
        carregarJson("data/produtores-km.json")
    ]);
    estado.caminhoes = caminhoes;
    estado.produtoresKm = Array.isArray(baseProdutores) ? baseProdutores : (baseProdutores.produtores || []);
    preencherDatalistCaminhoes();
    adicionarListeners();
    await carregarConfiguracao();
    await restaurarEstado();
    chrome.storage.onChanged.addListener(atualizarComStorage);
    atualizarBotao();
}

async function carregarJson(caminho) {
    const resposta = await fetch(chrome.runtime.getURL(caminho));
    if (!resposta.ok) throw new Error(`Não foi possível carregar ${caminho}.`);
    return resposta.json();
}

function adicionarListeners() {
    $("#xmlInput").addEventListener("change", importarXmls);
    $("#btnRepom").addEventListener("click", iniciarEmissao);
    $("#btnLimpar").addEventListener("click", limparFormulario);
    $("#btnSalvarCredenciais").addEventListener("click", salvarConfiguracao);
    Object.values(campos).forEach((campo) => campo.addEventListener("input", atualizarBotao));
    Object.values(campos).forEach((campo) => campo.addEventListener("change", atualizarBotao));
}

async function importarXmls(event) {
    const arquivos = Array.from(event.target.files || []);
    if (!arquivos.length) return;

    try {
        const nfs = [];
        for (const arquivo of arquivos) nfs.push(extrairNfe(await arquivo.text(), arquivo.name));

        const placas = [...new Set(nfs.map((nf) => normalizarPlaca(nf.placa)).filter(Boolean))];
        if (placas.length > 1) throw new Error(`Os XMLs têm placas diferentes: ${placas.join(", ")}. Separe as viagens.`);

        estado.nfs = nfs.sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));
        const destinos = estado.nfs.map((nf) => ({ nf, km: buscarProdutorKm(estado.produtoresKm, nf) }));
        const elegiveis = destinos.filter((item) => Number.isFinite(Number(item.km?.distanciaPagamento ?? item.km?.kmPagamento ?? item.km?.distancia)));
        const destino = (elegiveis.length ? elegiveis : destinos).reduce((maior, atual) => {
            const kmMaior = Number(maior?.km?.distanciaPagamento ?? maior?.km?.kmPagamento ?? maior?.km?.distancia ?? -1);
            const kmAtual = Number(atual?.km?.distanciaPagamento ?? atual?.km?.kmPagamento ?? atual?.km?.distancia ?? -1);
            return !maior || kmAtual > kmMaior ? atual : maior;
        }, null);

        const caminhao = encontrarCaminhao(placas[0]);
        campos.placa.value = caminhao?.placa || placas[0] || "";
        campos.cidade.value = destino?.nf?.municipio || "";
        campos.notas.value = estado.nfs.map((nf) => nf.numero).filter(Boolean).join("\n");
        const empresa = inferirEmpresa(destino?.nf?.emitente || estado.nfs[0]?.emitente);
        campos.empresa.value = empresa === "PLUMA" || empresa === "PLUSVAL" ? empresa : "";
        estado.servico = {
            origem: "xml",
            nfs: estado.nfs,
            destinoPedagio: destino?.nf || null,
            produtorKm: destino?.km || null
        };
        atualizarResumo();
        atualizarBotao();
        setStatus(`${estado.nfs.length} XML(s) importado(s). Confira os dados da viagem.`, "ok");
    } catch (error) {
        setStatus(error.message || "Não foi possível ler os XMLs.", "error");
    } finally {
        event.target.value = "";
    }
}

function preencherDatalistCaminhoes() {
    const datalist = $("#placas");
    datalist.replaceChildren(...Object.values(estado.caminhoes).map((caminhao) => {
        const option = document.createElement("option");
        option.value = caminhao.placa;
        option.label = `${caminhao.placa} — ${caminhao.motorista}`;
        return option;
    }));
}

function encontrarCaminhao(placa) {
    const busca = normalizarPlaca(placa);
    if (!busca) return null;
    const caminhoes = Object.entries(estado.caminhoes);
    const exato = estado.caminhoes[busca] || caminhoes
        .find(([codigo, caminhao]) => normalizarPlaca(codigo) === busca || normalizarPlaca(caminhao.placa) === busca)?.[1];
    if (exato) return exato;

    // Alguns XMLs trazem caracteres divergentes depois do prefixo da placa.
    // Os quatro primeiros caracteres identificam o cadastro; use a placa oficial.
    if (busca.length < 4) return null;
    const prefixo = busca.slice(0, 4);
    const correspondencias = caminhoes.filter(([codigo, caminhao]) =>
        normalizarPlaca(codigo).startsWith(prefixo) || normalizarPlaca(caminhao.placa).startsWith(prefixo)
    );
    return correspondencias.length === 1 ? correspondencias[0][1] : null;
}

function listarNotas() {
    return [...new Set(campos.notas.value.split(/[\s,;]+/).map((nota) => nota.trim()).filter(Boolean))];
}

function atualizarBotao() {
    const placa = campos.placa.value.trim();
    const caminhao = encontrarCaminhao(placa);
    const notas = listarNotas();
    $("#placaAviso").hidden = !placa || Boolean(caminhao);
    $("#motorista").textContent = caminhao?.motorista || (placa ? "Motorista não encontrado" : "Selecione a placa");
    $("#btnRepom").disabled = estado.ocupado || !caminhao || !campos.cidade.value.trim() || !campos.empresa.value || !notas.length || notas.some((n) => !/^\d+$/.test(n));
    if (estado.servico?.origem === "xml" && normalizar(campos.cidade.value) === normalizar(estado.servico?.destinoPedagio?.municipio)) {
        atualizarResumo();
    } else {
        atualizarResumoManual();
    }
}

function atualizarResumo() {
    const nfs = estado.nfs;
    $("#resumoProdutor").textContent = [...new Set(nfs.map((nf) => nf.produtor).filter(Boolean))].join("; ") || "-";
}

function atualizarResumoManual() {
    $("#resumoProdutor").textContent = estado.servico?.destinoPedagio?.produtor || "-";
}

async function iniciarEmissao() {
    if (estado.ocupado) return;
    const caminhao = encontrarCaminhao(campos.placa.value);
    const notas = listarNotas();
    if (!caminhao || !campos.cidade.value.trim() || !campos.empresa.value || !notas.length) {
        setStatus("Confira a placa cadastrada, o destino, a empresa e os números das notas.", "error");
        return;
    }

    const servico = {
        origem: estado.servico?.origem || "manual",
        criadoEm: Date.now(),
        codigo: normalizarPlaca(caminhao.placa),
        cidade: campos.cidade.value.trim(),
        nota: notas[0],
        notas,
        quantidade: notas.length,
        autoConfirmar: campos.autoConfirmar.checked,
        semPedagio: false,
        caminhao,
        produtorKm: estado.servico?.produtorKm || null,
        destinoPedagio: estado.servico?.destinoPedagio || null,
        nfs: estado.nfs,
        resumo: {
            produtor: estado.servico?.destinoPedagio?.produtor || "",
            emitente: campos.empresa.value,
            municipio: campos.cidade.value.trim(),
            notas
        },
        usuario: "Auto-Pedágio"
    };

    estado.ocupado = true;
    atualizarBotao();
    setStatus("Preparando o REPOM…", "ok");
    const agora = Date.now();
    const tentativa = {
        criadoEm: agora,
        atualizadoEm: agora,
        origem: "auto-pedagio",
        usuario: "Auto-Pedágio",
        etapa: "inicio",
        tentativas: 1,
        usuarioEnviado: false,
        senhaEnviada: false
    };
    await chrome.storage.local.set({
        [STORAGE_KEYS.servicoAtual]: servico,
        [STORAGE_KEYS.repomPendente]: servico,
        [STORAGE_KEYS.repomLogin]: tentativa,
        [STORAGE_KEYS.repomPosLogin]: { criadoEm: agora, atualizadoEm: agora, origem: "auto-pedagio" }
    });

    try {
        const abas = await chrome.tabs.query({ url: "*://www.repom.com.br/*" });
        const aba = abas.find((item) => item.active) || abas[0];
        if (aba?.id) {
            await chrome.tabs.update(aba.id, { active: true, url: URLS.repomRoteiro });
            if (aba.windowId) await chrome.windows.update(aba.windowId, { focused: true });
        } else {
            await chrome.tabs.create({ url: URLS.repomRoteiro });
        }
        setStatus("Viagem enviada ao REPOM. Acompanhe o preenchimento na aba aberta.", "ok");
    } catch (error) {
        setStatus(`Não foi possível abrir o REPOM: ${error.message || error}`, "error");
    } finally {
        estado.ocupado = false;
        atualizarBotao();
    }
}

async function limparFormulario() {
    if (estado.ocupado) return;
    estado.nfs = [];
    estado.servico = null;
    campos.placa.value = "";
    campos.cidade.value = "";
    campos.empresa.value = "";
    campos.notas.value = "";
    campos.autoConfirmar.checked = false;
    $("#xmlInput").value = "";
    atualizarResumoManual();
    atualizarBotao();
    setStatus("Viagem limpa. Importe XMLs ou preencha os dados manualmente.", "");
}

async function carregarConfiguracao() {
    const storage = await chrome.storage.local.get(STORAGE_KEYS.configuracaoRepom);
    const config = storage[STORAGE_KEYS.configuracaoRepom] || {};
    $("#loginPlusval").value = config.credenciais?.plusval?.login || "";
    $("#senhaPlusval").value = config.credenciais?.plusval?.senha || "";
    $("#loginPluma").value = config.credenciais?.pluma?.login || "";
    $("#senhaPluma").value = config.credenciais?.pluma?.senha || "";
}

async function salvarConfiguracao() {
    const config = {
        credenciais: {
            plusval: { login: $("#loginPlusval").value.trim(), senha: $("#senhaPlusval").value },
            pluma: { login: $("#loginPluma").value.trim(), senha: $("#senhaPluma").value }
        }
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.configuracaoRepom]: config });
    setStatus("Configuração salva neste perfil do Chrome.", "ok");
}

async function restaurarEstado() {
    const storage = await chrome.storage.local.get(STORAGE_KEYS.servicoAtual);
    const servico = storage[STORAGE_KEYS.servicoAtual];
    if (servico) {
        estado.servico = servico;
        estado.nfs = Array.isArray(servico.nfs) ? servico.nfs : [];
        campos.placa.value = servico.codigo || servico.caminhao?.placa || "";
        campos.cidade.value = servico.cidade || "";
        campos.empresa.value = servico.resumo?.emitente || "";
        campos.notas.value = (servico.notas || servico.nfs?.map((nf) => nf.numero) || [servico.nota]).filter(Boolean).join("\n");
        campos.autoConfirmar.checked = Boolean(servico.autoConfirmar);
        atualizarResumo();
    }
}

function atualizarComStorage(changes, area) {
    if (area !== "local") return;
    if (changes[STORAGE_KEYS.configuracaoRepom]) carregarConfiguracao();
}

function setStatus(texto, tipo = "") {
    const status = $("#status");
    status.textContent = texto;
    status.className = `status ${tipo}`.trim();
}

function normalizarPlaca(valor) { return String(valor || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
