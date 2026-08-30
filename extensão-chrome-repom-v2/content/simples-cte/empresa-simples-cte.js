import { STORAGE_KEYS } from "../../shared/constants.js";
import { normalizar } from "../../shared/text.js";

const TEMPO_MAX_CTE_MS = 10 * 60 * 1000;
const TIMEOUT_CTE_MS = 3000;
const TIMEOUT_AUTOCOMPLETE_MS = 8000;
const TIMEOUT_RECEITA_MS = 60000;
const INTERVALO_BUSCA_MS = 150;
const PAUSA_POS_CLIQUE_MS = 450;
const TEMPO_MINIMO_BUSCA_GRUPO_MS = 3500;

export async function selecionarEmpresaSimplesCte() {
    if (!location.hostname.includes("app.simplescte.com.br")) return false;

    const pendente = await obterPendente();

    if (!pendente) return false;

    if (pendente.etapa === "empresa_selecionada") {
        return clicarNovoCte(pendente);
    }

    if (pendente.etapa === "novo_cte_clicado") {
        return clicarTenhoNotaFiscalEletronica(pendente);
    }

    if (pendente.etapa === "nfe_clicado") {
        return clicarDigitarChaveAcesso(pendente);
    }

    if (pendente.etapa === "digitar_chave_clicado") {
        return preencherChavesAcesso(pendente);
    }

    if (pendente.etapa === "chaves_preenchidas") {
        return clicarProximoChaves(pendente);
    }

    if (pendente.etapa === "proximo_chaves_clicado") {
        return clicarProximoDocumentosCarga(pendente);
    }

    if (pendente.etapa === "proximo_documentos_carga_clicado") {
        return preencherProdutorTomador(pendente);
    }

    if (pendente.etapa === "produtor_selecionado") {
        return clicarBotaoCalculadoraFrete(pendente);
    }

    if (pendente.etapa === "calculadora_frete_clicada") {
        return selecionarCalculadoraFreteMinimo(pendente);
    }

    if (pendente.etapa === "calculadora_frete_minimo_selecionada") {
        return preencherCalculadoraFrete(pendente);
    }

    if (pendente.etapa !== "selecionar_empresa") return false;

    if (!pendente.transportadora) {
        console.warn("Transportadora nao informada para selecionar empresa no Simples CTE.", pendente);
        return false;
    }

    await esperarDocumentoPronto();
    await sleep(250);

    const elemento = await aguardarElementoPorTexto(pendente.transportadora, TIMEOUT_CTE_MS);

    if (!elemento) {
        console.warn("Empresa/transportadora nao encontrada na tela do Simples CTE.", {
            transportadora: pendente.transportadora,
            placa: pendente.placa
        });
        return false;
    }

    elemento.scrollIntoView?.({
        behavior: "smooth",
        block: "center"
    });
    await sleep(150);
    elemento.click();

    const pendenteAtualizado = {
        ...pendente,
        etapa: "empresa_selecionada",
        atualizadoEm: Date.now(),
        empresaSelecionada: textoLimpo(elemento.textContent)
    };

    await chrome.storage.local.set({
        [STORAGE_KEYS.simplesCtePendente]: pendenteAtualizado
    });

    console.log("Empresa selecionada no Simples CTE.", {
        transportadora: pendente.transportadora,
        elemento: textoLimpo(elemento.textContent)
    });

    await aguardarMudancaAposClique();
    await clicarNovoCte(pendenteAtualizado);
    return true;
}

async function clicarNovoCte(pendente) {
    const botao = await aguardarNovoCte(TIMEOUT_CTE_MS) || await aguardarBotaoPorTextos([
        "NOVO CTE",
        "NOVO CT-E",
        "NOVO CTe",
        "NOVO",
        "EMITIR CTE",
        "EMITIR CT-E",
        "CRIAR CTE",
        "CRIAR CT-E"
    ], TIMEOUT_CTE_MS);

    if (!botao) {
        console.warn("Botao Novo CTE do Simples CTE nao encontrado.", {
            pendente,
            botoesVisiveis: listarBotoesVisiveis()
        });
        return false;
    }

    await clicarElemento(botao);

    await chrome.storage.local.set({
        [STORAGE_KEYS.simplesCtePendente]: {
            ...pendente,
            etapa: "novo_cte_clicado",
            atualizadoEm: Date.now(),
            botaoNovoCte: textoLimpo(botao.textContent)
        }
    });

    console.log("Botao Novo CTE clicado.", {
        botao: textoLimpo(botao.textContent)
    });

    await sleep(PAUSA_POS_CLIQUE_MS);
    await clicarTenhoNotaFiscalEletronica({
        ...pendente,
        etapa: "novo_cte_clicado"
    });
    return true;
}

async function clicarTenhoNotaFiscalEletronica(pendente) {
    const botao = await aguardarBotaoPorTextos([
        "TENHO NOTA FISCAL ELETRONICA",
        "NOTA FISCAL ELETRONICA",
        "NF-E",
        "NFE"
    ], TIMEOUT_CTE_MS);

    if (!botao) {
        console.warn("Botao Tenho Nota Fiscal Eletronica nao encontrado.", pendente);
        return false;
    }

    await clicarElemento(botao);

    const pendenteAtualizado = {
        ...pendente,
        etapa: "nfe_clicado",
        atualizadoEm: Date.now(),
        botaoNfe: textoLimpo(botao.textContent)
    };

    await chrome.storage.local.set({
        [STORAGE_KEYS.simplesCtePendente]: pendenteAtualizado
    });

    console.log("Botao Tenho Nota Fiscal Eletronica clicado.", {
        botao: textoLimpo(botao.textContent)
    });

    await sleep(PAUSA_POS_CLIQUE_MS);
    await clicarDigitarChaveAcesso(pendenteAtualizado);
    return true;
}

async function clicarDigitarChaveAcesso(pendente) {
    const botao = await aguardarBotaoDigitarChaveAcesso(TIMEOUT_CTE_MS) || await aguardarBotaoPorTextos([
        "DIGITAR CHAVE DE ACESSO",
        "CHAVE DE ACESSO"
    ], TIMEOUT_CTE_MS);

    if (!botao) {
        console.warn("Botao Digitar chave de acesso nao encontrado.", pendente);
        return false;
    }

    await clicarElemento(botao);

    await chrome.storage.local.set({
        [STORAGE_KEYS.simplesCtePendente]: {
            ...pendente,
            etapa: "digitar_chave_clicado",
            atualizadoEm: Date.now(),
            botaoDigitarChave: textoLimpo(botao.textContent),
            indiceGrupoCteAtual: obterIndiceGrupoCteAtual(pendente)
        }
    });

    console.log("Botao Digitar chave de acesso clicado.", {
        botao: textoLimpo(botao.textContent)
    });

    await sleep(PAUSA_POS_CLIQUE_MS);
    await preencherChavesAcesso({
        ...pendente,
        etapa: "digitar_chave_clicado",
        indiceGrupoCteAtual: obterIndiceGrupoCteAtual(pendente)
    });
    return true;
}

async function preencherChavesAcesso(pendente) {
    const chaves = obterChavesAcesso(pendente);
    const grupo = obterGrupoCteAtual(pendente);

    if (!chaves.length) {
        console.warn("Nenhuma chave de acesso encontrada nos dados do servico.", pendente);
        return false;
    }

    const textarea = await aguardarTextareaChaves(TIMEOUT_CTE_MS);

    if (!textarea) {
        console.warn("Campo de chaves de acesso do Simples CTE nao encontrado.", pendente);
        return false;
    }

    textarea.focus?.();
    textarea.value = chaves.map(formatarChaveAcesso).join("\n");
    dispararEventos(textarea);
    textarea.blur?.();
    dispararEventos(textarea, ["blur"]);

    await chrome.storage.local.set({
        [STORAGE_KEYS.simplesCtePendente]: {
            ...pendente,
            etapa: "chaves_preenchidas",
            atualizadoEm: Date.now(),
            chavesAcesso: chaves,
            indiceGrupoCteAtual: obterIndiceGrupoCteAtual(pendente),
            grupoCteAtualId: grupo?.id || "",
            grupoCteAtualProdutor: grupo?.produtor || ""
        }
    });

    console.log("Chaves de acesso preenchidas no Simples CTE.", {
        quantidade: chaves.length,
        grupo: grupo?.produtor || "sem grupo"
    });

    await sleep(PAUSA_POS_CLIQUE_MS);
    await clicarProximoChaves({
        ...pendente,
        etapa: "chaves_preenchidas",
        chavesAcesso: chaves,
        indiceGrupoCteAtual: obterIndiceGrupoCteAtual(pendente),
        grupoCteAtualId: grupo?.id || "",
        grupoCteAtualProdutor: grupo?.produtor || ""
    });
    return true;
}

