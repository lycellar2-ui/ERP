async function testLiveAuth() {
    console.log('1. Fetching Captcha from https://hoadondientu.gdt.gov.vn/api/captcha...')

    const capRes = await fetch('https://hoadondientu.gdt.gov.vn/api/captcha')
    const capData = await capRes.json()
    console.log('Captcha Key:', capData.key)
    console.log('Captcha SVG length:', capData.content.length)

    // Let's test what response GDT returns when we send a test cvalue
    const authRes = await fetch('https://hoadondientu.gdt.gov.vn/api/security-taxpayer/authenticate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://hoadondientu.gdt.gov.vn',
            'Referer': 'https://hoadondientu.gdt.gov.vn/',
        },
        body: JSON.stringify({
            username: '0109579480',
            password: 'Lyscellars@2026',
            ckey: capData.key,
            cvalue: 'TEST',
        }),
    })

    console.log(`Auth HTTP Status: ${authRes.status}`)
    const authBody = await authRes.json()
    console.log('Auth Body Response:', JSON.stringify(authBody, null, 2))
}

testLiveAuth()
