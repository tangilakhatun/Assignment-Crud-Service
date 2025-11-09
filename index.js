const express = require("express");

const { MongoClient, ServerApiVersion } = require('mongodb');
require("dotenv").config()
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());



const uri =
  `mongodb+srv://${process.env.USERNAME_BD}:${process.env.USERNAME_PASSWORD}@cluster0.ri8wtve.mongodb.net/?appName=Cluster0`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    
    await client.connect();
    
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    
    await client.close();
  }
}
run().catch(console.dir);






app.get("/", (req, res) => {
  res.send("simple crud server is running");
});

app.listen(port, () => {
  console.log(`simple crud server is running on port ${port}`);
});