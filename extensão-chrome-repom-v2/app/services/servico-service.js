import { normalizar } from "../../shared/text.js";

export function montarServico(nfs, contexto) {
    if (!nfs.length) {
        throw new Error("Nenhuma NF-e informada.");
    }

    const primeira = nfs[0];
    const destinoPedagio = selecionarDestinoPedagio(nfs, contexto);
    const nfDestino = destinoPedagio?.nf || primeira;
    const produtorKm = destinoPedagio?.produtorKm || null;
    const placa = nfs.find((nf) => nf.placa)?.placa || "";
    const caminhao = contexto.buscarCaminhao(placa);
    const gruposProdutores = agruparNfsPorProdutor(nfs, contexto);

    return montarBaseServico({
        origem: "xml",
        criadoEm: Date.now(),
        codigo: placa,
        cidade: nfDestino.municipio,
        nota: primeira.numero,
        quantidade: nfs.length,
        autoConfirmar: contexto.autoConfirmar,
        semPedagio: contexto.semPedagio,
        caminhao,
        produtorKm,
        destinoPedagio: limparDestinoPedagio(destinoPedagio),
        chavesAcesso: extrairChavesAcesso(nfs),
        gruposProdutores,
        grupoCteSelecionadoId: gruposProdutores[0]?.id || "",
        nfs,
        resumo: {
            produtor: nfDestino.produtor,
            produtores: gruposProdutores.map(resumirGrupoProdutor),
            emitente: nfDestino.emitente,
            municipio: `${nfDestino.municipio}${nfDestino.uf ? `/${nfDestino.uf}` : ""}`,
            destinos: destinoPedagio?.destinos || [],
            notas: nfs.map((nf) => nf.numero).filter(Boolean),
            pesoTotal: soma(nfs, "pesoLiquido") || soma(nfs, "quantidade"),
            valorTotal: soma(nfs, "valor")
        }
    });
}

export function montarServicoManual(base = {}, valores, contexto) {
    const placa = valores.placa.trim().toUpperCase();
    const nfBase = encontrarNfPorCidade(base.nfs, valores.cidade) || {
        produtor: base.resumo?.produtor,
        municipio: valores.cidade.trim(),
        emitente: base.resumo?.emitente
    };
    const cidadeAlterada = normalizar(base.cidade) !== normalizar(valores.cidade);
    const produtorKm = !cidadeAlterada && base.produtorKm
        ? base.produtorKm
        : contexto.buscarProdutorKm(nfBase);
    const produtorResumo = cidadeAlterada ? nfBase.produtor : base.resumo?.produtor;
    const emitenteResumo = cidadeAlterada ? nfBase.emitente : base.resumo?.emitente;

    return montarBaseServico({
        ...base,
        criadoEm: base.criadoEm || Date.now(),
        atualizadoEm: Date.now(),
        codigo: placa,
        cidade: valores.cidade.trim(),
        nota: valores.nota.trim(),
        quantidade: Number(valores.quantidade || 0),
        autoConfirmar: valores.autoConfirmar,
        semPedagio: valores.semPedagio,
        caminhao: contexto.buscarCaminhao(placa),
        produtorKm,
        chavesAcesso: base.chavesAcesso || extrairChavesAcesso(base.nfs),
        gruposProdutores: base.gruposProdutores || [],
        grupoCteSelecionadoId: base.grupoCteSelecionadoId || base.gruposProdutores?.[0]?.id || "",
        resumo: {
            produtor: produtorResumo || "-",
            produtores: base.resumo?.produtores || base.gruposProdutores?.map(resumirGrupoProdutor) || [],
            emitente: emitenteResumo || "-",
            municipio: valores.cidade.trim(),
            notas: base.resumo?.notas || [valores.nota.trim()].filter(Boolean),
            pesoTotal: base.resumo?.pesoTotal || 0,
            valorTotal: base.resumo?.valorTotal || 0
        }
    });
}

function montarBaseServico(servico) {
    const produtorKm = servico.produtorKm;
    const distancia = produtorKm?.distancia ??
        servico.distanciaPagamento ??
        servico.distanciaKm ??
        servico.kmPagamento ??
        servico.resumo?.distanciaPagamento ??
        servico.resumo?.distanciaKm ??
        servico.resumo?.kmPagamento ??
        null;

    const kmTotal = produtorKm?.kmTotal ??
        produtorKm?.km ??
        servico.kmTotal ??
        servico.resumo?.kmTotal ??
        null;

    return {
        ...servico,
        kmPagamento: distancia,
        distanciaPagamento: distancia,
        kmTotal,
        resumo: {
            ...servico.resumo,
            kmPagamento: distancia,
            distanciaPagamento: distancia,
            kmTotal
        }
    };
}

function soma(lista, chave) {
    return lista.reduce((total, item) => total + Number(item[chave] || 0), 0);
}

