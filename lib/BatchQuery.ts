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
import axios from 'axios';

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

function resolveAddress(walletInfo: IValidatedWalletInfo, alias: string | undefined, defaultValue: any): IWalletRecord | any {

  if (!alias) {
    return defaultValue;
  }

  if (walletInfo[alias]) {

    return walletInfo[alias];
  }
  if (walletInfo.imported[alias]) {

    return walletInfo.imported[alias];
  }

  // As a last effort try and return the address
  try {

    detectAddressTypeToScripthash(alias)
    return {
      address: alias
    }
  } catch (err) {
    // Do nothing, but at least we tried
  }

  throw 'No wallet alias or valid address found: ' + alias;
}


async function getRealTimeGas() {
  let fee = 0;
    try {
        const response = await axios.get('https://mempool.space/api/v1/fees/recommended');
        let currentFastest = response.data.fastestFee;
        console.log('currentFastest',currentFastest);
        if(currentFastest <= 60){
          fee = currentFastest + 15;
        }else if(currentFastest <= 100){
          fee = currentFastest + 20;
        }
        else if(currentFastest <= 200){
          fee = currentFastest + 20;
        }
        else if(currentFastest <= 260){
          fee = currentFastest + 20;
        }else
        {
          fee = Math.min(currentFastest + 20,400);
        }
        return fee;
    } catch (error) {
        console.error('Error fetching Bitcoin fees:', error);
        return 0;
    }
}

async function main(){
    let container = 'fishfaceman';
    for(let i = 9000;i > 8000;i --){
        try {
          
            let itemId = i.toString();
            console.log('查询 ',itemId);
            const atomicals = new Atomicals(ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
            const modifiedStripped = container.indexOf('#') === 0 ? container.substring(1) : container;
            const result: any = await atomicals.getAtomicalByContainerItem(modifiedStripped, itemId);
            // console.log(JSON.stringify(result, null, 2));
            if(result.success == true && result.data.status == undefined)
            {
                console.log('漏网之鱼',itemId);
            }else
            {
              console.log(itemId,'已经被占');
            }
            await sleeper(2);
          } catch (error) {
            console.log(error);
          } 
    }
    console.log('查询结束');
}


main().catch(console.error);