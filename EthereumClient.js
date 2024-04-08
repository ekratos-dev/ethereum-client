const ContractModule = require('./modules/ContractModule');
const EventModule = require ('./modules/EventModule');

const util = require("util");
const Rabbot = require('rabbot');
const Rabbus = require("rabbus");

const mongoose = require('mongoose');
mongoose.Promise = require('bluebird');

const Web3 = require('web3');
web3 = new Web3(new Web3.providers.HttpProvider(""));

let quiet= false;
let DBConfig= "";
let RabbitMQConfig= {};
let network= {};
let project= "";
let ActionThreads = 1;
EventModule.on('sendTransaction',function(transactionObject){
    sendTransaction(transactionObject);
});

const wait = (ms) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
};

async function waitForEmittedEvents() {
    if (EventModule.getCurrentEvents() === 0) return;
    await wait(250);
    return await waitForEmittedEvents();
}

async function close() {
    // Wait for current events
    await waitForEmittedEvents();
    // Stop queue connections
    Rabbot.closeAll();
}

let transactionSender = null;
let callRequester= null;
let actionReceiver = null;
// define the transactionSender
// ------------------

function TransactionSender(network_name){
    Rabbus.Sender.call(this, Rabbot, {
        exchange:  { name: 'transactions', type: 'topic', autoDelete: false, durable:true,persistent:true},
        routingKey: network_name
    });
}
util.inherits(TransactionSender, Rabbus.Sender);

// define a call requester
// ------------------

function CallRequester(network_name){
    Rabbus.Requester.call(this, Rabbot, {
        exchange: { name: 'calls', type: 'topic', autoDelete: false, durable:true,persistent:false},
        routingKey: network_name
    });
}
util.inherits(CallRequester, Rabbus.Requester);

// define action Receiver
// -------------------

function ActionReceiver(project_name,ActionThreads){
    Rabbus.Receiver.call(this, Rabbot, {
        exchange:  { name: 'actions', type: 'topic', autoDelete: false, durable:true,persistent:true},
        queue:  { name: 'actions-'+project_name, autoDelete: false,durable:true,noBatch:true,limit:ActionThreads},
        routingKey: project_name
    });
}
util.inherits(ActionReceiver, Rabbus.Receiver);

// start Rabbitmq connection

function start(){

    return Rabbot.configure(RabbitMQConfig).then(() => {

        //set Call Requester
        callRequester=new CallRequester(network.name);

        //set Transaction Sender
        transactionSender = new TransactionSender(network.name);
        // basic error handler
        transactionSender.use(function(err, msg, propers, actions, next){
            setImmediate(function(){ throw err; });
        });

        //set Action Receiver
        actionReceiver = new ActionReceiver(project,ActionThreads);

        // basic error handler
        actionReceiver.receive(function(msgAction, propsAction, actionsAction, nextAction){
            if (!quiet) console.log("action received with name: " + msgAction.event.name);
            EventModule.emit(msgAction.event.name, msgAction);
            actionsAction.ack();
        });

    }).then(()=> {

        return mongoose.connect(DBConfig);

    }).catch(function (e) {
        console.error("ERROR");
        console.error(e.message);
        //process.exit();
    });
}

async function sendTransaction(transaction){
    if (!quiet) console.log("  Function: " + transaction.functionName + ". Parameters: " + JSON.stringify(transaction.params));

    transactionSender.send(transaction, function(){
        if (!quiet) console.log("published transaction "+transaction.transactionId);
    });
}

async function getTransactionData(functionName, parameters = [], contractValue, senderAddress, senderPrivateKey, transactionValue) {

    const transactionValues = {};

    try {

        let contractInfo = await ContractModule.getContractAbi(contractValue.toString());

        if(contractInfo != null){

            // Get data by params
            if (parameters === null) {
                parameters = [];
            }

            //Get Contract Data
            const contract = new web3.eth.Contract(contractInfo.contractAbi, contractInfo.contractAddress);
            const data = contract.methods[functionName].apply(null, parameters).encodeABI();

            //Return Prepared transaction
            transactionValues.functionName = functionName;
            transactionValues.senderAddress = senderAddress;
            transactionValues.senderPrivateKey = senderPrivateKey;
            transactionValues.toAddress =  contractInfo.contractAddress;
            transactionValues.data = data;
            transactionValues.params = parameters;
            transactionValues.value = transactionValue;
            transactionValues.project = project;
        }

        return transactionValues;

    } catch (e) {
        console.error("Function: " + functionName);
        console.error("Parameters: ");
        console.error(parameters);
        console.error(e);
        return null;
    }
}

function call(functionName, parameters = [], contractValue,fromAddress) {
    return new Promise( async function(resolve,reject){

        if (!quiet) console.log('Call:');
        if (!quiet) console.log('    function: '+functionName);
        if (!quiet) console.log('    param: '+JSON.stringify(parameters));
        if (!quiet) console.log('    contract: '+contractValue);
        if (!quiet) console.log('    from: '+fromAddress);

        let senderAddress = fromAddress;

        if (!quiet) console.log('    sender: '+senderAddress);

        let contractInfo = await ContractModule.getContractAbi(contractValue.toString());
        if (!contractInfo) return reject(new Error('Contract Information Not Found in Database'));

        const contract = new web3.eth.Contract(contractInfo.contractAbi,contractInfo.contractAddress);

        const callData = contract.methods[functionName].apply(null, parameters).encodeABI();
        let msg = {from: senderAddress, to: contractInfo.contractAddress, data: callData};

        callRequester.on('error',function(e){
            reject(e);
        });

        callRequester.request(msg,function (response) {
            if (!quiet) console.log("    response: " + JSON.stringify(response));
            const abi = contract.options.jsonInterface;
            const methodAbi = abi.find(method => method.name === functionName && method.type === 'function');
            const outputs = methodAbi.outputs;
            const out = web3.eth.abi.decodeParameters(outputs, response);
            resolve(out);
        });
    })
}

function config(RabbitMQConfig_,network_,project_,DBConfig_,ActionThreads_,quiet_=false){
    RabbitMQConfig = RabbitMQConfig_;
    network = network_;
    project = project_;
    DBConfig = DBConfig_;
    ActionThreads = ActionThreads_;
    quiet = quiet_;
    EventModule.setQuiet(quiet);
}

module.exports = {
    start:start,
    on: EventModule.on,
    emit: EventModule.emit,
    call: call,
    sendTransaction: sendTransaction,
    getTransactionData: getTransactionData,
    config: config,
    close: close
};
