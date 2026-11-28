# Auto-Pedágio REPOM

Extensão Chrome independente para preparar e emitir vale-pedágio no REPOM. Ela não altera nem depende da extensão LEVO AUTO principal. A geração do CTe continua na extensão principal.

## O que faz

- Importa um ou mais XMLs de NF-e e extrai placa, produtor, município, empresa emissora e números das notas.
- Escolhe como destino a nota com maior distância de ida encontrada na base de produtores e KM.
- Permite preencher manualmente placa, cidade, empresa e uma lista de números de NF-e (uma por linha, ou separados por vírgula/ponto e vírgula).
- Usa a base local de caminhões para preencher placa, motorista e transportadora no REPOM.
- Preenche o percurso, veículo, motorista, transportadora e cada NF informada, preservando a regra de eixos suspensos para Três Barras.
- Pode confirmar automaticamente a viagem no REPOM, se essa opção for marcada. Por padrão, a confirmação fica manual.
- Abre a tela de impressão do REPOM após a emissão, sem manter histórico ou dados de pedágios anteriores.

## Instalação

1. Abra `chrome://extensions` e ative o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação**.
3. Selecione esta pasta `auto-pedagio`.
4. Clique no ícone **Auto-Pedágio REPOM** para abrir a tela.
5. Opcionalmente, abra **Configurar acesso automático ao REPOM** e salve os logins da PLUSVAL e PLUMA. Sem credenciais configuradas, entre manualmente no REPOM quando solicitado.

As credenciais configuradas ficam em `chrome.storage.local` deste perfil do Chrome. Para removê-las, limpe os campos e salve, ou remova os dados da extensão nas configurações do Chrome.

## Dados locais

- `data/caminhoes.json`: veículos, motoristas e transportadoras. Adicione novos veículos neste arquivo, mantendo a chave como código curto ou placa completa.
- `data/produtores-km.json`: cópia independente da base de produtores e distâncias usada pela extensão no momento da extração. Atualize este arquivo quando quiser atualizar essa extensão; ela não lê arquivos da extensão principal.

## Uso

1. Importe os XMLs da viagem ou informe manualmente placa, cidade de destino, empresa e os números das notas.
2. Confira os dados e clique em **Iniciar emissão do vale-pedágio**.
3. Acompanhe o preenchimento na aba REPOM.
4. Se a confirmação automática estiver desmarcada, revise e confirme a viagem no próprio REPOM.
5. Consulte o número, meio de pagamento e valor capturados na tela do Auto-Pedágio.

Para a entrada manual, os números são tratados individualmente; a extensão não presume que sejam sequenciais. O destino e a empresa precisam ser informados manualmente.

## Limites

- O acesso automático ao REPOM usa somente credenciais configuradas nesta extensão e suporta PLUSVAL e PLUMA.
- A lista de veículos e a base de KM são cópias locais; mudanças feitas nas bases da extensão principal não são sincronizadas automaticamente.
- Mudanças de interface ou fluxo no REPOM podem exigir atualização dos seletores.
- Esta extensão não inicia nem preenche o Simples CTe.
