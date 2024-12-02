const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  empID: { type: Number, required: true, unique: true },
  process: {
    type: String,
    required: true,
  },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  password: { type: String, required: true },
  date: { type: Date, default: Date.now },
  tickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }]
});

const User = mongoose.model('User', userSchema);
module.exports = User;
