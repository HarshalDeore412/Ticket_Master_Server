const mongoose = require("mongoose");
const dotenv = require("dotenv").config();


const DBConnect = () => {
  mongoose.connect(process.env.DB_URL, {}).then(console.log("CONNECTED TO DATABASE WITH ZERO ERRORS -->>")).catch((error) => {
    console.log("error while connecting to database ", error)
  })
}

module.exports = DBConnect;