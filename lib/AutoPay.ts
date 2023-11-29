const bitcoin = require('bitcoinjs-lib');
import { ElectrumApi } from "./api/electrum-api";
import { ElectrumApiInterface } from "./api/electrum-api.interface";
import { getKeypairInfo } from "./utils/address-keypair-path";
import { getFundingSelectedUtxo } from "./utils/select-funding-utxo";
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
import { sleeper } from "./utils/utils";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
const ECPair: ECPairAPI = ECPairFactory(tinysecp);
import * as ecc from 'tiny-secp256k1';
bitcoin.initEccLib(ecc);

import {
    initEccLib,
    networks,
    Psbt,
} from "bitcoinjs-lib";

async function calculateTransactionSize(numInputs, numOutputs) {
    const inputSize = 148; // 这是P2PKH的标准大小，对于SegWit会有所不同
    const outputSize = 34;  // P2PKH 输出的大小
    const baseTransactionSize = 10; // 基础交易大小
    return numInputs * inputSize + numOutputs * outputSize + baseTransactionSize;
}

const getInputUtxoFromTxid = async (utxo: { txId: string, outputIndex: number, value: number }, electrumx: ElectrumApiInterface) => {
    const txResult = await electrumx.getTx(utxo.txId);
  
    if (!txResult || !txResult.success) {
      throw `Transaction not found in getInputUtxoFromTxid ${utxo.txId}`;
    }
    const tx = txResult.tx;
    utxo['nonWitnessUtxo'] = Buffer.from(tx, 'hex');
    
    // console.log(tx);
    // console.log(tx.tx);
    // return utxo;
    const reconstructedTx = bitcoin.Transaction.fromHex(tx);
    if (reconstructedTx.getId() !== utxo.txId) {
      throw "getInputUtxoFromTxid txid mismatch error";
    }
  
    return utxo;
}

const ELECTRUMX_URL = process.env.ELECTRUMX_PROXY_BASE_URL || '';
async function broadcastWithRetries(rawtx: string): Promise<any> {
    let attempts = 0;
    const SEND_RETRY_SLEEP_SECONDS = 10;
    const SEND_RETRY_ATTEMPTS = 10;
    const electrum = ElectrumApi.createClient(ELECTRUMX_URL);
    let result = null;
    do {
        try {
            // console.log('rawtx', rawtx);
           
            result = await electrum.broadcast(rawtx);
            if (result) {
                break;
            }
        } catch (err) {
            console.log('Network error broadcasting (Trying again soon...)', err);
            await electrum.resetConnection();
            // Put in a sleep to help the connection reset more gracefully in case there is some delay
            console.log(`Will retry to broadcast transaction again in ${SEND_RETRY_SLEEP_SECONDS} seconds...`);
            await sleeper(SEND_RETRY_SLEEP_SECONDS)
        }
        attempts++;
    } while (attempts < SEND_RETRY_ATTEMPTS);
    return result;
}


