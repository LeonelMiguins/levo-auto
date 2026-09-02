(async () => {
    if (window.__pedagioAutoContentRodando) {
        console.warn("Pedagio Auto ja esta rodando nesta pagina. Ignorando execucao duplicada.");
        return;
    }

    window.__pedagioAutoContentRodando = true;

    if (location.hostname.includes("app.simplescte.com.br")) {
        const { executarMdfePendente } = await import(chrome.runtime.getURL("content/simples-cte/mdfe-simples-cte.js"));
        const { selecionarEmpresaSimplesCte } = await import(chrome.runtime.getURL("content/simples-cte/empresa-simples-cte.js"));

        if (await executarMdfePendente()) return;

        await selecionarEmpresaSimplesCte();
        return;
    }

    const { abrirModal } = await import(chrome.runtime.getURL("ui/modal.js"));
    const { executarRoteiroAuto } = await import(chrome.runtime.getURL("automation/repom-etapa-01.js"));
    const { redirecionarErroParaLogin } = await import(chrome.runtime.getURL("content/repom/erro-repom.js"));
    const { executarAutoLoginRepom } = await import(chrome.runtime.getURL("content/repom/login-repom.js"));
    const { capturarPedagioEmitido } = await import(chrome.runtime.getURL("content/repom/pedagio-emitido-repom.js"));
    const { continuarAutomacaoPendente, retomarAposLogin } = await import(chrome.runtime.getURL("content/repom/retomada-repom.js"));

    let modalAberto = false;

    const abrir = async () => {
        if (modalAberto) return;

        modalAberto = true;

        const resultado = await abrirModal();

        modalAberto = false;

        console.log("RESULTADO FINAL:", resultado);

        if (!resultado?.cidade) {
            console.warn("Cidade vazia");
            return;
        }

        await executarRoteiroAuto(resultado);
    };

    document.addEventListener("keydown", (event) => {
        if (event.key !== "F3") return;

        event.preventDefault();
        abrir();
    });

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === "abrirModal") {
            abrir();
        }
    });

    if (await redirecionarErroParaLogin()) return;
    if (await executarAutoLoginRepom()) return;
    if (await capturarPedagioEmitido()) return;
    if (await retomarAposLogin()) return;

    continuarAutomacaoPendente();
})();
