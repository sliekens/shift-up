import * as rp from 'request-promise';

rp.get('http://www.google.com')
    .then((html: string) => {
        console.log(html);
    })
    .catch((err: {}) => {
        console.error(err);
    });
