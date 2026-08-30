import { formatarHora, formatarKm, formatarMoeda, formatarNumero, valorExiste } from "../shared/formatters.js";
import { STORAGE_KEYS } from "../shared/constants.js";
import { normalizar } from "../shared/text.js";
import { carregarJson, carregarUsuarios, normalizarUsuarios } from "./services/data-service.js";
import { abrirOuReutilizarAbaSimplesCte } from "./services/cte-launcher.js";
import { buscarProdutorKm as buscarProdutorKmNaBase } from "./services/produtores-service.js";
import { abrirOuReutilizarAbaRepom } from "./services/repom-launcher.js";
import { criarSessao, limparSessao, obterSessaoValida, salvarSessao } from "./services/session-service.js";
import { montarServico, montarServicoManual } from "./services/servico-service.js";
import {
    limparServicoTemporario,
    obterHistoricoPedagiosUsuario,
    obterPedagioEmitido,
    obterServicoAtual,
    salvarServicoAtual,
    salvarServicoRepomPendente,
    salvarSimplesCtePendente
} from "./services/storage-service.js";
import { extrairNfe } from "./services/xml-service.js";

const estado = {
    nfs: [],
    caminhoes: {},
    produtoresKm: [],
    usuarios: [],
    sessao: null,
    grupoCteSelecionadoId: ""
};

const $ = (seletor) => document.querySelector(seletor);

const campos = {
    placa: $("#placa"),
    placaAviso: $("#placaAviso"),
    cidade: $("#cidade"),
    nota: $("#nota"),
    quantidade: $("#quantidade"),
    autoConfirmar: $("#autoConfirmar"),
    semPedagio: $("#semPedagio")
};

const login = {
    form: $("#loginForm"),
    nome: $("#loginNome"),
    senha: $("#loginSenha"),
    status: $("#loginStatus"),
    usuarioSessao: $("#usuarioSessao")
};

const resumo = {
    produtor: $("#produtor"),
    emitente: $("#emitente"),
    municipio: $("#municipio"),
    kmPagamento: $("#kmPagamento"),
    notas: $("#notas"),
    peso: $("#peso"),
    valor: $("#valor")
};

const repomEmitido = {
    numeroPedagio: $("#repomNumeroPedagio"),
    meioPagamento: $("#repomMeioPagamento"),
    valor: $("#repomValor"),
    empresa: $("#repomEmpresa"),
    btnCte: $("#btnCte"),
    historico: $("#historicoPedagios")
};

iniciar();

async function iniciar() {
    const [caminhoes, produtoresKm, usuarios] = await Promise.all([
        carregarJson("data/caminhoes.json"),
        carregarJson("data/produtores-km.json"),
        carregarUsuarios()
    ]);

    estado.caminhoes = caminhoes;
    estado.produtoresKm = produtoresKm.produtores || [];
    estado.usuarios = normalizarUsuarios(usuarios);

    login.form.addEventListener("submit", entrar);
    $("#btnSair").addEventListener("click", sair);
    $("#xmlInput").addEventListener("change", importarXmls);
    campos.placa.addEventListener("input", validarPlacaNaTela);
    campos.cidade.addEventListener("input", atualizarBotaoRepom);
    campos.nota.addEventListener("input", atualizarBotaoRepom);
    campos.quantidade.addEventListener("input", atualizarBotaoRepom);
    campos.semPedagio.addEventListener("change", alternarSemPedagio);
    $("#btnSalvar").addEventListener("click", salvarTemporario);
    $("#btnRepom").addEventListener("click", fazerRepom);
    $("#btnCte").addEventListener("click", fazerCte);
    $("#btnLimpar").addEventListener("click", limparTudo);
    chrome.storage.onChanged.addListener(atualizarQuandoStorageMudar);

    const sessao = await obterSessaoValida(estado.usuarios);

    if (sessao) {
        aplicarSessao(sessao);
        await restaurarServicoTemporario();
        aplicarPedagioEmitido(await obterPedagioEmitido());
        await aplicarHistoricoUsuario();
    } else {
        bloquearAplicacao();
    }
}

