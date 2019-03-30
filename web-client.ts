import cheerio from 'cheerio';
import { RequestAPI, RequiredUriUrl, Response } from 'request';
import { RequestPromise, RequestPromiseOptions } from 'request-promise-native';

const resources = {
    loginForm: '/home',
    submitLoginForm: '/sessions',
    codeForm: '/code_redemptions/new',
    checkCode: '/entitlement_offer_codes', // ?code=<code>
    submitCodeForm: '/code_redemptions'
};
Object.freeze(resources);

/**
 * WebClient is responsible for interacting with the SHiFT website.
 */
export class WebClient {
    /**
     * @param http an object that can GET and POST data over HTTP.
     * @param baseUrl the SHiFT website location without any path segments, i.e. 'https://shift.gearboxsoftware.com'.
     */
    constructor(
        private http: RequestAPI<RequestPromise, RequestPromiseOptions, RequiredUriUrl>,
        private baseUrl: string
    ) {
    }

    /**
     * Gets a page and returns its CSRF token (A.K.A. authenticity token).
     * @param url the location of the page.
     */
    async getToken(url: string): Promise<string> {
        console.log('GET', url);
        let $: CheerioStatic = await this.http
            .get({
                uri: url,
                transform: body => cheerio.load(body)
            });

        return $('meta[name=csrf-token]').attr('content');
    }

    /**
     * Submits a login form and returns the entire response.
     * @param email a valid SHiFT account name
     * @param password a valid password
     */
    async login(email: string, password: string) {
        let token = await this.getToken(this.baseUrl + resources.loginForm);
        console.log('POST', this.baseUrl + resources.submitLoginForm);
        return this.http.post({
            uri: this.baseUrl + resources.submitLoginForm,
            formData: {
                'authenticity_token': token,
                'user[email]': email,
                'user[password]': password
            }
        });
    }

    async getRedemptionForm(code: string): Promise<any> {
        let token = await this.getToken(this.baseUrl + resources.codeForm);
        console.log('GET', `${this.baseUrl}${resources.checkCode}?code=${code}`);
        let $: CheerioStatic = await this.http.get({
            uri: `${this.baseUrl}${resources.checkCode}?code=${code}`,
            headers: {
                'x-csrf-token': token,
                'x-requested-with': 'XMLHttpRequest'
            },
            transform: body => cheerio.load(body)
        });

        if ($('form.new_archway_code_redemption').length === 0) {
            return Promise.reject($.root().text().trim());
        } else {
            return {
                'authenticity_token': $('input[name=authenticity_token]').val(),
                'archway_code_redemption[code]': $('#archway_code_redemption_code').val(),
                'archway_code_redemption[check]': $('#archway_code_redemption_check').val(),
                'archway_code_redemption[service]': $('#archway_code_redemption_service').val()
            };
        }
    }

    async redeem(formData: any): Promise<string | null> {
        console.log('POST', this.baseUrl + resources.submitCodeForm);
        let response = await this.http.post({
            uri: this.baseUrl + resources.submitCodeForm,
            formData,
            resolveWithFullResponse: true,
            followRedirect: false
        });
        let redirectLocation = await this.checkRedemptionStatus(response);
        console.log('GET', this.baseUrl + redirectLocation);
        let body = await this.http.get({
            uri: this.baseUrl + redirectLocation
        });

        return this.getAlert(body);
    }

    private async checkRedemptionStatus(response: Response): Promise<string> {
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
            await this.wait(500);
            let nextResponse = await this.http.get({
                uri: this.baseUrl + url,
                resolveWithFullResponse: true,
                followRedirect: false
            });

            // retry recursively
            return this.checkRedemptionStatus(nextResponse);
        }
        return Promise.reject(response.body);
    }

    private wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
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
