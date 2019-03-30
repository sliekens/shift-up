/**
 * HTML parse error, indicating a bug in shiftup.
 */
export class ParseError extends Error {
    constructor(message?: any) {
        super(message);
    }
}