async function entrar(event) {
    event.preventDefault();

    const nome = login.nome.value.trim();
    const senha = login.senha.value;

    if (!estado.usuarios.length) {
        setLoginStatus("Nenhum usuario cadastrado em data/users.json.", true);
        return;
    }

    const usuario = estado.usuarios.find((item) =>
        normalizar(item.nome) === normalizar(nome) &&
        String(item.senha || "") === senha
    );

    if (!usuario) {
        setLoginStatus("Usuario ou senha invalidos.", true);
        return;
    }

    const sessao = criarSessao(usuario);

    await salvarSessao(sessao);
    aplicarSessao(sessao);
    await restaurarServicoTemporario();
    await aplicarHistoricoUsuario();
}

function aplicarSessao(sessao) {
    estado.sessao = sessao;
    document.body.classList.remove("bloqueado");
    login.senha.value = "";
    login.usuarioSessao.textContent =
        `${sessao.nome} - sessao ate ${formatarHora(sessao.expiraEm)}`;
}

function bloquearAplicacao() {
    estado.sessao = null;
    document.body.classList.add("bloqueado");
    login.usuarioSessao.textContent = "";
    setLoginStatus("Entre para iniciar a automacao.", false);
    aplicarHistorico([]);
}

async function sair() {
    await limparSessao();
    bloquearAplicacao();
}

async function exigirSessao() {
    const sessao = await obterSessaoValida(estado.usuarios);

    if (sessao) {
        aplicarSessao(sessao);
        return sessao;
    }

    bloquearAplicacao();
    setLoginStatus("Sessao expirada. Entre novamente.", true);
    throw new Error("Sessao expirada");
}

async function restaurarServicoTemporario() {
    const servico = await obterServicoAtual();

    if (!servico) return;

    aplicarServicoNaTela(servico);
    aplicarPedagioEmitido(servico.pedagioEmitido || await obterPedagioEmitido());
    setStatus("Servico temporario carregado.", "ok");
}

async function importarXmls(event) {
    await exigirSessao();

    const arquivos = Array.from(event.target.files || []);

    if (!arquivos.length) return;

    try {
        const nfs = [];

        for (const arquivo of arquivos) {
            const xml = await arquivo.text();
            nfs.push(extrairNfe(xml, arquivo.name));
        }

        validarPlacasDasNotas(nfs);

        estado.nfs = nfs.sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));
        const servico = montarServico(estado.nfs, criarContextoServico());

        aplicarServicoNaTela(servico);
        await salvarServicoAtual(servico);

        const variosDestinos = (servico.destinoPedagio?.destinos || []).length > 1;
        const mensagemKm = valorExiste(servico.kmPagamento)
            ? ` Pedagio para ${servico.cidade}${variosDestinos ? " (cidade mais longe)" : ""}: ${formatarKm(servico.kmPagamento)}.`
            : " Produtor nao encontrado na base de KM.";

        setStatus(`${nfs.length} XML(s) importado(s) e salvos temporariamente.${mensagemKm}`, "ok");
    } catch (error) {
        console.error(error);
        setStatus(error.message || "Nao foi possivel ler os XMLs.", "error");
    } finally {
        event.target.value = "";
    }
}

function aplicarServicoNaTela(servico) {
    campos.placa.value = servico.codigo || servico.caminhao?.placa || "";
    campos.cidade.value = servico.cidade || "";
    campos.nota.value = servico.nota || "";
    campos.quantidade.value = servico.quantidade || 0;
    campos.autoConfirmar.checked = Boolean(servico.autoConfirmar ?? servico.autoImprimir);
    campos.semPedagio.checked = Boolean(servico.semPedagio);

    estado.grupoCteSelecionadoId = obterGrupoSelecionado(servico)?.id || servico.grupoCteSelecionadoId || "";
    renderizarProdutores(servico);
    resumo.emitente.textContent = servico.resumo?.emitente || "-";
    resumo.municipio.textContent = servico.resumo?.municipio || servico.cidade || "-";
    resumo.kmPagamento.textContent = formatarKm(
        servico.distanciaPagamento ??
        servico.distanciaKm ??
        servico.kmPagamento ??
        servico.resumo?.distanciaPagamento ??
        servico.resumo?.distanciaKm ??
        servico.resumo?.kmPagamento
    );
    resumo.notas.textContent = servico.resumo?.notas?.join(", ") || servico.nota || "-";
    resumo.peso.textContent = formatarNumero(servico.resumo?.pesoTotal, " kg");
    resumo.valor.textContent = formatarMoeda(servico.resumo?.valorTotal);

    validarPlacaNaTela();
}

