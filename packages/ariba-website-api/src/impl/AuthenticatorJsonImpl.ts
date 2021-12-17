import type express from "express";
import type { IMiddleware } from "../IMiddleware.js";
import type { TAsyncMiddleware } from "./BaseMiddleware.js";
import type { IApiServer } from "../IApiServer.js";

import basicAuth from "express-basic-auth";
import { readConfigurationFile } from "../ApiConfiguration.js";
import { BaseMiddleware } from "./BaseMiddleware.js";

export const USER_DB_FILE = "users.json";

export interface UserData {
    user: string;
    password: string;
    aribaUsername: string;
    aribaPassword: string;
}

export interface UserDatabaseJson {
    [user: string] : UserData;
}

export type RequestWithAuthentication = express.Request & {
    auth: UserData;
};

export class AuthenticatorJsonImpl extends BaseMiddleware implements IMiddleware {
    private _userDatabaseFile: string;
    private _userDatabase?: UserDatabaseJson;

    public constructor(databaseFile?: string) {
        super();
        this._userDatabaseFile = databaseFile || USER_DB_FILE;
    }

    public async registerMiddleware(app: express.Express, apiServer: IApiServer): Promise<express.Express> {
        // install authentication middleware
        app.use(basicAuth({ users: await this.getAuthDatabase() }));
        return await super.registerMiddleware(app, apiServer);
    }

    public async getUserData(username: string): Promise<UserData> {
        const userDB = await this.getUserDB();
        return userDB[username];
    }

    public async getAuthDatabase(): Promise<{ [user: string]: string }> {
        const userDatabase = await this.getUserDB();
        const users: { [user: string]: string } = {};

        for (const user of Object.getOwnPropertyNames(userDatabase)) {
            users[user] = userDatabase[user].password;
        }

        return users;
    }

    public async getUserDB(): Promise<UserDatabaseJson> {
        if (!this._userDatabase) {
            this._userDatabase = await readConfigurationFile(this._userDatabaseFile);
        }

        return this._userDatabase || {};
    }

    protected getMiddleware(): PromiseLike<TAsyncMiddleware[]> {
        const userDataMiddleware: TAsyncMiddleware = async (request) => {
            const usersDB = await this.getUserDB();
            const authData = (request as RequestWithAuthentication).auth;
            if (authData?.user && usersDB[authData.user]) {
                (request as RequestWithAuthentication).auth = {
                    ...usersDB[authData.user],
                    ...authData,
                };
            }
        };

        return Promise.resolve([userDataMiddleware]);
    }
}
