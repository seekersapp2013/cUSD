let oathstone;
let selectedNetwork;
let selectedToken;

async function initializeOathstone() {
  try {
    console.log('Starting initialization...');
    const response = await fetch('./oathstone.js');
    const code = await response.text();
    console.log('Loaded oathstone.js');

    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    const OathstoneModule = await import(url);
    console.log('Imported Oathstone module');
    const Oathstone = OathstoneModule.default;

    oathstone = new Oathstone();
    console.log('Created Oathstone instance');

    const networkConnected = await oathstone.connectNetworks();
    console.log('Network connection result:', networkConnected);
    if (!networkConnected) {
      throw new Error('Failed to connect to networks');
    }

    const contractsLoaded = await oathstone.loadContracts();
    console.log('Contracts loading result:', contractsLoaded);
    if (!contractsLoaded) {
      throw new Error('Failed to load contracts');
    }

    await initializeSelectors();
    console.log('Initialization complete');
  } catch (error) {
    console.error('Failed to initialize Oathstone:', error);
    alert('Failed to initialize the application. Please check the console for details.');
  }
}

async function initializeSelectors() {
  const networkSelect = document.getElementById('networkSelect');
  const tokenSelect = document.getElementById('tokenSelect');
  networkSelect.innerHTML = '<option value="">Select Network</option>';
  tokenSelect.innerHTML = '<option value="">Select Token</option>';

  if (!oathstone.config.networks || Object.keys(oathstone.config.networks).length === 0) {
    console.warn("No networks available");
    return;
  }

  Object.keys(oathstone.config.networks).forEach(network => {
    const option = document.createElement('option');
    option.value = network;
    option.textContent = network.charAt(0).toUpperCase() + network.slice(1);
    networkSelect.appendChild(option);
  });

  if (Object.keys(oathstone.config.networks).length === 1) {
    const onlyNetwork = Object.keys(oathstone.config.networks)[0];
    networkSelect.value = onlyNetwork;
    handleNetworkChange();
  }
}

async function handleNetworkChange() {
  const networkSelect = document.getElementById('networkSelect');
  const tokenSelect = document.getElementById('tokenSelect');
  selectedNetwork = networkSelect.value;
  tokenSelect.innerHTML = '<option value="">Select Token</option>';

  if (selectedNetwork) {
    const tokens = oathstone.config.networks[selectedNetwork].tokens;
    if (!tokens || Object.keys(tokens).length === 0) {
      console.warn(`No tokens available for network ${selectedNetwork}`);
      return;
    }

    Object.keys(tokens).forEach(token => {
      const option = document.createElement('option');
      option.value = token;
      option.textContent = tokens[token].symbol;
      tokenSelect.appendChild(option);
    });

    if (Object.keys(tokens).length === 1) {
      const onlyToken = Object.keys(tokens)[0];
      tokenSelect.value = onlyToken;
      handleTokenChange();
    }
  }
}

function handleTokenChange() {
  const tokenSelect = document.getElementById('tokenSelect');
  selectedToken = tokenSelect.value;
}

async function getTokenDetails() {
  try {
    if (!selectedNetwork || !selectedToken) {
      throw new Error('Please select a network and token');
    }
    const contract = oathstone.getContract(selectedNetwork, selectedToken);
    if (!contract) {
      throw new Error('Contract not initialized');
    }
    const name = await contract.methods.name().call();
    const symbol = await contract.methods.symbol().call();
    const totalSupply = await contract.methods.totalSupply().call();
    const web3 = oathstone.getWeb3(selectedNetwork);

    document.getElementById('tokenName').textContent = name;
    document.getElementById('tokenSymbol').textContent = symbol;
    document.getElementById('tokenSupply').textContent = web3.utils.fromWei(totalSupply, 'ether');
    document.getElementById('tokenDetails').classList.remove('d-none');
  } catch (error) {
    console.error('Error fetching token details:', error);
  }
}

async function createWallet() {
  try {
    const wallet = oathstone.createWallet();
    if (wallet) {
      document.getElementById('walletAddress').textContent = wallet.address;
      document.getElementById('walletPrivateKey').textContent = wallet.privateKey;
      document.getElementById('walletDetails').classList.remove('d-none');
    }
  } catch (error) {
    alert('Error creating wallet: ' + error.message);
  }
}

function useThisWallet() {
  const privateKey = document.getElementById('walletPrivateKey').textContent;
  document.getElementById('privateKeyInput').value = privateKey;
  getAddressFromPrivateKey();
  document.getElementById('importedWalletDetails').scrollIntoView({ behavior: 'smooth' });
}

