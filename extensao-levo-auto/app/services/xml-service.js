export function extrairNfe(xmlTexto, nomeArquivo) {
    const doc = new DOMParser().parseFromString(xmlTexto, "application/xml");
    const erroParser = doc.querySelector("parsererror");

    if (erroParser) {
        throw new Error(`XML invalido: ${nomeArquivo}`);
    }

    const ler = (tag, base = doc) => base.getElementsByTagName(tag)[0]?.textContent?.trim() || "";
    const infNFe = doc.getElementsByTagName("infNFe")[0];
    const prod = doc.getElementsByTagName("prod")[0];
    const dest = doc.getElementsByTagName("dest")[0];
    const emit = doc.getElementsByTagName("emit")[0];
    const enderDest = doc.getElementsByTagName("enderDest")[0];
    const veicTransp = doc.getElementsByTagName("veicTransp")[0];
    const vol = doc.getElementsByTagName("vol")[0];

    if (!infNFe) {
        throw new Error(`Arquivo sem NF-e reconhecida: ${nomeArquivo}`);
    }

    const placa = extrairPlaca(doc, veicTransp, ler, xmlTexto);

    if (!placa) {
        console.warn("Placa nao encontrada no XML da NF-e.", {
            arquivo: nomeArquivo,
            emitente: ler("xNome", emit),
            possuiVeiculoTransporte: Boolean(veicTransp),
            possuiObservacaoPlaca: /xCampo\s*=\s*["'][^"']*placa/i.test(xmlTexto),
            possuiPlacaTextoComplementar: /PLACA(?:\s+CAVALO)?\s*:/i.test(xmlTexto)
        });
    }

    return {
        arquivo: nomeArquivo,
        chave: ler("chNFe") || (infNFe.getAttribute("Id") || "").replace(/^NFe/, ""),
        xmlTexto,
        numero: ler("nNF"),
        serie: ler("serie"),
        natureza: ler("natOp"),
        tipo: ler("tpNF"),
        emissao: ler("dhEmi"),
        emitente: ler("xNome", emit),
        emitenteCnpj: ler("CNPJ", emit),
        produtor: ler("xNome", dest),
        produtorDocumento: ler("CPF", dest) || ler("CNPJ", dest),
        municipio: ler("xMun", enderDest),
        uf: ler("UF", enderDest),
        produto: ler("xProd", prod),
        quantidade: numeroDecimal(ler("qCom", prod)),
        valor: numeroDecimal(ler("vProd", prod)),
        pesoLiquido: numeroDecimal(ler("pesoL", vol)),
        pesoBruto: numeroDecimal(ler("pesoB", vol)),
        placa
    };
}

function extrairPlaca(doc, veicTransp, ler, xmlTexto) {
    const placaVeiculo = normalizarPlaca(ler("placa", veicTransp));

    if (placaVeiculo) return placaVeiculo;

    const observacaoPlaca = Array.from(doc.getElementsByTagName("obsCont"))
        .find((observacao) =>
            String(observacao.getAttribute("xCampo") || "")
                .toUpperCase()
                .includes("PLACA")
        );
    const placaObservacao = observacaoPlaca
        ? normalizarPlaca(ler("xTexto", observacaoPlaca))
        : "";

    if (placaObservacao) return placaObservacao;

    const textoComplementar = ler("infCpl");
    const placaNoTexto = textoComplementar.match(
        /PLACA(?:\s+CAVALO)?\s*:\s*([A-Z]{3}[0-9A-Z][A-Z0-9][0-9]{2})/i
    )?.[1];

    const placaComplementar = normalizarPlaca(placaNoTexto);

    if (placaComplementar) return placaComplementar;

    const placaObservacaoXml = String(xmlTexto || "").match(
        /<(?:(?:\w+):)?obsCont\b[^>]*xCampo\s*=\s*["'][^"']*placa[^"']*["'][^>]*>[\s\S]*?<(?:(?:\w+):)?xTexto\b[^>]*>\s*([A-Z]{3}[0-9A-Z][A-Z0-9][0-9]{2})\s*<\//i
    )?.[1];

    if (placaObservacaoXml) return normalizarPlaca(placaObservacaoXml);

    const placaTextoXml = String(xmlTexto || "").match(
        /PLACA(?:\s+CAVALO)?\s*:\s*([A-Z]{3}[0-9A-Z][A-Z0-9][0-9]{2})/i
    )?.[1];

    return normalizarPlaca(placaTextoXml);
}

function normalizarPlaca(valor) {
    const placa = String(valor || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

    return /^[A-Z]{3}[0-9A-Z][A-Z0-9][0-9]{2}$/.test(placa)
        ? placa
        : "";
}

export function numeroDecimal(valor) {
    const texto = String(valor || "").replace(",", ".");
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : 0;
}
