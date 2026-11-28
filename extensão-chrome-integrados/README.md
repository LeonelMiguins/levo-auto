# Extensão Chrome - Busca de Produtores

Extensão do Chrome para buscar e filtrar produtores por nome e visualizar a quilometragem (KM).

## Como Instalar

1. Abra o Chrome e vá para `chrome://extensions/`
2. Ative o "Modo do desenvolvedor" no canto superior direito
3. Clique em "Carregar sem compactação"
4. Selecione a pasta `extension` deste projeto

## Como Usar

1. Clique no ícone da extensão na barra do Chrome
2. Digite o nome do produtor no campo de pesquisa
3. Os resultados serão filtrados automaticamente

## Atualizar os Dados

As duas extensões usam a mesma fonte de dados. Edite somente:

`../dados-compartilhados/produtores-km.json`

As duas extensões leem esse arquivo diretamente. Ative **Permitir acesso a URLs
de arquivo** nos detalhes de ambas em `chrome://extensions`.

Em outro computador, edite `URL_PRODUTORES_COMPARTILHADOS` em `popup.js` e a
mesma constante em `../extensao-levo-auto/app/services/data-service.js`. As duas
devem usar a URL `file:///` completa do mesmo arquivo. Exemplo:

```js
const URL_PRODUTORES_COMPARTILHADOS =
  'file:///C:/Projetos/pedagio-auto/dados-compartilhados/produtores-km.json';
```

O arquivo usa o formato:

```json
{
  "produtores": [
  {
    "produtor": "Nome do Produtor",
    "distancia": 15.5,
    "kmPagamento": 15.5
  }
  ]
}
```

## Estrutura de Arquivos

- `manifest.json` - Configuração da extensão
- `popup.html` - Interface do popup
- `popup.css` - Estilos do popup
- `popup.js` - Lógica de filtragem
- `../dados-compartilhados/produtores-km.json` - Base compartilhada

## Ícones

A extensão precisa de ícones nos tamanhos 16x16, 48x48 e 128x128 pixels. Você pode:
1. Criar seus próprios ícones e salvá-los como `icon16.png`, `icon48.png`, `icon128.png`
2. Ou remover a seção `default_icon` do `manifest.json` para usar o ícone padrão do Chrome
