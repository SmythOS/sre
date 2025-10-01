//==[ SRE: Memcached Types ]======================


export type MemcachedConfig = {
    name: string;                           
    hosts: string | string[] | {
        host: string;
        port: number;
    }[];
    username?: string;                     
    password?: string; 
    prefix?: string;
    metadataPrefix?: string;
};
