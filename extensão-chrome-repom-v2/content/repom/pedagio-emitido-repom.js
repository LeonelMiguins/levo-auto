import { STORAGE_KEYS } from "../../shared/constants.js";
import { normalizar } from "../../shared/text.js";
import { isPaginaImpressaoRepom } from "./paginas-repom.js";

export async function capturarPedagioEmitido() {
    if (!isPaginaImpressaoRepom()) return false;

    const dados = extrairDadosPedagioEmitido();

    if (!dados.numeroPedagio || !dados.numeroMeioPagamento || !dados.valor || !dados.empresa) {
        console.warn("Nao foi possivel capturar todos os dados do pedagio emitido.", dados);
        return false;
    }

    const storage = await chrome.storage.local.get([
        STORAGE_KEYS.servicoAtual,
        STORAGE_KEYS.sessao,
        STORAGE_KEYS.historicoPedagios
    ]);
    const servicoAtual = storage[STORAGE_KEYS.servicoAtual] || {};
    const sessao = storage[STORAGE_KEYS.sessao] || {};
    const pedagioEmitido = {
        ...dados,
        capturadoEm: Date.now(),
        origem: "repom",
        usuario: sessao.nome || servicoAtual.usuario || ""
    };
    const historico = adicionarAoHistorico(
        storage[STORAGE_KEYS.historicoPedagios],
        criarRegistroHistorico(pedagioEmitido, servicoAtual)
    );

    await chrome.storage.local.set({
        [STORAGE_KEYS.repomPedagioEmitido]: pedagioEmitido,
        [STORAGE_KEYS.historicoPedagios]: historico,
        [STORAGE_KEYS.servicoAtual]: {
            ...servicoAtual,
            pedagioEmitido
        }
    });

    console.log("Dados do pedagio emitido capturados.", pedagioEmitido);
    return false;
}

function extrairDadosPedagioEmitido() {
    const linhas = Array.from(document.querySelectorAll("tr"));
    const textoPagina = document.body?.innerText || "";
    const celulas = Array.from(document.querySelectorAll("td"));

    return {
        numeroPedagio: extrairNumeroPedagio(celulas),
        numeroMeioPagamento: extrairNumeroMeioPagamento(textoPagina),
        valor: extrairValorTotal(linhas, celulas),
        empresa: extrairEmpresa(celulas, textoPagina)
    };
}

function extrairNumeroPedagio(celulas) {
    const celulaViagem = celulas.find((celula) =>
        normalizar(celula.textContent) === "VIAGEM:"
    );

    return limparTexto(celulaViagem?.nextElementSibling?.textContent || "");
}

function extrairNumeroMeioPagamento(textoPagina) {
    const match = textoPagina.match(/N[ºo°]?\s*Meio\s*De\s*Pagamento\s*:\s*([0-9]+)/i);
    return match?.[1] || "";
}

function extrairValorTotal(linhas, celulas) {
    const linhaTotal = linhas.find((linha) =>
        normalizar(linha.textContent).includes("TOTAL:")
    );

    if (linhaTotal) {
        const valoresLinha = extrairValoresMonetarios(linhaTotal.textContent);
        const ultimoValor = valoresLinha.at(-1);

        if (ultimoValor) return ultimoValor;
    }

    const celulaTotal = celulas.find((celula) =>
        normalizar(celula.textContent) === "TOTAL:"
    );
    const proximaCelula = celulaTotal?.nextElementSibling;
    const valorProxima = proximaCelula && extrairValoresMonetarios(proximaCelula.textContent).at(-1);

    if (valorProxima) return valorProxima;

    return extrairValoresMonetarios(document.body?.innerText || "")
        .sort((a, b) => numeroValor(b) - numeroValor(a))[0] || "";
}

function extrairEmpresa(celulas, textoPagina) {
    const celulaCliente = celulas.find((celula) =>
        normalizar(celula.textContent) === "CLIENTE:"
    );
    const textoCliente = celulaCliente?.nextElementSibling?.textContent || "";
    const empresaCliente = separarEmpresa(textoCliente);

    if (empresaCliente) return empresaCliente;

    const match = textoPagina.match(/\b\d{14}\s*-\s*([^\n\r]+)/);
    return limparTexto(match?.[1] || "");
}

function separarEmpresa(texto) {
    const partes = String(texto || "").split("-");
    return limparTexto(partes.length > 1 ? partes.slice(1).join("-") : "");
}

function extrairValoresMonetarios(texto) {
    return Array.from(String(texto || "").matchAll(/\b\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\b/g))
        .map((match) => match[0]);
}

function numeroValor(valor) {
    const texto = String(valor || "").trim();
    const decimal = texto.includes(",")
        ? texto.replace(/\./g, "").replace(",", ".")
        : texto;
    const numero = Number(decimal);
    return Number.isFinite(numero) ? numero : 0;
}

function limparTexto(texto) {
    return String(texto || "").replace(/\s+/g, " ").trim();
}

function criarRegistroHistorico(pedagio, servico) {
    return {
        id: criarIdHistorico(pedagio),
        usuario: pedagio.usuario,
        criadoEm: pedagio.capturadoEm,
        repom: {
            numeroPedagio: pedagio.numeroPedagio,
            numeroMeioPagamento: pedagio.numeroMeioPagamento,
            valor: pedagio.valor,
            empresa: pedagio.empresa
        },
        servico: {
            cidade: servico.cidade || "",
            notaInicial: servico.nota || "",
            quantidadeNotas: servico.quantidade || 0,
            placa: servico.codigo || servico.caminhao?.placa || "",
            caminhao: servico.caminhao || null,
            produtor: servico.resumo?.produtor || "",
            emitente: servico.resumo?.emitente || "",
            municipio: servico.resumo?.municipio || servico.cidade || "",
            distanciaPagamento: servico.distanciaPagamento ?? servico.kmPagamento ?? null,
            kmTotal: servico.kmTotal ?? null,
            notas: servico.resumo?.notas || [],
            pesoTotal: servico.resumo?.pesoTotal || 0,
            valorTotalNotas: servico.resumo?.valorTotal || 0,
            produtorKm: servico.produtorKm || null
        },
        nfs: Array.isArray(servico.nfs)
            ? servico.nfs.map((nf) => ({
                numero: nf.numero,
                chave: nf.chave,
                serie: nf.serie,
                emitente: nf.emitente,
                produtor: nf.produtor,
                municipio: nf.municipio,
                uf: nf.uf,
                quantidade: nf.quantidade,
                valor: nf.valor,
                pesoLiquido: nf.pesoLiquido,
                placa: nf.placa
            }))
            : []
    };
}

function adicionarAoHistorico(historicoAtual, registro) {
    const historico = historicoAtual && typeof historicoAtual === "object"
        ? historicoAtual
        : {};
    const usuario = registro.usuario || "sem_usuario";
    const listaUsuario = Array.isArray(historico[usuario]) ? historico[usuario] : [];
    const semDuplicado = listaUsuario.filter((item) => item.id !== registro.id);

    return {
        ...historico,
        [usuario]: [registro, ...semDuplicado].slice(0, 500)
    };
}

function criarIdHistorico(pedagio) {
    return [
        pedagio.usuario || "sem_usuario",
        pedagio.numeroPedagio,
        pedagio.numeroMeioPagamento
    ].join(":");
}
