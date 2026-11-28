export async function executarFluxoFrete(passos) {
    if (!await passos.preencherVeiculo()) return { ok: false, etapa: "veiculo" };
    if (!await passos.selecionarTipoCarga()) return { ok: false, etapa: "tipo_carga" };
    if (!await passos.preencherDistancia()) return { ok: false, etapa: "distancia" };
    if (!await passos.marcarRetornoVazio()) return { ok: false, etapa: "retorno_vazio" };
    if (!await passos.marcarAltoDesempenho()) return { ok: false, etapa: "alto_desempenho" };

    const distanciaFrete = passos.obterDistancia();
    if (!await passos.calcular()) return { ok: false, etapa: "calcular" };
    if (!await passos.confirmar()) return { ok: false, etapa: "confirmar" };
    if (!await passos.abrirInformacoesAdicionais()) return { ok: false, etapa: "informacoes_adicionais" };
    if (!await passos.preencherObservacao(distanciaFrete)) return { ok: false, etapa: "observacao" };

    return { ok: true, distanciaFrete };
}
