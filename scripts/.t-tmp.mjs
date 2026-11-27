import { chromium } from 'playwright-core';
console.log('launching...');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--headless=new','--no-proxy-server'], timeout: 30000 });
console.log('launched');
const page = await browser.newPage();
await page.goto('about:blank');
console.log('goto ok');
await browser.close();
console.log('closed');
