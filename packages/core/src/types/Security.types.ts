export type OAuthConfig = {
    oAuthAppID: string;
    oAuthAppSecret: string;
    oAuthBaseUrl: string;
    oAuthResource?: string;
    oAuthScope?: string;
};

export type JSONFileVaultConfig = {
    file: string;
    fileKey?: string;
    shared?: boolean;
};

export type SmythVaultConfig = {
    vaultAPIBaseUrl: string;
};

export type SecretsManagerConfig = {
    region: string;
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
};

export type SmythConfigs = {
    smythAPIBaseUrl: string;
};
