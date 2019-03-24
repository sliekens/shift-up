#!/usr/bin/env node
import commander, { Command } from 'commander';
import { promises as fs } from 'fs';
import { Response } from 'request';
import rp from 'request-promise-native';
import { MemoryCookieStore } from 'tough-cookie';
import { CookieMonster } from './cookie-monster';
import { WebClient } from './web-client';

let cookieStore = new MemoryCookieStore();
let jar = rp.jar(cookieStore);
let http = rp.defaults({
    jar,
    headers: {
        'dnt': '1'
    },
    followRedirect: resp => {
        if (resp.headers.location != null) {
            console.log('GET', resp.headers.location);
        }
        return true;
    },
    followAllRedirects: true
});

const cookieMonster = new CookieMonster(cookieStore);
const webClient = new WebClient(http, 'https://shift.gearboxsoftware.com/');

commander.version('1.0.0');

commander.command('login <user> <password>')
    .action((u, p) => {
        webClient.login(u, p)
            .then(async () => {
                try {
                    await fs.mkdir('secrets');
                } catch {
                    // ignore 'EEXIST: file already exists'
                }
            })
            .then(() => cookieMonster.showCookies())
            .then(cookies => cookies.filter(cookie => cookie.key === 'si'))
            .then(cookies => cookieMonster.buryCookies(cookies, `./secrets/${u}.json`));
    });

commander.command('redeem <user> <code')
    .action((u, c) => {
        cookieMonster
            .fetchCookies(`./secrets/${u}.json`)
            .then(() => cookieMonster.isAuthenticated())
            .then(loggedIn => {
                if (!loggedIn) {
                    return Promise.reject('Unauthorized');
                }
                return Promise.resolve(true);
            })
            .then(() => webClient.getRedemptionForm(c))
            .then(formData => webClient.redeem(formData))
            .then(result => console.log(result))
            .catch((err: Response) => console.error(err.message));
    });

commander.parse(process.argv);
