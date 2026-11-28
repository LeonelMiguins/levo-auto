import { criarEngineAutomacao } from "../engine.js";

const URL_ROTEIRO =
    "https://www.repom.com.br/Express/ValePedagio/Viagem/ViagemRoteiro.asp";

const CHAVE_AUTOMACAO_PENDENTE = "repomAutomacaoPendente";

const PAUSA_REPOM = {
    curta: 700,
    media: 1200,
    longa: 2500,
    documento: 1400
};

export async function executarRoteiroAuto(dados) {
    const auto = criarEngineAutomacao();

    if (location.href.includes("ViagemMostra.asp")) {
        await executarEtapaMostra(auto, dados);
        await limparAutomacaoPendente();
        return;
    }

    await salvarAutomacaoPendente(dados);

    if (!location.href.includes("ViagemRoteiro.asp")) {
        location.href = URL_ROTEIRO;
        return;
    }

    await executarEtapaRoteiro(auto, dados);
}

async function executarEtapaRoteiro(auto, dados) {
    const cidade = typeof dados === "string" ? dados : dados?.cidade;

    await aguardarPaginaPronta(auto);

    await clicarComPausa(auto, "#ListaRot", PAUSA_REPOM.media);

    await selecionarPorTextoComPausa(auto, "#Roteiros", cidade, PAUSA_REPOM.longa);

    await clicarComPausa(auto, "#ListaPerc", PAUSA_REPOM.longa);

    await selecionarPorTextoComPausa(auto, "#Percursos", "CASCAVEL(PR)", PAUSA_REPOM.media);

    await clicarComPausa(auto, "#Conf", PAUSA_REPOM.longa);

    console.log("Etapa 1 concluida, aguardando pagina ViagemMostra.asp");
}

async function executarEtapaMostra(auto, dados) {
    const caminhao = dados?.caminhao;

    if (!caminhao) {
        throw new Error("Caminhao nao encontrado nos dados da automacao");
    }

    await aguardarPaginaPronta(auto);

    await selecionarPorTextoComPausa(auto, "#Filial", "MATRIZ");

    await configurarEixosSuspensosVolta(auto, dados);

    await preencherComPausa(auto, "[name='PlacaVeiculoTag']", caminhao.placa, {
        blur: true
    });

    // validar placa
    await clicarComPausa(auto, "#PlacaVeiculoPedagioValidar", PAUSA_REPOM.media);

    await preencherComPausa(auto, "#CPFNomeMotorista", caminhao.motorista, {
        blur: true
    });

    await clicarBuscarEAguardarSelect(
        auto,
        "input[name='CPFNomeValidar']",
        "#CPFMotorista",
        "motorista"
    );

    await selecionarOpcaoQuandoAparecer(auto, "#CPFMotorista", caminhao.motorista);
    await auto.sleep(PAUSA_REPOM.curta);

    await preencherComPausa(auto, "#CPFCNPJNomeTransportador", caminhao.transportadora);

    await clicarBuscarEAguardarSelect(
        auto,
        "input[name='TransportadorValidar']",
        "#CPFCNPJTransportador",
        "transportador"
    );

    await selecionarOpcaoQuandoAparecer(
        auto,
        "#CPFCNPJTransportador",
        caminhao.transportadora
    );
    await auto.sleep(PAUSA_REPOM.curta);

    await configurarEixosSuspensosVolta(auto, dados);
    await adicionarDocumentos(auto, dados);
    await configurarEixosSuspensosVolta(auto, dados);
    await finalizarEConfirmarSeMarcado(auto, dados);

    console.log("Etapa 2 concluida com sucesso", {
        placa: caminhao.placa,
        motorista: caminhao.motorista,
        transportadora: caminhao.transportadora,
        notaInicial: dados.nota,
        quantidadeNotas: dados.quantidade,
        autoConfirmar: deveAutoConfirmar(dados)
    });
}

