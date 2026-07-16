import * as https from 'https'

const url = 'https://i.ibb.co/0y71VzhH/L10010.png'

https.get(url, (res) => {
    console.log('Status Code:', res.statusCode)
    console.log('Content-Length:', res.headers['content-length'])
    console.log('Content-Type:', res.headers['content-type'])
}).on('error', (e) => {
    console.error(e)
})
