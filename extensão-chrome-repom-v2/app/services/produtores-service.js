import { inferirEmpresa } from "../../shared/empresas.js";
import { normalizar } from "../../shared/text.js";

export function buscarProdutorKm(produtoresKm, nf) {
    const produtor = normalizar(nf?.produtor);

    if (!produtor) return null;

    let candidatos = produtoresKm.filter((item) =>
        item.buscaProdutor === produtor ||
        item.buscaProdutorTeste === produtor ||
        item.buscaProdutorTeste?.startsWith(`${produtor} `)
    );

    if (!candidatos.length) return null;

    const municipio = normalizar(nf?.municipio);
    const porMunicipio = candidatos.filter((item) => item.buscaMunicipio === municipio);

    if (porMunicipio.length) {
        candidatos = porMunicipio;
    }

    const empresa = inferirEmpresa(nf?.emitente);
    const porEmpresa = candidatos.filter((item) => item.buscaEmpresa === empresa);

    if (porEmpresa.length) {
        candidatos = porEmpresa;
    }

    const alternativas = candidatos
        .slice(0, 10)
        .map(({ buscaProdutor, buscaProdutorTeste, buscaMunicipio, buscaEmpresa, ...item }) => item);

    return {
        ...alternativas[0],
        alternativas,
        ambiguo: new Set(candidatos.map((item) => item.distancia)).size > 1
    };
}
