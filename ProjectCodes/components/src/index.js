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
				res.redirect("/register", {message: "incorrect user '" + row.username + "', please create an account first."});
			}
			console.log("select query returned = " + row.username + ", " + row.password);
			
			// compare passwords, if same then save api_key, 
			//const hash2 = await bcrypt.hash(req.query.password, 10);
			//const match = await bcrypt.compare(req.query.password, row.password);
			
			console.log("req.query.password = " + req.query.password + ", row.password = " + row.password);
			
			if (req.query.password === row.password) {
				// save api_key
				//req.session.user = {
				//  api_key: process.env.API_KEY,
				//};
				//req.session.save();
				//console.log("passwords match, saving api_key " + process.env.API_KEY);
				
				//go to home page
				res.redirect("/home", {
					username
				});
			}
			
			// if usernames don't match then tell user to register first
			else if (row.username != req.query.username) {
				console.log("Username does not match, please register first");
				res.redirect("/register", {message: "User does not exist in the system, please register first"});
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
				res.redirect("/register", {message: "user does not exist in the system, please register first"});
			}
			else {
				console.log("UNKNOWN error = " + err);
				res.redirect("/register", {message: "UNKNOWN login error, try login again"});
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


// POST Register submission
app.post("/create", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  let re = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,})");
  let result = re.test(password);
  console.log("password result = " + result);
  
  if (password.length < 8) {
	res.render("pages/create", {message: "Password must be 8 or more characters long."});
  }
  else if (!result) {
	res.render("pages/create", {message: "Password must contain atleast one uppercase, one lowercase, one special character, one number, and no spaces"});
  }
  else if (result) {
	  
	  //const hash = await bcrypt.hash(req.body.password, 10);
	  //console.log("password hash = " + hash);
	  
		try {
		  const aaa = await db.none(
			  "INSERT INTO users(username, password) VALUES ($1, $2);",
			  [req.body.username, password]
			);
			console.log("User '" + username + "' added to db");
			res.render("pages/login", {message: "User '" + username + "' successfully added to NutriLog database"});
		}
		catch (err) {
			if (err.toString().startsWith("error: duplicate key value violates unique constraint")) {
				console.log("user already exists, go to login page from path = " + req.path);
				res.redirect("/login");
			}
			return;
		}
	}	
  else {
	res.render("pages/login", {
		username,
		password,
	});
  }
});

app.get("/home", (req, res) => {
	  user.username = req.query.username;

	  if (user.username == undefined){
		user.username = "test";
	  }

	  req.session.user = user;
      req.session.save();

	  console.log("username = " + user.username);

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