async function finalizarEConfirmarSeMarcado(auto, dados) {
    if (!deveAutoConfirmar(dados)) {
        console.log("Autoconfirmar desmarcado. Fluxo finalizado sem confirmar.");
        return;
    }

    console.log("Autoconfirmar marcado. Confirmando viagem.");

    // Remove a automacao principal antes de confirmar, para nao repetir o preenchimento
    // caso o Repom recarregue ou navegue para outra pagina apos o clique.
    await limparAutomacaoPendente();

    await clicarComPausa(auto, "input[name='Conf'][value='Confirma'], input[name='Conf']", PAUSA_REPOM.curta);
    await auto.esperarCarregar();
    await auto.sleep(3000);
}

function deveAutoConfirmar(dados) {
    return Boolean(dados?.autoConfirmar ?? dados?.autoImprimir);
}

function salvarAutomacaoPendente(dados) {
    return chrome.storage.local.set({
        [CHAVE_AUTOMACAO_PENDENTE]: dados
    });
}

function limparAutomacaoPendente() {
    return chrome.storage.local.remove(CHAVE_AUTOMACAO_PENDENTE);
}

async function selecionarOpcaoQuandoAparecer(auto, seletor, texto, timeout = 60000) {
    const inicio = Date.now();
    const textoBusca = normalizar(texto);
    const palavrasBusca = textoBusca.split(/\s+/).filter(Boolean);
    let ultimasOpcoes = [];

    while (Date.now() - inicio < timeout) {
        const select = await auto.esperarElemento(seletor);
        const opcoesValidas = Array.from(select.options).filter((option) => option.value !== "0");

        ultimasOpcoes = opcoesValidas.map((option) => ({
            value: option.value,
            text: option.textContent.trim(),
            nome: option.dataset?.nome || ""
        }));

        const opcao = opcoesValidas.find((option) => {
            const textoOpcao = normalizar(`${option.dataset?.nome || ""} ${option.textContent}`);

            return textoOpcao.includes(textoBusca) ||
                palavrasBusca.every((palavra) => textoOpcao.includes(palavra));
        });

        if (opcao) {
            await auto.selectByValue(seletor, opcao.value);
            await auto.sleep(PAUSA_REPOM.curta);
            return opcao;
        }

        if (opcoesValidas.length === 1) {
            await auto.selectByValue(seletor, opcoesValidas[0].value);
            await auto.sleep(PAUSA_REPOM.curta);
            console.warn(`Selecionada unica opcao disponivel em ${seletor}`, ultimasOpcoes[0]);
            return opcoesValidas[0];
        }

        await auto.sleep(250);
    }

    console.warn(`Opcoes encontradas em ${seletor}:`, ultimasOpcoes);
    throw new Error(`Opcao nao encontrada em ${seletor}: ${texto}`);
}

async function clicarBuscarEAguardarSelect(auto, seletorBotao, seletorSelect, nomeBusca) {
    const botao = await auto.esperarElemento(seletorBotao);

    console.log(`Clicando em Buscar ${nomeBusca}`, {
        seletorBotao,
        disabled: botao.disabled
    });

    botao.focus?.();
    botao.click();

    if (await aguardarSelectComOpcoes(auto, seletorSelect, 12000)) {
        return;
    }

    console.warn(`Select ${seletorSelect} nao carregou apos clique inicial. Tentando fallback.`);

    botao.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window
    }));

    try {
        botao.onclick?.call(botao, new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window
        }));
    } catch (error) {
        console.warn(`Fallback onclick falhou em ${seletorBotao}`, error);
    }

    if (await aguardarSelectComOpcoes(auto, seletorSelect, 12000)) {
        return;
    }

    throw new Error(`Buscar ${nomeBusca} nao carregou opcoes em ${seletorSelect}`);
}

async function aguardarSelectComOpcoes(auto, seletorSelect, timeout = 5000) {
    const inicio = Date.now();

    while (Date.now() - inicio < timeout) {
        const select = await auto.esperarElemento(seletorSelect);
        const opcoesValidas = Array.from(select.options).filter((option) => option.value !== "0");

        if (opcoesValidas.length) {
            return true;
        }

        await auto.sleep(250);
    }

    return false;
}

function normalizar(valor) {
    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();
}

