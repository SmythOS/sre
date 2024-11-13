/**
 * @class ApiError
 * @extends Error
 * @public
 * @description
 * ApiError class is used to create an error object that will be used by the error handler middleware.
 * It is the primary error class that will be used in the application.

 */
class ApiError extends Error {
    statusCode: number | null | undefined;

    isOperational: boolean;

    stack: string | undefined;

    errKey: string | undefined;

    isApiError: boolean;

    /**
     *
     * @param statusCode - http status code of the error
     * @param message - error message
     * @param isOperational - whether the error should be shown in production or not (if not, internal server error will be shown)
     * @param stack - error stack trace
     * @param errKey -  error code to be used in the response
     */

    // eslint-disable-next-line default-param-last
    constructor(statusCode: number | null | undefined, message: string, errKey?: string, isOperational = true, stack?: string) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational === undefined ? true : isOperational;
        this.errKey = errKey;
        this.isApiError = true;
    }
}

export default ApiError;