async function salvarTemporario() {
    await exigirSessao();

    const servico = montarServicoManual(
        await obterServicoAtual() || {},
        obterValoresTela(),
        criarContextoServico()
    );

    await salvarServicoAtual(servico);
    aplicarServicoNaTela(servico);
    setStatus("Servico salvo temporariamente.", "ok");
}

async function fazerRepom() {
    const sessao = await exigirSessao();
    const servico = montarServicoManual(
        await obterServicoAtual() || {},
        obterValoresTela(),
        criarContextoServico()
    );

    if (!servico.cidade || !servico.nota || !servico.quantidade) {
        setStatus("Informe cidade, nota inicial e quantidade antes de fazer o Repom.", "error");
        return;
    }

    if (servico.semPedagio) {
        setStatus("Servico marcado como sem pedagio. Use Fazer CTE.", "error");
        return;
    }

    if (!validarPlacaNaTela()) {
        setStatus("Corrija a placa antes de fazer o Repom.", "error");
        return;
    }

    await salvarServicoRepomPendente(servico, sessao);
    aplicarPedagioEmitido(null);

    const aba = await abrirOuReutilizarAbaRepom();
    const acao = aba.reutilizada ? "reutilizada" : "aberta";

    setStatus(`Servico enviado para o Repom. A aba do Repom foi ${acao}.`, "ok");
}

async function fazerCte() {
    const sessao = await exigirSessao();

    const pedagio = await obterPedagioEmitido();
    const servicoBase = await obterServicoAtual();
    const servico = prepararServicoParaCte(servicoBase);
    const semPedagio = Boolean(servico?.semPedagio || campos.semPedagio.checked);

    if (!semPedagio && (!pedagio?.numeroPedagio || !pedagio?.numeroMeioPagamento || !pedagio?.valor || !pedagio?.empresa)) {
        aplicarPedagioEmitido(null);
        setStatus("Consuma o pedagio no Repom antes de fazer o CTE.", "error");
        return;
    }

    if (semPedagio && (!servico?.cidade || !servico?.nota || !servico?.quantidade)) {
        setStatus("Carregue ou salve os dados da nota antes de fazer o CTE.", "error");
        return;
    }

    if (!servico?.caminhao?.transportadora) {
        setStatus("Transportadora do caminhao nao encontrada na base.", "error");
        return;
    }

    await salvarServicoAtual(servico);
    await salvarSimplesCtePendente(servico, semPedagio ? null : pedagio, sessao);

    const aba = await abrirOuReutilizarAbaSimplesCte();
    const acao = aba.reutilizada ? "reutilizada" : "aberta";

    setStatus(`Simples CTE ${acao}. Buscando empresa: ${servico.caminhao.transportadora}.`, "ok");
}

async function limparTudo() {
    await exigirSessao();

    estado.nfs = [];
    estado.grupoCteSelecionadoId = "";
    await limparServicoTemporario();

    Object.values(campos).forEach((campo) => {
        if (campo.type === "checkbox") {
            campo.checked = false;
        } else if ("value" in campo) {
            campo.value = "";
        }
    });

    Object.values(resumo).forEach((item) => {
        item.textContent = "-";
    });

    aplicarPedagioEmitido(null);
    validarPlacaNaTela();
    atualizarBotaoRepom();
    setStatus("Nenhum XML carregado.", "empty");
}

function obterValoresTela() {
    return {
        placa: campos.placa.value,
        cidade: campos.cidade.value,
        nota: campos.nota.value,
        quantidade: campos.quantidade.value,
        autoConfirmar: campos.autoConfirmar.checked,
        semPedagio: campos.semPedagio.checked
    };
}

function criarContextoServico() {
    return {
        autoConfirmar: campos.autoConfirmar.checked,
        semPedagio: campos.semPedagio.checked,
        buscarCaminhao,
        buscarProdutorKm
    };
}

function buscarCaminhao(valor) {
    const busca = String(valor || "").toUpperCase().trim();

    if (!busca) return null;

    return estado.caminhoes[busca] ||
        Object.values(estado.caminhoes).find((caminhao) => caminhao.placa === busca) ||
        null;
}

