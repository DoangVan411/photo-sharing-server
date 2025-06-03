const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  uploadTime: {
    type: Date,
    default: Date.now
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

module.exports = mongoose.model('Photo', photoSchema);