async function adicionarDocumentos(auto, dados) {
    const quantidade = Math.max(Number(dados?.quantidade || 0), 0);

    if (!dados?.nota || !quantidade) {
        console.warn("Nota ou quantidade vazia, nenhum documento foi adicionado");
        return;
    }

    for (let indice = 0; indice < quantidade; indice++) {
        const numeroNota = incrementarNota(dados.nota, indice);

        await preencherComPausa(auto, "#NumeroDocumento", numeroNota, {}, PAUSA_REPOM.curta);

        await preencherComPausa(auto, "#SerieDocumento", "001", {}, PAUSA_REPOM.curta);

        await selecionarPorTextoComPausa(auto, "#FilialDocumento", "MATRIZ", PAUSA_REPOM.curta);

        await clicarComPausa(auto, "[name='Adiciona']", PAUSA_REPOM.documento);
        document.activeElement?.blur?.();

        console.log("Documento adicionado", {
            numeroNota,
            indice: indice + 1,
            total: quantidade
        });
    }
}

function incrementarNota(notaInicial, incremento) {
    const notaTexto = String(notaInicial).trim();
    const largura = notaTexto.length;
    const numero = Number(notaTexto);

    if (!Number.isFinite(numero)) {
        return notaTexto;
    }

    return String(numero + incremento).padStart(largura, "0");
}

async function configurarEixosSuspensosVolta(auto, dados) {
    const textoPagina = document.body?.innerText || "";

    if (!isTresBarras(dados?.cidade) && !isTresBarras(textoPagina)) {
        console.log("EixosSuspVolta mantido em 0, cidade nao e Tres Barras", {
            cidade: dados?.cidade
        });
        return;
    }

    await auto.sleep(PAUSA_REPOM.curta);
    await selecionarEixosSuspensosVolta(auto, "2");
    await auto.sleep(PAUSA_REPOM.curta);

    console.log("EixosSuspVolta ajustado para 2 por cidade TRES BARRAS");
}

function isTresBarras(cidade) {
    const cidadeNormalizada = normalizar(cidade).replace(/\s+/g, " ");
    const cidadeSemEspaco = cidadeNormalizada.replace(/\s+/g, "");

    return cidadeNormalizada.includes("TRES BARRAS") ||
        cidadeNormalizada.includes("3 BARRAS") ||
        cidadeSemEspaco.includes("TRESBARRAS") ||
        cidadeSemEspaco.includes("3BARRAS");
}

async function selecionarEixosSuspensosVolta(auto, valor) {
    const select = await auto.esperarElemento("#EixosSuspVolta", { timeout: 1000 });

    select.scrollIntoView?.({
        behavior: "instant",
        block: "center"
    });

    select.focus?.();
    select.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    select.click();
    select.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));

    const option = Array.from(select.options).find((item) => item.value === valor);

    if (!option) {
        throw new Error(`Opcao ${valor} nao encontrada em #EixosSuspVolta`);
    }

    select.value = valor;
    select.selectedIndex = option.index;
    option.selected = true;

    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    select.onchange?.call(select, new Event("change", { bubbles: true }));
    select.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true
    }));

    select.blur?.();

    if (select.value !== valor) {
        throw new Error(`#EixosSuspVolta nao manteve o valor ${valor}. Valor atual: ${select.value}`);
    }

    console.log("Valor atual de #EixosSuspVolta:", select.value);
}

async function aguardarPaginaPronta(auto) {
    await auto.sleep(PAUSA_REPOM.longa);
    await auto.esperarCarregar();
    await auto.sleep(PAUSA_REPOM.media);
}

async function clicarComPausa(auto, seletor, pausa = PAUSA_REPOM.media) {
    await auto.click(seletor);
    await auto.sleep(pausa);
}

async function preencherComPausa(auto, seletor, valor, opcoes = {}, pausa = PAUSA_REPOM.media) {
    await auto.setText(seletor, valor, opcoes);
    await auto.sleep(pausa);
}

async function selecionarPorTextoComPausa(auto, seletor, texto, pausa = PAUSA_REPOM.media) {
    await auto.selectByText(seletor, texto, { timeout: 60000 });
    await auto.sleep(pausa);
}
