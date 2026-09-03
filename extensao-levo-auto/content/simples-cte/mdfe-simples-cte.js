import { STORAGE_KEYS } from "../../shared/constants.js";
import { normalizar } from "../../shared/text.js";

const TEMPO_MAX_MDFE_MS = 10 * 60 * 1000;
const TIMEOUT_MDFE_MS = 8000;
const TIMEOUT_TRANSICAO_MDFE_MS = 20000;
const INTERVALO_BUSCA_MS = 150;
const PAUSA_POS_CLIQUE_MS = 450;

export async function executarMdfePendente() {
    if (!location.hostname.includes("app.simplescte.com.br")) return false;

    const pendente = await obterPendenteMdfe();

    if (!pendente) return false;

    await esperarDocumentoPronto();
    await sleep(300);

    if (encontrarModalSelecionarEmpresa() && pendente.transportadora) {
        return selecionarEmpresaMdfe({
            ...pendente,
            etapa: "selecionar_empresa"
        });
    }

    if (pendente.etapa === "selecionar_empresa") {
        return selecionarEmpresaMdfe(pendente);
    }

    if (pendente.etapa === "buscar_cte") {
        return clicarModuloMdfe(pendente);
    }

    if (pendente.etapa === "mdfe_modulo_clicado") {
        return clicarNovoMdfe(pendente);
    }

    if (pendente.etapa === "novo_mdfe_clicado") {
        return clicarOpcaoCteMdfe(pendente);
    }

    if (pendente.etapa === "opcao_cte_clicada") {
        return selecionarCtesParaManifestar(pendente);
    }

    return false;
}

async function selecionarEmpresaMdfe(pendente) {
    if (!pendente.transportadora) {
        await registrarErroMdfe(pendente, "Transportadora nao informada");
        return false;
    }

    const modalEmpresa = encontrarModalSelecionarEmpresa();

    if (modalEmpresa) {
        await pesquisarTransportadoraNoModal(modalEmpresa, pendente.transportadora);
    }

    const cardTransportadora = await aguardarElemento(TIMEOUT_MDFE_MS, () => encontrarElementoPorTexto(pendente.transportadora));

    if (cardTransportadora) {
        await clicarElemento(cardTransportadora);

        const atualizado = await atualizarPendenteMdfe(pendente, {
            etapa: "buscar_cte",
            empresaSelecionada: textoLimpo(cardTransportadora.textContent)
        });

        await aguardarMudancaAposClique();
        return clicarModuloMdfe(atualizado);
    }

    if (!encontrarModalSelecionarEmpresa() && estaEmAreaInternaSimplesCte()) {
        const atualizado = await atualizarPendenteMdfe(pendente, {
            etapa: "buscar_cte",
            empresaJaSelecionada: true
        });

        return clicarModuloMdfe(atualizado);
    }

    const elemento = await aguardarElemento(TIMEOUT_MDFE_MS, () => encontrarElementoPorTexto(pendente.transportadora));

    if (!elemento) {
        await registrarErroMdfe(pendente, "Transportadora nao encontrada");
        console.warn("Transportadora nao encontrada antes do MDF-e.", {
            transportadora: pendente.transportadora,
            placa: pendente.placa
        });
        return false;
    }

    await clicarElemento(elemento);

    const atualizado = await atualizarPendenteMdfe(pendente, {
        etapa: "buscar_cte",
        empresaSelecionada: textoLimpo(elemento.textContent)
    });

    await sleep(PAUSA_POS_CLIQUE_MS);
    return clicarModuloMdfe(atualizado);
}

