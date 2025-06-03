const express = require('express');
const session = require('express-session');
const app = express();
require("dotenv").config();
const bcrypt = require('bcrypt')
const cors = require("cors");
const port = 3001;
const mongoose = require("mongoose")
const User = require('./model/User')
const Photo = require('./model/Photo')
const Comment = require('./model/Comment')
const multer = require('multer');
const path = require('path');

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

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'images/'))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

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
    if (!isMatch) {
      return res.status(400).send({ error: 'Incorrect password' })
    }
    req.session.user_id = user._id;
    req.session.save((err) => {
      if (err) {
        console.log('Session save error:', err);
        return res.status(500).send({ error: 'Session save failed' });
      }

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
  if (!req.session.user_id) {
    return res.status(400).send({ error: 'User is not logged in' });
  }
  req.session.destroy(err => {
    if (err) return res.status(500).send({ error: 'Logout failed' });
    res.send({ message: 'Logged out successfully' });
    console.log("Log out")
  });
});

app.get('/user/list', async(req, res) => {
  try {
    const users = await User.find().select("-__v");
    res.status(200).json(users);
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

app.post('/photos/new', upload.single('image'), async (req, res) => {
  try {
    console.log(req.file)
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.session.user_id) {
      return res.status(401).json({ error: 'Please login to upload photo' });
    }

    const newPhoto = new Photo({
      filename: req.file.filename,
      userId: req.session.user_id
    });

    await newPhoto.save();

    res.status(201).json({
      message: 'Upload photo successfully',
      photo: {
        id: newPhoto._id,
        filename: newPhoto.filename,
        uploadTime: newPhoto.uploadTime,
        userId: newPhoto.userId
      }
    });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ error: 'Server error when uploading photo' });
  }
});

app.post('/commentsOfPhoto/:photo_id', async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({ error: 'Please login to comment' });
    }

    const { comment } = req.body;
    const photo_id = req.params.photo_id;

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ error: 'Comment content cannot be empty' });
    }

    const photo = await Photo.findById(photo_id);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const newComment = new Comment({
      comment: comment.trim(),
      user: req.session.user_id,
      photo_id: photo_id
    });

    await newComment.save();

    // Populate user information before sending response
    await newComment.populate('user', 'first_name last_name');

    res.status(201).json({
      message: 'Create comment successfully',
      comment: {
        _id: newComment._id,
        date_time: newComment.date_time,
        comment: newComment.comment,
        user: {
          _id: newComment.user._id,
          first_name: newComment.user.first_name,
          last_name: newComment.user.last_name
        },
        photo_id: newComment.photo_id
      }
    });

  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Server error when creating comment' });
  }
});

app.get('/photos/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const photos = await Photo.find({ userId: userId });

    const photosWithComments = await Promise.all(photos.map(async (photo) => {
      const comments = await Comment.find({ photo_id: photo._id })
        .populate('user', 'first_name last_name') 
        .sort({ date_time: -1 }); 

      return {
        _id: photo._id,
        filename: photo.filename,
        url: `http://localhost:3001/images/${photo.filename}`,
        uploadTime: photo.uploadTime,
        userId: photo.userId,
        comments: comments.map(comment => ({
          _id: comment._id,
          date_time: comment.date_time,
          comment: comment.comment,
          user: {
            _id: comment.user._id,
            first_name: comment.user.first_name,
            last_name: comment.user.last_name
          }
        }))
      };
    }));

    res.json({
      user: {
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name
      },
      photos: photosWithComments
    });

  } catch (error) {
    console.error('Error fetching photos and comments:', error);
    res.status(500).json({ error: 'Server error when fetching data' });
  }
});

app.post('/user', async (req, res) => {
  const { login_name, password, first_name, last_name, location, description, occupation } = req.body;

  if (!login_name || !password || !first_name || !last_name) {
    return res.status(400).send({ error: 'Missing required fields' });
  }

  try {
    const existingUser = await User.findOne({ login_name });
    if (existingUser) {
      return res.status(400).send({ error: 'Login name already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      login_name,
      password: hashedPassword,
      first_name,
      last_name,
      location,
      description,
      occupation
    });

    await newUser.save();

    // Trả về thông tin user (không bao gồm password)
    res.status(201).send({
      _id: newUser._id,
      login_name: newUser.login_name,
      first_name: newUser.first_name,
      last_name: newUser.last_name,
      location: newUser.location,
      description: newUser.description,
      occupation: newUser.occupation
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).send({ error: 'Server error during registration' });
  }
});

app.use("/images", express.static(path.join(__dirname, "./images")));

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
