const URL_PRODUTORES_COMPARTILHADOS = "file:///D:/PROJETOS/pedagio-auto/dados-compartilhados/produtores-km.json";
let alertaBaseCompartilhadaExibido = false;

export async function carregarJson(caminho) {
    const usaBaseCompartilhada = caminho === "data/produtores-km.json";
    const url = usaBaseCompartilhada
        ? URL_PRODUTORES_COMPARTILHADOS
        : chrome.runtime.getURL(caminho);

    try {
        const resposta = await fetch(url);

        if (!resposta.ok) {
            throw new Error(`Falha ao carregar JSON (${resposta.status}): ${url}`);
        }

        return await resposta.json();
    } catch (error) {
        if (usaBaseCompartilhada) {
            alertarBaseCompartilhada(url);
        }

        throw error;
    }
}

function alertarBaseCompartilhada(url) {
    if (alertaBaseCompartilhadaExibido) return;

    alertaBaseCompartilhadaExibido = true;
    alert([
        "Nao foi possivel carregar a base compartilhada de produtores.",
        "",
        `Caminho configurado: ${url}`,
        "",
        "Corrija URL_PRODUTORES_COMPARTILHADOS em:",
        "extensao-levo-auto/app/services/data-service.js",
        "",
        "Depois habilite 'Permitir acesso a URLs de arquivo' e recarregue a extensao."
    ].join("\n"));
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
