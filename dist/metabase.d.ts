export declare const auth: import("@proca/api").AuthHeader;
export declare const apiUrl: (path: string) => string;
export declare const api: (method: 'GET' | 'POST', path: string, params?: Record<string, number | string>) => Promise<any>;
export declare const fetchSession: () => Promise<any>;
export declare const updateSession: () => Promise<string>;
export declare const getParametersInfo: (cardId: number) => Promise<{}>;
export declare const wrapParam: (name: string, value: string, type: string) => {
    type: string;
    target: (string | string[])[];
    value: string[];
} | {
    type: string;
    target: (string | string[])[];
    value: string;
};
export declare const fetchCard: (id: number, params: any) => Promise<any>;
