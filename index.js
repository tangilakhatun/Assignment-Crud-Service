const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.USERNAME_BD}:${process.env.USERNAME_PASSWORD}@cluster0.ri8wtve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let simpleCardCollection;

async function run() {
  try {
   
    await client.connect();
    const db = client.db("sampleCars_db");
    simpleCardCollection = db.collection("sampleCars");

    console.log("sucssesfuly Connected to MongoDB");

    app.listen(port, () => {
      console.log(`simple crud server is running on port ${port}`);
    });
  } catch (error) {
    console.error(" MongoDB connection error:", error);
  }
}

run();



// Get all cards
app.get("/api/cards", async (req, res) => {
  try {
    const cards = await simpleCardCollection.find().sort({ createdAt: -1 }).toArray();
    res.json(cards);
  } catch (error) {
    console.error(" Error fetching cards:", error);
    res.status(500).json({ message: "Server error" });
  }
});


app.get("/", (req, res) => {
  res.send(" simple crud server is running successfully");
});
