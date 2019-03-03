import fs from "fs"
import { Cookie, MemoryCookieStore, Store } from "tough-cookie"
import util from "util"

const fs2 = {
    exists: util.promisify(fs.exists),
    readFile: util.promisify(fs.readFile),
    writeFile: util.promisify(fs.writeFile),
    open: util.promisify(fs.open)
}

export class CookieMonster {
    constructor(private store: Store) {}

    showCookies(): Promise<Cookie[]> {
        return new Promise((resolve, reject) => {
            this.store.getAllCookies((err, cookies) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(cookies)
                }
            })
        })
    }

    eatCookies(domain: string, path: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.store.removeCookies(domain, path, err => {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
            })
        })
    }

    buryCookies(cookies: Cookie[], fileName: string): Promise<void> {
        let json = cookies.map(cookie => cookie.toJSON())
        let text = JSON.stringify(json, null, 2)
        return fs2.writeFile(fileName, text)
    }

    fetchCookies(fileName: string): Promise<void> {
        return fs2
            .open(fileName, "a+")
            .then(fd => fs2.readFile(fd, { encoding: "utf-8" }))
            .then(text => JSON.parse(text || "[]"))
            .then(json => (Array.isArray(json) ? json.map(cookie => Cookie.fromJSON(cookie)) : []))
            .then(cookies =>
                cookies.map(cookie => {
                    return new Promise((resolve, reject) => {
                        if (!cookie) {
                            reject("cookie is empty")
                            return
                        }
                        this.store.putCookie(cookie, err => {
                            if (err) {
                                reject(err)
                            } else {
                                resolve()
                            }
                        })
                    })
                })
            )
            .then(tasks => Promise.all(tasks))
            .then(() => undefined)
    }

    isExpiring(cookie: Cookie) {
        return cookie.TTL() < 300
    }

    isAuthenticated(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.store.findCookie("shift.gearboxsoftware.com", "/", "si", (err, cookie) => {
                if (err) {
                    reject(err)
                } else if (cookie == null) {
                    resolve(false)
                } else {
                    if (this.isExpiring(cookie)) {
                        resolve(false)
                    } else {
                        resolve(true)
                    }
                }
            })
        })
    }
}
