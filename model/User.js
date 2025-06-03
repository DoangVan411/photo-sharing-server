const { default: mongoose } = require("mongoose");

const userSchema = new mongoose.Schema({
    login_name: {type: String, required: true, unique: true},
    password: {type: String, required: true},
    first_name: {type: String, required: true},
    last_name: {type: String, required: true},
    location: {type: String},
    description: {type: String},
    occupation: {type: String},
    address: {type: String},
    birthday: {type: Date}
})

module.exports = mongoose.model('User', userSchema, 'user')