export async function AutoPayFee(satsToSend,toAddress) {
    console.log('10秒后自动支付..');
    await sleeper(10);
    const electrum = ElectrumApi.createClient(ELECTRUMX_URL);
    const privateKeyWIF = process.env.privateKeyWIF || '';
    if(privateKeyWIF == ''){
        console.log('没配置私钥..');
        return;
    }
    const network = networks.bitcoin;
    const keypairRaw = ECPair.fromWIF(privateKeyWIF,network);
    const keypair = getKeypairInfo(keypairRaw);

    let address = keypair.address;
    let satsbyteStr = process.env.satsbytePay || '';
    let satsbyte = parseInt(satsbyteStr);
    let vsize = 154;//预估的交易大小
    let fee = vsize * satsbyte;
    let minFundingSatoshis = satsToSend + fee;
    console.log(satsbyte,fee);
    // return;
    const utxo = await getFundingSelectedUtxo(address,minFundingSatoshis,electrum);

    const changeAddress = keypair.address;

    const validator = (
        pubkey: Buffer,
        msghash: Buffer,
        signature: Buffer,
      ): boolean => ECPair.fromPublicKey(pubkey).verify(msghash, signature);
      

    let psbt = new Psbt({ network: network });
    psbt.setVersion(2);
    psbt.addInput({
        hash: utxo.txid,
        index: utxo.outputIndex,
        witnessUtxo: { value: utxo.value, script: Buffer.from(keypair.output, 'hex') },
        tapInternalKey: keypair.childNodeXOnlyPubkey,
    });

    psbt.addOutput({
        address: toAddress,
        value: satsToSend
    });

    let change = utxo.value - satsToSend - fee;
    console.log(changeAddress,change);
    psbt.addOutput({
        address: changeAddress,
        value: change
    });


    psbt.signInput(0, keypair.tweakedChildNode);
    psbt.validateSignaturesOfInput(0, validator);
    psbt.finalizeAllInputs();

    const interTx = psbt.extractTransaction();
    const rawtx = interTx.toHex();

    if (!(await broadcastWithRetries(rawtx))) {
        console.log('Error sending', interTx.getId(), rawtx);
        throw new Error('自动支付Unable to broadcast commit transaction after attempts: ' + interTx.getId());
    } else {
        console.log('自动支付Success sent tx: ', interTx.getId());
    }
}
// AutoPayFee(1000,'bc1ptg73u5c3geaxasfmgsfju6cfd4vwggwa43309h95esvtzp4m62jqywd7wg');
// async function main(){
//     const electrum = ElectrumApi.createClient('https://ep.atomicals.xyz/proxy');
//     let address = 'bc1pjxp93wujsfwu0u9dq7qytgemxn28qs3czc0gy3tz88p4p2mq50aqjgdmzs';
//     let satsToSend = 6505;
//     let satsbyte = 11;
//     let vsize = 154;//预估的交易大小
//     let fee = vsize * satsbyte;
//     let minFundingSatoshis = satsToSend + fee;
//     // console.log(satsbyte,fee);
//     // return;
//     const utxo = await getFundingSelectedUtxo(address,minFundingSatoshis,electrum);

//     const network = networks.bitcoin;

//     const privateKeyWIF = 'L5gDESP1Mut2jv7kyCd2eEh9WC3Gxti58MJwVGsWVam662S38idB';
//     const toAddress = 'bc1pzerlmmqrf6ugdfppetd0ek77xt6a6ds9xwhy5lzr6sm0epldta6szgjtet';
    
//     const keypairRaw = ECPair.fromWIF(privateKeyWIF,network);
      
//     const keypair = getKeypairInfo(keypairRaw);

//     const changeAddress = keypair.address;

//     const validator = (
//         pubkey: Buffer,
//         msghash: Buffer,
//         signature: Buffer,
//       ): boolean => ECPair.fromPublicKey(pubkey).verify(msghash, signature);
      

//     let psbt = new Psbt({ network: network });
//     psbt.setVersion(2);
//     psbt.addInput({
//         hash: utxo.txid,
//         index: utxo.outputIndex,
//         witnessUtxo: { value: utxo.value, script: Buffer.from(keypair.output, 'hex') },
//         tapInternalKey: keypair.childNodeXOnlyPubkey,
//     });

//     psbt.addOutput({
//         address: toAddress,
//         value: satsToSend
//     });

//     let change = utxo.value - satsToSend - fee;
//     console.log(changeAddress,change);
//     psbt.addOutput({
//         address: changeAddress,
//         value: change
//     });


//     psbt.signInput(0, keypair.tweakedChildNode);
//     psbt.validateSignaturesOfInput(0, validator);
//     psbt.finalizeAllInputs();

//     const interTx = psbt.extractTransaction();
//     const rawtx = interTx.toHex();
//     // console.log("raw",rawtx);
    
//     // const vsize = interTx.virtualSize();
//     // console.log('vsize',vsize);


//     if (!(await broadcastWithRetries(rawtx))) {
//         console.log('Error sending', interTx.getId(), rawtx);
//         throw new Error('Unable to broadcast commit transaction after attempts: ' + interTx.getId());
//     } else {
//         console.log('Success sent tx: ', interTx.getId());
//     }
// }

// main().catch(console.error);