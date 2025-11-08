const { MongoClient } = require('mongodb');

let db;

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.warn("MONGO_URI not set. Data will not be persisted.");
    return;
  }
  try {
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    db = client.db('aura'); // Using 'aura' as the database name
    console.log("MongoDB connected successfully.");
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  }
};

const getDB = () => db;

module.exports = { connectDB, getDB };
