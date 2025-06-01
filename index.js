// index.js
const express = require('express');
const session = require('express-session');
const app = express();
require("dotenv").config();
const bcrypt = require('bcrypt')
const cors = require("cors");
const port = 3001;
const mongoose = require("mongoose")
const User = require('./User')

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connect successfully"))
  .catch((err) => console.error("Connect failed", err))

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}))
app.use(express.json());
app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  name: 'connect.sid',
  cookie: { 
    secure: false,
    httpOnly: false,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    domain: 'localhost'
  }
}));


app.post('/admin/login', async (req, res) => {
  const { login_name, password } = req.body

  if (!login_name || !password) {
    return res.status(400).send({ error: 'Missing login_name or password' })
  }

  try {
    const user = await User.findOne({ login_name })

    if (!user) {
      return res.status(400).send({ error: 'Cannot find user' })
    }
    const isMatch = await bcrypt.compare(password, user.password)
    console.log(isMatch)
    if (!isMatch) {
      return res.status(400).send({ error: 'Incorrect password' })
    }
    req.session.user_id = user._id;
    console.log('After setting user_id:', req.session.user_id);
    console.log('Full session after login:', req.session);
    console.log('Session ID after login:', req.sessionID);
    req.session.save((err) => {
      if (err) {
        console.log('Session save error:', err);
        return res.status(500).send({ error: 'Session save failed' });
      }

      console.log('Session saved successfully');
      console.log('Session after save:', req.session);

      res.send({
        _id: user._id,
        login_name: user.login_name,
        first_name: user.first_name,
        last_name: user.last_name
      });
    });
  } catch (err) {
    res.status(500).send({ error: 'Server error' });
  }
})

app.post('/admin/logout', (req, res) => {
  console.log('Session ID:', req.sessionID);
  console.log('Session data:', req.session);
  console.log('User ID from session:', req.session.user_id);
  if (!req.session.user_id) {
    return res.status(400).send({ error: 'User is not logged in' });
  }
  req.session.destroy(err => {
    if (err) return res.status(500).send({ error: 'Logout failed' });
    res.send({ message: 'Logged out successfully' });
    console.log("Log out")
  });
});

app.get('/users', async(req, res) => {
  try {
    const users = await User.find().select("-__v");
    console.log("Users from DB:", users);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
})

app.get('/users/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    const user = await User.findById(userId).select("-__v");
    console.log(user)
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Khởi động server
app.listen(port, () => {
  console.log(`Server đang chạy tại http://localhost:${port}`);
});