async function clicarModuloMdfe(pendente) {
    const botaoNovoAberto = encontrarBotaoNovoMdfe();

    if (botaoNovoAberto) {
        const atualizado = await atualizarPendenteMdfe(pendente, {
            etapa: "mdfe_modulo_clicado",
            moduloJaAberto: true
        });

        return clicarNovoMdfe(atualizado);
    }

    const botao = await aguardarElemento(TIMEOUT_MDFE_MS, encontrarCardMdfe);

    if (!botao) {
        await registrarErroMdfe(pendente, "Modulo MDFe nao encontrado");
        return false;
    }

    await clicarElemento(botao);
    const telaMdfeAberta = await aguardarElemento(TIMEOUT_TRANSICAO_MDFE_MS, encontrarBotaoNovoMdfe);

    if (!telaMdfeAberta) {
        await registrarErroMdfe(pendente, "Tela de MDFe nao abriu o botao Novo MDFe");
        console.warn("Modulo MDFe foi clicado, mas o botao Novo MDFe nao apareceu.", {
            pendente,
            botao: textoLimpo(botao.textContent),
            botoesVisiveis: listarBotoesVisiveis()
        });
        return false;
    }

    const atualizado = await atualizarPendenteMdfe(pendente, {
        etapa: "mdfe_modulo_clicado",
        modulo: textoLimpo(botao.textContent)
    });

    return clicarNovoMdfe(atualizado);
}

async function clicarNovoMdfe(pendente) {
    const botao = await aguardarElemento(TIMEOUT_MDFE_MS, encontrarBotaoNovoMdfe);

    if (!botao) {
        await registrarErroMdfe(pendente, "Botao Novo MDFe nao encontrado");
        return false;
    }

    const resultadoClique = await clicarNovoMdfeAteAbrirDocumento();
    const modalDocumento = resultadoClique?.modalDocumento;

    if (!modalDocumento) {
        await registrarErroMdfe(pendente, "Modal para adicionar documento do MDFe nao abriu");
        console.warn("Botao Novo MDFe clicado, mas o modal de documento nao apareceu.", {
            pendente,
            botao: textoLimpo(botao.textContent),
            botoesVisiveis: listarBotoesVisiveis()
        });
        return false;
    }

    const atualizado = await atualizarPendenteMdfe(pendente, {
        etapa: "novo_mdfe_clicado",
        botaoNovoMdfe: textoLimpo(resultadoClique.botao.textContent)
    });

    return clicarOpcaoCteMdfe(atualizado);
}

async function clicarNovoMdfeAteAbrirDocumento() {
    for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
        const botoes = encontrarBotoesNovoMdfe();

        for (const botao of botoes) {
            await clicarElemento(botao);

            const modalDocumento = await aguardarElemento(3500, () =>
                encontrarModalAdicionarDocumentoMdfe() || encontrarBotaoOpcaoCte()
            );

            if (modalDocumento) return { botao, modalDocumento };

            await sleep(300);
        }

        await sleep(500);
    }

    return null;
}

async function clicarOpcaoCteMdfe(pendente) {
    const botao = await aguardarElemento(TIMEOUT_MDFE_MS, encontrarBotaoOpcaoCte);

    if (!botao) {
        await registrarErroMdfe(pendente, "Opcao Conhecimento de Transporte CTe nao encontrada");
        return false;
    }

    await clicarElemento(botao);

    const atualizado = await atualizarPendenteMdfe(pendente, {
        etapa: "opcao_cte_clicada",
        opcaoDocumento: textoLimpo(botao.textContent)
    });

    await sleep(PAUSA_POS_CLIQUE_MS);
    return selecionarCtesParaManifestar(atualizado);
}

async function selecionarCtesParaManifestar(pendente) {
    const modal = await aguardarElemento(TIMEOUT_MDFE_MS, encontrarModalSelecaoCte);

    if (!modal) {
        await registrarErroMdfe(pendente, "Modal de selecao de CTe nao encontrado");
        return false;
    }

    const linhas = await aguardarLinhasCteCorretas(pendente, TIMEOUT_MDFE_MS, modal);

    if (!linhas.length) {
        await registrarErroMdfe(pendente, "CTe autorizado compativel nao encontrado");
        console.warn("Nenhum CTe autorizado compativel encontrado para MDF-e.", {
            pendente,
            linhas: listarLinhasCteModal(modal).map((linha) => linha.dados)
        });
        return false;
    }

    for (const linha of linhas) {
        await marcarLinhaCte(linha.elemento);
    }

    const botaoAdicionar = await aguardarElemento(TIMEOUT_MDFE_MS, encontrarBotaoAdicionarCte);

    if (!botaoAdicionar) {
        await registrarErroMdfe(pendente, "Botao Adicionar CTe nao encontrado");
        return false;
    }

    await clicarElemento(botaoAdicionar);

    await atualizarPendenteMdfe(pendente, {
        etapa: "ctes_adicionados",
        ctesSelecionados: linhas.map((linha) => linha.dados),
        quantidadeCtes: linhas.length,
        erro: ""
    });

    console.log("CTe(s) selecionado(s) para gerar MDF-e.", {
        quantidade: linhas.length,
        ctes: linhas.map((linha) => linha.dados)
    });

    return true;
}

