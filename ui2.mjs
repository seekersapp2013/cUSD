import Web3 from 'web3';
import fs from 'fs';
import path from 'path';

class Oathstone {
  constructor() {
    this.web3 = null;
    this.config = null;
    this.contract = null;
  }

  loadConfig() {
    const configPath = path.resolve('data.json');
    try {
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf-8');
        this.config = JSON.parse(data);
        console.log("Loaded config:", this.config);

        const requiredFields = ['environment', 'network', 'contractAddress', 'abi'];
        for (const field of requiredFields) {
          if (!this.config.hasOwnProperty(field)) {
            console.error(`Missing required field in data.json: ${field}`);
            return false;
          }
        }
        console.log("All required fields are present.");
        return true;
      } else {
        console.error("data.json not found in the current directory.");
        return false;
      }
    } catch (error) {
      console.error("Error loading data.json:", error);
      return false;
    }
  }

  getRpcUrl() {
    const { environment, network } = this.config;
    const rpcUrl = network === "ethereum" ?
      (environment === 0 ? 
        "https://sepolia.infura.io/v3/c821007d520e417ba5ae6ee73c417fdd" : 
        "https://mainnet.infura.io/v3/c821007d520e417ba5ae6ee73c417fdd") :
      (environment === 0 ? 
        "https://alfajores-forno.celo-testnet.org" : 
        "https://forno.celo.org");
    console.log(`Using RPC URL for ${network} network on ${environment === 0 ? 'testnet' : 'mainnet'}: ${rpcUrl}`);
    return rpcUrl;
  }

  async connectNetwork() {
    if (this.loadConfig()) {
      const rpcUrl = this.getRpcUrl();

      try {
        this.web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
        console.log("Connected to network successfully.");
      } catch (error) {
        console.error("Error connecting to network:", error);
      }
    }
  }

  loadContract() {
    const { contractAddress, abi } = this.config;
    if (!contractAddress || !abi) {
      console.error("Contract address or ABI is missing in data.json");
      return null;
    }
    console.log(`Loaded contract at address: ${contractAddress}`);
    this.contract = new this.web3.eth.Contract(abi, contractAddress);
  }

  async setTokenDetails(newName, newSymbol, newInitialSupply, userPrivateKey) {
    try {
      await this.connectNetwork();
      this.loadContract();

      if (this.contract) {
        const fromAddress = this.web3.eth.accounts.privateKeyToAccount(userPrivateKey).address;

        const txSetName = this.contract.methods.setName(newName);
        await this.sendTransaction(txSetName, fromAddress, userPrivateKey);

        const txSetSymbol = this.contract.methods.setSymbol(newSymbol);
        await this.sendTransaction(txSetSymbol, fromAddress, userPrivateKey);

        const txSetInitialSupply = this.contract.methods.setInitialSupply(newInitialSupply);
        await this.sendTransaction(txSetInitialSupply, fromAddress, userPrivateKey);

        console.log("Token details updated successfully.");
      } else {
        console.error("Contract instance not loaded.");
      }
    } catch (error) {
      console.error("Error setting token details:", error);
    }
  }

  async sendTransaction(tx, fromAddress, privateKey) {
    const nonce = await this.web3.eth.getTransactionCount(fromAddress, 'pending');
    const gas = await tx.estimateGas({ from: fromAddress }).catch(() => 200000);  // fallback gas limit
    const gasPrice = await this.web3.eth.getGasPrice();
    const data = tx.encodeABI();

    const signedTx = await this.web3.eth.accounts.signTransaction(
      {
        to: this.config.contractAddress,
        data,
        gas,
        gasPrice,
        nonce,
      },
      privateKey
    );

    const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log("Transaction successful:", receipt);
  }
}

// Usage example:
const oathstone = new Oathstone();
const newName = "MONI";
const newSymbol = "MNI";
const newInitialSupply = Web3.utils.toWei("10000000000000", "ether");
const userPrivateKey = "0xdfca2e462be7699f264ecc80374067823560e5156ded92b53072a1965cc5bfcc";

oathstone.setTokenDetails(newName, newSymbol, newInitialSupply, userPrivateKey);











