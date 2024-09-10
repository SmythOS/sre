export type JSONFileVaultConfig = {
    file: string;
};

export type SmythVaultConfig = {
    oAuthAppID: string;
    oAuthAppSecret: string;
    oAuthBaseUrl: string;
    oAuthResource?: string;
    oAuthScope?: string;
    vaultAPIBaseUrl: string;
};