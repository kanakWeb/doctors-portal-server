const express = require('express');
const cors = require('cors');
const app = express()

const { MongoClient, ServerApiVersion } = require('mongodb');

require('dotenv').config();
const port = process.env.PORT||5000

//middleware
app.use(cors())
app.use(express.json())






const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lbpdr.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
  try {
    await client.connect();
     const  servicesCollection=client.db('Doctors_portal').collection('Services')


     app.get('/service',async(req,res)=>{
       const query={}
       const cursor = servicesCollection.find(query)
       const result= await cursor.toArray()
       res.send(result)
     })

   
  } finally {
   

  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Hello Doctors!')
})

app.listen(port, () => {
  console.log(`Doctors app listening on port ${port}`)
})