function validarPlacasDasNotas(nfs) {
    const placas = Array.from(new Set(
        nfs
            .map((nf) => String(nf.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, ""))
            .filter(Boolean)
    ));

    if (placas.length <= 1) return;

    const detalhes = nfs
        .map((nf) => {
            const placa = String(nf.placa || "").toUpperCase().trim() || "sem placa";
            const nota = nf.numero ? `NF ${nf.numero}` : nf.arquivo;

            return `${nota}: ${placa}`;
        })
        .join(" | ");

    throw new Error(`XMLs com placas diferentes. Selecione notas de apenas um caminhao. ${detalhes}`);
}

function validarPlacaNaTela() {
    const placa = campos.placa.value.trim();
    const encontrada = !placa || Boolean(buscarCaminhao(placa));
    campos.placaAviso.hidden = encontrada;
    campos.placa.classList.toggle("field-error", !encontrada);
    atualizarBotaoRepom();
    return encontrada;
}

function atualizarBotaoRepom() {
    $("#btnRepom").disabled =
        !campos.cidade.value.trim() ||
        !campos.nota.value.trim() ||
        !Number(campos.quantidade.value || 0) ||
        !validarPlacaSemAtualizarTela() ||
        campos.semPedagio.checked;

    atualizarBotaoCte();
}

function validarPlacaSemAtualizarTela() {
    const placa = campos.placa.value.trim();
    return !placa || Boolean(buscarCaminhao(placa));
}

function buscarProdutorKm(nf) {
    return buscarProdutorKmNaBase(estado.produtoresKm, nf);
}

function atualizarQuandoStorageMudar(changes, areaName) {
    if (areaName !== "local") return;

    if (changes[STORAGE_KEYS.repomPedagioEmitido]) {
        aplicarPedagioEmitido(changes[STORAGE_KEYS.repomPedagioEmitido].newValue || null);
    }

    if (changes[STORAGE_KEYS.historicoPedagios]) {
        aplicarHistoricoUsuario();
    }
}

function aplicarPedagioEmitido(pedagio) {
    repomEmitido.numeroPedagio.textContent = pedagio?.numeroPedagio || "-";
    repomEmitido.meioPagamento.textContent = pedagio?.numeroMeioPagamento || "-";
    repomEmitido.valor.textContent = formatarValorRepom(pedagio?.valor);
    repomEmitido.empresa.textContent = pedagio?.empresa || "-";
    atualizarBotaoCte(pedagio);
}

function atualizarBotaoCte(pedagioAtual = null) {
    const dadosNotaOk =
        Boolean(campos.cidade.value.trim()) &&
        Boolean(campos.nota.value.trim()) &&
        Boolean(Number(campos.quantidade.value || 0)) &&
        validarPlacaSemAtualizarTela();

    if (campos.semPedagio.checked) {
        repomEmitido.btnCte.disabled = !dadosNotaOk;
        return;
    }

    const pedagioOk =
        pedagioAtual?.numeroPedagio &&
        pedagioAtual?.numeroMeioPagamento &&
        pedagioAtual?.valor &&
        pedagioAtual?.empresa;

    repomEmitido.btnCte.disabled = !pedagioOk;
}

async function alternarSemPedagio() {
    const servicoAtual = await obterServicoAtual();

    if (servicoAtual) {
        await salvarServicoAtual({
            ...servicoAtual,
            semPedagio: campos.semPedagio.checked,
            autoConfirmar: campos.autoConfirmar.checked
        });
    }

    aplicarPedagioEmitido(campos.semPedagio.checked ? null : await obterPedagioEmitido());
    atualizarBotaoRepom();
}

async function aplicarHistoricoUsuario() {
    if (!estado.sessao?.nome) {
        aplicarHistorico([]);
        return;
    }

    aplicarHistorico(await obterHistoricoPedagiosUsuario(estado.sessao.nome));
}

function aplicarHistorico(historico) {
    const itens = historico.slice(0, 8);

    if (!itens.length) {
        repomEmitido.historico.textContent = "Nenhum pedagio emitido.";
        return;
    }

    repomEmitido.historico.replaceChildren(
        ...itens.map((item) => {
            const elemento = document.createElement("article");
            const titulo = document.createElement("strong");
            const detalhes = document.createElement("span");
            const produtor = document.createElement("span");

            elemento.className = "history-item";
            titulo.textContent = `Pedagio ${item.repom?.numeroPedagio || "-"}`;
            detalhes.textContent = [
                item.repom?.empresa,
                formatarValorRepom(item.repom?.valor),
                item.repom?.numeroMeioPagamento
            ].filter(Boolean).join(" | ");
            produtor.textContent = [
                item.servico?.produtor,
                item.servico?.municipio
            ].filter(Boolean).join(" - ");

            elemento.append(titulo, detalhes, produtor);
            return elemento;
        })
    );
}

