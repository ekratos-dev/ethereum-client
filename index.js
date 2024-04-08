const EthereumClient = require('./EthereumClient');
const ContractModule = require('./modules/ContractModule');
const EventModule = require('./modules/EventModule');
const ParserModule = require('./modules/ParserModule');
const ErrorModule = require('./modules/ErrorModule');
const Transactions = require('./models/transaction');
const Action = require('./modules/Action')(EthereumClient);

module.exports = {
    EthereumClient: EthereumClient,
    Action: Action,
    ContractModule: ContractModule,
    EventModule: EventModule,
    ParserModule: ParserModule,
    ErrorWeb3: ErrorModule,
    Transaction: Transactions
};