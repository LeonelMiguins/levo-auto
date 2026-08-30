const DEFAULT_TIMEOUT = 10000;

export function criarEngineAutomacao(root = document) {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const esperarCarregar = () => {
        return new Promise((resolve) => {
            if (document.readyState === "complete") {
                resolve();
                return;
            }

            window.addEventListener("load", resolve, { once: true });
        });
    };

    const normalizar = (valor) =>
        String(valor ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .trim();

    const resolverElemento = (alvo) => {
        if (!alvo) return null;
        if (alvo instanceof Element) return alvo;

        const seletor = String(alvo).trim();
        let porSeletor = null;

        try {
            porSeletor = root.querySelector(seletor);
        } catch {
            porSeletor = null;
        }

        if (porSeletor) return porSeletor;

        if (!seletor.startsWith("#") && !seletor.startsWith(".")) {
            return root.getElementById?.(seletor) || root.querySelector(`[name="${seletor}"]`);
        }

        return null;
    };

    const disparar = (elemento, eventos = ["input", "change"]) => {
        eventos.forEach((nome) => {
            elemento.dispatchEvent(new Event(nome, { bubbles: true }));
        });
    };

    const esperarElemento = async (alvo, { timeout = DEFAULT_TIMEOUT } = {}) => {
        const existente = resolverElemento(alvo);
        if (existente) return existente;

        const inicio = Date.now();

        while (Date.now() - inicio < timeout) {
            await sleep(100);

            const elemento = resolverElemento(alvo);
            if (elemento) return elemento;
        }

        throw new Error(`Elemento nao encontrado: ${alvo}`);
    };

    const setText = async (alvo, texto, opcoes = {}) => {
        const { timeout, blur = false } = opcoes;
        const elemento = await esperarElemento(alvo, { timeout });

        elemento.focus?.();
        elemento.value = texto ?? "";
        disparar(elemento);

        if (blur) {
            elemento.blur?.();
            disparar(elemento, ["blur"]);
        }

        return elemento;
    };

    const click = async (alvo, opcoes = {}) => {
        const elemento = await esperarElemento(alvo, opcoes);
        elemento.click();
        return elemento;
    };

    const selectByText = async (alvo, texto, opcoes = {}) => {
        const { timeout = DEFAULT_TIMEOUT } = opcoes;
        const elemento = await esperarElemento(alvo, { timeout });

        if (!(elemento instanceof HTMLSelectElement)) {
            throw new Error(`Elemento nao e select: ${alvo}`);
        }

        const textoBusca = normalizar(texto);
        const inicio = Date.now();
        let option = null;

        while (Date.now() - inicio < timeout) {
            option = Array.from(elemento.options).find((item) =>
                normalizar(item.text).includes(textoBusca) ||
                normalizar(item.textContent).includes(textoBusca) ||
                normalizar(item.dataset?.nome).includes(textoBusca)
            );

            if (option) break;

            await sleep(250);
        }

        if (!option) {
            throw new Error(`Opcao nao encontrada em ${alvo}: ${texto}`);
        }

        elemento.value = option.value;
        disparar(elemento);

        return option;
    };

    const selectByValue = async (alvo, valor, opcoes = {}) => {
        const { timeout = DEFAULT_TIMEOUT } = opcoes;
        const elemento = await esperarElemento(alvo, { timeout });

        if (!(elemento instanceof HTMLSelectElement)) {
            throw new Error(`Elemento nao e select: ${alvo}`);
        }

        const inicio = Date.now();

        while (
            valor &&
            !Array.from(elemento.options).some((option) => option.value === valor) &&
            Date.now() - inicio < timeout
        ) {
            await sleep(250);
        }

        elemento.value = valor;
        disparar(elemento);

        return elemento;
    };

    const setChecked = async (alvo, checked = true, opcoes = {}) => {
        const elemento = await esperarElemento(alvo, opcoes);
        elemento.checked = Boolean(checked);
        disparar(elemento, ["input", "change", "click"]);
        return elemento;
    };

    const escolherOpcaoCustom = async (alvo, texto, opcoes = {}) => {
        const {
            optionSelector = "[role='option'], li, option, .option, .item",
            timeout = DEFAULT_TIMEOUT
        } = opcoes;

        await click(alvo, { timeout });

        const inicio = Date.now();
        const textoBusca = normalizar(texto);

        while (Date.now() - inicio < timeout) {
            const opcao = Array.from(document.querySelectorAll(optionSelector)).find((item) =>
                normalizar(item.textContent).includes(textoBusca)
            );

            if (opcao) {
                opcao.click();
                return opcao;
            }

            await sleep(100);
        }

        throw new Error(`Opcao custom nao encontrada: ${texto}`);
    };

    const setAutocomplete = async (alvo, texto, opcoes = {}) => {
        const {
            optionSelector = "[role='option'], li, .autocomplete-item, .ui-menu-item",
            timeout = DEFAULT_TIMEOUT,
            pressEnter = false
        } = opcoes;

        const elemento = await setText(alvo, texto, { timeout });

        if (pressEnter) {
            elemento.dispatchEvent(new KeyboardEvent("keydown", {
                key: "Enter",
                bubbles: true
            }));
            return elemento;
        }

        await escolherOpcaoCustom(elemento, texto, { optionSelector, timeout });
        return elemento;
    };

    return {
        click,
        escolherOpcaoCustom,
        esperarCarregar,
        esperarElemento,
        selectByText,
        selectByValue,
        setAutocomplete,
        setChecked,
        setText,
        sleep
    };
}
