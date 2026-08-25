const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

const connectDB = async () => {
  if (!MONGO_URI) {
    throw new Error('MONGO_URI no definido en .env');
  }

  await mongoose.connect(MONGO_URI);

  console.log('MongoDB conectado');
};

module.exports = connectDB;
