const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const cors = require("cors");
const admin = require("firebase-admin");
const serviceAccount = require("./service.json");

const app = express();


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


app.use(
  cors({
    origin: [
      "http://localhost:5173", 
      "https://gleeful-hamster-5db8bf.netlify.app", 
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());

const uri = `mongodb+srv://${process.env.USERNAME_BD}:${process.env.USERNAME_PASSWORD}@cluster0.ri8wtve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db, simpleCardCollection,usersCol, carsCol, bookingsCol;

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
    db = client.db("sampleCars_db");
     usersCol = db.collection("users"); 
    simpleCardCollection = db.collection("sampleCars");
    carsCol = simpleCardCollection;
    bookingsCol = db.collection("bookings");

    console.log(" Connected to MongoDB successfully");
  } catch (error) {
    console.error(" MongoDB connection error:", error);
  }
}

run();

// user post route 
app.post("/users", verifyFirebaseTokenMiddleware, async (req, res) => {
  try {
    const { uid, email, name } = req.user;

    const isExist = await usersCol.findOne({ uid });
    if (isExist) {
      return res.send({ message: "User already exists" });
    }

    const newUser = {
      uid,
      name,
      email,
      role: "user",
      createdAt: new Date(),
    };

    const result = await usersCol.insertOne(newUser);
    res.status(201).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Server error" });
  }
});

  
// user email role base 
app.get("/users/role/:email", verifyFirebaseTokenMiddleware, async (req, res) => {
  try {
    const email = req.params.email;

    // security check
    if (req.user.email !== email) {
      return res.status(403).send({ message: "Forbidden access" });
    }

    const user = await usersCol.findOne({ email });

    res.send({ role: user?.role || "user" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Server error" });
  }
});

// update profile 
app.put("/users/profile", verifyFirebaseTokenMiddleware, async (req, res) => {
  const { name, photo, phone, address } = req.body;

  const result = await usersCol.updateOne(
    { email: req.user.email },
    {
      $set: {
        name,
        photo,
        phone,
        address,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  res.send({ success: true, result });
});


//  Root route
app.get("/", (req, res) => {
  res.send(" Car Rental Server is running successfully!");
});

//  Get all cards
app.get("/api/cards", async (req, res) => {
  try {
    const cards = await simpleCardCollection.find().sort({ createdAt: -1 }).toArray();
    res.json(cards);
  } catch (error) {
    console.error("Error fetching cards:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/cards/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const card = await simpleCardCollection.findOne({ _id: new ObjectId(id) });
    if (!card) return res.status(404).json({ message: "Card not found" });
    res.json(card);
  } catch (err) {
    console.error("Error fetching single card:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//  Car CRUD
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
    res.status(201).json({ message: "Car added", carId: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/cars", async (req, res) => {
  try {
    const q = req.query.q;
    let filter = {};
    if (q) filter.name = { $regex: q, $options: "i" };
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

app.put("/cars/:id", verifyFirebaseTokenMiddleware, async (req, res) => {
  try {
    const car = await carsCol.findOne({ _id: new ObjectId(req.params.id) });
    if (!car) return res.status(404).json({ message: "Car not found" });
    if (car.ownerEmail !== req.user.email) return res.status(403).json({ message: "Forbidden" });

    const updates = req.body;
    delete updates.ownerEmail;
    await carsCol.updateOne({ _id: new ObjectId(req.params.id) }, { $set: updates });
    res.json({ message: "Car updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/cars/:id", verifyFirebaseTokenMiddleware, async (req, res) => {
  try {
    const car = await carsCol.findOne({ _id: new ObjectId(req.params.id) });
    if (!car) return res.status(404).json({ message: "Car not found" });
    if (car.ownerEmail !== req.user.email) return res.status(403).json({ message: "Forbidden" });

    await carsCol.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: "Car deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// Dashboard stats
app.get("/dashboard/stats", verifyFirebaseTokenMiddleware, async (req, res) => {
  try {
    const totalCars = await carsCol.countDocuments();
    const availableCars = await carsCol.countDocuments({ status: "Available" });
    const totalBookings = await bookingsCol.countDocuments();
    const totalUsers = await usersCol.countDocuments();

    res.json({
      totalCars,
      availableCars,
      totalBookings,
      totalUsers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Car availability for chart
app.get("/dashboard/car-availability", verifyFirebaseTokenMiddleware, async (req, res) => {
  try {
    const availableCars = await carsCol.countDocuments({ status: "Available" });
    const bookedCars = await carsCol.countDocuments({ status: "Booked" });
    res.json([
      { name: "Available", value: availableCars },
      { name: "Booked", value: bookedCars },
    ]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Bookings over time
app.get("/dashboard/bookings-over-time", verifyFirebaseTokenMiddleware, async (req, res) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];
    const data = await bookingsCol.aggregate(pipeline).toArray();
    res.json(data.map(item => ({ date: item._id, count: item.count })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Recent bookings
app.get("/dashboard/recent-bookings", verifyFirebaseTokenMiddleware, async (req, res) => {
  try {
    const recent = await bookingsCol.find().sort({ createdAt: -1 }).limit(5).toArray();
    res.json(recent);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});




app.post("/bookings", verifyFirebaseTokenMiddleware, async (req, res) => {
  try {
    const { carId, startDate, endDate } = req.body;
    if (!carId || !startDate || !endDate) return res.status(400).json({ message: "Fill all fields" });

    const car = await carsCol.findOne({ _id: new ObjectId(carId) });
    if (!car) return res.status(404).json({ message: "Car not found" });
    if (car.status === "Booked") return res.status(409).json({ message: "Car already booked" });

    const booking = {
      carId: new ObjectId(carId),
      carName: car.carName,
      providerEmail: car.ownerEmail,
      userEmail: req.user.email,
      userName: req.user.name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      createdAt: new Date(),
    };

    const result = await bookingsCol.insertOne(booking);
    await carsCol.updateOne({ _id: new ObjectId(carId) }, { $set: { status: "Booked" } });

    res.status(201).json({ message: "Booking successful", bookingId: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/my-bookings", verifyFirebaseTokenMiddleware, async (req, res) => {
  try {
    const bookings = await bookingsCol.find({ userEmail: req.user.email }).sort({ createdAt: -1 }).toArray();
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/bookings/:id", verifyFirebaseTokenMiddleware, async (req, res) => {
  try {
    const booking = await bookingsCol.findOne({ _id: new ObjectId(req.params.id) });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.userEmail !== req.user.email) return res.status(403).json({ message: "Forbidden" });

    await bookingsCol.deleteOne({ _id: new ObjectId(req.params.id) });
    await carsCol.updateOne({ _id: new ObjectId(booking.carId) }, { $set: { status: "Available" } });

    res.json({ message: "Booking cancelled" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = app;
