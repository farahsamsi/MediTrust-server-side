const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

const SSLCommerzPayment = require("sslcommerz-lts");
const store_id = `${process.env.store_ID}`;
const store_passwd = `${process.env.store_KEY}`;
const is_live = false; //true for live, false for sandbox

const port = process.env.PORT || 5000;

// mongoDB connection
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tu4i6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// middleware
app.use(cors());
app.use(express.json());

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
    const orderCollection = client.db("MediTrustDB").collection("orders");
    const categoryCollection = client
      .db("MediTrustDB")
      .collection("categories");

    // _________________bill payment APIs
    app.post("/order", async (req, res) => {
      const order = req.body;
      order.product_name = order.items
        .map((item) => item.medicineName)
        .join(", ");

      const tran_id = new ObjectId().toString();

      const data = {
        total_amount: order?.totalBill, // dynamic
        currency: "BDT",
        tran_id: tran_id, // use unique tran_id for each api call
        // success_url: `http://localhost:5000/payment/success/${tran_id}`,
        success_url: `https://medi-trust-server-side.vercel.app/payment/success/${tran_id}`,
        // fail_url: `http://localhost:5000/payment/fail/${tran_id}`,
        fail_url: `https://medi-trust-server-side.vercel.app/payment/fail/${tran_id}`,
        cancel_url: "http://localhost:3030/cancel",
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: order.product_name,
        product_category: "Medicine",
        product_profile: "general",
        cus_name: order?.buyerName,
        cus_email: order?.buyerEmail,
        cus_add1: order?.buyerAddress,
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: order?.postCode,
        cus_country: "Bangladesh",
        cus_phone: order?.contactNumber,
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };

      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then(async (apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });

        const finalOrder = {
          order,
          transactionID: tran_id,
          paymentStatus: "pending",
          transactionDate: new Date(),
        };
        const result = await orderCollection.insertOne(finalOrder);

        // console.log("Redirecting to: ", GatewayPageURL);
      });
    });

    // payment SUCCESS URL
    app.post("/payment/success/:tranId", async (req, res) => {
      const result = await orderCollection.updateOne(
        { transactionID: req.params.tranId },
        {
          $set: {
            paymentStatus: "paid",
          },
        }
      );
      if (result.modifiedCount > 0) {
        res.redirect(
          `http://localhost:5173/payment/success/${req.params.tranId}`
          // `https://medibazaar-94fd8.web.app/payment/success/${req.params.tranId}`
        );
      }
    });

    // payment FAIL URL
    app.post("/payment/fail/:tranId", async (req, res) => {
      const result = await orderCollection.deleteOne({
        transactionID: req.params.tranId,
      });
      if (result.deletedCount > 0) {
        res.redirect(`http://localhost:5173/payment/fail/${req.params.tranId}`);
        // res.redirect(
        //   `https://medibazaar-94fd8.web.app/payment/fail/${req.params.tranId}`
        // );
      }
    });

    // get buying details using transaction id
    app.get("/order/:tranId", async (req, res) => {
      const tranId = req.params.tranId;
      const result = await orderCollection.findOne({ transactionID: tranId });
      res.send(result);
    });

    // ----------- order related API
    app.get("/order/user/:buyerEmail", async (req, res) => {
      const buyerEmail = req.params.buyerEmail;
      const query = { "order.buyerEmail": buyerEmail };
      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });

    // get all order details
    app.get("/allOrders", async (req, res) => {
      const result = await orderCollection.find().toArray();
      res.send(result);
    });

    // get orders of specific medicine
    app.get("/orders/medicineName/:medicineName", async (req, res) => {
      const medicineName = req.params.medicineName;
      const filter = { "order.items.medicineName": medicineName };
      const result = await orderCollection.find(filter).toArray();
      res.send(result);
    });

    // accept payment manually API
    app.patch("/order/update/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          paymentStatus: "paid",
        },
      };

      const result = await orderCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

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

    // api to get specific category medicines
    app.get("/medicine/:category", async (req, res) => {
      const category = req.params.category;
      const query = { category: category };
      const result = await medicineCollection.find(query).toArray();
      res.send(result);
    });

    // ---------  Carts collection API
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { buyerEmail: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    // post new item in cart
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const { buyerEmail, medicineName } = cartItem;

      const isExisting = await cartCollection.findOne({
        buyerEmail,
        medicineName,
      });
      if (isExisting) {
        return res
          .status(400)
          .send({ message: "This medicine is already in the cart." });
      }

      const result = await cartCollection.insertOne(cartItem);

      // Fetch all items of this user
      const userCartItems = await cartCollection.find({ buyerEmail }).toArray();

      // Calculate the subtotal
      const subTotal = userCartItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      );

      const updateSubTotal = {
        $set: {
          subTotal: subTotal,
        },
      };
      const resultForSubTotal = await cartCollection.updateMany(
        { buyerEmail },
        updateSubTotal
      );

      res.send(result);
    });

    // PATCH: Update quantity and total price
    app.patch("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const { type, buyerEmail } = req.body; // type "increase" or "decrease"
      const query = { _id: id };

      const cartItem = await cartCollection.findOne(query);

      let newQuantity = cartItem?.medicineQuantity;
      if (type === "increase") {
        newQuantity += 1;
      } else if (type === "decrease" && cartItem?.medicineQuantity > 1) {
        newQuantity -= 1;
      } else {
        return res.status(400).send({ message: "Invalid quantity update" });
      }

      const newTotal = parseInt(newQuantity * cartItem?.price);

      const updatedDoc = {
        $set: {
          medicineQuantity: newQuantity,
          totalPrice: newTotal,
        },
      };

      const result = await cartCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    app.get("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await cartCollection.findOne(query);
      res.send(result);
    });

    // delete specific item from cart
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // remove all cart items for a specific user (by email)
    app.delete("/carts", async (req, res) => {
      const { buyerEmail } = req.query;
      const result = await cartCollection.deleteMany({ buyerEmail });
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

    // delete specific category
    app.delete("/category/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await categoryCollection.deleteOne(query);
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
