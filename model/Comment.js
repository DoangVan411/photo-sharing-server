const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  date_time: {
    type: Date,
    default: Date.now
  },
  comment: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  photo_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Photo',
    required: true
  }
});

module.exports = mongoose.model('Comment', commentSchema); 