export async function executarFluxoValePedagio(passos) {
    if (await passos.semPedagio()) {
        passos.atualizarStatus("Sem pedagio; abrindo CIOT...");
        const ciotOk = await passos.abrirCiot();
        if (!ciotOk) return passos.falhar("Confira dados do CIOT");
        return true;
    }

    passos.atualizarStatus("Abrindo vale...");
    const modal = await passos.abrirModal();
    if (!modal) return passos.falhar("Modal nao abriu");

    passos.atualizarStatus("Lendo dados...");
    const dados = await passos.obterDados();
    if (!dados.valido) return passos.falhar("Dados indisponiveis", dados);

    passos.atualizarStatus("Preenchendo...");
    const preenchido = await passos.preencher(modal, dados);
    if (!preenchido) return passos.falhar("Erro ao preencher");

    passos.atualizarStatus("Adicionado");
    const ciotOk = await passos.abrirCiot();
    if (!ciotOk) return passos.falhar("Confira dados do CIOT");

    return true;
}
