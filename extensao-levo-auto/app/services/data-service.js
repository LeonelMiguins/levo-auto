const URL_PRODUTORES_COMPARTILHADOS = "file:///D:/PROJETOS/pedagio-auto/dados-compartilhados/produtores-km.json";

export async function carregarJson(caminho) {
    const url = caminho === "data/produtores-km.json"
        ? URL_PRODUTORES_COMPARTILHADOS
        : chrome.runtime.getURL(caminho);
    const resposta = await fetch(url);

    if (!resposta.ok) {
        throw new Error(`Falha ao carregar JSON (${resposta.status}): ${url}`);
    }

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
