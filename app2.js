import Oathstone from './oathstone.js';
import Web3 from 'web3';
import express from 'express';
import path from 'path'; // Used for resolving file paths

// Initialize Oathstone instance
const oathstone = new Oathstone();

// Create an Express app
const app = express();

// Middleware to parse incoming JSON data (form submission)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fetch contract details
export async function fetchContractDetails(oathstoneInstance) {
  try {
    await oathstoneInstance.connectNetwork();
    oathstoneInstance.loadContract();

    if (oathstoneInstance.contract) {
      try {
        const name = await oathstoneInstance.contract.methods.name().call();
        const symbol = await oathstoneInstance.contract.methods.symbol().call();
        const initialSupply = await oathstoneInstance.contract.methods.initialSupply().call();

        return {
          name,
          symbol,
          initialSupply: oathstoneInstance.web3.utils.fromWei(initialSupply, 'ether'),
        };
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

// Handle contract updates (form submission)
app.post('/update-contract', async (req, res) => {
  const { name, symbol, initialSupply, privateKey } = req.body;

  if (!privateKey) {
    return res.status(400).send("Private key is required");
  }

  try {
    await oathstone.connectNetwork();
    await oathstone.loadContract();
    if (oathstone.contract) {
      // Set the user's private key
      const web3 = oathstone.web3;
      web3.eth.accounts.wallet.add(privateKey);
      const account = web3.eth.accounts.wallet[0].address;

      // Convert initial supply to Wei
      const supplyInWei = web3.utils.toWei(initialSupply, 'ether');

      // Call the contract's setter methods (assuming these methods are available)
      await oathstone.contract.methods.setName(name).send({ from: account });
      await oathstone.contract.methods.setSymbol(symbol).send({ from: account });
      await oathstone.contract.methods.setInitialSupply(supplyInWei).send({ from: account });

      res.send("Contract updated successfully!");
    } else {
      res.status(400).send("Contract instance not loaded.");
    }
  } catch (error) {
    console.error("Error updating contract:", error);
    res.status(500).send("Error updating contract");
  }
});

// Serve the contract details at an API endpoint
app.get('/contract-details', async (req, res) => {
  try {
    const contractDetails = await fetchContractDetails(oathstone);
    res.json(contractDetails);
  } catch (error) {
    res.status(500).send('Error fetching contract details');
  }
});

// Serve the index.html file
app.get('/', (req, res) => {
  const filePath = path.resolve('./index.html');  // Resolving the path to index.html
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error serving index.html:", err);
      res.status(500).send("Error serving index.html");
    }
  });
});

// Start the server on port 3000
app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});

// Entry point
(async () => {
  await fetchContractDetails(oathstone);
})();


