export async function carregarJson(caminho) {
    const resposta = await fetch(chrome.runtime.getURL(caminho));
    return resposta.json();
}

export async function carregarUsuarios() {
    const resposta = await fetch(chrome.runtime.getURL("data/users.json"));
    const texto = await resposta.text();

    if (!texto.trim()) return [];

    return JSON.parse(texto);
}

export function normalizarUsuarios(dados) {
    if (Array.isArray(dados)) return dados;
    if (Array.isArray(dados?.users)) return dados.users;

    if (dados && typeof dados === "object") {
        return Object.values(dados);
    }

    return [];
}
