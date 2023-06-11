const mongoose = require("mongoose")

accountSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    created: {
        type: Date,
        default: Date.now
    },
    admin: {
        type: Boolean,
        default: false
    }
})

module.exports = mongoose.model("Account", accountSchema)