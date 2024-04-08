// load the things we need
const mongoose = require('mongoose');

// define the schema for our user model
const Schema = mongoose.Schema({
    text: String,
    creationDate: { type: Date, default: Date.now }
}, { collection: 'ec_abis' });

// create the model for users and expose it to our app
module.exports = mongoose.model('Abi', Schema);
