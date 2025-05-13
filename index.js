const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// mongoDB connection
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tu4i6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const medicineCollection = client.db("MediTrustDB").collection("medicines");
    const cartCollection = client.db("MediTrustDB").collection("carts");
    const userCollection = client.db("MediTrustDB").collection("users");
    const categoryCollection = client
      .db("MediTrustDB")
      .collection("categories");

    // ---------  medicines related API
    app.get("/medicines", async (req, res) => {
      const result = await medicineCollection.find().toArray();
      res.send(result);
    });

    app.post("/medicine", async (req, res) => {
      const medicineItem = req.body;
      const result = await medicineCollection.insertOne(medicineItem);
      res.send(result);
    });

    // ---------  Carts collection API
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    // -------- category related API
    app.post("/category", async (req, res) => {
      const categoryItem = req.body;
      const result = await categoryCollection.insertOne(categoryItem);
      res.send(result);
    });

    app.get("/categories", async (req, res) => {
      const result = await categoryCollection.find().toArray();
      res.send(result);
    });

    //  ------- users related API
    app.post("/users", async (req, res) => {
      const user = req.body;

      // insert email if user doesn't exists
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // api to get all users
    app.get("/allUsers", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // api to get specific user using email as query
    app.get("/users", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    // patch to update user role
    app.patch("/user/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      let updatedDoc = {};
      const update = req.body.role;
      if (update) {
        updatedDoc = {
          $set: {
            role: update,
          },
        };
      }

      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // checking admin api
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let isAdmin = false;
      if (user) {
        isAdmin = user?.role === "admin";
      }
      res.send({ isAdmin });
    });

    // checking seller api
    app.get("/users/seller/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let isSeller = false;
      if (user) {
        isSeller = user?.role === "seller";
      }
      res.send({ isSeller });
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("MediTrust server");
});

app.listen(port, () => {
  console.log(`MediTrust server is at ${port}`);
});
