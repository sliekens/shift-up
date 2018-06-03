declare module 'prompt' {
    function start(): void;

    function get(fields: string[] | any, cb: (err: any, res: any) => void): void;
}
