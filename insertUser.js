const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("./User"); 

// Thay đổi theo connection string MongoDB Atlas của bạn
const mongoUrl = "mongodb+srv://admin:123@photo.qmjv0is.mongodb.net/photo-sharing?retryWrites=true&w=majority&appName=photo";

async function insertUser() {
  try {
    await mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("Kết nối MongoDB thành công");

    const hashedPassword = await bcrypt.hash("123", 10); // Mật khẩu gốc là '123456'

    const newUser = new User({
      login_name: "van",
      password: hashedPassword,
      first_name: "Vân",
      last_name: "Đoàn"
    });

    await newUser.save();
    console.log("Thêm user thành công:", newUser);
  } catch (error) {
    console.error("Lỗi:", error);
  } finally {
    mongoose.disconnect();
  }
}

insertUser();
