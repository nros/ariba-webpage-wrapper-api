/// <reference types="node" />
import type { Response } from "express-serve-static-core";
import type { HttpError, HttpResponseErrorMessage } from "../IApiServer";

export function sendResponseError<ResBody = unknown, Locals extends Record<string, unknown> = Record<string, unknown>>(
    responsePromise: Response<ResBody | HttpResponseErrorMessage, Locals> | PromiseLike<Response<ResBody | HttpResponseErrorMessage, Locals>>,
    defaultStatusCode?: number,
): ((error: HttpError | Error | string) => void) {
    return (error: HttpError | Error | string) => Promise.resolve(responsePromise)
        .then((response) =>
            response.status((error as HttpError).status || defaultStatusCode || 500)
                .json({
                    error: (error as HttpError).status || defaultStatusCode || 500,
                    message: typeof error === "string" ? error : error.message,
                } as HttpResponseErrorMessage),
        );
}

export function sendResponseJson<ResBody = unknown, Locals extends Record<string, unknown> = Record<string, unknown>>(
    responsePromise: Response<ResBody | HttpResponseErrorMessage, Locals> | PromiseLike<Response<ResBody | HttpResponseErrorMessage, Locals>>,
    defaultStatusCode?: number,
): ((data: ResBody) => void) {
    return (data: ResBody) => Promise.resolve(responsePromise)
        .then((response) =>
            response.status(defaultStatusCode || 200).json(data),
        );
}
