(async () => {
    if (window.__autoPedagioRepomExecutando) return;
    window.__autoPedagioRepomExecutando = true;

    const { redirecionarErroParaLogin } = await import(chrome.runtime.getURL("content/repom/erro-repom.js"));
    const { executarAutoLoginRepom } = await import(chrome.runtime.getURL("content/repom/login-repom.js"));
    const { abrirImpressaoPedagioRepom } = await import(chrome.runtime.getURL("content/repom/imprimir-pedagio-repom.js"));
    const { continuarAutomacaoPendente, retomarAposLogin } = await import(chrome.runtime.getURL("content/repom/retomada-repom.js"));

    if (await redirecionarErroParaLogin()) return;
    if (await executarAutoLoginRepom()) return;
    if (await abrirImpressaoPedagioRepom()) return;
    if (await retomarAposLogin()) return;
    await continuarAutomacaoPendente();
})();
