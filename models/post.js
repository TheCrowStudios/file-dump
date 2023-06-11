const mongoose = require("mongoose")

const postSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    fileName: {
        type: String
    },
    originalFileName: {
        type: String
    },
    files: {
        type: [ String ]
    },
    userId: {
        type: String,
        required: true
    },
    size: {
        type: Number
    },
    created: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model("Post", postSchema)