// Pure wallet helpers from POTIFY's November 6 Holder Hub prototype.
import crypto from 'node:crypto';
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100','hex');

export function base58Encode(buf) {
  let num = BigInt('0x' + Buffer.from(buf).toString('hex'));
  let out = '';
  while(num > 0n){out = ALPHABET[Number(num % 58n)] + out;num /= 58n;}
  for(const n of buf){if(n===0)out = '1'+out;else break;}
  return out || '1';
}
export function base58Decode(value) {
  if(typeof value!=='string'||!/^[1-9A-HJ-NP-Za-km-z]+$/.test(value)) throw new Error('Invalid base58');
  let num=0n;
  for(const ch of value){num=num*58n+BigInt(ALPHABET.indexOf(ch));}
  let hex=num.toString(16); if(hex.length%2)hex='0'+hex;
  let data = num===0n ? Buffer.alloc(0):Buffer.from(hex,'hex');
  const leading=value.match(/^1*/)?.[0]?.length || 0;
  return Buffer.concat([Buffer.alloc(leading),data]);
}
function assertWallet(value){
  const bytes=base58Decode(value);
  if(bytes.length!==32 || base58Encode(bytes)!==value) throw new Error('Invalid Solana wallet');
  return value;
}
export function verifySolanaMessage(wallet,message,signatureBase64){
  try{
    assertWallet(wallet);
    const sig=Buffer.from(signatureBase64,'base64');
    if(sig.length!==64 || sig.toString('base64')!==signatureBase64) return false;
    const key=crypto.createPublicKey({key:Buffer.concat([SPKI_PREFIX,base58Decode(wallet)]),format:'der',type:'spki'});
    return crypto.verify(null,Buffer.from(message,'utf8'),key,sig);
  }catch{return false;}
}