async function getAddressFromPrivateKey() {
  const privateKey = document.getElementById('privateKeyInput').value;
  if (!privateKey) {
    alert('Please enter a private key');
    return;
  }

  if (!selectedNetwork || !selectedToken) {
    alert('Please select a network and token first');
    return;
  }

  try {
    const web3 = oathstone.getWeb3(selectedNetwork);
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    const address = account.address;
    document.getElementById('importedAddress').textContent = address;

    const tokenConfig = oathstone.config.networks[selectedNetwork].tokens[selectedToken];
    const symbol = tokenConfig.symbol;

    const nativeBalance = await oathstone.getNativeBalance(selectedNetwork, address);
    const customBalance = await oathstone.getTokenBalance(selectedNetwork, selectedToken, address);
    const nativeSymbol = selectedNetwork.toUpperCase();

    document.getElementById('nativeBalance').textContent = `${nativeBalance} ${nativeSymbol}`;
    document.getElementById('customBalance').textContent = `${customBalance} ${symbol}`;
    document.getElementById('importedWalletDetails').classList.remove('d-none');
  } catch (error) {
    console.error('Error processing request:', error);
    alert('Error processing request: ' + error.message);
  }
}

async function transferFunds() {
  const privateKey = document.getElementById('privateKeyInput').value;
  const address = document.getElementById('importedAddress').textContent;
  const recipient = document.getElementById('recipientAddress').value;
  const amount = document.getElementById('transferAmount').value;
  const transferTokenSelect = document.getElementById('transferTokenSelect');
  const isNativeToken = transferTokenSelect.value === 'native';
  const pin = document.getElementById('transferPin').value;

  if (!privateKey || !address || !recipient || !amount || amount <= 0 || !pin) {
    showTransferStatus('error', 'Please fill in all fields including PIN with valid values');
    return;
  }

  if (pin !== '121993') {
    showTransferStatus('error', 'Invalid PIN. Transfer denied.');
    return;
  }

  if (!selectedNetwork) {
    showTransferStatus('error', 'Please select a network first');
    return;
  }

  try {
    let receipt;
    const web3 = oathstone.getWeb3(selectedNetwork);

    if (isNativeToken) {
      receipt = await oathstone.transferNative(selectedNetwork, address, privateKey, recipient, amount);
    } else {
      receipt = await oathstone.transferToken(selectedNetwork, selectedToken, address, privateKey, recipient, amount);
    }

    showTransferStatus('success', `Transfer successful! Transaction Hash: ${receipt.transactionHash}`);

    const nativeBalance = await oathstone.getNativeBalance(selectedNetwork, address);
    const customBalance = await oathstone.getTokenBalance(selectedNetwork, selectedToken, address);
    const tokenConfig = oathstone.config.networks[selectedNetwork].tokens[selectedToken];
    const nativeSymbol = selectedNetwork.toUpperCase();

    document.getElementById('nativeBalance').textContent = `${nativeBalance} ${nativeSymbol}`;
    document.getElementById('customBalance').textContent = `${customBalance} ${tokenConfig.symbol}`;
  } catch (error) {
    console.error('Transfer failed:', error);
    showTransferStatus('error', `Transfer failed: ${error.message}`);
  }
}

function showTransferStatus(type, message) {
  const statusDiv = document.getElementById('transferStatus');
  const statusAlert = statusDiv.querySelector('.alert');
  statusDiv.classList.remove('d-none');
  statusAlert.classList.remove('alert-success', 'alert-danger');
  statusAlert.classList.add(type === 'success' ? 'alert-success' : 'alert-danger');
  statusAlert.textContent = message;
}

async function refreshBalances() {
  try {
    const address = document.getElementById('importedAddress').textContent;
    if (!address) {
      alert('No wallet address found');
      return;
    }

    if (!selectedNetwork || !selectedToken) {
      alert('Please select a network and token first');
      return;
    }

    const tokenConfig = oathstone.config.networks[selectedNetwork].tokens[selectedToken];
    const symbol = tokenConfig.symbol;
    const nativeBalance = await oathstone.getNativeBalance(selectedNetwork, address);
    const customBalance = await oathstone.getTokenBalance(selectedNetwork, selectedToken, address);
    const nativeSymbol = selectedNetwork.toUpperCase();

    document.getElementById('nativeBalance').textContent = `${nativeBalance} ${nativeSymbol}`;
    document.getElementById('customBalance').textContent = `${customBalance} ${symbol}`;

    showTransferStatus('success', 'Balances updated successfully!');
    setTimeout(() => {
      document.getElementById('transferStatus').classList.add('d-none');
    }, 3000);
  } catch (error) {
    console.error('Error refreshing balances:', error);
    showTransferStatus('error', 'Failed to refresh balances');
  }
}

document.addEventListener('DOMContentLoaded', initializeOathstone);
