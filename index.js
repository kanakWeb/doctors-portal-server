const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");

const nodemailer = require("nodemailer");
const sgTransport = require("nodemailer-sendgrid-transport");

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

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET,
    function (err, decoded) {
      if (err) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      req.decoded = decoded;
      next();
    }
  );
}

const emailSenderOptions = {
  auth: {
    api_key: process.env.EMAIL_SENDER_KEY,
  },
};

const emailClient = nodemailer.createTransport(
  sgTransport(emailSenderOptions)
);

//send mail
function sendAppointmentEmail(booking) {
  const { patient, patientName, treatment, date, slot } = booking;

  const email = {
    from: process.env.EMAIL_SENDER,
    to: patient,
    subject: patientName,
    text: `Your appointment for ${patientName} is on ${date} at ${slot} is confirmed`,
    html: `
    <div>
    <p>hello ${patientName}</p>
<h3>Your Appointment for ${treatment} is confirmed</h3>
<p>looking forward to seeing you on ${date} at ${slot}</p>

<h3>Our address</h3>
<p>Dhaka Mirpur 10</p>
<p>Bangladesh</p>
<a href='https://www.google.com/'>google</a>
    </div>`,
  };

  emailClient.sendMail(email, function (err, info) {
    if (err) {
      console.log(error);
    } else {
      console.log("Message sent: ", info);
    }
  });
}

async function run() {
  try {
    await client.connect();
    const servicesCollection = client
      .db("Doctors_portal")
      .collection("Services");
    const bookingCollection = client
      .db("Doctors_portal")
      .collection("bookings");
    const userCollection = client
      .db("Doctors_portal")
      .collection("users");
    const doctorCollection = client
      .db("Doctors_portal")
      .collection("doctors");

    /* 
API Naming Convention
*app.get('/booking')//get all bookings in this collection.or get more than one or by filter
*app.get('/booking/:id')//get specific booking
*app.post('/booking') //add a new booking add-create-operation
*app.patch('/booking/:id') //
*app.put('booking/:id')//upsert=>update(if exists)or(if doesn't exist)
*app.delete('/booking/:id')//
*/

    //verify admin
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "Forbidden" });
      }
    };

    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = servicesCollection
        .find(query)
        .project({ name: 1 });
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

    app.get("/user", verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    //admin access

    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    // //user add admin find
    app.put(
      "/user/admin/:email",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const filter = { email: email };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollection.updateOne(
          filter,
          updateDoc
        );
        res.send(result);
      }
    );

    //user
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    app.get("/booking", verifyJWT, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.decoded.email;
      if (patient === decodedEmail) {
        const query = { patient: patient };
        const bookings = await bookingCollection
          .find(query)
          .toArray();
        return res.send(bookings);
      } else {
        return res.status(403).send({ message: "Forbidden Access" });
      }
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
      sendAppointmentEmail(booking);
      return res.send({ success: true, result });
    });

    //add doctor
    app.post("/doctor", verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    });

    //delete doctor
    app.delete(
      "/doctor/:email",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const filter = { email: email };
        const result = await doctorCollection.deleteOne(filter);
        res.send(result);
      }
    );

    //doctor get
    app.get("/doctor", verifyJWT, verifyAdmin, async (req, res) => {
      const doctors = await doctorCollection.find().toArray();
      res.send(doctors);
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
