# levo-auto

Automacao operacional em extensao Chrome para leitura de XML de NF-e, emissao de pedagio no Repom e preparacao de CTe no Simples CTE.

## O que a extensao faz

- Le XMLs de NF-e selecionados na tela local da extensao.
- Extrai placa, produtor, cidade, notas, chaves de acesso, peso e valor.
- Valida se todas as notas selecionadas pertencem ao mesmo caminhao.
- Agrupa notas por produtor para evitar CTe globalizado indevido.
- Calcula a cidade/distancia de pedagio pela nota mais distante.
- Valida placa com a base `data/caminhoes.json`.
- Reutiliza uma unica aba do Repom.
- Faz auto-login no Repom conforme a empresa emissora e o usuario logado.
- Automatiza a emissao/confirmacao do pedagio no Repom.
- Captura numero do pedagio, meio de pagamento, valor e empresa emitida.
- Mantem historico local de pedagios por usuario.
- Inicia o fluxo do Simples CTE, seleciona transportadora e carrega chaves por grupo de produtor.
- Preenche a calculadora de frete minimo com placa, tipo de contratacao, tipo de carga e distancia de ida.

## Estrutura principal

```txt
extensão-chrome-repom-v2/
  app/                         Tela local da extensao
  app/services/                Servicos de XML, storage, sessao, dados e lancadores
  automation/                  Engine de automacao e rotinas do Repom
  content/repom/               Scripts especificos das paginas Repom
  content/simples-cte/         Scripts especificos do Simples CTE
  data/                        Bases locais usadas pela extensao
  icon/                        Icones da extensao
  shared/                      Constantes, formatadores e helpers compartilhados
  background.js                Service worker da extensao
  content.js                   Roteador dos content scripts
  manifest.json                Manifest V3 da extensao
```

## Dados locais

Arquivos versionados:

- `data/caminhoes.json`: placas, motoristas e transportadoras.
- `data/produtores-km.json`: produtores e distancias.
- `data/users.example.json`: exemplo da estrutura de usuarios.

Arquivo nao versionado:

- `data/users.json`: contem senhas e credenciais reais. Deve ser criado localmente a partir de `data/users.example.json`.

Formato de usuario:

```json
[
  {
    "nome": "usuario",
    "senha": "senha-da-extensao",
    "login_repom_plusval": "login-repom-plusval",
    "senha_repom_plusval": "senha-repom-plusval",
    "login_repom_pluma": "login-repom-pluma",
    "senha_repom_pluma": "senha-repom-pluma",
    "is_admin": false
  }
]
```

## Como carregar no Chrome

1. Acesse `chrome://extensions`.
2. Ative o modo desenvolvedor.
3. Clique em `Carregar sem compactacao`.
4. Selecione a pasta `extensão-chrome-repom-v2`.

## Fluxo operacional

1. Abra a extensao.
2. Faca login na tela local.
3. Selecione um ou mais XMLs de NF-e.
4. Confirme placa, cidade, nota inicial, quantidade e grupos de produtores.
5. Para viagens com pedagio, clique em `Fazer Repom`.
6. Apos o Repom gerar o pedagio, confira os dados capturados no painel.
7. Clique em `Fazer CTE`.
8. No Simples CTE, a extensao carrega as chaves por grupo de produtor e preenche as primeiras etapas do CTe.

## Observacoes importantes

- A distancia usada para pagamento e pedagio e a distancia de ida.
- Quando existem notas para produtores diferentes, a extensao agrupa por produtor e envia as chaves em lotes no Simples CTE.
- Se forem selecionados XMLs com placas diferentes, a importacao e bloqueada.
- O historico de pedagios fica no `chrome.storage.local`, separado por usuario.
- A automacao depende dos componentes atuais das telas Repom e Simples CTE; mudancas visuais nesses sistemas podem exigir ajuste nos seletores.

## Validacao local

Para checar sintaxe dos scripts:

```powershell
Get-ChildItem -Path "extensão-chrome-repom-v2" -Recurse -Filter *.js | ForEach-Object {
  node --check $_.FullName
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

