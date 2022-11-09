const express = require('express');
const app = express();
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const axios = require('axios');

//globals for Spoontacular call limits. Only functional when index.js isnt going down and up repeatedly
var numRequests = 0;
var stampDate = Date.now();

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
				//save api_key
				req.session.user = {
				 api_key: process.env.API_KEY,
				 api_host: process.env.API_HOST
				};
				req.session.save();
				
				//go to home page
				res.redirect("/home", 200, {
					username: username
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
	res.render("pages/create", {message: "Password must contain atleast one uppercase, one lowercase, one special character and no spaces"});
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
	  var username = req.query.username;
	  console.log("username = " + username);
	  res.render("pages/home",{
		username: username
	  });
 });

//3rd party calls to Spoontacular https://rapidapi.com/spoonacular/api/recipe-food-nutrition/
//TODO: integrate options into the request itself, and encode session variables for API_Key, API_Host
//TODO: Add recipe to library with modal. Need modal and login to work
//500 requests a day for free. hardcord limit

app.get("/discover",(req, res) => {
	console.log('calling get /discover...');
	
	if(Date.now() - stampDate >= 1000*60*60*24){
		//24 hours or greater passed stampDate. Set stampDate to now to reset 24hr clock, reset call count
		numRequests = 0;
		stampDate = Date.now();
	} else {
		//iterate numRequests
		numRequests += 1;
		console.log("Request good. Number: " + numRequests);
	}

	//Some random values for populating discover with user input query
	const randomFoods = ['American','Asian','Indian','Salad','Mexican','Eastern European','breakfast','lunch','dinner','healthy'];

	//check for user input for the query. If none, use value from randomFoods
	var qIn = '';
	if(!req.query.queryIn){
		qIn = randomFoods[Math.floor(Math.random() * 10)];
	} else {
		qIn = req.query.queryIn;
	}

	const options = {
		method: 'GET',
		url: 'https://spoonacular-recipe-food-nutrition-v1.p.rapidapi.com/recipes/search',
		params: {
		  query: qIn
		},
		headers: {
		  'X-RapidAPI-Key': 'd9a69e76eemshcbf61c53dd16f62p197b80jsn7bd9b1cb406a',
		  'X-RapidAPI-Host': 'spoonacular-recipe-food-nutrition-v1.p.rapidapi.com'
		}
	  };

	if(numRequests >= 500){
		//dont call the request because it will cost me money (0.003$)
		res.render('pages/discover',{
			results:[],
			error: true,
			message: 'To many requests. Wait until tomorrow'
		})
	} else {
	axios.request(options).then(function (results) {
		// console.log(typeof results.data.results);
		// console.log(results.data)
		res.render('pages/discover',{
			results: results
		})
	})
	.catch(function (error) {
		console.error(error);
		res.render('pages/discover',{
			results: [],
			error: true,
			message: 'Spoontacular API call failed'
		});
	})}
});




app.listen(3000);
console.log('Server is listening on port 3000');
