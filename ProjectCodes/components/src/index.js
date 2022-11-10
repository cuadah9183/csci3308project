const express = require('express');
const app = express();
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const axios = require('axios');

// database configuration
const dbConfig = {
  host: 'db',
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};

const db = pgp(dbConfig);

// test your database
db.connect()
  .then(obj => {
    console.log('Database connection successful'); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// set the view engine to ejs
app.set("view engine", "ejs");
app.use(bodyParser.json());


app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);


const user = {username: undefined};

app.get('/', (req, res) => {
  res.redirect("/login");
});

//GET login
app.get('/login', async (req, res) =>{
	const username = req.query.username;
    const password = req.query.password;
	
	if (username != undefined && password != undefined) {
		console.log("username = " + req.query.username + ", password = " + req.query.password);
		try {
			const [row] = await db.query(
			  "select * from users where username=$1;",
			  [req.query.username]
			);
			 if (!row || row.username != req.query.username) {
				res.redirect("/create", {message: "incorrect user '" + row.username + "', please create an account first."});
			}
			console.log("select query returned = " + row.username + ", " + row.password);
			console.log("req.query.password = " + req.query.password + ", row.password = " + row.password);
			
			if (req.query.password === row.password) {
				// save username to user
				user.username = row.username;
				//save api_key and user
				req.session.user = {
				 api_key: process.env.API_KEY,
				 api_host: process.env.API_HOST,
				 user
				};
				req.session.save();
				console.log("username = " + row.username);
				//go to home page
				res.redirect("/home");
			}
			
			// if usernames don't match then tell user to register first
			else if (row.username != req.query.username) {
				console.log("Username does not match, please register first");
				res.redirect("/create", {username, password, message: "User does not exist in the system, please create account first"});
			}
			else if (password != row.password) {
				console.log("Passwords don't match, probably entered incorrect password, try logging in again");
				res.render("pages/login", {message: "Incorrect password for user '" + row.username + "', try logging in again"});
			}
			else {
				console.log("unknown login error");
				res.render("pages/login", {message: "unknown login error, try logging in again"});
			}
				
		}
		catch(err) {
			if (err.toString().startsWith("TypeError: Cannot read properties of undefined (reading 'username')")) {
				//console.log("user does not exist in the system, go register first = " + err);
				res.redirect("/create", {username, password, message: "user does not exist in the system, please create account first"});
			}
			else {
				console.log("UNKNOWN error = " + err);
				res.redirect("/create", {message: "UNKNOWN login error, try login again"});
			}
		}
	}
	else {
		res.render("pages/login");
	}
});



app.get('/create', (req, res) =>{
    res.render("pages/create");
});


// POST Create submission
app.post("/create", async (req, res) => {
  var username = req.body.username;
  var password = req.body.password;
  if (username === "") {
	console.log("username is blank");
  }

  if (password.length < 8) {
	res.render("pages/create", {username, password, message: "Password must be 8 or more characters long."});
  }
  else if ((/[a-z]/).test(password) === false) {
	res.render("pages/create", {username, password, message: "Password must contain atleast one lowercase character."});
  }
  else if ((/[A-Z]/).test(password) === false) {
	res.render("pages/create", {username, password, message: "Password must contain atleast one uppercase character."});
  }
  else if ((/[0-9]/).test(password) === false) {
	res.render("pages/create", {username, password, message: "Password must contain atleast one digit between 0 & 9."});
  }
  else if ((/[0-9]/).test(password) === false) {
	res.render("pages/create", {username, password, message: "Password must contain atleast one digit between 0 & 9."});
  }
  else if ((/(?=.[-~!#*$@_%+=.,&(){}|;:<>?])[^'"\\]+$/i).test(password) === false) {
	res.render("pages/create", {username, password, message: "Password must contain atleast one special character - ~ ! # * $ @ _ % + = . , & ( ) { } | ; : < > ?"});
  }  
  else {
	  console.log("we have a valid password = " + password);
	  
		try {
		  const aaa = await db.none(
			  "INSERT INTO users(username, password) VALUES ($1, $2);",
			  [req.body.username, password]
			);
			console.log("User '" + username + "' added to db");
			res.render("pages/login", {username, password, message: "User '" + username + "' successfully added to NutriLog database"});
		}
		catch (err) {
			if (err.toString().startsWith("error: duplicate key value violates unique constraint")) {
				console.log("user already exists, go to login page from path = " + req.path);
				res.redirect("/login");
			}
			return;
		}
  }
});



// Authentication Middleware.
const auth = (req, res, next) => {
	if (!req.session.user) {
	  // Return to login page
	  console.log('Not authenticated. Returning to login');
	  
	  //authentication redirect works as intended, but the error message doesnt display.
	  return res.redirect('/',401,{
		message: 'Please log in first!',
		error: true,
	  });
	}
	next();
  };

// Authentication Required
app.use(auth);


//username is always undefined here
app.get("/home", (req, res) => {

	  console.log("in home page, username = " + user.username);

	  const userquery = "SELECT date(time) AS date, time::time, servings, name, calories, protein, fiber, sodium, imageurl FROM users u INNER JOIN log l ON l.userID = u.userID INNER JOIN recipe r ON r.recipeID = l.recipeID WHERE username = $1 AND date(time) = current_date ORDER BY time ASC;";
	  
	  db.any(userquery, [user.username])
	  .then(daylog => {
		console.log(daylog);
		res.render("pages/home", {username: req.session.user.username, daylog: daylog,});

	  })
	  .catch((err) => {
		console.log(err);
		res.redirect("/login");
	  });


 });

 app.listen(3000);
console.log('Server is listening on port 3000');