async function aguardarLinhasCteCorretas(pendente, timeout, modal) {
    const inicio = Date.now();

    while (Date.now() - inicio < timeout) {
        const linhas = encontrarLinhasCteCorretas(pendente, modal);

        if (linhas.length) return linhas;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return [];
}

function encontrarLinhasCteCorretas(pendente, modal) {
    const linhas = listarLinhasCteModal(modal)
        .filter((linha) => statusPermiteManifestar(linha.dados.status))
        .map((linha) => ({
            ...linha,
            pontos: pontuarLinhaCteModal(linha.dados, pendente)
        }))
        .filter((linha) => linha.pontos >= 8)
        .sort((a, b) => b.pontos - a.pontos || a.indice - b.indice);

    const alvos = obterAlvosCteMdfe(pendente);

    if (alvos.length > 1) {
        return escolherUmaLinhaPorAlvo(linhas, alvos);
    }

    return linhas.slice(0, 1);
}

function escolherUmaLinhaPorAlvo(linhas, alvos) {
    const selecionadas = [];

    alvos.forEach((alvo) => {
        const linha = linhas.find((item) =>
            !selecionadas.includes(item) &&
            linhaCombinaComAlvo(item.dados, alvo)
        );

        if (linha) selecionadas.push(linha);
    });

    return selecionadas.length ? selecionadas : linhas.slice(0, 1);
}

function listarLinhasCteModal(modal) {
    return Array.from(modal.querySelectorAll("[role='row'].MuiDataGrid-row, [role='row'][data-id]"))
        .filter(isVisivel)
        .map((elemento, indice) => ({
            elemento,
            indice,
            dados: lerDadosLinhaCteModal(elemento)
        }))
        .filter((linha) => linha.dados.numeroCte || linha.dados.remetente || linha.dados.destinatario);
}

function lerDadosLinhaCteModal(linha) {
    return {
        dataEmissao: lerCampoLinha(linha, "dataEmissao"),
        numeroCte: lerCampoLinha(linha, "numeroCte"),
        remetente: lerCampoLinha(linha, "remetente"),
        destinatario: lerCampoLinha(linha, "destinatario"),
        valorTotal: lerCampoLinha(linha, "valorTotal"),
        origem: lerCampoLinha(linha, "origem"),
        destino: lerCampoLinha(linha, "destino"),
        status: lerCampoLinha(linha, "status")
    };
}

function lerCampoLinha(linha, campo) {
    const elemento = linha.querySelector(`[data-field='${campo}']`);
    return textoLimpo(elemento?.getAttribute("title") || elemento?.textContent || "");
}

function pontuarLinhaCteModal(dados, pendente) {
    let pontos = 0;
    const remetente = normalizar(dados.remetente);
    const destinatario = normalizar(dados.destinatario);
    const emitente = normalizar(pendente.emitente || pendente.servico?.resumo?.emitente);
    const empresa = inferirEmpresaTexto(emitente);
    const produtores = obterProdutoresBusca(pendente).map(normalizar);
    const alvos = obterAlvosCteMdfe(pendente);

    if (statusPermiteManifestar(dados.status)) pontos += 6;
    if (dados.dataEmissao === obterDataHojeBr()) pontos += 2;
    if (emitente && (remetente.includes(emitente) || emitente.includes(remetente))) pontos += 4;
    if (empresa && remetente.includes(empresa)) pontos += 3;
    if (produtores.some((produtor) => textoCombina(destinatario, produtor))) pontos += 5;
    if (normalizar(dados.origem).includes("PR")) pontos += 1;
    if (normalizar(dados.destino).includes("PR")) pontos += 1;
    if (alvos.some((alvo) => linhaCombinaComAlvo(dados, alvo))) pontos += 8;
    if (
        valorCteCombina(dados.valorTotal, pendente.valorFreteCalculado) ||
        alvos.some((alvo) => valorCteCombina(dados.valorTotal, alvo.valorTotal))
    ) {
        pontos += 4;
    }

    return pontos;
}

function statusPermiteManifestar(status) {
    const texto = normalizar(status);

    return texto.includes("AUTORIZADO") && !texto.includes("MANIFESTADO") && !texto.includes("CANCELADO");
}

function obterAlvosCteMdfe(pendente) {
    const alvosSalvos = Array.isArray(pendente.alvosCteMdfe) ? pendente.alvosCteMdfe : [];

    if (alvosSalvos.length) return alvosSalvos;

    return obterProdutoresBusca(pendente).map((produtor) => ({
        remetente: pendente.emitente || pendente.servico?.resumo?.emitente || "",
        destinatario: produtor,
        valorTotal: pendente.valorFreteCalculado || "",
        origem: "PR",
        destino: "PR"
    }));
}

function linhaCombinaComAlvo(dados, alvo) {
    const remetenteOk = !alvo.remetente || textoCombina(dados.remetente, normalizar(alvo.remetente)) || textoCombinaEmpresa(dados.remetente, alvo.remetente);
    const destinatarioOk = !alvo.destinatario || textoCombina(dados.destinatario, normalizar(alvo.destinatario));
    const origemOk = !alvo.origem || normalizar(dados.origem).includes(normalizar(alvo.origem));
    const destinoOk = !alvo.destino || normalizar(dados.destino).includes(normalizar(alvo.destino));

    return remetenteOk && destinatarioOk && origemOk && destinoOk;
}

function textoCombinaEmpresa(texto, empresa) {
    const empresaInferida = inferirEmpresaTexto(normalizar(empresa));

    return Boolean(empresaInferida && normalizar(texto).includes(empresaInferida));
}

function valorCteCombina(valorLinha, valorEsperado) {
    const linha = normalizarValorMoeda(valorLinha);
    const esperado = normalizarValorMoeda(valorEsperado);

    if (!Number.isFinite(linha) || !Number.isFinite(esperado) || esperado <= 0) return false;

    return Math.abs(linha - esperado) < 0.01;
}

function normalizarValorMoeda(valor) {
    const texto = String(valor || "")
        .replace(/\s|\u00a0/g, "")
        .replace(/[^\d,.-]/g, "")
        .replace(/\.(?=\d{3}(\D|$))/g, "")
        .replace(",", ".");
    const numero = Number(texto);

    return Number.isFinite(numero) ? numero : NaN;
}

async function marcarLinhaCte(linha) {
    const checkbox = linha.querySelector("input[name='select_row'], input[type='checkbox']");

    if (!checkbox) return false;

    if (checkbox.checked || linha.getAttribute("aria-selected") === "true") return true;

    const alvo = checkbox.closest(".MuiCheckbox-root, .PrivateSwitchBase-root") || checkbox;
    await clicarElemento(alvo);
    await sleep(120);
    return true;
}

function encontrarModalSelecaoCte() {
    return Array.from(document.querySelectorAll(".MuiDialogContent-root, [role='dialog'], .MuiDialog-root, body"))
        .filter(isVisivel)
        .find((elemento) => normalizar(elemento.textContent).includes("SELECIONE UM OU MAIS CTE")) || null;
}

function encontrarModalSelecionarEmpresa() {
    return Array.from(document.querySelectorAll(".MuiDialogContent-root, [role='dialog'], .MuiDialog-root, body"))
        .filter(isVisivel)
        .find((elemento) => normalizar(elemento.textContent).includes("SELECIONAR EMPRESA")) || null;
}

function encontrarModalAdicionarDocumentoMdfe() {
    const textos = [
        "ADICIONE SEU DOCUMENTO PARA EMITIR O MDFE",
        "ADICIONE SEU DOCUMENTO",
        "DOCUMENTO PARA EMITIR O MDFE",
        "CONHECIMENTO DE TRANSPORTE CTE"
    ];

    return Array.from(document.querySelectorAll(".MuiDialogContent-root, [role='dialog'], .MuiDialog-root, body"))
        .filter(isVisivel)
        .find((elemento) => {
            const texto = normalizar(elemento.textContent);
            return textos.some((busca) => texto.includes(busca));
        }) || null;
}

function encontrarCardMdfe() {
    const porIcone = document.querySelector("svg[data-icon-name='line-file-contract-light']")
        ?.closest(".css-1vp3x7d, button, [role='button'], a, div");

    if (porIcone && isVisivel(porIcone) && normalizar(porIcone.textContent).includes("MDFE")) {
        return porIcone;
    }

    const candidatos = Array.from(document.querySelectorAll("button, [role='button'], .css-1vp3x7d, div"))
        .filter(isVisivel)
        .filter((elemento) => normalizar(elemento.textContent).includes("MDFE"));

    return candidatos.sort((a, b) => textoLimpo(a.textContent).length - textoLimpo(b.textContent).length)[0] || null;
}

async function pesquisarTransportadoraNoModal(modal, transportadora) {
    const input = modal.querySelector("input[placeholder='Pesquisar'], input[type='text']");

    if (!input || !isVisivel(input)) return false;
    if (normalizar(input.value).includes(normalizar(transportadora))) return true;

    await preencherCampo(input, transportadora);
    await sleep(700);
    return true;
}

function encontrarCardTransportadora(transportadora, raiz = document) {
    const busca = normalizar(transportadora);
    const palavras = busca.split(/\s+/).filter(Boolean);
    const vistos = new Set();

    if (!busca) return null;

    return Array.from(raiz.querySelectorAll(".MuiGrid-root, .css-k0iyq1, button, [role='button'], div"))
        .filter(isVisivel)
        .map((elemento) => resolverCardTransportadora(elemento))
        .filter((elemento) => {
            if (!elemento || vistos.has(elemento)) return false;
            vistos.add(elemento);
            return isVisivel(elemento) && !elemento.disabled;
        })
        .map((elemento) => ({
            elemento,
            texto: normalizar(elemento.textContent),
            tamanho: textoLimpo(elemento.textContent).length
        }))
        .filter((item) =>
            item.texto.includes(busca) ||
            palavras.every((palavra) => item.texto.includes(palavra))
        )
        .sort((a, b) =>
            pontuarCardTransportadora(b.elemento, b.texto, busca) -
            pontuarCardTransportadora(a.elemento, a.texto, busca) ||
            a.tamanho - b.tamanho
        )[0]?.elemento || null;
}

function resolverCardTransportadora(elemento) {
    const conteudoCard = elemento.closest(".css-k0iyq1");
    const gridCard = conteudoCard?.parentElement?.matches(".MuiGrid-root[class*='MuiGrid-grid']") ?
        conteudoCard.parentElement :
        null;

    return gridCard ||
        elemento.closest(".MuiGrid-root[class*='MuiGrid-grid-md-4'], .MuiGrid-root[class*='MuiGrid-grid-sm-6'], button, [role='button'], a") ||
        conteudoCard ||
        elemento;
}

function pontuarCardTransportadora(elemento, texto, busca) {
    let pontos = 0;

    if (texto.includes(busca)) pontos += 10;
    if (elemento.querySelector(".MuiAvatar-root")) pontos += 3;
    if (texto.includes("/0001-")) pontos += 2;
    if (texto.includes("CASCAVEL")) pontos += 1;
    if (normalizar(elemento.textContent).includes("MDFE")) pontos -= 8;

    return pontos;
}

function estaEmAreaInternaSimplesCte() {
    return Boolean(encontrarBotaoNovoMdfe() || encontrarCardMdfe());
}

function encontrarBotaoNovoMdfe() {
    return encontrarBotoesNovoMdfe()[0] || null;
}

function encontrarBotoesNovoMdfe() {
    const candidatos = [];
    const adicionar = (elemento) => {
        const botao = elemento?.closest?.("button, [role='button']") || elemento;

        if (!botao || candidatos.includes(botao)) return;
        if (!isVisivel(botao) || botao.disabled) return;
        if (!normalizar(botao.textContent).replace(/[-\s]/g, "").includes("NOVOMDFE")) return;

        candidatos.push(botao);
    };

    document.querySelectorAll("svg[data-icon-name='line-plus-circle-solid']").forEach((icone) => {
        adicionar(icone.closest("button, [role='button']"));
    });

    Array.from(document.querySelectorAll("button, [role='button']"))
        .filter(isVisivel)
        .filter((elemento) => !elemento.disabled)
        .filter((elemento) => normalizar(elemento.textContent).replace(/[-\s]/g, "").includes("NOVOMDFE"))
        .forEach(adicionar);

    const porTexto = encontrarBotaoPorTexto("NOVO MDFE");
    adicionar(porTexto);

    return candidatos.sort((a, b) => pontuarBotaoNovoMdfe(b) - pontuarBotaoNovoMdfe(a));
}

function pontuarBotaoNovoMdfe(botao) {
    let pontos = 0;
    const classe = botao.className?.toString() || "";

    if (botao.tagName === "BUTTON") pontos += 5;
    if (classe.includes("MuiButton-containedPrimary")) pontos += 4;
    if (classe.includes("MuiButton-fullWidth")) pontos += 3;
    if (botao.querySelector("svg[data-icon-name='line-plus-circle-solid']")) pontos += 2;

    return pontos;
}

function encontrarBotaoOpcaoCte() {
    const raiz = encontrarModalAdicionarDocumentoMdfe() || document;
    const porIcone = raiz.querySelector("svg[data-icon-name='file-cte-light']")
        ?.closest("button, [role='button']");

    if (porIcone && isVisivel(porIcone) && !porIcone.disabled) return porIcone;

    return encontrarBotaoPorTexto("CONHECIMENTO DE TRANSPORTE CTE", raiz);
}

function encontrarBotaoAdicionarCte() {
    return encontrarBotaoPorTexto("ADICIONAR");
}

async function aguardarElemento(timeout, buscar) {
    const inicio = Date.now();

    while (Date.now() - inicio < timeout) {
        const elemento = buscar?.();

        if (elemento) return elemento;

        await sleep(INTERVALO_BUSCA_MS);
    }

    return null;
}

async function aguardarMudancaAposClique(timeout = TIMEOUT_MDFE_MS) {
    const inicio = Date.now();
    const urlInicial = location.href;

    await sleep(PAUSA_POS_CLIQUE_MS);

    while (Date.now() - inicio < timeout) {
        if (location.href !== urlInicial) {
            await sleep(250);
            return;
        }

        if (!encontrarModalSelecionarEmpresa() || encontrarCardMdfe() || encontrarBotaoNovoMdfe()) {
            return;
        }

        await sleep(INTERVALO_BUSCA_MS);
    }
}

function encontrarBotaoPorTexto(texto, raiz = document) {
    const busca = normalizar(texto);

    return Array.from(raiz.querySelectorAll("button, [role='button'], a, li, span, div"))
        .filter(isVisivel)
        .filter((elemento) => normalizar(elemento.textContent).includes(busca))
        .map((elemento) => elemento.closest("button, [role='button'], a, li") || elemento)
        .filter((elemento) => isVisivel(elemento) && !elemento.disabled)
        .sort((a, b) => textoLimpo(a.textContent).length - textoLimpo(b.textContent).length)[0] || null;
}

function encontrarElementoPorTexto(texto) {
    const busca = normalizar(texto);
    const palavras = busca.split(/\s+/).filter(Boolean);
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
            item.texto.includes(busca) ||
            palavras.every((palavra) => item.texto.includes(palavra))
        )
        .sort((a, b) => a.tamanho - b.tamanho)[0]?.elemento || null;

    return encontrado ? resolverElementoClicavel(encontrado) : null;
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

function obterProdutoresBusca(pendente) {
    const grupos = pendente.servico?.gruposCte || pendente.servico?.gruposProdutores || pendente.servico?.resumo?.produtores || [];
    const produtores = [
        pendente.produtor,
        ...(pendente.produtores || []),
        pendente.servico?.grupoCte?.produtor,
        pendente.servico?.resumo?.produtor,
        ...grupos.map((grupo) => grupo?.produtor)
    ].filter(Boolean);

    return Array.from(new Set(produtores));
}

function textoCombina(texto, buscaNormalizada) {
    const textoNormalizado = normalizar(texto);

    if (!textoNormalizado || !buscaNormalizada) return false;
    if (textoNormalizado.includes(buscaNormalizada) || buscaNormalizada.includes(textoNormalizado)) return true;

    const palavrasBusca = buscaNormalizada.split(/\s+/).filter((palavra) => palavra.length > 2);
    const palavrasTexto = textoNormalizado.split(/\s+/).filter((palavra) => palavra.length > 2);
    const minimo = Math.min(2, palavrasBusca.length);

    return palavrasBusca.filter((palavra) => palavrasTexto.includes(palavra)).length >= minimo;
}

function inferirEmpresaTexto(texto) {
    if (texto.includes("PLUSVAL")) return "PLUSVAL";
    if (texto.includes("PLUMA")) return "PLUMA";
    if (texto.includes("DIPLOMATA")) return "DIPLOMATA";
    return "";
}

async function atualizarPendenteMdfe(pendente, dados) {
    const atualizado = {
        ...pendente,
        ...dados,
        atualizadoEm: Date.now()
    };

    await chrome.storage.local.set({
        [STORAGE_KEYS.mdfePendente]: atualizado
    });

    return atualizado;
}

async function registrarErroMdfe(pendente, erro) {
    await atualizarPendenteMdfe(pendente, {
        etapa: "erro",
        erro
    });
}

async function obterPendenteMdfe() {
    const storage = await chrome.storage.local.get(STORAGE_KEYS.mdfePendente);
    const pendente = storage[STORAGE_KEYS.mdfePendente];

    if (!pendente) return null;

    if (Date.now() - pendente.criadoEm > TEMPO_MAX_MDFE_MS) {
        await chrome.storage.local.remove(STORAGE_KEYS.mdfePendente);
        return null;
    }

    return pendente;
}

function obterDataHojeBr() {
    return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(new Date());
}

async function esperarDocumentoPronto() {
    if (document.readyState === "complete" || document.readyState === "interactive") return;

    await new Promise((resolve) => {
        document.addEventListener("DOMContentLoaded", resolve, { once: true });
    });
}

async function clicarElemento(elemento) {
    elemento.scrollIntoView?.({
        behavior: "instant",
        block: "center"
    });
    await sleep(120);
    elemento.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    elemento.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    elemento.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
    elemento.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    elemento.click();
}

async function preencherCampo(input, valor) {
    input.scrollIntoView?.({
        behavior: "instant",
        block: "center"
    });
    input.focus();
    await sleep(80);

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "");
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward", data: null }));

    await sleep(80);
    setter?.call(input, valor);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: valor }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
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

function listarBotoesVisiveis() {
    return Array.from(document.querySelectorAll("button, [role='button'], .MuiButtonBase-root"))
        .filter(isVisivel)
        .slice(0, 30)
        .map((elemento) => ({
            texto: textoLimpo(elemento.textContent),
            classe: elemento.className?.toString() || "",
            id: elemento.id || "",
            ariaLabel: elemento.getAttribute("aria-label") || ""
        }));
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
