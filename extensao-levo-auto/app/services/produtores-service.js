import { inferirEmpresa } from "../../shared/empresas.js";
import { normalizar } from "../../shared/text.js";

export function buscarProdutorKm(produtoresKm, nf) {
    const produtor = normalizar(nf?.produtor);

    if (!produtor) return null;

    let candidatos = produtoresKm.filter((item) =>
        obterBuscaProdutor(item) === produtor ||
        obterBuscaProdutorTeste(item) === produtor ||
        obterBuscaProdutorTeste(item).startsWith(`${produtor} `)
    );

    if (!candidatos.length) return null;

    const municipio = normalizar(nf?.municipio);
    const porMunicipio = candidatos.filter((item) => obterBuscaMunicipio(item) === municipio);

    if (porMunicipio.length) {
        candidatos = porMunicipio;
    }

    const empresa = inferirEmpresa(nf?.emitente);
    const porEmpresa = candidatos.filter((item) => obterBuscaEmpresa(item) === empresa);

    if (porEmpresa.length) {
        candidatos = porEmpresa;
    }

    const alternativas = candidatos
        .slice(0, 10)
        .map(normalizarProdutorKm);

    return {
        ...alternativas[0],
        alternativas,
        ambiguo: new Set(candidatos.map((item) => item.distancia)).size > 1
    };
}

function normalizarProdutorKm(item) {
    return {
        ...item,
        produtorTeste: item.produtorTeste || criarProdutorTeste(item),
        kmTotal: item.kmTotal ?? calcularKmTotal(item),
        distanciaPagamento: item.distanciaPagamento ?? item.kmPagamento ?? item.distancia ?? null
    };
}

function obterBuscaProdutor(item) {
    return item.buscaProdutor || normalizar(item.produtor);
}

function obterBuscaProdutorTeste(item) {
    return item.buscaProdutorTeste || normalizar(item.produtorTeste || criarProdutorTeste(item));
}

function obterBuscaMunicipio(item) {
    return item.buscaMunicipio || normalizar(item.municipio);
}

function obterBuscaEmpresa(item) {
    const empresa = normalizar(item.buscaEmpresa || item.empresa);

    return empresa === "PLUVAL" ? "PLUSVAL" : empresa;
}

function criarProdutorTeste(item) {
    return [item.produtor, item.aviario].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function calcularKmTotal(item) {
    const distancia = Number(item.distanciaPagamento ?? item.kmPagamento ?? item.distancia);

    return Number.isFinite(distancia) ? distancia * 2 : null;
}