async function clicarProximoChaves(pendente) {
    const textoAntesBusca = document.body?.innerText || "";
    const botao = await aguardarBotaoBuscarChaves(TIMEOUT_CTE_MS) || await aguardarBotaoPorTextos([
        "BUSCAR",
        "PROXIMO",
        "AVANCAR",
        "CONTINUAR"
    ], TIMEOUT_CTE_MS);

    if (!botao) {
        console.warn("Botao Buscar apos chaves de acesso nao encontrado.", {
            pendente,
            botoesVisiveis: listarBotoesVisiveis()
        });
        return false;
    }

    await clicarElemento(botao);

    const pendenteAtualizado = {
        ...pendente,
        etapa: "proximo_chaves_clicado",
        atualizadoEm: Date.now(),
        botaoBuscarChaves: textoLimpo(botao.textContent),
        indiceGrupoCteAtual: obterIndiceGrupoCteAtual(pendente)
    };

    await chrome.storage.local.set({
        [STORAGE_KEYS.simplesCtePendente]: pendenteAtualizado
    });

    console.log("Botao Buscar apos chaves de acesso clicado.", {
        botao: textoLimpo(botao.textContent)
    });

    const modalCarregado = await aguardarBuscaChavesDoGrupo(pendenteAtualizado, textoAntesBusca);

    if (!modalCarregado) {
        console.warn("Dados do grupo nao terminaram de carregar apos buscar na Receita/Sefaz.", {
            pendente: pendenteAtualizado,
            grupoAtual: obterGrupoCteAtual(pendenteAtualizado),
            botoesVisiveis: listarBotoesVisiveis()
        });
        return false;
    }

    if (temProximoGrupoCte(pendenteAtualizado)) {
        const proximoPendente = {
            ...pendenteAtualizado,
            etapa: "nfe_clicado",
            atualizadoEm: Date.now(),
            indiceGrupoCteAtual: obterIndiceGrupoCteAtual(pendenteAtualizado) + 1
        };

        await chrome.storage.local.set({
            [STORAGE_KEYS.simplesCtePendente]: proximoPendente
        });

        console.log("Grupo de chaves carregado. Iniciando proximo grupo no Simples CTE.", {
            indiceGrupoCteAtual: proximoPendente.indiceGrupoCteAtual,
            grupos: obterGruposCte(proximoPendente).length
        });

        await sleep(PAUSA_POS_CLIQUE_MS);
        await clicarDigitarChaveAcesso(proximoPendente);
        return true;
    }

    await clicarProximoDocumentosCarga(pendenteAtualizado);
    return true;
}

