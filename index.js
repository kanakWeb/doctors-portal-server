const express = require("express");
const cors = require("cors");
const app = express();

const { MongoClient, ServerApiVersion } = require("mongodb");

require("dotenv").config();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lbpdr.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const servicesCollection = client
      .db("Doctors_portal")
      .collection("Services");
    const bookingCollection = client
      .db("Doctors_portal")
      .collection("bookings");

    /* 
API Naming Convention
*app.get('/booking')//get all bookings in this collection.or get more than one or by filter
*app.get('/booking/:id')//get specific booking
*app.post('/booking') //add a new booking add-create-operation
*app.patch('/booking/:id') //
*app.delete('/booking/:id')//
*/

    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = servicesCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // available date
    app.get("/available", async (req, res) => {
      const date = req.query.date;

      //step1: all service
      const services = await servicesCollection.find().toArray();

      // step2: get the booking of the day

      const query = { date: date };
      const bookings = await bookingCollection.find(query).toArray();

      // step3: for each service,find booking for that service

      services.forEach((service) => {
        // step4:find booking for that service [{},{}...]
        const serviceBookings = bookings.filter(
          (book) => book.treatment === service.name
        );

        //step5: select slots for the service
        const booked = serviceBookings.map((book) => book.slot);
        //step6:select those slot that are not in bookSlots
        const available = service.slots.filter(
          (slot) => !booked.includes(slot)
        );
        service.slots = available;
        /* service.booked=serviceBooking.map(s=>s.slot) */
      });

      res.send(services);
    });

    app.get("/booking", async (req, res) => {
      const patient = req.query.patient;
      const query = { patient: patient };
      console.log(query);
      const bookings = await bookingCollection.find(query).toArray();
      res.send(bookings);
    });

    //booking create
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patient: booking.patient,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Doctors!");
});

app.listen(port, () => {
  console.log(`Doctors app listening on port ${port}`);
});
