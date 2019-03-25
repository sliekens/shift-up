"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const tough_cookie_1 = require("tough-cookie");
const util_1 = __importDefault(require("util"));
const fs2 = {
    exists: util_1.default.promisify(fs_1.default.exists),
    readFile: util_1.default.promisify(fs_1.default.readFile),
    writeFile: util_1.default.promisify(fs_1.default.writeFile),
    open: util_1.default.promisify(fs_1.default.open)
};
class CookieMonster {
    constructor(store) {
        this.store = store;
    }
    showCookies() {
        return new Promise((resolve, reject) => {
            this.store.getAllCookies((err, cookies) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(cookies);
                }
            });
        });
    }
    eatCookies(domain, path) {
        return new Promise((resolve, reject) => {
            this.store.removeCookies(domain, path, err => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
    buryCookies(cookies, fileName) {
        let json = cookies.map(cookie => cookie.toJSON());
        let text = JSON.stringify(json, null, 2);
        return fs2.writeFile(fileName, text);
    }
    fetchCookies(fileName) {
        return fs2
            .open(fileName, "a+")
            .then(fd => fs2.readFile(fd, { encoding: "utf-8" }))
            .then(text => JSON.parse(text || "[]"))
            .then(json => (Array.isArray(json) ? json.map(cookie => tough_cookie_1.Cookie.fromJSON(cookie)) : []))
            .then(cookies => cookies.map(cookie => {
            return new Promise((resolve, reject) => {
                if (!cookie) {
                    reject("cookie is empty");
                    return;
                }
                this.store.putCookie(cookie, err => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            });
        }))
            .then(tasks => Promise.all(tasks))
            .then(() => undefined);
    }
    isExpiring(cookie) {
        return cookie.TTL() < 300;
    }
    isAuthenticated() {
        return new Promise((resolve, reject) => {
            this.store.findCookie("shift.gearboxsoftware.com", "/", "si", (err, cookie) => {
                if (err) {
                    reject(err);
                }
                else if (cookie == null) {
                    resolve(false);
                }
                else {
                    if (this.isExpiring(cookie)) {
                        resolve(false);
                    }
                    else {
                        resolve(true);
                    }
                }
            });
        });
    }
}
exports.CookieMonster = CookieMonster;
