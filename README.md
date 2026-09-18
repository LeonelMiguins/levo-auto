# levo-auto

## Base compartilhada de produtores

A fonte oficial de quilometragem das duas extensões é
`dados-compartilhados/produtores-km.json`. Tanto `extensao-levo-auto` quanto
`extensão-chrome-integrados` leem esse arquivo diretamente.

Como a base usa uma URL `file://`, ative **Permitir acesso a URLs de arquivo**
nos detalhes das duas extensões em `chrome://extensions`.

### Configurar o caminho em outro computador

O caminho da base compartilhada é absoluto e precisa ser ajustado em cada
computador depois de baixar o projeto. Altere a constante
`URL_PRODUTORES_COMPARTILHADOS` nestes dois arquivos:

- `extensao-levo-auto/app/services/data-service.js`
- `extensão-chrome-integrados/popup.js`

Os dois arquivos devem apontar para o mesmo `produtores-km.json`. Exemplo para
um projeto baixado em `C:\Projetos\pedagio-auto`:

```js
const URL_PRODUTORES_COMPARTILHADOS =
    "file:///C:/Projetos/pedagio-auto/dados-compartilhados/produtores-km.json";
```

Na URL, use barras `/`, mantenha `file:///` no início e não use o formato
`C:\Projetos\...` diretamente no JavaScript.

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
extensao-levo-auto/
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
- `../dados-compartilhados/produtores-km.json`: produtores e distancias usados
  pelas duas extensoes.
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

1. Ajuste `URL_PRODUTORES_COMPARTILHADOS` nos dois arquivos indicados acima.
2. Crie `extensao-levo-auto/data/users.json` a partir de
   `extensao-levo-auto/data/users.example.json` e preencha os usuarios locais.
3. Acesse `chrome://extensions`.
4. Ative o modo desenvolvedor.
5. Clique em `Carregar sem compactacao` e selecione `extensao-levo-auto`.
6. Se usar a extensao auxiliar, carregue tambem `extensão-chrome-integrados`.
7. Abra **Detalhes** de cada extensao e habilite **Permitir acesso a URLs de
   arquivo**.
8. Recarregue as extensoes depois de alterar o caminho, o manifest ou os
   arquivos JavaScript.

### Checklist depois de baixar do GitHub

- O arquivo `dados-compartilhados/produtores-km.json` existe no caminho usado
  pelas duas constantes.
- As duas constantes usam uma URL `file:///` correspondente ao computador.
- `extensao-levo-auto/data/users.json` foi criado; ele não vem do GitHub porque
  contém credenciais e está no `.gitignore`.
- **Permitir acesso a URLs de arquivo** está habilitado nas duas extensoes.
- As pastas corretas foram carregadas sem compactacao, e não a raiz inteira do
  repositorio.
- As extensoes foram recarregadas em `chrome://extensions` após a configuracao.

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
Get-ChildItem -Path "extensao-levo-auto" -Recurse -Filter *.js | ForEach-Object {
  node --check $_.FullName
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```
