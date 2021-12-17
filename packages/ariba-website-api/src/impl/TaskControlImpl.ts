import type { HttpError } from "../IApiServer.js";
import type { ITaskManagerTaskControl } from "../ILongRunningTaskManager.js";

import { constants } from "http2";

export class TaskControlImpl implements ITaskManagerTaskControl {
    private _progressMessage: string | undefined = "";
    private _progress = 0;

    public isCancelled = false;

    public get progress(): number {
        return this._progress;
    }

    public set progress(progress: number) {
        this._progress = progress;
    }

    public get progressMessage(): (string | undefined) {
        return this._progressMessage;
    }

    public set progressMessage(message: (string | undefined)) {
        this._progressMessage = message;
    }

    public createCancelError(message?: string): HttpError {
        const error = new Error(message || "Task cancelled") as HttpError;
        error.status = constants.HTTP_STATUS_SERVICE_UNAVAILABLE;
        return error;
    }

    public get checkAndPass() : (<T>(data: T) => Promise<T>) {
        return this._checkAndPass.bind(this);
    }

    private _checkAndPass<T>(data: T): Promise<T> {
        if (this.isCancelled) {
            return Promise.reject(this.createCancelError());
        } else {
            return Promise.resolve(data);
        }
    }
}
