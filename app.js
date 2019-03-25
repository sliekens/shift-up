"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = __importDefault(require("commander"));
const request_promise_native_1 = __importDefault(require("request-promise-native"));
const tough_cookie_1 = require("tough-cookie");
const cookie_monster_1 = require("./cookie-monster");
const web_client_1 = require("./web-client");
const fs_1 = __importDefault(require("fs"));
let cookieStore = new tough_cookie_1.MemoryCookieStore();
let jar = request_promise_native_1.default.jar(cookieStore);
let http = request_promise_native_1.default.defaults({
    jar,
    headers: {
        dnt: "1"
    },
    followRedirect: resp => {
        if (resp.headers.location != null) {
            console.log("GET", resp.headers.location);
        }
        return true;
    },
    followAllRedirects: true
});
const cookieMonster = new cookie_monster_1.CookieMonster(cookieStore);
const webClient = new web_client_1.WebClient(http, "https://shift.gearboxsoftware.com/");
const secretsDir = "./secrets";
const codesDir = "./shiftcodes";
!fs_1.default.existsSync(secretsDir) && fs_1.default.mkdirSync(secretsDir);
commander_1.default.version("1.0.0");
commander_1.default.command("login <user> <password>").action((u, p) => {
    webClient
        .login(u, p)
        .then(() => cookieMonster.showCookies())
        .then(cookies => cookieMonster.buryCookies(cookies, `${secretsDir}/${u}.json`));
});
commander_1.default.command("redeem <user> <code>").action((u, c) => {
    const readCodes = () => {
        if (c.endsWith(".txt")) {
            console.log("hit");
            return fs_1.default
                .readFileSync(`${codesDir}/${c}`, "utf-8")
                .split("\n")
                .filter(Boolean);
        }
        else {
            return c;
            console.log("else");
        }
    };
    const codes = readCodes();
    const wait = (ms) => new Promise(res => setTimeout(res, ms));
    const processCode = (c) => new Promise(res => res(cookieMonster
        .fetchCookies(`${secretsDir}/${u}.json`)
        .then(() => cookieMonster.isAuthenticated())
        .then(loggedIn => {
        if (!loggedIn) {
            return Promise.reject("Unauthorized");
        }
        return Promise.resolve(true);
    })
        .then(() => webClient.getRedemptionForm(c))
        .then(formData => webClient.redeem(formData))
        .then(result => console.log(result))
        .catch((err) => {
        if (err && err.statusCode === 500) {
            console.error(err.statusMessage || "Internal Server Error");
        }
        else {
            console.error(err);
        }
    })));
    (function redeemCodes() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const c of codes) {
                yield processCode(c);
                yield wait(10000); //attempt to avoid 429 and 504 server codes
            }
        });
    })();
});
commander_1.default.parse(process.argv);
