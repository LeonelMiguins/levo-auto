export const URLS = {
    repomLogin: "https://www.repom.com.br/Repom.Usuario.Web/Account/Logar",
    repomRoteiro: "https://www.repom.com.br/Express/ValePedagio/Viagem/ViagemRoteiro.asp",
    repomImpressao: "https://www.repom.com.br/Express/ValePedagio/Viagem/ImprimeVPR.asp"
};

export const STORAGE_KEYS = {
    servicoAtual: "autoPedagioServicoAtual",
    repomPendente: "autoPedagioRepomPendente",
    repomLogin: "autoPedagioRepomLogin",
    repomPosLogin: "autoPedagioRepomPosLogin",
    configuracaoRepom: "autoPedagioCredenciaisRepom"
};

export const REPOM_LOGIN_TEMPO_MAX_MS = 10 * 60 * 1000;
export const SESSAO_DURACAO_MS = 5 * 60 * 60 * 1000;
export const REPOM_LOGIN_PAUSAS_MS = { curta: 600, media: 1000, envio: 1400 };
