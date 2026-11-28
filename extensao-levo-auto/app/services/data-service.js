export async function carregarJson(caminho) {
    const url = chrome.runtime.getURL(caminho);
    const resposta = await fetch(url);

    if (!resposta.ok) {
        throw new Error(`Falha ao carregar JSON (${resposta.status}): ${url}`);
    }

    return resposta.json();
}

export async function carregarUsuarios() {
    const url = chrome.runtime.getURL("data/users.json");
    const resposta = await fetch(url);

    if (!resposta.ok) {
        throw new Error(`Falha ao carregar JSON (${resposta.status}): ${url}`);
    }

    const texto = await resposta.text();
    return texto.trim() ? JSON.parse(texto) : [];
}

export function normalizarUsuarios(dados) {
    if (Array.isArray(dados)) return dados;
    if (Array.isArray(dados?.users)) return dados.users;

    if (dados && typeof dados === "object") {
        return Object.values(dados);
    }

    return [];
}