async function aguardarBotaoDigitarChaveAcesso(timeout) {
    const inicio = Date.now();

    await esperarDocumentoPronto();
    await sleep(150);

    while (Date.now() - inicio < timeout) {
        const botao = encontrarBotaoDigitarChaveAcesso();

        if (botao) return botao;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

async function aguardarBuscaChavesDoGrupo(pendente, textoAntesBusca) {
    const inicio = Date.now();
    const textoAntes = normalizar(textoAntesBusca);

    while (Date.now() - inicio < TIMEOUT_RECEITA_MS) {
        const tempoDecorrido = Date.now() - inicio;
        const textoAtual = normalizar(document.body?.innerText || "");
        const modalDocumentosDisponivel = textoAtual.includes("INFORME OS DOCUMENTOS DA CARGA");
        const carregando = existemIndicadoresCarregamento();
        const formularioChavesAberto = campoChavesAcessoAberto();
        const houveMudancaTela = textoAtual !== textoAntes;
        const grupoAtualVisivel = grupoCteAtualApareceNaTela(pendente);
        const precisaConfirmarGrupo = obterGruposCte(pendente).length > 1;

        if (
            modalDocumentosDisponivel &&
            tempoDecorrido >= TEMPO_MINIMO_BUSCA_GRUPO_MS &&
            !carregando &&
            !formularioChavesAberto &&
            (precisaConfirmarGrupo ? grupoAtualVisivel : houveMudancaTela || grupoAtualVisivel)
        ) {
            return true;
        }

        await sleep(500);
    }

    return false;
}

function campoChavesAcessoAberto() {
    const textarea =
        document.querySelector("textarea[name='chaves_acesso_csv']") ||
        document.querySelector("textarea[placeholder*='5500']");

    return Boolean(textarea && isVisivel(textarea));
}

function existemIndicadoresCarregamento() {
    const texto = normalizar(document.body?.innerText || "");

    if (
        texto.includes("CARREGANDO") ||
        texto.includes("BUSCANDO") ||
        texto.includes("CONSULTANDO") ||
        texto.includes("PROCESSANDO") ||
        texto.includes("AGUARDE")
    ) {
        return true;
    }

    return Array.from(document.querySelectorAll([
        "[role='progressbar']",
        ".MuiCircularProgress-root",
        ".MuiLinearProgress-root",
        "[class*='loading']",
        "[class*='Loading']",
        "[class*='spinner']",
        "[class*='Spinner']",
        "[class*='progress']",
        "[class*='Progress']"
    ].join(","))).some(isVisivel);
}

function grupoCteAtualApareceNaTela(pendente) {
    const grupo = obterGrupoCteAtual(pendente);

    if (!grupo) return false;

    const textoAtual = normalizar(document.body?.innerText || "");
    const notas = Array.isArray(grupo.notas) ? grupo.notas : [];
    const chaves = Array.isArray(grupo.chavesAcesso) ? grupo.chavesAcesso : [];

    return notas.some((nota) => textoAtual.includes(normalizar(nota))) ||
        chaves.some((chave) => textoAtual.includes(normalizar(formatarChaveAcesso(chave))) || textoAtual.includes(normalizar(chave))) ||
        textoAtual.includes(normalizar(grupo.produtor || ""));
}

function encontrarBotaoDigitarChaveAcesso() {
    const botaoPorId = document.querySelector("button#chave-acesso");

    if (botaoPorId && isVisivel(botaoPorId) && !botaoPorId.disabled) {
        return botaoPorId;
    }

    const icone = document.querySelector("svg[data-icon-name='line-file-contract-solid']");
    const botaoPorIcone = icone?.closest("button, [role='button']");

    if (botaoPorIcone && isVisivel(botaoPorIcone) && !botaoPorIcone.disabled) {
        return botaoPorIcone;
    }

    return null;
}

async function aguardarBotaoBuscarChaves(timeout) {
    const inicio = Date.now();

    await esperarDocumentoPronto();
    await sleep(150);

    while (Date.now() - inicio < timeout) {
        const botao = encontrarBotaoBuscarChaves();

        if (botao) return botao;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

function encontrarBotaoBuscarChaves() {
    const botoes = Array.from(document.querySelectorAll([
        "button.line-button-contained",
        "button.css-wicqjn",
        "button[type='button']",
        "button"
    ].join(",")))
        .filter(isVisivel)
        .filter((elemento) => !elemento.disabled);

    return botoes.find((elemento) => normalizar(elemento.textContent) === "BUSCAR") ||
        botoes.find((elemento) => normalizar(elemento.textContent).includes("BUSCAR")) ||
        null;
}

async function clicarProximoDocumentosCarga(pendente) {
    const modalCarregado = await aguardarTextoNaTela("INFORME OS DOCUMENTOS DA CARGA", TIMEOUT_RECEITA_MS);

    if (!modalCarregado) {
        console.warn("Modal Informe os documentos da carga nao esta disponivel.", pendente);
        return false;
    }

    const botao =
        await aguardarElementoPorSeletor("[data-testid='/cte--modal-Informe os documentos da carga--button-proximo']", TIMEOUT_CTE_MS) ||
        await aguardarElementoPorSeletor("#cte-wizard-submit-button", TIMEOUT_CTE_MS) ||
        await aguardarBotaoPorTextos(["PROXIMO"], TIMEOUT_CTE_MS);

    if (!botao) {
        console.warn("Botao Proximo do modal Informe os documentos da carga nao encontrado.", {
            pendente,
            botoesVisiveis: listarBotoesVisiveis()
        });
        return false;
    }

    await clicarElemento(botao);

    const pendenteAtualizado = {
        ...pendente,
        etapa: "proximo_documentos_carga_clicado",
        atualizadoEm: Date.now(),
        botaoProximoDocumentosCarga: textoLimpo(botao.textContent)
    };

    await chrome.storage.local.set({
        [STORAGE_KEYS.simplesCtePendente]: pendenteAtualizado
    });

    console.log("Botao Proximo do modal Informe os documentos da carga clicado.", {
        botao: textoLimpo(botao.textContent)
    });

    await sleep(PAUSA_POS_CLIQUE_MS);
    await preencherProdutorTomador(pendenteAtualizado);
    return true;
}

async function preencherProdutorTomador(pendente) {
    const produtor = obterProdutorNota(pendente);

    if (!produtor) {
        console.warn("Produtor nao encontrado nos dados da nota para preencher no Simples CTE.", pendente);
        return false;
    }

    const input = await aguardarCampoTomador(TIMEOUT_AUTOCOMPLETE_MS);

    if (!input) {
        console.warn("Campo Tomador nao encontrado no Simples CTE.", {
            pendente,
            camposVisiveis: listarCamposVisiveis()
        });
        return false;
    }

    if (campoTomadorValido(input, produtor)) {
        return concluirProdutorTomador(pendente, produtor, "preenchido automaticamente");
    }

    await preencherCampoTomador(input, produtor);

    if (campoTomadorValido(input, produtor)) {
        return concluirProdutorTomador(pendente, produtor, "preenchido no campo");
    }

    const opcao = await aguardarOpcaoAutocomplete(produtor, TIMEOUT_AUTOCOMPLETE_MS);

    if (!opcao) {
        if (campoTomadorValido(input, produtor)) {
            return concluirProdutorTomador(pendente, produtor, "preenchido apos busca");
        }

        console.warn("Tomador vazio, DIVERSOS ou opcao do produtor nao encontrada no autocomplete do Simples CTE.", {
            produtor,
            pendente,
            valorCampo: obterTextoCampo(input),
            opcoesVisiveis: listarOpcoesAutocomplete()
        });
        return false;
    }

    await clicarElemento(opcao);

    if (!await aguardarCampoTomadorValido(produtor, TIMEOUT_CTE_MS)) {
        console.warn("Tomador nao ficou valido apos selecionar produtor no Simples CTE.", {
            produtor,
            pendente,
            valorCampo: obterTextoCampo(input),
            camposVisiveis: listarCamposVisiveis()
        });
        return false;
    }

    return concluirProdutorTomador(pendente, produtor, textoLimpo(opcao.textContent));
}

async function concluirProdutorTomador(pendente, produtor, origemSelecao) {
    const pendenteAtualizado = {
        ...pendente,
        etapa: "produtor_selecionado",
        atualizadoEm: Date.now(),
        produtorSelecionado: produtor,
        opcaoProdutor: origemSelecao
    };

    await chrome.storage.local.set({
        [STORAGE_KEYS.simplesCtePendente]: pendenteAtualizado
    });

    console.log("Produtor selecionado no Simples CTE.", {
        produtor,
        opcao: origemSelecao
    });

    await sleep(PAUSA_POS_CLIQUE_MS);
    await clicarBotaoCalculadoraFrete(pendenteAtualizado);
    return true;
}

async function clicarBotaoCalculadoraFrete(pendente) {
    const botao = await aguardarBotaoCalculadoraFrete(TIMEOUT_CTE_MS);

    if (!botao) {
        console.warn("Botao da calculadora de frete nao encontrado no Simples CTE.", {
            pendente,
            botoesVisiveis: listarBotoesVisiveis()
        });
        return false;
    }

    await clicarElemento(botao);

    const pendenteAtualizado = {
        ...pendente,
        etapa: "calculadora_frete_clicada",
        atualizadoEm: Date.now()
    };

    await chrome.storage.local.set({
        [STORAGE_KEYS.simplesCtePendente]: pendenteAtualizado
    });

    console.log("Botao da calculadora de frete clicado.");

    await sleep(PAUSA_POS_CLIQUE_MS);
    await selecionarCalculadoraFreteMinimo(pendenteAtualizado);
    return true;
}

async function selecionarCalculadoraFreteMinimo(pendente) {
    const opcao = await aguardarElementoPorTexto("CALCULADORA DE FRETE MINIMO", TIMEOUT_CTE_MS);

    if (!opcao) {
        console.warn("Opcao Calculadora de frete minimo nao encontrada no Simples CTE.", {
            pendente,
            opcoesVisiveis: listarOpcoesAutocomplete(),
            botoesVisiveis: listarBotoesVisiveis()
        });
        return false;
    }

    await clicarElemento(opcao);

    const pendenteAtualizado = {
        ...pendente,
        etapa: "calculadora_frete_minimo_selecionada",
        atualizadoEm: Date.now(),
        opcaoCalculadoraFrete: textoLimpo(opcao.textContent)
    };

    await chrome.storage.local.set({
        [STORAGE_KEYS.simplesCtePendente]: pendenteAtualizado
    });

    console.log("Opcao Calculadora de frete minimo selecionada.", {
        opcao: textoLimpo(opcao.textContent)
    });

    await sleep(PAUSA_POS_CLIQUE_MS);
    await preencherCalculadoraFrete(pendenteAtualizado);
    return true;
}

async function preencherCalculadoraFrete(pendente) {
    const placaOk = await preencherVeiculoTracaoCalculadora(pendente);

    if (!placaOk) return false;

    const contratoOk = await selecionarOpcaoSelectPorRotulo(
        "O QUE ESTA SENDO CONTRATADO",
        "SOMENTE VEICULO TRACAO CAVALO",
        0
    );

    if (!contratoOk) {
        console.warn("Campo O que esta sendo contratado nao encontrado/preenchido na calculadora de frete.", {
            pendente,
            camposVisiveis: listarCamposVisiveis()
        });
        return false;
    }

    const cargaOk = await selecionarOpcaoSelectPorRotulo(
        "TIPO DE CARGA",
        "GRANEL SOLIDO",
        1
    );

    if (!cargaOk) {
        console.warn("Campo Tipo de carga nao encontrado/preenchido na calculadora de frete.", {
            pendente,
            camposVisiveis: listarCamposVisiveis()
        });
        return false;
    }

    const distanciaOk = await preencherDistanciaCalculadora(pendente);

    if (!distanciaOk) return false;

    const retornoVazioOk = await marcarCheckboxCalculadora("RETORNO VAZIO");

    if (!retornoVazioOk) {
        console.warn("Checkbox Retorno vazio nao encontrado/marcado na calculadora de frete.", {
            pendente,
            camposVisiveis: listarCamposVisiveis()
        });
        return false;
    }

    const altoDesempenhoOk = await marcarCheckboxCalculadora("ALTO DESEMPENHO");

    if (!altoDesempenhoOk) {
        console.warn("Checkbox E alto desempenho nao encontrado/marcado na calculadora de frete.", {
            pendente,
            camposVisiveis: listarCamposVisiveis()
        });
        return false;
    }

    const calcularOk = await clicarCalcularFrete();

    if (!calcularOk) {
        console.warn("Botao Calcular nao encontrado na calculadora de frete.", {
            pendente,
            botoesVisiveis: listarBotoesVisiveis()
        });
        return false;
    }

    await chrome.storage.local.set({
        [STORAGE_KEYS.simplesCtePendente]: {
            ...pendente,
            etapa: "calculadora_frete_calculada",
            atualizadoEm: Date.now()
        }
    });

    console.log("Calculadora de frete preenchida e calculada no Simples CTE.");
    return true;
}

async function aguardarBotaoCalculadoraFrete(timeout) {
    const inicio = Date.now();

    await esperarDocumentoPronto();
    await sleep(150);

    while (Date.now() - inicio < timeout) {
        const botao = encontrarBotaoCalculadoraFrete();

        if (botao) return botao;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

function encontrarBotaoCalculadoraFrete() {
    const icone = document.querySelector("svg[data-icon-name='line-calculator-solid']");
    const botaoPorIcone = icone?.closest("button, [role='button'], .MuiButtonBase-root");

    if (botaoPorIcone && isVisivel(botaoPorIcone) && !botaoPorIcone.disabled) {
        return botaoPorIcone;
    }

    const botoes = Array.from(document.querySelectorAll([
        "button.MuiButton-neutralPrimary",
        "button.MuiButtonBase-root",
        "button"
    ].join(",")))
        .filter(isVisivel)
        .filter((elemento) => !elemento.disabled);

    return botoes.find((elemento) => elemento.querySelector("svg[data-icon-name*='calculator']")) || null;
}

async function preencherVeiculoTracaoCalculadora(pendente) {
    const placa = obterPlaca(pendente);

    if (!placa) {
        console.warn("Placa nao encontrada nos dados para preencher Veiculo tracao.", pendente);
        return false;
    }

    const input = await aguardarCampoPorRotulo("VEICULO TRACAO", "input[role='combobox'], input[placeholder*='Digite']", TIMEOUT_AUTOCOMPLETE_MS);

    if (!input) {
        console.warn("Campo Veiculo tracao nao encontrado na calculadora de frete.", {
            pendente,
            camposVisiveis: listarCamposVisiveis()
        });
        return false;
    }

    if (campoContemPlaca(input, placa)) return true;

    await preencherInputBusca(input, placa);

    const opcao = await aguardarOpcaoPorComparador(
        (elemento) => textoContemPlaca(elemento.textContent, placa),
        TIMEOUT_AUTOCOMPLETE_MS
    );

    if (!opcao) {
        console.warn("Opcao da placa nao encontrada no autocomplete da calculadora de frete.", {
            placa,
            pendente,
            valorCampo: obterTextoCampo(input),
            opcoesVisiveis: listarOpcoesAutocomplete()
        });
        return false;
    }

    await clicarElemento(opcao);

    if (!await aguardarCampoComPlaca(input, placa, TIMEOUT_CTE_MS)) {
        console.warn("Veiculo tracao nao ficou com a placa correta apos selecao.", {
            placa,
            valorCampo: obterTextoCampo(input),
            camposVisiveis: listarCamposVisiveis()
        });
        return false;
    }

    return true;
}

async function selecionarOpcaoSelectPorRotulo(rotulo, opcaoTexto, indiceFallback = null) {
    const modal = obterModalCalculadoraFrete();
    const compararOpcao = criarComparadorTextoOpcao(opcaoTexto);
    const campo = await aguardarSelectCalculadora(rotulo, opcaoTexto, indiceFallback, TIMEOUT_AUTOCOMPLETE_MS, modal);

    if (!campo) return false;

    if (compararOpcao(campo)) {
        console.log("Select da calculadora ja estava preenchido.", {
            rotulo,
            valor: textoLimpo(campo.textContent || campo.value)
        });
        return true;
    }

    await clicarSelectMui(campo);

    const opcao = await aguardarOpcaoPorComparador(
        compararOpcao,
        TIMEOUT_AUTOCOMPLETE_MS
    );

    if (!opcao) return false;

    await clicarElemento(opcao);
    await sleep(PAUSA_POS_CLIQUE_MS);

    return await aguardarSelectComTexto(rotulo, opcaoTexto, indiceFallback, TIMEOUT_CTE_MS) ||
        compararOpcao(opcao);
}

async function clicarSelectMui(campo) {
    campo.scrollIntoView?.({
        behavior: "instant",
        block: "center"
    });
    await sleep(120);
    campo.focus?.();
    ["mousedown", "mouseup", "click"].forEach((tipo) => {
        campo.dispatchEvent(new MouseEvent(tipo, {
            bubbles: true,
            cancelable: true,
            view: window
        }));
    });
}

async function aguardarSelectCalculadora(rotulo, opcaoTexto, indiceFallback, timeout, escopo = document) {
    const inicio = Date.now();

    await esperarDocumentoPronto();
    await sleep(150);

    while (Date.now() - inicio < timeout) {
        const campo = encontrarSelectCalculadoraEspecifico(rotulo, opcaoTexto) ||
            encontrarCampoPorRotulo(rotulo, ".MuiSelect-select, div[role='combobox']", escopo || document) ||
            encontrarSelectCalculadoraPorIndice(indiceFallback);

        if (campo) return campo;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

function encontrarSelectCalculadoraEspecifico(rotulo, opcaoTexto) {
    const modal = obterModalCalculadoraFrete();

    if (!modal) return null;

    const selects = obterSelectsCalculadora(modal);
    const rotuloNormalizado = normalizar(rotulo);
    const compararOpcao = criarComparadorTextoOpcao(opcaoTexto);

    if (rotuloNormalizado.includes("CONTRATADO")) {
        return selects.find(compararOpcao) ||
            selects.find((select) => normalizar(select.textContent).includes("COMPOSICAO")) ||
            selects[0] ||
            null;
    }

    if (rotuloNormalizado.includes("TIPO DE CARGA")) {
        return selects.find(compararOpcao) ||
            selects.find((select) => normalizar(select.textContent).includes("GRANEL")) ||
            selects[1] ||
            null;
    }

    return null;
}

async function aguardarSelectComTexto(rotulo, textoEsperado, indiceFallback, timeout) {
    const inicio = Date.now();

    while (Date.now() - inicio < timeout) {
        const modal = obterModalCalculadoraFrete();
        const campo = encontrarSelectCalculadoraEspecifico(rotulo, textoEsperado) ||
            encontrarCampoPorRotulo(rotulo, ".MuiSelect-select, div[role='combobox']", modal || document) ||
            encontrarSelectCalculadoraPorIndice(indiceFallback);

        if (campo && criarComparadorTextoOpcao(textoEsperado)(campo)) return true;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return false;
}

function encontrarSelectCalculadoraPorIndice(indice) {
    if (!Number.isInteger(indice)) return null;

    const modal = obterModalCalculadoraFrete();

    if (!modal) return null;

    return obterSelectsCalculadora(modal)[indice] || null;
}

function obterSelectsCalculadora(modal) {
    return Array.from(modal.querySelectorAll(".MuiSelect-select, div[role='combobox']"))
        .filter(isVisivel)
        .filter((elemento) => elemento.tagName !== "INPUT")
        .filter((elemento) => !elemento.disabled);
}

async function marcarCheckboxCalculadora(rotulo) {
    const checkbox = await aguardarCheckboxCalculadora(rotulo, TIMEOUT_CTE_MS);

    if (!checkbox) return false;

    if (checkbox.checked) return true;

    await clicarCheckbox(checkbox);
    return aguardarCheckboxMarcado(rotulo, TIMEOUT_CTE_MS);
}

async function aguardarCheckboxCalculadora(rotulo, timeout) {
    const inicio = Date.now();

    await esperarDocumentoPronto();
    await sleep(150);

    while (Date.now() - inicio < timeout) {
        const checkbox = encontrarCheckboxCalculadora(rotulo);

        if (checkbox) return checkbox;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

function encontrarCheckboxCalculadora(rotulo) {
    const modal = obterModalCalculadoraFrete();

    if (!modal) return null;

    const rotuloBusca = normalizarCompacto(rotulo);

    const elementoRotulo = Array.from(modal.querySelectorAll("label, span, div"))
        .filter(isVisivel)
        .filter((elemento) => normalizarCompacto(elemento.textContent).includes(rotuloBusca))
        .sort((a, b) => textoLimpo(a.textContent).length - textoLimpo(b.textContent).length)[0];

    if (!elementoRotulo) return null;

    const label = elementoRotulo.closest("label");
    const checkboxNoLabel = label?.querySelector("input[type='checkbox']");

    if (checkboxNoLabel) return checkboxNoLabel;

    return encontrarCheckboxProximoAoRotulo(modal, elementoRotulo);
}

async function clicarCheckbox(checkbox) {
    const alvo = checkbox.closest(".MuiCheckbox-root, .PrivateSwitchBase-root") ||
        checkbox.closest("label") ||
        checkbox;

    alvo.scrollIntoView?.({
        behavior: "instant",
        block: "center"
    });
    await sleep(120);
    ["mousedown", "mouseup", "click"].forEach((tipo) => {
        alvo.dispatchEvent(new MouseEvent(tipo, {
            bubbles: true,
            cancelable: true,
            view: window
        }));
    });

    if (!checkbox.checked) {
        checkbox.click();
        checkbox.dispatchEvent(new Event("change", {
            bubbles: true
        }));
    }
}

function encontrarCheckboxProximoAoRotulo(modal, elementoRotulo) {
    const rectRotulo = elementoRotulo.getBoundingClientRect();

    return Array.from(modal.querySelectorAll("input[type='checkbox']"))
        .map((checkbox) => ({
            checkbox,
            rect: checkbox.getBoundingClientRect()
        }))
        .filter((item) =>
            Math.abs(item.rect.top - rectRotulo.top) <= 30 ||
            Math.abs((item.rect.top + item.rect.height / 2) - (rectRotulo.top + rectRotulo.height / 2)) <= 30
        )
        .sort((a, b) => Math.abs(a.rect.left - rectRotulo.left) - Math.abs(b.rect.left - rectRotulo.left))[0]?.checkbox || null;
}

async function aguardarCheckboxMarcado(rotulo, timeout) {
    const inicio = Date.now();

    while (Date.now() - inicio < timeout) {
        const checkbox = encontrarCheckboxCalculadora(rotulo);

        if (checkbox && (checkbox.checked || checkbox.getAttribute("value") === "true")) return true;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return false;
}

async function clicarCalcularFrete() {
    const botao = await aguardarBotaoCalcularFrete(TIMEOUT_CTE_MS);

    if (!botao) return false;

    await clicarElemento(botao);
    return true;
}

async function aguardarBotaoCalcularFrete(timeout) {
    const inicio = Date.now();

    await esperarDocumentoPronto();
    await sleep(150);

    while (Date.now() - inicio < timeout) {
        const botao = encontrarBotaoCalcularFrete();

        if (botao) return botao;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

function encontrarBotaoCalcularFrete() {
    const modal = obterModalCalculadoraFrete();

    if (!modal) return null;

    return Array.from(modal.querySelectorAll("button.line-button-contained, button[type='submit'], button"))
        .filter(isVisivel)
        .filter((botao) => !botao.disabled)
        .find((botao) => normalizar(botao.textContent).includes("CALCULAR")) || null;
}

async function preencherDistanciaCalculadora(pendente) {
    const distancia = obterDistanciaPagamento(pendente);

    if (!Number.isFinite(distancia) || distancia <= 0) {
        console.warn("Distancia de pagamento nao encontrada para preencher calculadora de frete.", pendente);
        return false;
    }

    const input = await aguardarCampoDistanciaCalculadora(TIMEOUT_AUTOCOMPLETE_MS);

    if (!input) {
        console.warn("Campo Distancia nao encontrado na calculadora de frete.", {
            pendente,
            camposVisiveis: listarCamposVisiveis()
        });
        return false;
    }

    const valor = formatarDistanciaCalculadora(distancia);

    await preencherInputTexto(input, valor);

    if (!await aguardarValorInput(input, valor, TIMEOUT_CTE_MS)) {
        console.warn("Distancia nao ficou preenchida na calculadora de frete.", {
            distancia: valor,
            valorCampo: textoLimpo(input.value),
            pendente,
            camposVisiveis: listarCamposVisiveis()
        });
        return false;
    }

    return true;
}

async function aguardarCampoDistanciaCalculadora(timeout) {
    const inicio = Date.now();

    await esperarDocumentoPronto();
    await sleep(150);

    while (Date.now() - inicio < timeout) {
        const input = encontrarCampoDistanciaCalculadora();

        if (input) return input;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

function encontrarCampoDistanciaCalculadora() {
    const modal = obterModalCalculadoraFrete();

    return encontrarCampoPorRotulo("DISTANCIA KM", "input", modal) ||
        encontrarCampoPorRotulo("DISTANCIA", "input", modal) ||
        encontrarInputNumericoCalculadora();
}

function encontrarInputNumericoCalculadora() {
    const modal = obterModalCalculadoraFrete();
    const textoTela = normalizar(modal?.innerText || document.body?.innerText || "");

    if (!textoTela.includes("CALCULADORA DE FRETE")) return null;

    return Array.from((modal || document).querySelectorAll("input[type='text'], input:not([type])"))
        .filter(isVisivel)
        .filter((input) => !input.disabled && !input.readOnly)
        .filter((input) => input.getAttribute("role") !== "combobox")
        .filter((input) => !campoEhBuscaGlobalOuCfop(input))
        .filter((input) => {
            const texto = normalizar([
                input.name,
                input.id,
                input.placeholder,
                input.getAttribute("aria-label")
            ].filter(Boolean).join(" "));

            return !texto.includes("DIGITE PARA BUSCAR") &&
                !texto.includes("CHAVE") &&
                !texto.includes("PLACA") &&
                !texto.includes("VEICULO");
        })
        .sort((a, b) => {
            const valorA = textoLimpo(a.value);
            const valorB = textoLimpo(b.value);

            if (/^\d+([,.]\d+)?$/.test(valorA) && !/^\d+([,.]\d+)?$/.test(valorB)) return -1;
            if (!/^\d+([,.]\d+)?$/.test(valorA) && /^\d+([,.]\d+)?$/.test(valorB)) return 1;

            return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
        })[0] || null;
}

function obterModalCalculadoraFrete() {
    return Array.from(document.querySelectorAll(".line-modal-dialog, [role='dialog'], form"))
        .filter(isVisivel)
        .find((elemento) => normalizar(elemento.textContent).includes("CALCULADORA DE FRETE")) || null;
}

async function aguardarCampoPorRotulo(rotulo, seletorCampo, timeout, escopo = document) {
    const inicio = Date.now();

    await esperarDocumentoPronto();
    await sleep(150);

    while (Date.now() - inicio < timeout) {
        const campo = encontrarCampoPorRotulo(rotulo, seletorCampo, escopo || document);

        if (campo) return campo;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

function encontrarCampoPorRotulo(rotulo, seletorCampo, escopo = document) {
    const raiz = escopo || document;
    const rotuloBusca = normalizar(rotulo);
    const rotuloBuscaCompacto = normalizarCompacto(rotulo);
    const rotulos = Array.from(raiz.querySelectorAll("label, span, p, div"))
        .filter(isVisivel)
        .map((elemento) => ({
            elemento,
            texto: normalizar(elemento.textContent),
            textoCompacto: normalizarCompacto(elemento.textContent),
            tamanho: textoLimpo(elemento.textContent).length
        }))
        .filter((item) =>
            item.texto.includes(rotuloBusca) ||
            item.textoCompacto.includes(rotuloBuscaCompacto)
        )
        .sort((a, b) => a.tamanho - b.tamanho);

    for (const item of rotulos) {
        const campo = encontrarCampoAbaixoDoRotulo(item.elemento, seletorCampo, raiz);

        if (campo) return campo;
    }

    return null;
}

function encontrarCampoAbaixoDoRotulo(rotulo, seletorCampo, escopo = document) {
    const rectRotulo = rotulo.getBoundingClientRect();

    return Array.from(escopo.querySelectorAll(seletorCampo))
        .filter(isVisivel)
        .filter((campo) => !campo.disabled && !campo.readOnly)
        .map((campo) => ({
            campo,
            rect: campo.getBoundingClientRect()
        }))
        .filter((item) =>
            item.rect.top >= rectRotulo.top &&
            item.rect.top <= rectRotulo.bottom + 130 &&
            retangulosSobrepoemHorizontalmente(rectRotulo, item.rect)
        )
        .sort((a, b) => (a.rect.top - b.rect.top) || (a.rect.left - b.rect.left))[0]?.campo || null;
}

async function aguardarOpcaoPorComparador(comparar, timeout) {
    const inicio = Date.now();

    while (Date.now() - inicio < timeout) {
        const opcao = encontrarOpcaoPorComparador(comparar);

        if (opcao) return opcao;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

async function aguardarTextoCampo(campo, textoEsperado, timeout) {
    const inicio = Date.now();

    while (Date.now() - inicio < timeout) {
        if (textoEquivalente(campo.textContent || campo.value, textoEsperado)) return true;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return false;
}

function encontrarOpcaoPorComparador(comparar) {
    const candidatos = Array.from(document.querySelectorAll([
        "[role='option']",
        "[role='listbox'] *",
        "li",
        ".MuiAutocomplete-option",
        ".MuiMenuItem-root",
        ".MuiListItem-root",
        ".MuiPaper-root *",
        "[class*='option']",
        "[class*='Option']",
        "[class*='menu']",
        "[class*='Menu']"
    ].join(",")))
        .filter(isVisivel)
        .filter(comparar)
        .sort((a, b) => textoLimpo(a.textContent).length - textoLimpo(b.textContent).length);

    return candidatos[0] || null;
}

function textoEquivalente(texto, esperado) {
    const textoNormalizado = normalizarCompacto(texto);
    const esperadoNormalizado = normalizarCompacto(esperado);

    return Boolean(textoNormalizado && esperadoNormalizado) &&
        (textoNormalizado.includes(esperadoNormalizado) || esperadoNormalizado.includes(textoNormalizado));
}

function criarComparadorTextoOpcao(esperado) {
    const esperadoNormalizado = normalizar(esperado);
    const palavrasEssenciais = esperadoNormalizado
        .split(/\s+/)
        .map((palavra) => palavra.replace(/[^A-Z0-9]/g, ""))
        .filter((palavra) => palavra.length > 2);

    return (elementoOuTexto) => {
        const texto = typeof elementoOuTexto === "string"
            ? elementoOuTexto
            : elementoOuTexto?.textContent || elementoOuTexto?.value || "";
        const textoNormalizado = normalizar(texto);
        const textoCompacto = normalizarCompacto(texto);

        if (textoEquivalente(texto, esperado)) return true;

        return palavrasEssenciais.every((palavra) => textoCompacto.includes(palavra));
    };
}

function normalizarCompacto(valor) {
    return normalizar(valor).replace(/[^A-Z0-9]/g, "");
}

async function aguardarCampoComPlaca(campo, placa, timeout) {
    const inicio = Date.now();

    while (Date.now() - inicio < timeout) {
        if (campoContemPlaca(campo, placa)) return true;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return false;
}

function campoContemPlaca(campo, placa) {
    return textoContemPlaca(obterTextoCampo(campo), placa);
}

function textoContemPlaca(texto, placa) {
    const textoPlaca = normalizarPlaca(texto);
    const placaBusca = normalizarPlaca(placa);

    return Boolean(placaBusca && textoPlaca.includes(placaBusca));
}

function normalizarPlaca(valor) {
    return String(valor || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function obterPlaca(pendente) {
    return pendente.placa ||
        pendente.caminhao?.placa ||
        pendente.servico?.codigo ||
        pendente.servico?.caminhao?.placa ||
        "";
}

function obterDistanciaPagamento(pendente) {
    const distancia =
        pendente.servico?.destinoPedagio?.distancia ??
        pendente.servico?.produtorKm?.distancia ??
        pendente.servico?.produtorKm?.distanciaPagamento ??
        pendente.servico?.distanciaPagamento ??
        pendente.servico?.kmPagamento ??
        pendente.servico?.resumo?.distanciaPagamento ??
        pendente.servico?.resumo?.kmPagamento;

    const numero = Number(String(distancia ?? "").replace(",", "."));

    return Number.isFinite(numero) ? numero : null;
}

async function obterPendente() {
    const storage = await chrome.storage.local.get(STORAGE_KEYS.simplesCtePendente);
    const pendente = storage[STORAGE_KEYS.simplesCtePendente];

    if (!pendente) return null;

    if (Date.now() - pendente.criadoEm > TEMPO_MAX_CTE_MS) {
        await chrome.storage.local.remove(STORAGE_KEYS.simplesCtePendente);
        return null;
    }

    return pendente;
}

async function aguardarElementoPorTexto(texto, timeout) {
    const inicio = Date.now();

    while (Date.now() - inicio < timeout) {
        const elemento = encontrarElementoPorTexto(texto);

        if (elemento) return elemento;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

async function aguardarElementoPorSeletor(seletor, timeout) {
    const inicio = Date.now();

    await esperarDocumentoPronto();
    await sleep(150);

    while (Date.now() - inicio < timeout) {
        const elemento = document.querySelector(seletor);

        if (elemento && isVisivel(elemento) && !elemento.disabled) return elemento;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

async function aguardarTextoNaTela(texto, timeout) {
    const inicio = Date.now();
    const textoBusca = normalizar(texto);

    while (Date.now() - inicio < timeout) {
        if (normalizar(document.body?.innerText || "").includes(textoBusca)) {
            return true;
        }

        await sleep(500);
    }

    return false;
}

function encontrarElementoPorTexto(texto) {
    const textoBusca = normalizar(texto);
    const palavras = textoBusca.split(/\s+/).filter(Boolean);
    const candidatos = Array.from(document.querySelectorAll([
        "button",
        "a",
        "[role='button']",
        "[role='link']",
        "li",
        "td",
        "span",
        "div",
        ".MuiTypography-root",
        ".MuiAvatar-root",
        ".card",
        ".empresa",
        ".company",
        "[class*='Mui']",
        "[class*='card']",
        "[class*='empresa']",
        "[class*='company']"
    ].join(",")));

    const encontrado = candidatos
        .filter(isVisivel)
        .map((elemento) => ({
            elemento,
            texto: normalizar(elemento.textContent),
            tamanho: textoLimpo(elemento.textContent).length
        }))
        .filter((item) =>
            item.texto.includes(textoBusca) ||
            palavras.every((palavra) => item.texto.includes(palavra))
        )
        .sort((a, b) => a.tamanho - b.tamanho)[0]?.elemento || null;

    return encontrado ? resolverElementoClicavel(encontrado) : null;
}

async function aguardarBotaoPorTextos(textos, timeout) {
    const inicio = Date.now();

    await esperarDocumentoPronto();
    await sleep(150);

    while (Date.now() - inicio < timeout) {
        const botao = encontrarBotaoPorTextos(textos);

        if (botao) return botao;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

async function aguardarTextareaChaves(timeout) {
    const inicio = Date.now();

    await esperarDocumentoPronto();
    await sleep(150);

    while (Date.now() - inicio < timeout) {
        const textarea =
            document.querySelector("textarea[name='chaves_acesso_csv']") ||
            document.querySelector("textarea[placeholder*='5500']");

        if (textarea && isVisivel(textarea)) return textarea;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

async function aguardarInputBuscaProdutor(timeout) {
    const inicio = Date.now();

    await esperarDocumentoPronto();
    await sleep(150);

    while (Date.now() - inicio < timeout) {
        const inputs = Array.from(document.querySelectorAll([
            "input[placeholder*='Digite para buscar']",
            ".input-container input[type='text']",
            "input[autocomplete='disabled']"
        ].join(",")))
            .filter(isVisivel)
            .filter((input) => !input.disabled && !input.readOnly)
            .filter(inputEhCampoBuscaProdutor);

        if (inputs.length) return inputs[0];

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

async function aguardarCampoTomador(timeout) {
    const inicio = Date.now();

    await esperarDocumentoPronto();
    await sleep(150);

    while (Date.now() - inicio < timeout) {
        const campo = encontrarCampoTomador();

        if (campo) return campo;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

function encontrarCampoTomador() {
    const campos = obterCamposPossiveisTomador();
    const campoPorPlaceholder = campos.find(campoTemTextoTomador);

    if (campoPorPlaceholder) return resolverElementoClicavel(campoPorPlaceholder);

    const rotulo = Array.from(document.querySelectorAll("label, span, p, div"))
        .filter(isVisivel)
        .map((elemento) => ({
            elemento,
            texto: normalizar(elemento.textContent),
            tamanho: textoLimpo(elemento.textContent).length
        }))
        .filter((item) =>
            item.texto.includes("TOMADOR") ||
            item.texto.includes("QUEM PAGARA A SUA EMPRESA PELO FRETE") ||
            item.texto.includes("QUEM VAI PAGAR O FRETE")
        )
        .sort((a, b) => a.tamanho - b.tamanho)[0]?.elemento;

    if (!rotulo) return null;

    const rectRotulo = rotulo.getBoundingClientRect();

    return campos
        .map((campo) => ({
            campo,
            rect: campo.getBoundingClientRect()
        }))
        .filter((item) =>
            item.rect.top >= rectRotulo.top &&
            item.rect.top <= rectRotulo.bottom + 130 &&
            retangulosSobrepoemHorizontalmente(rectRotulo, item.rect)
        )
        .sort((a, b) => (a.rect.top - b.rect.top) || (a.rect.left - b.rect.left))[0]?.campo || null;
}

function campoTemTextoTomador(campo) {
    const input = campo.matches?.("input") ? campo : campo.querySelector?.("input");
    const texto = normalizar([
        input?.placeholder,
        campo.placeholder,
        input?.getAttribute("aria-label"),
        campo.getAttribute("aria-label"),
        input?.closest("label")?.textContent,
        campo.closest("label")?.textContent
    ].filter(Boolean).join(" "));

    return texto.includes("QUEM VAI PAGAR O FRETE") ||
        texto.includes("QUEM VAI PAGAR") ||
        texto.includes("TOMADOR");
}

function retangulosSobrepoemHorizontalmente(a, b) {
    return b.left <= a.right + 40 && b.right >= a.left - 40;
}

function obterCamposPossiveisTomador() {
    const candidatos = Array.from(document.querySelectorAll([
        "input",
        "button",
        "[role='combobox']",
        "[aria-haspopup='listbox']",
        ".MuiSelect-select",
        ".MuiInputBase-root"
    ].join(",")))
        .filter(isVisivel)
        .filter((campo) => !campo.disabled && !campo.readOnly)
        .filter((campo) => !campoEhBuscaGlobalOuCfop(campo));

    return candidatos
        .map((campo) => campo.matches?.("input") ? campo : resolverElementoClicavel(campo))
        .filter((campo, indice, lista) => lista.indexOf(campo) === indice);
}

function campoEhBuscaGlobalOuCfop(campo) {
    const texto = normalizar([
        campo.name,
        campo.id,
        campo.placeholder,
        campo.getAttribute("aria-label"),
        campo.closest("label")?.textContent
    ].filter(Boolean).join(" "));

    if (texto.includes("PESQUISAR")) return true;
    if (texto.includes("CFOP")) return true;

    const rectCampo = campo.getBoundingClientRect();
    const rotuloCfop = Array.from(document.querySelectorAll("label, span, p, div"))
        .filter(isVisivel)
        .find((elemento) => normalizar(elemento.textContent).startsWith("CFOP"));

    if (!rotuloCfop) return false;

    const rectCfop = rotuloCfop.getBoundingClientRect();

    return rectCampo.top >= rectCfop.bottom - 8 &&
        rectCampo.top <= rectCfop.bottom + 90;
}

async function preencherCampoTomador(campo, produtor) {
    const input = campo.matches?.("input") ? campo : campo.querySelector?.("input");

    if (input && !input.readOnly && !input.disabled) {
        await preencherInputBusca(input, produtor);
        return;
    }

    await clicarElemento(campo);
    await sleep(PAUSA_POS_CLIQUE_MS);
}

function inputEhCampoBuscaProdutor(input) {
    const nome = normalizar(input.name || "");
    const id = normalizar(input.id || "");
    const placeholder = normalizar(input.placeholder || "");
    const contexto = normalizar(input.closest(".input-container, form, [role='dialog'], .MuiDialog-root")?.textContent || "");

    if (
        nome === "PESQUISAR" ||
        id === "PESQUISAR" ||
        placeholder === "PESQUISAR" ||
        placeholder.includes("PESQUISAR")
    ) {
        return false;
    }

    if (placeholder.includes("DIGITE PARA BUSCAR")) return true;

    return Boolean(input.closest(".input-container")) && (
        contexto.includes("TOMADOR") ||
        contexto.includes("REMETENTE") ||
        contexto.includes("DESTINATARIO") ||
        contexto.includes("EXPEDIDOR") ||
        contexto.includes("RECEBEDOR")
    );
}

async function preencherInputBusca(input, texto) {
    input.scrollIntoView?.({
        behavior: "instant",
        block: "center"
    });
    await sleep(120);
    input.focus?.();
    setValorNativo(input, "");
    dispararEventos(input);
    await sleep(100);
    setValorNativo(input, texto);
    input.dispatchEvent(new KeyboardEvent("keydown", {
        key: texto.slice(-1) || "a",
        bubbles: true,
        cancelable: true
    }));
    dispararEventos(input);
    input.dispatchEvent(new KeyboardEvent("keyup", {
        key: texto.slice(-1) || "a",
        bubbles: true,
        cancelable: true
    }));
    await sleep(900);
}

async function preencherInputTexto(input, texto) {
    input.scrollIntoView?.({
        behavior: "instant",
        block: "center"
    });
    await sleep(120);
    input.focus?.();
    input.select?.();
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
    input.blur?.();
    dispararEventos(input, ["blur"]);
}

async function aguardarValorInput(input, valorEsperado, timeout) {
    const inicio = Date.now();
    const esperado = normalizarNumeroCampo(valorEsperado);

    while (Date.now() - inicio < timeout) {
        if (normalizarNumeroCampo(input.value) === esperado) return true;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return false;
}

function formatarDistanciaCalculadora(distancia) {
    const numero = Number(distancia);

    if (Number.isInteger(numero)) return String(numero);

    return String(numero).replace(".", ",");
}

function normalizarNumeroCampo(valor) {
    const texto = String(valor || "")
        .replace(/\s+/g, "")
        .replace(",", ".")
        .replace(/\.0+$/, "");

    const numero = Number(texto);

    return Number.isFinite(numero) ? String(numero) : texto;
}

async function aguardarCampoTomadorValido(produtor, timeout) {
    const inicio = Date.now();

    while (Date.now() - inicio < timeout) {
        const campo = encontrarCampoTomador();

        if (campo && campoTomadorValido(campo, produtor)) return true;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return false;
}

function campoTomadorValido(campo, produtor) {
    const valor = obterTextoCampo(campo);

    if (!valor) return false;

    const valorNormalizado = normalizar(valor);
    const produtorNormalizado = normalizar(produtor);

    if (tomadorInvalido(valorNormalizado)) return false;

    return valorNormalizado.includes(produtorNormalizado) ||
        produtorNormalizado.includes(valorNormalizado) ||
        compararPalavrasPrincipais(valorNormalizado, produtorNormalizado);
}

function obterTextoCampo(campo) {
    const input = campo.matches?.("input") ? campo : campo.querySelector?.("input");
    const valorDireto = textoLimpo(input?.value || campo.value || campo.textContent || "");

    if (valorDireto) return valorDireto;

    const placeholder = textoLimpo(input?.placeholder || campo.placeholder || "");

    return placeholderEhValorSelecionado(placeholder) ? placeholder : "";
}

function placeholderEhValorSelecionado(placeholder) {
    const texto = normalizar(placeholder);

    if (!texto) return false;

    return !texto.includes("QUEM VAI PAGAR") &&
        !texto.includes("DIGITE PARA BUSCAR") &&
        !texto.includes("PESQUISAR") &&
        !tomadorInvalido(texto);
}

function tomadorInvalido(valorNormalizado) {
    return !valorNormalizado ||
        valorNormalizado === "DIVERSOS" ||
        valorNormalizado.includes("DIVERSOS");
}

function compararPalavrasPrincipais(valorNormalizado, produtorNormalizado) {
    const palavrasValor = valorNormalizado.split(/\s+/).filter((palavra) => palavra.length > 2);
    const palavrasProdutor = produtorNormalizado.split(/\s+/).filter((palavra) => palavra.length > 2);

    if (!palavrasValor.length || !palavrasProdutor.length) return false;

    const palavrasIguais = palavrasValor.filter((palavra) => palavrasProdutor.includes(palavra));
    const minimo = Math.min(2, palavrasProdutor.length);

    return palavrasIguais.length >= minimo;
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
    const textoBusca = normalizar(texto);
    const palavras = textoBusca.split(/\s+/).filter(Boolean);
    const candidatos = Array.from(document.querySelectorAll([
        "[role='option']",
        "[role='listbox'] *",
        "li",
        "ul li",
        ".MuiPopper-root *",
        ".MuiAutocomplete-popper *",
        ".MuiAutocomplete-option",
        ".MuiMenuItem-root",
        ".MuiListItem-root",
        ".MuiPaper-root li",
        ".MuiPaper-root [role='option']",
        "[class*='Popper'] *",
        "[class*='popover'] *",
        "[class*='Popover'] *",
        "[class*='dropdown'] *",
        "[class*='Dropdown'] *",
        "[class*='option']",
        "[class*='Option']",
        "[class*='menu']",
        "[class*='Menu']"
    ].join(",")))
        .filter(isVisivel)
        .map((elemento) => ({
            elemento,
            texto: normalizar(elemento.textContent),
            tamanho: textoLimpo(elemento.textContent).length
        }))
        .filter((item) =>
            item.texto.includes(textoBusca) ||
            palavras.every((palavra) => item.texto.includes(palavra))
        )
        .sort((a, b) => a.tamanho - b.tamanho);

    return candidatos[0]?.elemento || null;
}

async function aguardarNovoCte(timeout) {
    const inicio = Date.now();

    await esperarDocumentoPronto();
    await sleep(150);

    while (Date.now() - inicio < timeout) {
        const botao = encontrarNovoCte();

        if (botao) return botao;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

function encontrarNovoCte() {
    const botoes = Array.from(document.querySelectorAll([
        "button.MuiButton-containedPrimary.MuiButton-fullWidth",
        "button.MuiButtonBase-root",
        "button"
    ].join(",")))
        .filter(isVisivel)
        .filter((elemento) => !elemento.disabled)
        .filter((elemento) => elemento.querySelector(".MuiTouchRipple-root"));

    return botoes.find((elemento) => {
        const texto = normalizar(elemento.textContent).replace(/[-\s]/g, "");

        return texto.includes("NOVOCTE");
    }) || null;
}

function encontrarBotaoPorTextos(textos) {
    const textosBusca = textos.map(normalizar);
    const botoesDiretos = Array.from(document.querySelectorAll([
        "button",
        "[role='button']",
        ".MuiButtonBase-root"
    ].join(",")))
        .filter(isVisivel)
        .filter((elemento) => !elemento.disabled);

    const porTextoDireto = botoesDiretos.find((elemento) => {
        const texto = normalizar(elemento.textContent);

        return textosBusca.some((textoBusca) => texto.includes(textoBusca));
    });

    if (porTextoDireto) return porTextoDireto;

    const candidatosTexto = Array.from(document.querySelectorAll([
        "span",
        "div",
        "p",
        "h1",
        "h2",
        "h3",
        ".MuiTypography-root"
    ].join(",")))
        .filter(isVisivel)
        .filter((elemento) => {
            const texto = normalizar(elemento.textContent);
            return textosBusca.some((textoBusca) => texto.includes(textoBusca));
        })
        .sort((a, b) => textoLimpo(a.textContent).length - textoLimpo(b.textContent).length);

    for (const candidato of candidatosTexto) {
        const clicavel = resolverElementoClicavel(candidato);

        if (
            clicavel &&
            clicavel !== document.body &&
            isVisivel(clicavel) &&
            !clicavel.disabled
        ) {
            return clicavel;
        }
    }

    return null;
}

async function clicarElemento(elemento) {
    elemento.scrollIntoView?.({
        behavior: "instant",
        block: "center"
    });
    await sleep(120);
    elemento.click();
}

function isVisivel(elemento) {
    const estilo = getComputedStyle(elemento);
    const rect = elemento.getBoundingClientRect();

    return estilo.display !== "none" &&
        estilo.visibility !== "hidden" &&
        Number(estilo.opacity || 1) > 0 &&
        rect.width > 0 &&
        rect.height > 0;
}

function resolverElementoClicavel(elemento) {
    const direto = elemento.closest("button, a, [role='button'], [role='link'], [onclick], .card, [class*='card']");

    if (direto) return direto;

    let atual = elemento;

    while (atual && atual !== document.body) {
        if (pareceClicavel(atual)) return atual;
        atual = atual.parentElement;
    }

    return elemento.parentElement || elemento;
}

function pareceClicavel(elemento) {
    const estilo = getComputedStyle(elemento);

    return estilo.cursor === "pointer" ||
        elemento.hasAttribute("tabindex") ||
        elemento.hasAttribute("aria-label") ||
        elemento.className?.toString().includes("MuiButtonBase");
}

function obterChavesAcesso(pendente) {
    const grupo = obterGrupoCteAtual(pendente);
    const chaves = grupo?.chavesAcesso ||
        pendente.grupoCte?.chavesAcesso ||
        pendente.servico?.grupoCte?.chavesAcesso ||
        pendente.servico?.chavesAcesso ||
        pendente.servico?.nfs?.map((nf) => nf.chave) ||
        [];

    return Array.from(new Set(
        chaves
            .map((chave) => String(chave || "").replace(/\D/g, ""))
            .filter((chave) => chave.length === 44)
    ));
}

function obterProdutorNota(pendente) {
    const grupo = obterGrupoCteAtual(pendente);

    return textoLimpo(
        grupo?.produtor ||
        pendente.grupoCte?.produtor ||
        pendente.servico?.grupoCte?.produtor ||
        pendente.servico?.resumo?.produtor ||
        pendente.servico?.nfs?.[0]?.produtor ||
        pendente.servico?.destinoPedagio?.produtor ||
        ""
    );
}

function obterGruposCte(pendente) {
    const grupos = pendente.gruposCte ||
        pendente.servico?.gruposCte ||
        pendente.servico?.gruposProdutores ||
        [];

    return Array.isArray(grupos) ? grupos.filter((grupo) => Array.isArray(grupo.chavesAcesso) && grupo.chavesAcesso.length) : [];
}

function obterIndiceGrupoCteAtual(pendente) {
    const indice = Number(pendente.indiceGrupoCteAtual ?? pendente.servico?.indiceGrupoCteAtual ?? 0);

    return Number.isInteger(indice) && indice >= 0 ? indice : 0;
}

function obterGrupoCteAtual(pendente) {
    const grupos = obterGruposCte(pendente);

    if (!grupos.length) return null;

    return grupos[obterIndiceGrupoCteAtual(pendente)] || grupos[0];
}

function temProximoGrupoCte(pendente) {
    const grupos = obterGruposCte(pendente);

    return obterIndiceGrupoCteAtual(pendente) + 1 < grupos.length;
}

function formatarChaveAcesso(chave) {
    return String(chave || "")
        .replace(/\D/g, "")
        .replace(/(.{4})/g, "$1 ")
        .trim();
}

function dispararEventos(elemento, eventos = ["input", "change"]) {
    eventos.forEach((evento) => {
        elemento.dispatchEvent(new Event(evento, {
            bubbles: true
        }));
    });
}

function setValorNativo(elemento, valor) {
    const prototype = Object.getPrototypeOf(elemento);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor?.set) {
        descriptor.set.call(elemento, valor);
        return;
    }

    elemento.value = valor;
}

function listarOpcoesAutocomplete() {
    return Array.from(document.querySelectorAll([
        "[role='option']",
        "li",
        ".MuiAutocomplete-option",
        ".MuiMenuItem-root",
        ".MuiListItem-root",
        ".MuiPopper-root *",
        "[class*='option']",
        "[class*='Option']",
        "[class*='menu']",
        "[class*='Menu']"
    ].join(",")))
        .filter(isVisivel)
        .slice(0, 30)
        .map((elemento) => ({
            texto: textoLimpo(elemento.textContent),
            classe: elemento.className?.toString() || "",
            role: elemento.getAttribute("role") || ""
        }));
}

function listarCamposVisiveis() {
    return Array.from(document.querySelectorAll("input, button, [role='combobox'], [aria-haspopup='listbox'], .MuiSelect-select"))
        .filter(isVisivel)
        .slice(0, 40)
        .map((elemento) => ({
            texto: textoLimpo(elemento.textContent),
            valor: textoLimpo(elemento.value),
            nome: elemento.name || "",
            id: elemento.id || "",
            placeholder: elemento.placeholder || "",
            ariaLabel: elemento.getAttribute("aria-label") || "",
            classe: elemento.className?.toString() || ""
        }));
}

async function aguardarMudancaAposClique(timeout = TIMEOUT_CTE_MS) {
    const inicio = Date.now();
    const urlInicial = location.href;

    await sleep(PAUSA_POS_CLIQUE_MS);

    while (Date.now() - inicio < timeout) {
        if (location.href !== urlInicial) {
            await sleep(250);
            return;
        }

        if (encontrarBotaoPorTextos(["NOVO CTE", "NOVO CT-E", "EMITIR CTE", "CRIAR CTE"])) {
            return;
        }

        await sleep(INTERVALO_BUSCA_MS);
    }
}

function textoLimpo(texto) {
    return String(texto || "").replace(/\s+/g, " ").trim();
}

function listarBotoesVisiveis() {
    return Array.from(document.querySelectorAll("button, [role='button'], .MuiButtonBase-root"))
        .filter(isVisivel)
        .slice(0, 30)
        .map((elemento) => ({
            texto: textoLimpo(elemento.textContent),
            ariaLabel: elemento.getAttribute("aria-label") || "",
            classe: elemento.className?.toString() || ""
        }));
}

function esperarDocumentoPronto() {
    return new Promise((resolve) => {
        if (document.readyState === "complete") {
            resolve();
            return;
        }

        window.addEventListener("load", resolve, { once: true });
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