function renderizarProdutores(servico) {
    const grupos = Array.isArray(servico.gruposProdutores) ? servico.gruposProdutores : [];

    if (!grupos.length) {
        resumo.produtor.textContent = servico.resumo?.produtor || "-";
        return;
    }

    const selecionado = obterGrupoSelecionado(servico) || grupos[0];

    resumo.produtor.replaceChildren(
        ...grupos.map((grupo) => {
            const botao = document.createElement("button");
            const nome = document.createElement("strong");
            const detalhes = document.createElement("span");
            const selecionadoAtual = grupo.id === selecionado.id;

            botao.type = "button";
            botao.className = `producer-group${selecionadoAtual ? " selected" : ""}`;
            botao.dataset.grupoProdutorId = grupo.id;
            nome.textContent = grupo.produtor || "-";
            detalhes.textContent = [
                `${grupo.quantidade || grupo.notas?.length || 0} NF`,
                grupo.notas?.length ? `Notas ${grupo.notas.join(", ")}` : "",
                grupo.municipio || grupo.cidade || "",
                valorExiste(grupo.distanciaPagamento) ? formatarKm(grupo.distanciaPagamento) : ""
            ].filter(Boolean).join(" | ");

            botao.append(nome, detalhes);
            botao.addEventListener("click", () => selecionarGrupoProdutorCte(grupo.id));
            return botao;
        })
    );
}

async function selecionarGrupoProdutorCte(grupoId) {
    const servico = await obterServicoAtual();

    if (!servico) return;

    const atualizado = {
        ...servico,
        grupoCteSelecionadoId: grupoId
    };

    estado.grupoCteSelecionadoId = grupoId;
    await salvarServicoAtual(atualizado);
    aplicarServicoNaTela(atualizado);
    setStatus("Grupo de produtor selecionado para o CTE.", "ok");
}

function prepararServicoParaCte(servico) {
    if (!servico) return null;

    const grupos = Array.isArray(servico.gruposProdutores) ? servico.gruposProdutores : [];
    const grupo = obterGrupoSelecionado(servico);

    if (!grupo || !grupos.length) return servico;

    return {
        ...servico,
        grupoCteSelecionadoId: grupo.id,
        gruposCte: grupos.map(semNfsInternasGrupo),
        grupoCte: semNfsInternasGrupo(grupo),
        indiceGrupoCteAtual: 0,
        resumo: {
            ...servico.resumo,
            produtor: grupo.produtor,
            emitente: grupo.emitente || servico.resumo?.emitente,
            municipio: grupo.municipio || grupo.cidade || servico.resumo?.municipio,
            notas: grupo.notas || [],
            pesoTotal: grupo.pesoTotal || 0,
            valorTotal: grupo.valorTotal || 0
        }
    };
}

function obterGrupoSelecionado(servico) {
    const grupos = Array.isArray(servico?.gruposProdutores) ? servico.gruposProdutores : [];

    if (!grupos.length) return null;

    const grupoId = estado.grupoCteSelecionadoId || servico.grupoCteSelecionadoId;
    return grupos.find((grupo) => grupo.id === grupoId) || grupos[0];
}

function semNfsInternasGrupo(grupo) {
    const { nfs, ...restante } = grupo;
    return restante;
}

function formatarValorRepom(valor) {
    if (!valorExiste(valor)) return "-";

    const texto = String(valor).trim();
    const numero = Number(
        texto.includes(",")
            ? texto.replace(/\./g, "").replace(",", ".")
            : texto
    );

    return Number.isFinite(numero) ? formatarMoeda(numero) : texto;
}

function setLoginStatus(mensagem, erro) {
    login.status.textContent = mensagem;
    login.status.className = `login-status${erro ? " error" : ""}`;
}

function setStatus(mensagem, tipo) {
    const status = $("#status");
    status.textContent = mensagem;
    status.className = `status ${tipo === "error" ? "error" : tipo === "empty" ? "empty" : ""}`;
}
