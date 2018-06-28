import cheerio from 'cheerio';
import { RequestAPI, RequiredUriUrl, Response } from 'request';
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

    redeem(formData: any): Promise<string | null> {
        console.log('POST', this.baseUrl + 'code_redemptions');
        return this.http
            .post({
                uri: this.baseUrl + 'code_redemptions',
                formData,
                resolveWithFullResponse: true,
                followRedirect: false
            })
            .then((response: Response) => this.checkRedemptionStatus(response))
            .then(redirect => {
                console.log('GET', this.baseUrl + redirect);
                return this.http.get({
                    uri: this.baseUrl + redirect
                });
            })
            .then(body => this.getAlert(body));
    }

    checkRedemptionStatus(response: Response): Promise<string> {
        if (response.statusCode === 302) {
            return Promise.resolve(response.headers.location!);
        }

        const alert = this.getAlert(response.body);
        if (alert != null) {
            return Promise.reject(alert);
        }

        const { status, url } = this.getStatus(response.body);
        if (status != null) {
            console.log(status);
            return this.wait(500)
                .then(() => this.http.get({
                    uri: this.baseUrl + url,
                    resolveWithFullResponse: true,
                    followRedirect: false
                }))
                .then(r2 => this.checkRedemptionStatus(r2));
        }
        return Promise.reject(response.body);
    }

    private wait(n: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, n));
    }

    private getAlert(body: any): string | null {
        const $ = cheerio.load(body);
        if ($('div.notice').length === 0) {
            return null;
        }
        return $('div.notice').text().trim();
    }

    private getStatus(body: any): { status?: string; url?: string } {
        const $ = cheerio.load(body);
        if ($('div#check_redemption_status').length === 0) {
            return {};
        }
        const div = $('div#check_redemption_status');
        return {
            status: div.text().trim(),
            url: div.data('url')
        };
    }
}
