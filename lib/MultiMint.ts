import { Command } from 'commander';
import { Atomicals } from '.';
import { sleeper } from './utils/utils';
import * as dotenv from 'dotenv'
import { ConfigurationInterface } from './interfaces/configuration.interface';
import { ElectrumApi } from './api/electrum-api';
import { validateCliInputs } from './utils/validate-cli-inputs';
import { IValidatedWalletInfo, IWalletRecord, validateWalletStorage } from './utils/validate-wallet-storage';
import * as qrcode from 'qrcode-terminal';
import { detectAddressTypeToScripthash, performAddressAliasReplacement } from './utils/address-helpers';
import { AtomicalsGetFetchType } from './commands/command.interface';
import { fileReader } from './utils/file-utils';

function printOperationResult(data: any, error?: boolean) {
    console.log(JSON.stringify(data, null, 2));
}

function handleResultLogging(result: any) {
    if (!result || !result.success) {
        printOperationResult(result, true);
    } else {
        printOperationResult(result.data);
    }
}

function resolveWalletAliasNew(walletInfo: IValidatedWalletInfo, alias: string | undefined, defaultValue: any): IWalletRecord {
    if (!alias) {
      return defaultValue;
    }
    if (walletInfo[alias]) {
      return walletInfo[alias];
    }
    if (walletInfo.imported[alias]) {
      return walletInfo.imported[alias]
    }
    throw 'No wallet alias or valid address found: ' + alias;
}


async function main(){
    try {
        const walletInfo = await validateWalletStorage();
        const config: ConfigurationInterface = validateCliInputs();

        let ticker = process.env.ticker || '';
        ticker = ticker.toLowerCase();
        const atomicals = new Atomicals(ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
        let walletRecord = resolveWalletAliasNew(walletInfo, undefined, walletInfo.primary);
        let fundingRecord = resolveWalletAliasNew(walletInfo, undefined, walletInfo.funding);

        let repeatTimesStr = process.env.repeatAmount || '1';
        let repeatTimes = parseInt(repeatTimesStr);
        let satsbyteStr = process.env.satsbyte || '10';
        for(let i = 0; i < repeatTimes; i++){
            console.log(`第${i+1}次mint${ticker}...`);
            // const result: any = await atomicals.mintDftInteractive(walletRecord.address, ticker, fundingRecord.WIF, {
            //     satsbyte: parseInt(satsbyteStr),
            //     disableMiningChalk: undefined
            //   });
            //   handleResultLogging(result);

            //   if(i != repeatTimes - 1){
            //     console.log(`10秒后开始下一次...`);
            //     await sleeper(10);
            //   }
        }
        console.log(`${repeatTimes}全部mint完毕...`);
    }catch (error: any) {
        console.log(error);
    }
}


main().catch(console.error);