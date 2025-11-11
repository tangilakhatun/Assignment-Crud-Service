const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const cors = require("cors");
const app = express();
const admin = require("firebase-admin");
const serviceAccount = require("./service.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.USERNAME_BD}:${process.env.USERNAME_PASSWORD}
@cluster0.ri8wtve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db, simpleCardCollection, carsCol, bookingsCol;

async function verifyFirebaseTokenMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const idToken = authHeader.split(" ")[1];
  if (!idToken) return res.status(401).json({ message: "No token provided" });

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email,
    };
    next();
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: "Invalid Firebase token" });
  }
}


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

app.get('/api/cards/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const card = await simpleCardCollection.findOne({ _id: new ObjectId(id) });
    if (!card) return res.status(404).json({ message: 'Card not found' });
    res.json(card);
  } catch (err) {
    console.error("Error fetching single card:", err);
    res.status(500).json({ message: 'Server error' });
  }
});

// car cruc 
app.post("/cars", verifyFirebaseTokenMiddleware, async (req, res) => {
      try {
        const { carName, description, category, rentPricePerDay, location, imageUrl } = req.body;
        if (!carName || !description || !rentPricePerDay)
          return res.status(400).json({ message: "Fill all required fields" });

        const doc = {
          carName,
          description,
          category: category || "General",
          rentPricePerDay: Number(rentPricePerDay),
          location: location || "Unknown",
          imageUrl: imageUrl || null,
          status: "Available",
          ownerEmail: req.user.email,
          createdAt: new Date(),
        };

        const result = await carsCol.insertOne(doc);
        res.status(201).json({ message: " Car added", carId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
    });

    app.get("/cars", async (req, res) => {
      try {
        const q = req.query.q;
        let filter = {};
        if (q) filter.carName = { $regex: q, $options: "i" };
        const cars = await carsCol.find(filter).sort({ createdAt: -1 }).toArray();
        res.json(cars);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
    });

    app.get("/cars/:id", async (req, res) => {
      try {
        const car = await carsCol.findOne({ _id: new ObjectId(req.params.id) });
        if (!car) return res.status(404).json({ message: "Car not found" });
        res.json(car);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
    });

    

app.get("/", (req, res) => {
  res.send(" simple crud server is running successfully");
});
