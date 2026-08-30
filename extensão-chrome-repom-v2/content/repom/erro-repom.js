import { URLS } from "../../shared/constants.js";
import { normalizar } from "../../shared/text.js";
import { isPaginaErroRepom } from "./paginas-repom.js";
import { limparPedidoAutoLogin, obterPedidoAutoLogin } from "./storage-repom.js";

export async function redirecionarErroParaLogin() {
    const url = new URL(location.href);
    const erro = url.searchParams.get("Erro") || "";
    const textoErro = normalizar(`${erro} ${document.body?.innerText || ""}`);
    const pareceErroDePerfil =
        textoErro.includes("PERFIL") &&
        textoErro.includes("INCOMPAT") &&
        textoErro.includes("SITE");

    if (!isPaginaErroRepom()) return false;

    const pedidoLogin = await obterPedidoAutoLogin();

    if (pedidoLogin?.etapa && pedidoLogin.etapa !== "inicio") {
        await limparPedidoAutoLogin();
        console.warn("Repom recusou uma etapa do login. Auto-login desativado para evitar loop.", {
            etapa: pedidoLogin.etapa
        });
    }

    console.warn("Repom retornou pagina de erro. Redirecionando para login.", {
        pareceErroDePerfil
    });
    location.href = URLS.repomLogin;
    return true;
}
