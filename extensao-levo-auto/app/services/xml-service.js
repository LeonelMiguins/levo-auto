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
        placa: ler("placa", veicTransp)
    };
}

export function numeroDecimal(valor) {
    const texto = String(valor || "").replace(",", ".");
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : 0;
}
