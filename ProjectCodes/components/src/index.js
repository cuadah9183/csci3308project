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

app.use(express.static('/home/node/app'));

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
				
				//save api_key and userID
				const IDresults = await db.query(
					"select userID FROM users where username = $1",[row.username]
				);
				req.session.user = {
				 api_key: process.env.API_KEY,
				 api_host: process.env.API_HOST,
				 ID: IDresults[0].userid,
				 lastQuery: "",
				 user
				};
				req.session.save();
				console.log("username = " + row.username + "| userID = " + req.session.user.ID);
				
				//go to home page
				res.redirect("/home");
			}
			
			// if usernames don't match then tell user to register first
			else if (row.username != req.query.username) {
				console.log("Username does not match, please register first");
				res.redirect("/create", 200, {username, password, message: "User does not exist in the system, please create account first"});
			}
			else if (password != row.password) {
				console.log("Passwords don't match, probably entered incorrect password, try logging in again");
				res.render("pages/login", 200, {message: "Incorrect password for user '" + row.username + "', try logging in again"});
			}
			else {
				console.log("unknown login error");
				res.render("pages/login", 200, {message: "unknown login error, try logging in again"});
			}
				
		}
		catch(err) {
			if (err.toString().startsWith("TypeError: Cannot read properties of undefined (reading 'username')")) {
				//console.log("user does not exist in the system, go register first = " + err);
				res.redirect("/create", 401, {username, password, message: "user does not exist in the system, please create account first"});
			}
			else {
				console.log("UNKNOWN error = " + err);
				res.redirect("/create", 401, {message: "UNKNOWN login error, try login again"});
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
app.get("/home", async (req, res) => {

	console.log("in home page, username = " + user.username);

	const datequery = "SELECT CURRENT_DATE;"
	const libquery = "SELECT * FROM recipe r INNER JOIN library l ON r.recipeID = l.recipeID INNER JOIN users u ON u.userID = l.userID WHERE username = $1;";
	const userquery = "SELECT date(time), time, servings, name, calories, protein, fiber, sodium, imageurl FROM users u INNER JOIN log l ON l.userID = u.userID INNER JOIN recipe r ON r.recipeID = l.recipeID WHERE username = $1 AND date(time) = current_date ORDER BY time ASC;";
	
	const userdata=[];
	await db.any (userquery, [user.username])
	  .then(daylog => {
		userdata.push(daylog);
	})
	  .catch((err) => {
		console.log(err);
		res.redirect("/login");
	});
	console.log ('check');
	await db.any (libquery, [user.username])
	  .then(library =>{
		userdata.push(library);
	})
	await db.any (datequery)
	.then(currdate =>{
	  userdata.push(currdate);
    })
	  .catch((err) => {
		console.log(err);
		res.redirect("/login");
	});
	console.log(userdata);

  res.render("pages/home", {username: req.session.user.user.username, daylog: userdata[0],recipes: JSON.stringify(userdata[1]), currdate: userdata[2],});

});



// Add a meal to the meal log
app.post("/addLog", (req, res) => {
	// Get entries from fields
	const mealName = req.body.mealName;
	const calories = req.body.calories;
	const protein = req.body.protein;
	const fiber = req.body.fiber;
	const sodium = req.body.sodium;

	const recID = req.body.saveMeal;
	const addRecipe = req.body.saveRecipe;

	console.log(recID, addRecipe);

	console.log("addLog called");
	// If the recipeID does not exist, insert into recipe table
	const queryAddRecipe = "INSERT INTO recipe (name, calories, protein, fiber, sodium) VALUES ($1, $2, $3, $4, $5);";
	// If user chose to save to library, do so
	const queryAddToLib = `INSERT INTO library (recipeID, userID) VALUES ((SELECT recipeID FROM recipe ORDER BY recipeID DESC LIMIT 1), (SELECT userID FROM users where username = '${user.username}'));`;
	// Add meal to log
	const queryInsertLogNew = `INSERT INTO log (recipeID, userID, time) VALUES ((SELECT recipeID from recipe order by recipeID desc limit 1), (select userID from users where username = '${user.username}'), current_timestamp);`;
	const queryInsertLogOld = `INSERT INTO log (recipeID, userID, time) VALUES ($1, (select userID from users where username = '${user.username}'), current_timestamp);`;

	if (req.body.mealName !== null) {
		db.task('get-everything', task => {
			// If the recipe does not exist already (it does not exist in the library).
			if (recID == "None") {
				// If recipe does not exist and user chose to save to library,
				// create recipe, save to library, add to log.
				if (addRecipe == "on") {
					return task.batch([
						task.any(queryAddRecipe, [mealName, calories, protein, fiber, sodium]),
						task.any(queryAddToLib),
						task.any(queryInsertLogNew)
					]);
				} else
				// If recipe does not exist, but user does not wish to save to library,
				// create recipe and add to log.
				{
					return task.batch([
						task.any(queryAddRecipe, [mealName, calories, protein, fiber, sodium]),
						task.any(queryInsertLogNew)
					]);
				}
			}
			else {

				// If recipe does exist (is in library) and is not to be saved to library,
				// just add to log.
				return task.batch([
					task.any(queryInsertLogOld, [recID])
				]);

			}

		})
			.then(() => {
				res.redirect("/home")
			})
			.catch((err) => {
				console.log(err);
				res.redirect("/login");
			})
	}
});



 app.get("/library", (req, res) => {
	var userquery = '';
	
	//if userSearch passed via req, take it into acccount when building query
	if(!req.query.userSearch){
		//undefined, pull every meal
		if(req.query.sort == ""){
			//no sort request. Pull every recipe, unsorted
			userquery = 'SELECT * FROM recipe R, library L WHERE R.recipeID = L.recipeID and L.userID = $1';
			
			//general query, reset for sorting library calls
			req.session.user.lastQuery = "";
		} else {
			//sort request. Order by value passed via sort and include LIKE statement if lastQuery != ""
			userquery = 'SELECT * FROM recipe R, library L WHERE R.recipeID = L.recipeID and L.userID = $1';

			if(req.session.user.lastQuery != ""){
				//if the last library call was a library search, include the like statement
				userquery += ' and R.name like $2'
			}

			if(req.query.sort == "CAL"){
				userquery += ' ORDER BY calories ASC;';
			}
			else if(req.query.sort == "PRO"){
				userquery += ' ORDER BY protein DESC;';
			}
			else if(req.query.sort == "SOD"){
				userquery += ' ORDER BY sodium ASC;';
			}
			else if(req.query.sort == "FIB"){
				userquery += ' ORDER BY fiber DESC;';
			} else {
				userquery += ';';
			}
		}

	} else {
		req.query.userSearch = '%' + req.query.userSearch + '%'
		userquery = `SELECT * FROM recipe R, library L WHERE R.recipeID = L.recipeID and L.userID = $1 and R.name like $2`;
		req.session.user.lastQuery = req.query.userSearch;
	}
	console.log("lib call: .lastQuery: " + req.session.user.lastQuery);
	
	//db call
	db.any(userquery, [req.session.user.ID, req.session.user.lastQuery])
	.then(results => {
		res.render("pages/library",{results: results});
	})
	.catch((err) => {
	  console.log(err);
	  res.render("pages/library",{
		results : [],
		message: 'Database call failed.',
		error: true});
	});
});

//3rd party calls to Spoontacular https://rapidapi.com/spoonacular/api/recipe-food-nutrition/
//TODO: Add recipe to library with modal. Need modal and login to work
 //populate modal of nutritional information with another call?
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

	//input for call to 3rd party
	const options = {
		method: 'GET',
		url: 'https://spoonacular-recipe-food-nutrition-v1.p.rapidapi.com/recipes/search',
		params: {
		  query: qIn
		},
		headers: {
		  'X-RapidAPI-Key': req.session.user.api_key,
		  'X-RapidAPI-Host': req.session.user.api_host
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


app.get("/calendar", (req, res) =>{
	console.log("loading calendar for " + user.username);
	const week=req.query.week;
	var logquery;

	if (week == undefined){
		logquery = "SELECT r.recipeID, name, calories, protein, fiber, sodium, imageurl, date_part('dow', time) AS day, date_part('week', time) AS week, servings FROM recipe r INNER JOIN log l ON l.recipeID = r.recipeID INNER JOIN users u ON u.userID = l.userID WHERE username = $1 AND date_part('week', time) = date_part('week', current_timestamp);";
	}
	else{
		logquery = "SELECT r.recipeID, name, calories, protein, fiber, sodium, imageurl, date_part('dow', time) AS day, date_part('week', time) AS week, servings FROM recipe r INNER JOIN log l ON l.recipeID = r.recipeID INNER JOIN users u ON u.userID = l.userID WHERE username = $1 AND date_part('week', time) = $2;";
	}

	db.any(logquery, [user.username, week])
	.then (weeklog => {
		console.log(weeklog);
		var cweek;
		if (weeklog.length == 0){
			cweek = req.query.week;
		}
		else{
			cweek = weeklog[0].week;
		}
		
		res.render("pages/calendar", {username: req.session.user.user.username, weeklog: weeklog, weeknum:cweek});
	})
});


//Get LOGOUT 
app.get('/logout', (req, res) => {
	req.session.user = {
		api_key: '',
		username: '',
		status : "created"
	};
	req.session.save();
	console.log("api_key and username deleted");
  res.render("pages/logout");
});

app.listen(3000);
console.log('Server is listening on port 3000');
