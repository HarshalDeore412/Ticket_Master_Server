const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  process: { type: String, required: true },
  deskNo: {
    type: String,
    required: true,
  },
  issue: {
    type: String,
    required: true,
  },
  description: { type: String, required: true },
  dateTime: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["Open", "Processing", "Closed"],
    default: "Open",
  },
  Note: {
    type: String,
    required: false,
  },

  empID: { type: Number, required: true },
  Image : {
    type : String,
  }
});

const Ticket = mongoose.model("Ticket", ticketSchema);
module.exports = Ticket;
