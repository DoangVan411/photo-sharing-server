const express = require("express");
const app = express();
require("dotenv").config();
const bcrypt = require("bcrypt");
const cors = require("cors");
const port = 3001;
const mongoose = require("mongoose");
const User = require("./model/User");
const Photo = require("./model/Photo");
const Comment = require("./model/Comment");
const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken");

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connect successfully"))
  .catch((err) => console.error("Connect failed", err));

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || "your-secret-key",
    (err, user) => {
      if (err) {
        return res.status(403).json({ error: "Invalid token" });
      }
      req.user = user;
      next();
    }
  );
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "images/"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

app.post("/admin/login", async (req, res) => {
  const { login_name, password } = req.body;

  if (!login_name || !password) {
    return res.status(400).send({ error: "Missing login_name or password" });
  }

  try {
    const user = await User.findOne({ login_name });

    if (!user) {
      return res.status(400).send({ error: "Cannot find user" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send({ error: "Incorrect password" });
    }

    const token = jwt.sign(
      {
        _id: user._id,
        login_name: user.login_name,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: {
        _id: user._id,
        login_name: user.login_name,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    });
  } catch (err) {
    res.status(500).send({ error: "Server error" });
  }
});

app.post('/admin/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

app.get("/user/list", async (req, res) => {
  try {
    const users = await User.find().select("-__v");
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.get("/users/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const user = await User.findById(userId).select("-__v");
    console.log(user);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post(
  "/photos/new",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const newPhoto = new Photo({
        filename: req.file.filename,
        userId: req.user._id,
      });

      await newPhoto.save();

      res.status(201).json({
        message: "Upload photo successfully",
        photo: {
          id: newPhoto._id,
          filename: newPhoto.filename,
          uploadTime: newPhoto.uploadTime,
          userId: newPhoto.userId,
        },
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
      res.status(500).json({ error: "Server error when uploading photo" });
    }
  }
);

app.post("/commentsOfPhoto/:photo_id", authenticateToken, async (req, res) => {
  try {
    const { comment } = req.body;
    const photo_id = req.params.photo_id;

    if (!comment || comment.trim() === "") {
      return res.status(400).json({ error: "Comment content cannot be empty" });
    }

    const photo = await Photo.findById(photo_id);
    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    const newComment = new Comment({
      comment: comment.trim(),
      user: req.user._id,
      photo_id: photo_id,
    });

    await newComment.save();
    await newComment.populate("user", "first_name last_name");

    res.status(201).json({
      message: "Create comment successfully",
      comment: {
        _id: newComment._id,
        date_time: newComment.date_time,
        comment: newComment.comment,
        user: {
          _id: newComment.user._id,
          first_name: newComment.user.first_name,
          last_name: newComment.user.last_name,
        },
        photo_id: newComment.photo_id,
      },
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ error: "Server error when creating comment" });
  }
});

app.get("/photos/user/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const photos = await Photo.find({ userId: userId });

    const photosWithComments = await Promise.all(
      photos.map(async (photo) => {
        const comments = await Comment.find({ photo_id: photo._id })
          .populate("user", "first_name last_name")
          .sort({ date_time: -1 });

        return {
          _id: photo._id,
          filename: photo.filename,
          url: `https://ngl6xs-3001.csb.app/images/${photo.filename}`,
          uploadTime: photo.uploadTime,
          userId: photo.userId,
          comments: comments.map((comment) => ({
            _id: comment._id,
            date_time: comment.date_time,
            comment: comment.comment,
            user: {
              _id: comment.user._id,
              first_name: comment.user.first_name,
              last_name: comment.user.last_name,
            },
          })),
        };
      })
    );

    res.json({
      user: {
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      photos: photosWithComments,
    });
  } catch (error) {
    console.error("Error fetching photos and comments:", error);
    res.status(500).json({ error: "Server error when fetching data" });
  }
});

app.post("/user", async (req, res) => {
  const {
    login_name,
    password,
    first_name,
    last_name,
    location,
    description,
    occupation,
  } = req.body;

  if (!login_name || !password || !first_name || !last_name) {
    return res.status(400).send({ error: "Missing required fields" });
  }

  try {
    const existingUser = await User.findOne({ login_name });
    if (existingUser) {
      return res.status(400).send({ error: "Login name already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      login_name,
      password: hashedPassword,
      first_name,
      last_name,
      location,
      description,
      occupation,
    });

    await newUser.save();

    res.status(201).send({
      _id: newUser._id,
      login_name: newUser.login_name,
      first_name: newUser.first_name,
      last_name: newUser.last_name,
      location: newUser.location,
      description: newUser.description,
      occupation: newUser.occupation,
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).send({ error: "Server error during registration" });
  }
});

app.use("/images", express.static(path.join(__dirname, "./images")));

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
