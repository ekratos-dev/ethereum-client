// load the things we need
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// define the schema for our user model
const ContractSchema = mongoose.Schema({
    address: String,
    name: String,
    abi: { type: Schema.Types.ObjectId, ref: 'Abi' },
    creationDate: { type: Date, default: Date.now }
}, { collection: 'ec_contracts' });

// create the model for users and expose it to our app
module.exports = mongoose.model('Contracts', ContractSchema);
