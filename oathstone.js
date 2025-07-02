class Oathstone {
  constructor() {
    this.web3Instances = {};
    this.config = null;
    this.contracts = {};
  }

  // Load configuration from data.json
  async loadConfig() {
    try {
      console.log('Loading config...');
      const response = await fetch('./data.json');
      console.log('Fetched data.json');
      const data = await response.json();
      console.log('Parsed data.json:', data);
      this.config = data;
        console.log("Loaded config:", this.config);
      if (!this.config.networks) {
        console.error("Missing networks object in config");
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error loading data.json:", error);
      console.error("Full error:", error.stack);
      return false;
    }
  }

  // Connect to all networks
  async connectNetworks() {
    try {
      console.log('Connecting to networks...');
      if (await this.loadConfig()) {
        if (!this.config.networks || Object.keys(this.config.networks).length === 0) {
          console.error("No networks configured in data.json");
          return false;
        }

        for (const [networkName, networkConfig] of Object.entries(this.config.networks)) {
          const rpcUrl = networkConfig.environment === 0 
            ? networkConfig.rpcUrl.testnet 
            : networkConfig.rpcUrl.mainnet;

          console.log(`Attempting to connect to ${networkName} at ${rpcUrl}`);
          this.web3Instances[networkName] = new Web3(new Web3.providers.HttpProvider(rpcUrl));
          console.log(`Connected to ${networkName} network successfully.`);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error connecting to networks:", error);
      console.error("Full error:", error.stack);
      return false;
    }
  }

  // Load all contracts
  async loadContracts() {
    try {
      if (!this.config.networks) {
        console.error("No networks configuration found");
        return false;
      }

      for (const [networkName, networkConfig] of Object.entries(this.config.networks)) {
        this.contracts[networkName] = {};
        
        if (!networkConfig.tokens || Object.keys(networkConfig.tokens).length === 0) {
          console.log(`No tokens configured for network ${networkName}`);
          continue;
        }
        
        for (const [tokenName, tokenConfig] of Object.entries(networkConfig.tokens)) {
          const { contractAddress, abi } = tokenConfig;
          this.contracts[networkName][tokenName] = new this.web3Instances[networkName].eth.Contract(
            abi,
            contractAddress
          );
          console.log(`Loaded ${tokenName} contract on ${networkName}`);
        }
      }
      return Object.keys(this.contracts).length > 0;
    } catch (error) {
      console.error("Error loading contracts:", error);
      return false;
    }
  }

  // Get contract instance
  getContract(network, tokenName) {
    return this.contracts[network]?.[tokenName];
  }

  // Get Web3 instance for a specific network
  getWeb3(network) {
    return this.web3Instances[network];
  }

  // Create a new wallet (on any network as they share the same key pairs)
  createWallet() {
    try {
      const web3 = this.web3Instances[Object.keys(this.web3Instances)[0]];
      if (!web3) {
        throw new Error("No Web3 instance available");
      }
      const wallet = web3.eth.accounts.create();
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
      };
    } catch (error) {
      console.error("Error creating wallet:", error.message);
      return null;
    }
  }

  // Get token balance
  async getTokenBalance(network, tokenName, address) {
    try {
      const contract = this.getContract(network, tokenName);
      if (!contract) {
        throw new Error(`Contract not found for ${tokenName} on ${network}`);
      }
      const balance = await contract.methods.balanceOf(address).call();
      return this.web3Instances[network].utils.fromWei(balance, 'ether');
    } catch (error) {
      console.error(`Error fetching ${tokenName} balance:`, error.message);
      throw error;
    }
  }

  // Get native token balance (ETH/CELO)
  async getNativeBalance(network, address) {
    try {
      const web3 = this.getWeb3(network);
      if (!web3) {
        throw new Error(`Web3 not initialized for ${network}`);
      }
      const balance = await web3.eth.getBalance(address);
      return web3.utils.fromWei(balance, 'ether');
    } catch (error) {
      console.error(`Error fetching ${network} balance:`, error.message);
      throw error;
    }
  }

  // Transfer token
  async transferToken(network, tokenName, fromAddress, privateKey, toAddress, amount) {
    const web3 = this.getWeb3(network);
    const contract = this.getContract(network, tokenName);
    
    if (!web3 || !contract) {
      throw new Error(`Invalid network or token: ${network}/${tokenName}`);
    }

    const amountInWei = web3.utils.toWei(amount.toString(), 'ether');
    const tx = contract.methods.transfer(toAddress, amountInWei);
    const gas = await tx.estimateGas({ from: fromAddress });
    const gasPrice = await web3.eth.getGasPrice();
    const data = tx.encodeABI();
    const nonce = await web3.eth.getTransactionCount(fromAddress);

    const signedTx = await web3.eth.accounts.signTransaction(
      {
        to: contract.options.address,
        data,
        gas,
        gasPrice,
        nonce,
      },
      privateKey
    );

    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    return receipt;
  }

  // Transfer native token
  async transferNative(network, fromAddress, privateKey, toAddress, amount) {
    const web3 = this.getWeb3(network);
    if (!web3) {
      throw new Error(`Invalid network: ${network}`);
    }

    const amountInWei = web3.utils.toWei(amount.toString(), 'ether');
    const nonce = await web3.eth.getTransactionCount(fromAddress);
    const gasPrice = await web3.eth.getGasPrice();

    const signedTx = await web3.eth.accounts.signTransaction(
      {
        from: fromAddress,
        to: toAddress,
        value: amountInWei,
        gas: 21000,
        gasPrice,
        nonce,
      },
      privateKey
    );

    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    return receipt;
  }
}

export default Oathstone;