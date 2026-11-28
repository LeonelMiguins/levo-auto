export async function executarFluxoEmissaoCte(passos) {
    if (!await passos.salvar()) return { ok: false, etapa: "salvar" };
    if (!await passos.deveEmitir()) return { ok: true, emitido: false };
    if (!await passos.emitir()) return { ok: false, etapa: "emitir" };
    return { ok: true, emitido: true };
}
