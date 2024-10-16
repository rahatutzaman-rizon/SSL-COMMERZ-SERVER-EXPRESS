require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const bodyParser = require('body-parser');
const SSLCommerzPayment = require('sslcommerz-lts');
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const cors = require("cors");

const app = express();
const port = 3030; // Server port

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
  origin: ["http://localhost:3000"], // Your frontend URL
  credentials: true,
}));

// MongoDB connection URI from environment variable
const mongoURI = process.env.MONGODB_URI;

// SSLCommerz configuration from environment variables
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false;



// MongoDB connection
const client = new MongoClient(mongoURI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Start the server
const run = async () => {
  try {
    await client.connect();
    const ordersCollection = client.db("mydatabase").collection("users");

    // POST request for creating a payment
    app.post("/api/payment", async (req, res) => {
      const { amount, currency } = req.body;
      
      // Create a transaction ID using ObjectId
      const tran_id = new ObjectId().toString();

      // Payment data to send to SSLCommerz
      const data = {
        total_amount: amount,
        currency: currency,
        tran_id: tran_id,
        success_url: `http://localhost:${port}/payment/success`,
        fail_url: `http://localhost:${port}/payment/fail`,
        cancel_url: `http://localhost:${port}/payment/cancel`,
        ipn_url: `http://localhost:${port}/payment/ipn`,
        shipping_method: "Courier",
        product_name: "Product Name",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: "Customer Name",
        cus_email: "customer@example.com",
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh"
      };

      // Initialize SSLCommerz payment
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.json({ redirectUrl: GatewayPageURL });

        // Insert order details into the database
        const order = { ...data, status: 'pending' };
        ordersCollection.insertOne(order);
      });
    });

    // POST request for handling successful payment
    app.post("/payment/success", async (req, res) => {
      const tran_id = req.body.tran_id;
      await ordersCollection.updateOne(
        { tran_id },
        { $set: { status: 'success' } }
      );
      res.redirect("http://localhost:3000/payment/success");
    });

    // POST request for handling failed payment
    app.post("/payment/fail", async (req, res) => {
      const tran_id = req.body.tran_id;
      await ordersCollection.updateOne(
        { tran_id },
        { $set: { status: 'failed' } }
      );
      res.redirect("http://localhost:3000/payment/fail");
    });

    // POST request for handling canceled payment
    app.post("/payment/cancel", async (req, res) => {
      const tran_id = req.body.tran_id;
      await ordersCollection.updateOne(
        { tran_id },
        { $set: { status: 'canceled' } }
      );
      res.redirect("http://localhost:3000/payment/cancel");
    });

    // POST request for handling IPN
    app.post("/payment/ipn", async (req, res) => {
      const tran_id = req.body.tran_id;
      const status = req.body.status;
      await ordersCollection.updateOne(
        { tran_id },
        { $set: { status: status === "VALID" ? 'success' : 'failed' } }
      );
      res.send({ message: "IPN received" });
    });

    // Simple route to check if server is running
    app.get('/', async (req, res) => {
      res.send({ server_status: "Running" });
    });

    // Start the Express server
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });

  } catch (error) {
    console.error("Error starting server:", error);
  }
};

// Run the server
run().catch(console.dir);