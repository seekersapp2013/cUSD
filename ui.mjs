import Web3 from 'web3';
import fs from 'fs';
import path from 'path';

class Oathstone {
  constructor() {
    this.web3 = null;
    this.config = null;
    this.contract = null;
  }

  // Load configuration from data.json
  loadConfig() {
    const configPath = path.resolve('data.json');
    try {
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf-8');
        this.config = JSON.parse(data);
        console.log("Loaded config:", this.config);  // Check if data is loaded correctly

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

  // Determine the correct RPC URL based on environment and network
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

  // Connect to the selected network
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

  // Load contract instance based on address and ABI from data.json
  loadContract() {
    const { contractAddress, abi } = this.config;
    if (!contractAddress || !abi) {
      console.error("Contract address or ABI is missing in data.json");
      return null;
    }
    console.log(`Loaded contract at address: ${contractAddress}`);
    this.contract = new this.web3.eth.Contract(abi, contractAddress);
  }

  // Fetch contract details (example usage)
  async fetchContractDetails() {
    try {
      await this.connectNetwork();
      this.loadContract();
      
      if (this.contract) {
        try {
          const name = await this.contract.methods.name().call();
          const symbol = await this.contract.methods.symbol().call();
          const initialSupply = await this.contract.methods.initialSupply().call();

          console.log("Contract Details:");
          console.log("Name:", name);
          console.log("Symbol:", symbol);
          console.log("Initial Supply:", this.web3.utils.fromWei(initialSupply, 'ether'));
        } catch (error) {
          console.error("Error fetching contract methods:", error);
        }
      } else {
        console.error("Contract instance not loaded.");
      }
    } catch (error) {
      console.error("Error fetching contract details:", error);
    }
  }
}

// Create an instance of Oathstone and call the fetchContractDetails method
const oathstone = new Oathstone();
oathstone.fetchContractDetails();









