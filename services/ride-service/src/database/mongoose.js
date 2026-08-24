import mongoose from 'mongoose';

let connectionPromise = null;
let mongoConnected = false;

async function connectMongo(uri = process.env.MONGODB_URI) {
  if (!uri) {
    return null;
  }

  if (mongoose.connection.readyState === 1) {
    mongoConnected = true;
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });
  }

  await connectionPromise;
  mongoConnected = true;
  return mongoose.connection;
}

async function disconnectMongo() {
  connectionPromise = null;
  mongoConnected = false;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

function isMongoConnected() {
  return mongoConnected && mongoose.connection.readyState === 1;
}

export {
  mongoose,
  connectMongo,
  disconnectMongo,
  isMongoConnected,
};