import { carregarStyles } from "./styles.js";

let cacheCaminhoes = null;

async function carregarCaminhoes() {
    if (cacheCaminhoes) return cacheCaminhoes;

    const resposta = await fetch(chrome.runtime.getURL("data/caminhoes.json"));
    cacheCaminhoes = await resposta.json();

    return cacheCaminhoes;
}

function buscarCaminhao(caminhoes, codigo) {
    if (!codigo) return null;

    const busca = codigo.toUpperCase().trim();

    return caminhoes[busca] ||
        Object.values(caminhoes).find((caminhao) => caminhao.placa === busca) ||
        null;
}

export async function abrirModal() {
    carregarStyles();

    if (document.querySelector("#erpModal")) {
        return null;
    }

    const caminhoes = await carregarCaminhoes();

    return new Promise((resolve) => {
        const modal = document.createElement("div");
        modal.id = "erpModal";

        modal.innerHTML = `
            <div id="erpBox">

                <h2>REPOM AUTOMACAO</h2>
                <h2>Feito por Leo Miguins</h2>

                <input id="placa" placeholder="PLACA / CODIGO" autofocus>
                <input id="cidade" placeholder="CIDADE DESTINO">
                <input id="nota" placeholder="NOTA" maxlength="6">
                <input id="quantidade" placeholder="QUANTIDADE" type="number">

                <label class="erpCheckbox">
                    <input id="autoConfirmar" type="checkbox">
                    <span>autoconfirmar</span>
                </label>

                <button id="btnIniciar">INICIAR</button>
                <button id="btnFechar" type="button">FECHAR</button>

            </div>
        `;

        document.body.appendChild(modal);

        let finalizado = false;

        const obterDadosFormulario = () => ({
            codigo: document.querySelector("#placa")?.value.trim().toUpperCase() || "",
            cidade: document.querySelector("#cidade")?.value.trim() || "",
            nota: document.querySelector("#nota")?.value.trim() || "",
            quantidade: Number(document.querySelector("#quantidade")?.value || 0),
            autoConfirmar: Boolean(document.querySelector("#autoConfirmar")?.checked)
        });

        document.querySelector("#placa").addEventListener("input", (e) => {
            const value = e.target.value.toUpperCase().trim();
            const caminhao = buscarCaminhao(caminhoes, value);

            if (caminhao) {
                document.querySelector("#placa").value = caminhao.placa;
                console.log("Encontrado:", caminhao);
            }
        });

        const removerModal = () => {
            modal.remove();
            document.removeEventListener("keydown", onKeyDown);
        };

        const finalizar = () => {
            if (finalizado) return;
            finalizado = true;

            const dados = obterDadosFormulario();
            const caminhao = buscarCaminhao(caminhoes, dados.codigo);

            removerModal();

            resolve({
                ...dados,
                caminhao
            });
        };

        const fechar = () => {
            if (finalizado) return;
            finalizado = true;

            removerModal();
            resolve(null);
        };

        const onKeyDown = (e) => {
            if (e.key === "Enter") {
                finalizar();
            }

            if (e.key === "Escape") {
                fechar();
            }
        };

        document
            .getElementById("btnIniciar")
            .addEventListener("click", finalizar);

        document
            .getElementById("btnFechar")
            .addEventListener("click", fechar);

        document.addEventListener("keydown", onKeyDown);
    });
}
