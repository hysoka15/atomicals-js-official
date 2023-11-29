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


async function main(){
    try {
      const configContainers = process.env.CONTAINERS || '';
      const containers = configContainers.split(';').map(item => item.trim().split(' '));

      let satsbyteStr = process.env.satsbyte || '10';
      for(let i = 0;i < containers.length;i ++){
        const containerName = containers[i][0];
        const itemName = containers[i][1];
        const manifestFile = containers[i][2];
        console.log(`第${i+1}次mint ${containerName} ${itemName} ${manifestFile}...`);

        try {
          const walletInfo = await validateWalletStorage();
          const atomicals = new Atomicals(ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
          let initialOwnerAddress = resolveAddress(walletInfo, undefined, walletInfo.primary);
          let ownerWalletRecord = resolveWalletAliasNew(walletInfo, undefined, walletInfo.primary);
          let fundingRecord = resolveWalletAliasNew(walletInfo, undefined, walletInfo.funding);
          const result: any = await atomicals.mintContainerItemInteractive(containerName, itemName, manifestFile, initialOwnerAddress.address, fundingRecord.WIF, ownerWalletRecord, {
            satsbyte: parseInt(satsbyteStr),
            satsoutput: 1000,
          });
          handleResultLogging(result);
        } catch (error) {
          console.log(error);
        }

        if(i != containers.length - 1){
          console.log(`10秒后开始下一次...`);
          await sleeper(10);
        }
      }
      console.log(`${containers.length} item 全部mint完毕...`);
    }catch (error: any) {
        console.log(error);
    }
}


main().catch(console.error);