import commander, { Command } from "commander"
import { Response } from "request"
import rp from "request-promise-native"
import { MemoryCookieStore } from "tough-cookie"
import { CookieMonster } from "./cookie-monster"
import { WebClient } from "./web-client"
import fs from "fs"

let cookieStore = new MemoryCookieStore()
let jar = rp.jar(cookieStore)
let http = rp.defaults({
    jar,
    headers: {
        dnt: "1"
    },
    followRedirect: resp => {
        if (resp.headers.location != null) {
            console.log("GET", resp.headers.location)
        }
        return true
    },
    followAllRedirects: true
})

const cookieMonster = new CookieMonster(cookieStore)
const webClient = new WebClient(http, "https://shift.gearboxsoftware.com/")
const secretsDir = "./secrets"
const codesDir = "./shiftcodes"

!fs.existsSync(secretsDir) && fs.mkdirSync(secretsDir)

commander.version("1.0.0")

commander.command("login <user> <password>").action((u, p) => {
    webClient
        .login(u, p)
        .then(() => cookieMonster.showCookies())
        .then(cookies => cookieMonster.buryCookies(cookies, `${secretsDir}/${u}.json`))
})

commander.command("redeem <user> <code>").action((u, c) => {
    const readCodes = () => {
        if (c.endsWith(".txt")) {
            return fs
                .readFileSync(`${codesDir}/${c}`, "utf-8")
                .split("\n")
                .filter(Boolean)
        } else {
            return [c]
        }
    }

    const codes: string[] = readCodes()

    const wait = (ms: number) => new Promise(res => setTimeout(res, ms))
    const processCode = (c: string) =>
        new Promise(res =>
            res(
                cookieMonster
                    .fetchCookies(`${secretsDir}/${u}.json`)
                    .then(() => cookieMonster.isAuthenticated())
                    .then(loggedIn => {
                        if (!loggedIn) {
                            return Promise.reject("Unauthorized")
                        }
                        return Promise.resolve(true)
                    })
                    .then(() => webClient.getRedemptionForm(c))
                    .then(formData => webClient.redeem(formData))
                    .then(result => console.log(result))
                    .catch((err: Response) => {
                        if (err && err.statusCode === 500) {
                            console.error(err.statusMessage || "Internal Server Error")
                        } else {
                            console.error(err)
                        }
                    })
            )
        )
    ;(async function redeemCodes() {
        for (const c of codes) {
            console.log(`Attempting to redeem code: ${c}`)
            await processCode(c)
            await wait(10000) //attempt to avoid 429 and 504 server codes
        }
    })()
})

commander.parse(process.argv)
