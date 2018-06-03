import cheerio from 'cheerio';
import fs from 'fs';
import prompt from 'prompt';
import { CookieJar, Response } from 'request';
import rp from 'request-promise-native';
import { Cookie, MemoryCookieStore, Store } from 'tough-cookie';
import util from 'util';

const baseUrl = 'https://shift.gearboxsoftware.com/';
const fs2 = {
    exists: util.promisify(fs.exists),
    readFile: util.promisify(fs.readFile),
    writeFile: util.promisify(fs.writeFile),
    open: util.promisify(fs.open)
};
let request = rp;

(() => {
    let cookieStore = new MemoryCookieStore();
    let jar = request.jar(cookieStore);
    request = request.defaults({
        jar,
        followRedirect: resp => {
            if (resp.headers.location != null) {
                console.log('GET', resp.headers.location);
            }
            return true;
        },
        followAllRedirects: true,
        transform: (body: any) => cheerio.load(body)
    });
    loadCookies(cookieStore, './cookies.json')
        .then(() => isAuthenticated(cookieStore))
        .then(yes => {
            if (!yes) {
                return login().then(() => getAllCookies(cookieStore));
            } else {
                return getAllCookies(cookieStore);
            }
        })
        .then(cookies => persistCookies(cookies, './cookies.json'))
        .then(() => new Promise<string>((resolve, reject) => prompt.get('code', (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res.code);
            }
        })))
        .then(code => getRedemptionForm(code))
        .then(formData => redeem(formData))
        .then(result => console.log(result))
        .catch((err: Response) => {
            if (err && err.statusCode === 500) {
                console.error(err.statusMessage || 'Internal Server Error');
            } else {
                console.error(err);
            }
        });
})();

function login(): Promise<any> {
    const schema = {
        properties: {
            email: {
                required: true
            },
            password: {
                hidden: true,
                required: true

            }
        }
    };
    prompt.start();
    return new Promise((resolve, reject) => prompt.get(schema, (err, res) => {
        if (err) {
            reject(err);
        } else {
            resolve(res);
        }
    }))
        .then(credentials => getToken(baseUrl + 'home').then(token => ({ ...credentials, authenticity_token: token })))
        .then((credentials: any) => {
            console.log('POST', baseUrl + 'sessions');
            return request.post({
                uri: baseUrl + 'sessions',
                formData: {
                    'authenticity_token': credentials.authenticity_token,
                    'user[email]': credentials.email,
                    'user[password]': credentials.password
                }
            });
        });
}

function getRedemptionForm(code: string): Promise<any> {
    return getToken(baseUrl + 'code_redemptions/new')
        .then(token => {
            console.log('GET', `${baseUrl}entitlement_offer_codes?code=${code}`);
            return request.get({
                uri: `${baseUrl}entitlement_offer_codes?code=${code}`,
                headers: {
                    'x-csrf-token': token,
                    'x-requested-with': 'XMLHttpRequest'
                }
            });
        })
        .then(($: CheerioStatic) => {
            return {
                'authenticity_token': $('input[name=authenticity_token]').val(),
                'archway_code_redemption[code]': $('#archway_code_redemption_code').val(),
                'archway_code_redemption[check]': $('#archway_code_redemption_check').val(),
                'archway_code_redemption[service]': $('#archway_code_redemption_service').val()
            };
        });
}

function redeem(formData: any): Promise<string> {
    console.log('POST', baseUrl + 'code_redemptions');
    return request.post({
        uri: baseUrl + 'code_redemptions',
        formData
    }).then(($: CheerioStatic) => {
        if ($('div.notice').length !== 0) {
            return $('div.notice').text().trim();
        } else {
            return $.html();
        }
    });
}

function getAllCookies(store: Store): Promise<Cookie[]> {
    return new Promise((resolve, reject) => {
        store.getAllCookies((err, cookies) => {
            if (err) {
                reject(err);
            } else {
                resolve(cookies);
            }
        });
    });
}

function persistCookies(cookies: Cookie[], fileName: string): Promise<void> {
    let json = cookies.map(cookie => cookie.toJSON());
    let text = JSON.stringify(json, null, 2);
    return fs2.writeFile(fileName, text);
}

function isExpiring(cookie: Cookie) {
    return cookie.TTL() < 300;
}

function isAuthenticated(store: Store): Promise<boolean> {
    return new Promise((resolve, reject) => {
        store.findCookie('shift.gearboxsoftware.com', '/', 'si', (err, cookie) => {
            if (err) {
                reject(err);
            } else if (cookie == null) {
                resolve(false);
            } else {
                if (isExpiring(cookie)) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            }
        });
    });
}

function getToken(url: string): Promise<string> {
    console.log('GET', url);
    return request
        .get({
            uri: url
        })
        .then(($: CheerioStatic) => $('meta[name=csrf-token]').attr('content'));
}

function loadCookies(store: Store, fileName: string): Promise<void> {
    return fs2.open(fileName, 'a+')
        .then(fd => fs2.readFile(fd, { encoding: 'utf-8' }))
        .then(text => JSON.parse(text || '[]'))
        .then(json => Array.isArray(json)
            ? json.map(cookie => Cookie.fromJSON(cookie))
            : [])
        .then(cookies => cookies.map(cookie => {
            return new Promise((resolve, reject) => {
                if (!cookie) {
                    reject('cookie is empty');
                    return;
                }
                store.putCookie(cookie, err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }))
        .then(tasks => Promise.all(tasks))
        .then(() => undefined);
}
