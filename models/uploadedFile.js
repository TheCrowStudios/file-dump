const mongoose = require("mongoose")

const uploadedFileSchema = new mongoose.Schema({
    fileName: {
        type: String,
        required: true
    },
    originalFileName: {
        type: String,
        required: true
    }
})

module.exports = mongoose.model("File", uploadedFileSchema)