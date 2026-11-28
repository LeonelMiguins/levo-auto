export async function executarFluxoCiot(passos) {
    await passos.registrarEstado("abrindo_escolha");

    const modalEscolha = await passos.aguardarEscolha();
    if (!modalEscolha) return passos.falhar("Modal de escolha do CIOT nao abriu");

    const opcaoNovoCiot = passos.encontrarOpcaoNovo(modalEscolha);
    if (!opcaoNovoCiot) return passos.falhar("Opcao Emitir novo CIOT nao encontrada");

    await passos.registrarEstado("abrindo_novo");
    passos.abrirNovo(opcaoNovoCiot);

    const modalNovoCiot = await passos.aguardarNovo();
    if (!modalNovoCiot) return passos.falhar("Modal Novo CIOT nao abriu");

    await passos.registrarEstado("conferindo_dados");
    if (!await passos.conferirDados(modalNovoCiot)) return false;
    if (!await passos.marcarRetornoVazio(modalNovoCiot)) {
        return passos.falhar("Checkbox Retorno vazio nao ficou marcado");
    }

    await passos.registrarEstado("retorno_vazio_marcado");
    return true;
}
