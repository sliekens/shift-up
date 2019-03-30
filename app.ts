#!/usr/bin/env node
import commander, { Command } from 'commander';
import { promises as fs } from 'fs';
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
const webClient = new WebClient(http, 'https://shift.gearboxsoftware.com');

commander.version('1.0.0');

commander.command('login <user> <password>')
    .action(async (user, password) => {
        await webClient.login(user, password);
        try {
            await fs.mkdir('secrets');
        } catch {
            // ignore 'EEXIST: file already exists'
        }

        let cookies = await cookieMonster.showCookies();
        cookies = cookies.filter(cookie => cookie.key === 'si');
        await cookieMonster.buryCookies(cookies, `./secrets/${user}.json`);
    });

commander.command('redeem <user> <code>')
    .action(async (user, code) => {
        await cookieMonster.fetchCookies(`./secrets/${user}.json`);
        let loggedIn = await cookieMonster.isAuthenticated();
        if (!loggedIn) {
            throw new Error('Unauthorized');
        }

        try {
            let formData = await webClient.getRedemptionForm(code);
            let result = await webClient.redeem(formData);
        } catch (error) {
            console.error(error);
        }
    });

commander.parse(process.argv);
