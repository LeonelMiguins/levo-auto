# Guia do Engine de Automacao

Este projeto tem um engine reutilizavel em `automation/engine.js` para preencher campos, clicar em botoes, selecionar opcoes e trabalhar com autocomplete dentro das paginas do sistema.

## Onde fica o engine

```js
import { criarEngineAutomacao } from "./engine.js";
```

Dentro de qualquer arquivo da pasta `automation`, crie uma instancia assim:

```js
const auto = criarEngineAutomacao();
```

A partir disso, voce pode usar as funcoes:

```js
await auto.setText("#campo", "texto");
await auto.click("#botao");
await auto.selectByText("#select", "texto da opcao");
await auto.selectByValue("#select", "valor");
await auto.setChecked("#checkbox", true);
await auto.setAutocomplete("#campoAutocomplete", "texto");
await auto.sleep(500);
```

Os alvos podem ser passados como seletor CSS, id ou elemento HTML:

```js
await auto.setText("#Placa", "ABC1234");
await auto.setText("Placa", "ABC1234");
await auto.setText(document.getElementById("Placa"), "ABC1234");
```

## Funcoes principais

### `setText(alvo, texto)`

Preenche um campo de texto, input ou textarea.

```js
await auto.setText("#Placa", "AVG3424");
await auto.setText("#Motorista", "RENATO SANTANA");
await auto.setText("#Transportadora", "EDVIGES");
```

O engine dispara os eventos `input` e `change`, que sao importantes para sistemas com validacao ou autocomplete.

Com blur:

```js
await auto.setText("#Placa", "AVG3424", { blur: true });
```

### `click(alvo)`

Clica em botao, link ou qualquer elemento clicavel.

```js
await auto.click("#Buscar");
await auto.click("#Confirmar");
```

### `selectByText(alvo, texto)`

Seleciona uma opcao de `<select>` procurando pelo texto visivel.

```js
await auto.selectByText("#Roteiros", "CASCAVEL");
```

Ele ignora maiusculas/minusculas e acentos.

### `selectByValue(alvo, valor)`

Seleciona uma opcao de `<select>` pelo `value`.

```js
await auto.selectByValue("#TipoVeiculo", "CAMINHAO");
```

### `setChecked(alvo, checked)`

Marca ou desmarca checkbox/radio.

```js
await auto.setChecked("#Aceito", true);
await auto.setChecked("#Aceito", false);
```

### `setAutocomplete(alvo, texto, opcoes)`

Preenche um campo de autocomplete e tenta escolher uma opcao da lista.

```js
await auto.setAutocomplete("#Placa", "AVG3424");
```

Se o sistema escolhe a opcao ao apertar Enter:

```js
await auto.setAutocomplete("#Placa", "AVG3424", {
    pressEnter: true
});
```

Se a lista do autocomplete usa classes especificas:

```js
await auto.setAutocomplete("#Placa", "AVG3424", {
    optionSelector: ".ui-menu-item, .autocomplete-item, li"
});
```

## Dados das placas

Os dados dos caminhoes ficam em:

```txt
data/caminhoes.json
```

Formato:

```json
{
    "AVG": {
        "motorista": "RENATO SANTANA",
        "transportadora": "EDVIGES",
        "placa": "AVG3424"
    }
}
```

Voce pode adicionar novos caminhoes seguindo o mesmo modelo:

```json
{
    "NOVO": {
        "motorista": "NOME DO MOTORISTA",
        "transportadora": "NOME DA TRANSPORTADORA",
        "placa": "ABC1234"
    }
}
```

## Exemplo: preencher pela placa escolhida no modal

O modal retorna um objeto parecido com este:

```js
{
    codigo: "AVG3424",
    cidade: "CASCAVEL",
    nota: "123456",
    quantidade: 10,
    caminhao: {
        motorista: "RENATO SANTANA",
        transportadora: "EDVIGES",
        placa: "AVG3424"
    }
}
```

Com isso, voce pode criar um roteiro para preencher os campos da pagina:

```js
import { criarEngineAutomacao } from "./engine.js";

export async function preencherDadosPlaca(dados) {
    const auto = criarEngineAutomacao();
    const caminhao = dados.caminhao;

    if (!caminhao) {
        throw new Error("Caminhao nao encontrado no JSON");
    }

    await auto.esperarCarregar();

    await auto.setAutocomplete("#Placa", caminhao.placa, {
        pressEnter: true
    });

    await auto.setText("#Motorista", caminhao.motorista);
    await auto.setText("#Transportadora", caminhao.transportadora);

    if (dados.nota) {
        await auto.setText("#Nota", dados.nota);
    }

    if (dados.quantidade) {
        await auto.setText("#Quantidade", dados.quantidade);
    }

    await auto.click("#Confirmar");
}
```

## Exemplo: roteiro completo

Crie um arquivo novo em `automation/preencher-placa.js`:

```js
import { criarEngineAutomacao } from "./engine.js";

export async function executarPreenchimentoPlaca(dados) {
    const auto = criarEngineAutomacao();

    if (!dados?.caminhao) {
        console.warn("Nenhum caminhao selecionado");
        return;
    }

    const { caminhao } = dados;

    await auto.esperarCarregar();
    await auto.sleep(500);

    await auto.setAutocomplete("#Placa", caminhao.placa, {
        pressEnter: true
    });

    await auto.sleep(300);

    await auto.setText("#Motorista", caminhao.motorista);
    await auto.setText("#Transportadora", caminhao.transportadora);

    if (dados.nota) {
        await auto.setText("#Nota", dados.nota);
    }

    if (dados.quantidade) {
        await auto.setText("#Quantidade", dados.quantidade);
    }

    console.log("Preenchimento da placa concluido", caminhao);
}
```

Depois importe esse roteiro no `content.js`:

```js
const { executarPreenchimentoPlaca } = await import(
    chrome.runtime.getURL("automation/preencher-placa.js")
);
```

E chame depois que o modal retornar os dados:

```js
await executarPreenchimentoPlaca(resultado);
```

## Quando usar cada funcao

Use `setText` para inputs comuns:

```js
await auto.setText("#Nota", "123456");
```

Use `setAutocomplete` para campos que abrem uma lista de sugestoes:

```js
await auto.setAutocomplete("#Placa", "AVG3424", { pressEnter: true });
```

Use `selectByText` para `<select>` normal:

```js
await auto.selectByText("#Cidade", "CASCAVEL");
```

Use `click` para botoes:

```js
await auto.click("#Salvar");
```

## Dicas para descobrir ids/classes da pagina

No navegador, clique com o botao direito no campo e escolha `Inspecionar`.

Procure por algo como:

```html
<input id="Placa">
```

Nesse caso use:

```js
await auto.setText("#Placa", "AVG3424");
```

Se tiver classe:

```html
<input class="campo-placa">
```

Use:

```js
await auto.setText(".campo-placa", "AVG3424");
```

Se tiver `name`:

```html
<input name="placa">
```

Use:

```js
await auto.setText("placa", "AVG3424");
```

## Checklist para criar uma nova automacao

1. Crie um arquivo em `automation/nome-da-automacao.js`.
2. Importe `criarEngineAutomacao`.
3. Receba os dados do modal por parametro.
4. Use `dados.caminhao.placa`, `dados.caminhao.motorista` e `dados.caminhao.transportadora`.
5. Preencha os campos com `setText` ou `setAutocomplete`.
6. Clique nos botoes com `click`.
7. Importe e chame a automacao no `content.js`.

