import webpush from 'web-push';
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const keys=webpush.generateVAPIDKeys();
writeFileSync('.dev.vars',`VAPID_PUBLIC_KEY="${keys.publicKey}"\nVAPID_PRIVATE_KEY="${keys.privateKey}"\nENROLLMENT_KEY="${randomBytes(24).toString('hex')}"\n`,{flag:'wx',mode:0o600});
console.log('Keys saved to ignored .dev.vars. Do not commit or share its contents. Existing file is never overwritten.');
