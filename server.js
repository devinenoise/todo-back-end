// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
// Initiate database connection

// "require" pg (after `npm i pg`)
const pg = require('pg');
// Use the pg Client
const Client = pg.Client;
const client = new Client(process.env.DATABASE_URL);
client.connect();

// Application Setup
const app = express();
const PORT = process.env.PORT;
app.use(morgan('dev')); // http logging
app.use(cors()); // enable CORS request
app.use(express.static('public')); // server files from /public folder
app.use(express.json()); // enable reading incoming json data
// API Routes

app.use(express.urlencoded({ extended: true }));



// Auth Routes
const createAuthRoutes = require('./auth/create-auth-routes');

const authRoutes = createAuthRoutes({
    selectUser(email) {
        return client.query(`
            SELECT id, email, hash 
            FROM users
            WHERE email = $1;
        `,
            [email]
        ).then(result => result.rows[0]);
    },
    insertUser(user, hash) {
        return client.query(`
            INSERT into users (email, hash)
            VALUES ($1, $2)
            RETURNING id, email;
        `,
            [user.email, hash]
        ).then(result => result.rows[0]);
    }
});

// before ensure auth, but after other middleware:
app.use('/api/auth', authRoutes);


// everything that starts with "/api" below here requires an auth token!
const ensureAuth = require('./auth/ensure-auth');
app.use('/api', ensureAuth);



app.get('/api/todos', async (req, res) => {

    try {
        // make a sql query using pg.Client() to select * from todos
        const result = await client.query(`
            select * from todos where user_id=$1;
        `, [req.userId]);

        // respond to the client with that data
        res.json(result.rows);
    }
    catch (err) {
        // handle errors
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }

});


app.post('/api/todos', async (req, res) => {
    try {
        // the user input lives is req.body.task

        console.log('|||||||', req.userId);
        // use req.body.task to build a sql query to add a new todo
        // we also return the new todo

        // eslint-disable-next-line no-unused-vars
        const query = `
        insert into todos (task, complete, user_id)
        values ($1, $2, $3)
        returning *;
    `;
        const result = await client.query(query,
            [req.body.task, false, req.userId]);

        // respond to the client request with the newly created todo
        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});


app.put('/api/todos/:id', async (req, res) => {
    try {
        const result = await client.query(`
        update todos
        set complete=$1
        where id = ${req.params.id}
        returning *;
        `, [req.body.complete]);

        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.delete('/api/todos/:id', async (req, res) => {
    // get the id that was passed in the route:

    try {
        const result = await client.query(`
            delete from todos where id=${req.params.id}
            returning *;
        `,); // this array passes to the $1 in the query, sanitizing it to prevent little bobby drop tables

        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log('server running on PORT', PORT);
});