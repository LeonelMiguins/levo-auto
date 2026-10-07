# Sincronização de KM

A referência de distância para pagamento é a coluna **F — KM distancia** da
aba **CALCULO CTE** de `CALCULO CTe.xlsx`. A coluna G e a aba
`DASE DADOS - DISTANCIA` contêm outros valores e não são usadas nesta sincronização.

O script atualiza `distancia`, `kmPagamento` e `distanciaPagamento` (quando
existente) dos registros que já existem em `produtores-km.json`. Preserva `km`,
coordenadas, município, demais campos e os produtores sem correspondência.
Não adiciona nem remove produtores.

As distâncias de pagamento são sempre arredondadas para cima até o próximo
inteiro (`112.5` vira `113`; `112.1` também vira `113`; `113` permanece `113`).
O valor armazenado na célula pode ter casas decimais mesmo quando o Excel
exibe somente um número inteiro.

A correspondência usa nome, aviário e empresa, ignorando acentos e espaços
extras e tratando PLUVAL como PLUSVAL. Se houver mais de uma correspondência,
usa CLIFFOR para desambiguar. KMs conflitantes, ausentes ou inválidos não são
aplicados e aparecem no relatório. Não são feitas aproximações de nomes.

Salve a planilha no Excel antes de executar. Requer Python com `openpyxl`.
A partir da raiz do projeto, confira primeiro:

```powershell
python dados-compartilhados/sincronizar-km.py
```

Veja `relatorio-sincronizacao-km.json`. Para aplicar:

```powershell
python dados-compartilhados/sincronizar-km.py --aplicar
```

Cada aplicação salva uma cópia exata do JSON anterior em um arquivo `.bak`
com data e hora. O relatório identifica os valores anteriores e novos, as
linhas da planilha e os registros preservados. A planilha não é modificada.

Após aplicar, confira se `URL_PRODUTORES_COMPARTILHADOS` em
`extensao-levo-auto/app/services/data-service.js` e
`extensão-chrome-integrados/popup.js` aponta para o JSON desta pasta.
Recarregue as extensões e reabra seus painéis para carregar os dados atualizados.
