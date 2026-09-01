import { criarEngineAutomacao } from "../../automation/engine.js";
import { REPOM_LOGIN_PAUSAS_MS } from "../../shared/constants.js";
import { normalizar } from "../../shared/text.js";
import { isPaginaLoginRepom } from "./paginas-repom.js";
import {
    atualizarPedidoAutoLogin,
    limparPedidoAutoLogin,
    obterAutomacaoPendente,
    obterCredenciaisRepom,
    obterPedidoAutoLogin,
    obterSessaoExtensao
} from "./storage-repom.js";

export async function executarAutoLoginRepom() {
    if (!isPaginaLoginRepom()) return false;

    const pedidoLogin = await obterPedidoAutoLogin();
    if (!pedidoLogin) return false;

    const dadosPendentes = await obterAutomacaoPendente();
    if (!dadosPendentes) {
        await limparPedidoAutoLogin();
        return false;
    }

    const sessao = await obterSessaoExtensao();
    if (!sessao) {
        await limparPedidoAutoLogin();
        console.warn("Sessao da extensao expirada. Auto-login do Repom cancelado.");
        return false;
    }

    const credenciais = await obterCredenciaisRepom(sessao, dadosPendentes);
    if (!credenciais) {
        await limparPedidoAutoLogin();
        return false;
    }

    const auto = criarEngineAutomacao();
    const senhaJaDisponivel = campoSenhaDisponivel();

    await auto.esperarCarregar();
    await auto.sleep(REPOM_LOGIN_PAUSAS_MS.media);

    if (pedidoLogin.etapa === "senha_enviada") {
        await limparPedidoAutoLogin();
        console.warn("Auto-login do Repom ja tentou a senha. Desativado para evitar loop.");
        return true;
    }

    if (senhaJaDisponivel || pedidoLogin.etapa === "usuario_enviado") {
        await preencherSenhaEEntrar(auto, pedidoLogin, credenciais);
        return true;
    }

    if (pedidoLogin.usuarioEnviado) {
        console.warn("Usuario ja enviado. Aguardando tela de senha sem reenviar.");
        return true;
    }

    await preencherUsuarioEEntrar(auto, credenciais);

    const senha = await esperarCampoSenha(5000).catch(() => null);
    if (!senha) return true;

    await preencherSenhaEEntrar(auto, {
        ...pedidoLogin,
        usuarioEnviado: true
    }, credenciais);
    return true;
}

async function preencherUsuarioEEntrar(auto, credenciais) {
    await auto.click("label[for='radio-contratante'], #radio-contratante");
    await auto.sleep(REPOM_LOGIN_PAUSAS_MS.curta);
    await auto.setText("#UserName", credenciais.login);
    await auto.sleep(REPOM_LOGIN_PAUSAS_MS.media);
    await atualizarPedidoAutoLogin({
        etapa: "usuario_enviado",
        usuarioEnviado: true
    });
    await auto.sleep(REPOM_LOGIN_PAUSAS_MS.curta);
    await enviarFormularioLogin();
    await auto.sleep(REPOM_LOGIN_PAUSAS_MS.envio);
}

async function preencherSenhaEEntrar(auto, pedidoLogin, credenciais) {
    if (pedidoLogin.senhaEnviada) {
        await limparPedidoAutoLogin();
        console.warn("Senha ja enviada nesta tentativa. Auto-login desativado para evitar loop.");
        return;
    }

    const senha = await esperarCampoSenha().catch((error) => {
        console.warn(error.message);
        return null;
    });

    if (!senha) return;

    if (!pedidoLogin.usuarioEnviado && document.querySelector("#UserName")) {
        await auto.click("label[for='radio-contratante'], #radio-contratante");
        await auto.sleep(REPOM_LOGIN_PAUSAS_MS.curta);
        await auto.setText("#UserName", credenciais.login);
        await auto.sleep(REPOM_LOGIN_PAUSAS_MS.media);
    }

    await auto.setText("#vSenha", credenciais.senha, { blur: true });
    await auto.sleep(REPOM_LOGIN_PAUSAS_MS.media);
    await atualizarPedidoAutoLogin({
        etapa: "senha_enviada",
        usuarioEnviado: true,
        senhaEnviada: true
    });
    await auto.sleep(REPOM_LOGIN_PAUSAS_MS.curta);
    await enviarFormularioLogin();
    await limparPedidoAutoLogin();
}

function campoSenhaDisponivel() {
    const senha = document.querySelector("#vSenha");

    return Boolean(
        senha &&
        getComputedStyle(senha).display !== "none" &&
        !senha.disabled
    );
}

async function esperarCampoSenha(timeout = 15000) {
    const inicio = Date.now();

    while (Date.now() - inicio < timeout) {
        if (campoSenhaDisponivel()) return document.querySelector("#vSenha");

        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error("Campo de senha do Repom nao apareceu apos informar usuario.");
}

async function enviarFormularioLogin() {
    const senha = document.querySelector("#vSenha");
    const form = senha?.closest("form") || document.querySelector("form");
    const botaoEntrar =
        document.querySelector("button[type='submit'].btn.btn-primary") ||
        Array.from(document.querySelectorAll("button, input[type='submit']"))
            .find((elemento) => {
                const texto = normalizar(`${elemento.textContent || ""} ${elemento.value || ""}`);
                return texto.includes("ENTRAR") ||
                    texto.includes("LOGIN") ||
                    texto.includes("ACESSAR") ||
                    texto.includes("ENVIAR");
            });

    if (botaoEntrar) {
        botaoEntrar.click();
        return;
    }

    if (form?.requestSubmit) {
        form.requestSubmit();
        return;
    }

    if (form) {
        form.submit();
        return;
    }

    senha?.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true
    }));
}