function extrairChavesAcesso(nfs = []) {
    if (!Array.isArray(nfs)) return [];

    return nfs
        .map((nf) => String(nf.chave || "").replace(/\D/g, ""))
        .filter(Boolean);
}

function agruparNfsPorProdutor(nfs, contexto) {
    const grupos = new Map();

    nfs.forEach((nf) => {
        const chaveGrupo = criarChaveGrupoProdutor(nf);

        if (!grupos.has(chaveGrupo)) {
            grupos.set(chaveGrupo, {
                id: chaveGrupo,
                produtor: nf.produtor || "-",
                produtorDocumento: nf.produtorDocumento || "",
                emitente: nf.emitente || "",
                nfs: []
            });
        }

        grupos.get(chaveGrupo).nfs.push(nf);
    });

    return Array.from(grupos.values()).map((grupo) => montarGrupoProdutor(grupo, contexto));
}

function montarGrupoProdutor(grupo, contexto) {
    const destinoPedagio = selecionarDestinoPedagio(grupo.nfs, contexto);
    const nfDestino = destinoPedagio?.nf || grupo.nfs[0] || {};
    const produtorKm = destinoPedagio?.produtorKm || contexto.buscarProdutorKm(nfDestino);

    return {
        id: grupo.id,
        produtor: grupo.produtor,
        produtorDocumento: grupo.produtorDocumento,
        emitente: grupo.emitente || nfDestino.emitente || "",
        cidade: nfDestino.municipio || "",
        municipio: `${nfDestino.municipio || ""}${nfDestino.uf ? `/${nfDestino.uf}` : ""}`,
        uf: nfDestino.uf || "",
        quantidade: grupo.nfs.length,
        notas: grupo.nfs.map((nf) => nf.numero).filter(Boolean),
        chavesAcesso: extrairChavesAcesso(grupo.nfs),
        pesoTotal: soma(grupo.nfs, "pesoLiquido") || soma(grupo.nfs, "quantidade"),
        valorTotal: soma(grupo.nfs, "valor"),
        distanciaPagamento: produtorKm?.distancia ?? produtorKm?.distanciaPagamento ?? produtorKm?.kmPagamento ?? null,
        kmTotal: produtorKm?.kmTotal ?? produtorKm?.km ?? null,
        produtorKm,
        destinoPedagio: limparDestinoPedagio(destinoPedagio),
        nfs: grupo.nfs
    };
}

function criarChaveGrupoProdutor(nf) {
    const documento = String(nf?.produtorDocumento || "").replace(/\D/g, "");

    if (documento) return `doc-${documento}`;

    const produtor = normalizar(nf?.produtor);
    return `nome-${produtor || "sem-produtor"}`;
}

function resumirGrupoProdutor(grupo) {
    return {
        id: grupo.id,
        produtor: grupo.produtor,
        produtorDocumento: grupo.produtorDocumento,
        municipio: grupo.municipio,
        cidade: grupo.cidade,
        quantidade: grupo.quantidade,
        notas: grupo.notas,
        pesoTotal: grupo.pesoTotal,
        valorTotal: grupo.valorTotal,
        distanciaPagamento: grupo.distanciaPagamento,
        kmTotal: grupo.kmTotal
    };
}

function encontrarNfPorCidade(nfs = [], cidade) {
    const cidadeBusca = normalizar(cidade);

    if (!cidadeBusca || !Array.isArray(nfs)) return null;

    return nfs.find((nf) => normalizar(nf.municipio) === cidadeBusca) || null;
}

function selecionarDestinoPedagio(nfs, contexto) {
    const destinos = nfs.map((nf, indice) => {
        const produtorKm = contexto.buscarProdutorKm(nf);

        return {
            indice,
            nota: nf.numero,
            produtor: nf.produtor,
            municipio: nf.municipio,
            uf: nf.uf,
            emitente: nf.emitente,
            distancia: produtorKm?.distancia ?? produtorKm?.distanciaPagamento ?? produtorKm?.kmPagamento ?? null,
            kmTotal: produtorKm?.kmTotal ?? produtorKm?.km ?? null,
            produtorKm,
            nf
        };
    });

    const comDistancia = destinos.filter((destino) =>
        Number.isFinite(Number(destino.distancia))
    );

    const escolhido = (comDistancia.length ? comDistancia : destinos)
        .reduce((maior, atual) => {
            const distanciaMaior = Number(maior?.distancia ?? -1);
            const distanciaAtual = Number(atual?.distancia ?? -1);

            if (!maior || distanciaAtual > distanciaMaior) return atual;
            return maior;
        }, null);

    if (!escolhido) return null;

    return {
        nf: escolhido.nf,
        ...semNfInterna(escolhido),
        destinos: destinos.map(semNfInterna)
    };
}

function semNfInterna(destino) {
    const { nf, ...dados } = destino;
    return dados;
}

function limparDestinoPedagio(destinoPedagio) {
    if (!destinoPedagio) return null;

    return semNfInterna(destinoPedagio);
}
