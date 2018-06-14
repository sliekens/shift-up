import cheerio from 'cheerio';
import { RequestAPI, RequiredUriUrl } from 'request';
import { RequestPromise, RequestPromiseOptions } from 'request-promise-native';

export class WebClient {
    constructor(
        private http: RequestAPI<RequestPromise, RequestPromiseOptions, RequiredUriUrl>,
        private baseUrl: string
    ) {
    }

    getToken(url: string): Promise<string> {
        console.log('GET', url);
        return this.http
            .get({
                uri: url,
                transform: body => cheerio.load(body)
            })
            .then(($: CheerioStatic) => $('meta[name=csrf-token]').attr('content'));
    }

    login(email: string, password: string): Promise<any> {
        return this.getToken(this.baseUrl + 'home')
            .then((token: string) => {
                console.log('POST', this.baseUrl + 'sessions');
                return this.http.post({
                    uri: this.baseUrl + 'sessions',
                    formData: {
                        'authenticity_token': token,
                        'user[email]': email,
                        'user[password]': password
                    }
                });
            });
    }

    getRedemptionForm(code: string): Promise<any> {
        return this.getToken(this.baseUrl + 'code_redemptions/new')
            .then(token => {
                console.log('GET', `${this.baseUrl}entitlement_offer_codes?code=${code}`);
                return this.http.get({
                    uri: `${this.baseUrl}entitlement_offer_codes?code=${code}`,
                    headers: {
                        'x-csrf-token': token,
                        'x-requested-with': 'XMLHttpRequest'
                    },
                    transform: body => cheerio.load(body)
                });
            })
            .then(($: CheerioStatic) => {
                if ($('form.new_archway_code_redemption').length === 0) {
                    return Promise.reject($.root().text().trim());
                } else {
                    return Promise.resolve({
                        'authenticity_token': $('input[name=authenticity_token]').val(),
                        'archway_code_redemption[code]': $('#archway_code_redemption_code').val(),
                        'archway_code_redemption[check]': $('#archway_code_redemption_check').val(),
                        'archway_code_redemption[service]': $('#archway_code_redemption_service').val()
                    });
                }
            });
    }

    redeem(formData: any): Promise<string> {
        console.log('POST', this.baseUrl + 'code_redemptions');
        return this.http.post({
            uri: this.baseUrl + 'code_redemptions',
            formData,
            transform: body => cheerio.load(body)
        }).then(($: CheerioStatic) => {
            if ($('div.notice').length !== 0) {
                return $('div.notice').text().trim();
            } else if ($('#check_redemption_status').length !== 0) {
                // tslint:disable-next-line:no-multiline-string
                return `Your code was accepted but no status was returned.
Wait a few moments then check the rewards page: https://shift.gearboxsoftware.com/rewards`;
            } else {
                return $.html();
            }
        });
    }
}
