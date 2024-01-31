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
import * as chalk from 'chalk';
import * as quotes from 'success-motivational-quotes'; 

function printOperationResult(data: any, error?: boolean) {
    console.log(JSON.stringify(data, null, 2));
}

/////////////////////////////////////////////////////////////////////////////////////////////
// General Helper Functions
/////////////////////////////////////////////////////////////////////////////////////////////
function printSuccess(data: any, showDonation?: boolean) {
  console.log(JSON.stringify(data, null, 2));
  if (!showDonation) {
    return;
  }

  if (process.env.DISABLE_DONATE_QUOTE && process.env.DISABLE_DONATE_QUOTE === 'true') {
    return;
  }
  console.log(chalk.blue("\n\n------------------------------------------------------------------------------"));

  let q = 'Recommend to your children virtue; that alone can make them happy, not gold.';
  let by = 'Ludwig van Beethoven';
  try {
    const quoteObj = quotes.getTodaysQuote();
    q = quoteObj.body;
    by = quoteObj.by;
  } catch (ex) {
    // Lib not installed
  }
  console.log(chalk.green(q));
  console.log(chalk.green('- ' + by));
  console.log(chalk.blue("------------------------------------------------------------------------------\n"))
  const donate = 'bc1pl6k2z5ra403zfeyevzsu7llh0mdqqn4802p4uqfhz6l7qzddq2mqduqvc6';
  console.log('Thank you for your support and contributions to Atomicals CLI development! ❤️');
  console.log(`Donation address: ${donate}\n`);
  console.log(`Even a little goes a long way!\n`);
  console.log(`Scan QR Code to Donate:`);
  qrcode.generate(donate, { small: true });
}
function printFailure(data: any) {
  console.log(JSON.stringify(data, null, 2));
}

function handleResultLogging(result: any, showDonation?: boolean) {
  if (!result || !result.success || !result.data) {
    printFailure(result);
    process.exit(1);
  } else {
    printSuccess(result.data, showDonation);
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
    let containerName = 'atomdragons2024';
    let mintAmount = 0;
    let maxAmount = 5;
    for(let i = 2023;i > 1000;i --){
      if(mintAmount >= maxAmount){
        break;
      }
        try {
            let itemId = i.toString();
            itemId = String(itemId).padStart(5, '0');
            console.log('查询 ',itemId);
            const atomicals = new Atomicals(ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
            const modifiedStripped = containerName.indexOf('#') === 0 ? containerName.substring(1) : containerName;
            const result: any = await atomicals.getAtomicalByContainerItem(modifiedStripped, itemId);
            // console.log(JSON.stringify(result, null, 2));
            if(result.success == true && result.data.status == undefined)
            {
                console.log('漏网之鱼',itemId);
                let satsbyteStr = process.env.satsbyteMint || '';
                let satsbyte = parseInt(satsbyteStr);
                // const satsbyte = 70;
                const manifestFile = `./${containerName}/item-${itemId}.json`

                const walletInfo = await validateWalletStorage();
                let initialOwnerAddress = resolveAddress(walletInfo, undefined, walletInfo.primary);
                let ownerWalletRecord = resolveWalletAliasNew(walletInfo, undefined, walletInfo.primary);
                let fundingRecord = resolveWalletAliasNew(walletInfo, undefined, walletInfo.funding);
                const result: any = await atomicals.mintContainerItemInteractive({
                  rbf: undefined,
                  meta: undefined,
                  ctx: undefined,
                  init: undefined,
                  satsbyte: satsbyte,
                }, containerName, itemId, manifestFile, initialOwnerAddress.address, fundingRecord.WIF);
                handleResultLogging(result, true);
                mintAmount ++;
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