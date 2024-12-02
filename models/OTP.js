const mongoose = require("mongoose");

const OTPSchema = new mongoose.Schema({
    otp : {
        type : Number,
        require: true,
    }, date : {
        type : Date,
        default : Date.now,
        expires : 60*10
    }
})


module.exports = mongoose.model('OTP' , OTPSchema);
