# Ethereum Client

This project is a fork of https://www.npmjs.com/package/easy-ethereum-client

It likely works together with the Ethereum Service.

## Modules
This project contents different modules.

### Action Module
This module allows to create actions and their associated transactions.

##### New action
```js
let actionClient = await new Action("action-buy-car", userId, [{collectionName: "cars", collectionObjectId: "5c9b60a39d3e152f1891b921"}]);
```

##### New Transaction
```js
    var result = actionClient.transaction(
                    "setString",
                    [web3.utils.fromAscii("name"), "stringName"],
                    contractStorage.simple.address,
                    userAddress,
                    userPrivateKey,
                    transactionValue
            );
```

### Contract Module
This module allows to create and store into the mongo database the contracts you need on your project and for each one
their own abi.

```js
let saveContract = await ContractModule.saveContractAbi(contractStorage.simple.address, JSON.stringify(contractStorage.simple.abi), "SimpleContract");
```

Once you stored your contracts in the database, you can retrieve the contract information with their name, when you create
a transaction.

```js
 actionClient.transaction(
        "setSimpleInt",
        [15],
        contractName,
        userAddress.toLowerCase(),
        userPrivateKey,
        transactionValue
 );
```

### Event Module
This module allows to capture or emit new events with the EventEmitter.
Also, this model captures 3 predefined events:

- on('hash'): When we get the hash for a transaction that we send to the blockchain.

- on('error'): When the transaction fails. Also, this event emits another one, that can be treated externally with
  the action name:

```js
  transactionEvents.emit(actionObject.name + ".on-error", actionObject);
```

- on('validated'): When the transaction achieve the number of confirmations you set in the configuration file.
  Also, this event emits "actionName.on-completed" event if necessary. This only happens when all the transactions for
  a specific action have been finished successfully:

```js
  transactionEvents.emit(actionObject.name + ".on-completed", actionObject);
```

### Error Module
This Module allows to create a new Error, with a custom message and code.

```js
    const {ErrorWeb3} = require('../Modules/ErrorModule');
```

Use:
```js
    if(!trx){
            throw new ErrorWeb3("Transaction doesn't exist in the blockchain", ErrorWeb3.TRANSACTION_NOT_EXIST);
     }
```

# Ethereum Client Usage

Example of usage of the Ethereum Client:

```js
const {EthereumClient, Action, ContractModule} = require('ethereum-client-js');

const contractAddress = "0x";
const contractAbi = {};
const config = {
  project: "my-project",
  database: 'mongodb://localhost:27017/mydb',
  network: {
    name: "localhost",
    host: "http://127.0.0.1:8545",
  },

  rabbitQM: {
    connection: {
      name: 'default',
      host: 'localhost',
      user: 'guest',
      pass: 'guest'
    }
  },
  // Number of actions to process at the same time
  actionThreads: 10,
};

const EthereumClientPromise = async () => {
  EthereumClient.config(config.rabbitQM, config.network, config.project, config.database, config.actionThreads);
  console.log('Ethereum Client Configured');
  
  // Start Ethereum Client
  await EthereumClient.start();
  console.log('Ethereum Client Running');

  // Save contract abi
  try {
    await ContractModule.saveContractAbi(contractAddress, JSON.stringify(contractAbi), "my-contract");
    console.log('Smart Contract Read');
  } catch (e) {
    console.error('Error reading Smart Contract');
    process.exit();
  }
};

async function onCompleted(actionParam) {
  console.log("Completed");
  const event = await actionParam.getEvent("MyEvent");
  console.log(event);
}

async function onError(actionParam) {
  console.log("Error " + actionParam.name);
}

EthereumClientPromise().then(async () => {
    EthereumClient.on('my-action.on-completed', onCompleted);
    EthereumClient.on('my-action.on-error', onError);
    
    // Contract Call
    const senderAddress = "0x";
    const senderPk = "";
    const callParameters = [];
    const result = await EthereumClient.call("my-function", callParameters, contractAddress, senderAddress);
    console.log(result);
  
    // Send transaction
    const action = new Action("my-action");
    const transactionParameters = [];
    const transaction = action.transaction(
            "my-action",
            transactionParameters,
            contractAddress, senderAddress, senderPk, ""
    );
    await action.send();
})
```
