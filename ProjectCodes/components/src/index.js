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

//Constants defining nutrients application uses
const nutrientList = ['calories','protein','fat','carbohydrates'];
const nutrientInfo = {calories: {label:'Calories',units:''},protein:{label:'Protein',units:'g'},carbohydrates:{label:'Carbs',units:'g'},fat:{label:'Fat',units:'g'}, fiber:{label:'Fiber',units:'g'},sodium:{label:'Sodium',units:'mg'}};

const user = {username: undefined};

/*-----date functions-----*/
const sqltimestamp = "CURRENT_TIMESTAMP - INTERVAL '7 hours'";

function prettyDate(date) {
	const months=['Jan','Feb','March','April','May','June','July','Aug', 'Sep','Oct','Nov','Dec'];
  
	return months[date.month-1]+' '+date.day+' '+date.year;
}


async function getDateFromWeekday(weekday,ivl){
	if (ivl){
		interval=" + INTERVAL '"+ivl+"'";
	}
	else{
		interval="";
	}

	var date;
	const rawdatequery="SELECT TO_DATE($1, 'IYYYIWID')"+interval;
	const datequery = "SELECT date_part('day', (" + rawdatequery+")) AS day, date_part('month', (" + rawdatequery+")) AS month, date_part('year', (" + rawdatequery+")) AS year;";

	await db.one(datequery, [ ''+weekday.year+parseInt(weekday.week).toLocaleString(undefined, {minimumIntegerDigits: 2}) + weekday.day])
		.then(currdate => {
			date = currdate;
		})
	return date;
}
async function getCurrentWeekday(date){
	var timestamp;
	if (date){
		timestamp="TIMESTAMP '"+date.year+"-"+date.month+"-"+date.day+"'";
	}
	else {
		timestamp=sqltimestamp;
	}


	var weekday;

	const datequery = "SELECT DATE_PART('week', " + timestamp + ") AS week, date_part('isodow'," + timestamp + ") AS day, date_part('isoyear'," + timestamp + ") AS year;";
	await db.one(datequery)
	.then(date => {
		weekday = date;
	})

	return weekday;
}
/*-----end date functions-----*/


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

/*-----meal functions-----*/
	/*--meal format: {recipeid,mealid,servings,name,nutrients={calories, protein, etc...}} --*/


//Takes flat dictionary from SQL return and formats it like above
function formatMeals(mealRecords) {
	var meal;
	return mealRecords.map(function (record) {
		var meal = {  nutrients: {} };
		Object.keys(record).forEach(function (field) {
			//if the record label exists in nutrientList add it to the nutrients sub-dict
			if (nutrientList.includes(field)) {
				meal.nutrients[field] = record[field];
			}
			else {
				meal[field]=record[field];
			}
		});
		return meal;
	});

}

//gets meal from db based on query and params and returns formatted meal record
async function getMeals(query,params){
	var meals;

	await db.any (query, params)
	  .then(records => {
		meals=formatMeals(records);
	})
	  .catch((err) => {
		console.log(err);
	});
	return meals;
}
//adds recipe to database and optionally users library and returns recipeid for added recipe
async function addToRecipes(body,userID,addToLib) {
	const queryAddR = "INSERT INTO recipe (name, imageurl, " +nutrientList.join(", ") + ") VALUES ($1, $2, "+nutrientList.map((f,i)=> "$"+(i+3)).join(", ")+");";
	const queryAddL = "INSERT INTO library (recipeID, userID) values ($1, $2);";
	const queryNewID="SELECT recipeID FROM recipe ORDER BY recipeID DESC LIMIT 1;";

	//add to recipe db and get id
	await db.any(queryAddR,[body.name,body.imageurl].concat(nutrientList.map(nutr=>body[nutr]))).catch((err) => {console.log(err);});
	recID = (await db.one(queryNewID)).recipeid;

	//add to library if selected
	if (addToLib){
	    await db.any(queryAddL,[recID,userID]).catch((err) => {console.log(err);});
	}

	return recID;
}

//add recipe to meal log
async function addToLog(userID,recipeID,servings,date){
	const queryAddLog = "INSERT INTO log (recipeID, userID, time, servings) VALUES ($2, $1," + date + ", $3);";
	return db.any(queryAddLog, [userID,recipeID, servings]);
}


/*-----end meal functions-----*/

app.get("/home", async (req, res) => {

	console.log("in home page, username = " + user.username);
	console.log("Request", req.query, Object.keys(req.query).length);

	var weeknday;
	if (Object.keys(req.query).length>=3){
		if (!req.query.dayshift){
			req.query.dayshift=0;
		}
		console.log('daysh',req.query.dayshift);
		weeknday=await getCurrentWeekday(await getDateFromWeekday({day:req.query.day, week:req.query.week, year:req.query.year},req.query.dayshift+' day')); //because postgresql
		
		
	}
	else{
        weeknday= await getCurrentWeekday();
	}
	console.log('oldweekday',{day:req.query.day, week:req.query.week, year:req.query.year});
	console.log('newweekday',weeknday);


	//get meal log for the chosen day
	const logquery = "SELECT mealid, date_part('hour', time) AS h, date_part('minute', time) AS m, time, r.recipeid, servings, name,"+nutrientList.join(", ")+ ", imageurl FROM users u INNER JOIN log l ON l.userID = u.userID INNER JOIN recipe r ON r.recipeID = l.recipeID WHERE username = $1 AND date_part('week', time) = $2 AND date_part('isodow', time) = $3 AND date_part('isoyear', time) = $4 ORDER BY time ASC;";
	const log =await getMeals(logquery,[user.username, weeknday.week, weeknday.day,weeknday.year]);

	//get the user's library
	const libquery = "SELECT * FROM recipe r INNER JOIN library l ON r.recipeID = l.recipeID INNER JOIN users u ON u.userID = l.userID WHERE username = $1;";
	const library =await getMeals(libquery,[user.username]);

	//get current date 
	const currentdate=await getDateFromWeekday(weeknday);



	console.log("userdata", currentdate,log,library);


	console.log('datetest',await getCurrentWeekday(currentdate));
    res.render("pages/home", {username: req.session.user.user.username, weekday:weeknday, currdate: prettyDate(currentdate), nutrients:{fields: nutrientList,info:nutrientInfo}, daylog: log,recipes: library});

});



/*-----log interface-----*/

// Add a meal to the meal log
app.post("/addLog", async (req, res) => {
	// Get entries from fields
	const servings = req.body.servings;
	const mealdate = {year:parseInt(req.body.year), week: parseInt(req.body.week), day: parseInt(req.body.day)};
	const addRecipe = req.body.saveRecipe;

	const currdate= await getCurrentWeekday()

	console.log("addlog currdate", mealdate)
	console.log("checkfunc", currdate);

	var recID = req.body.saveMeal;

	const date = "(SELECT TO_TIMESTAMP('"+req.body.year + req.body.week + req.body.day +req.body.mealtime+"', 'IYYYIWIDHH24:MI'))";

	if(req.body.imageurl==''){
		req.body.imageurl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Pictograms-nps-food_service-2.svg/640px-Pictograms-nps-food_service-2.svg.png'
		console.log('imgurl2', req.body.imageurl);
	  }
	console.log('imgurl2', req.body.imageurl);

	//if reciped doesn't already exist in database add it and get new recipeid
	if (recID == "None") {
		recID=await addToRecipes(req.body,req.session.user.ID,addRecipe=="on");
	}    

	//add to log and then refresh the page
	addToLog(req.session.user.ID,recID,servings,date)
	.then(() => {
		res.redirect("/home?week=" + mealdate.week +"&day=" + mealdate.day +"&year="+mealdate.year);
	})
	.catch((err) => {
		console.log(err);
		res.redirect("/login");
	})

});

app.post("/editLog", (req, res) => {
	const mealID = req.body.saveMeal;
	const servings = req.body.servings;
	const mealdate = {week: req.body.week, day: req.body.day, year:req.body.year};

	const time = "(SELECT TO_TIMESTAMP('"+req.body.year + req.body.week + req.body.day +req.body.mealtime+"', 'IYYYIWIDHH24:MI'))";

	const queryEdit = "UPDATE log SET servings = $1, time ="+time+" WHERE mealid = $2;";

	db.task('editMeal', task => {
		return task.any(queryEdit, [servings,  mealID])
	})
	.then(() => {
		res.redirect("/home?week=" + mealdate.week +"&day=" + mealdate.day +"&year="+mealdate.year);
		})
	.catch((err) => {
		console.log(err);
		res.redirect("/login");
	})


});


app.post("/delLog",(req,res) =>{
	console.log(req.body.mealid);

	const mealid = req.body.mealid;
	const mealdate = {week: req.body.week, day: req.body.day, year:req.body.year};

	queryDel = "DELETE FROM log WHERE mealid = $1;";

	db.task("delMeal", task => {
		return task.any(queryDel, [mealid])
	})
	.then(() => {
		res.redirect("/home?week=" + mealdate.week +"&day=" + mealdate.day +"&year="+mealdate.year);
		})
	.catch((err) => {
		console.log(err);
		res.redirect("/login");
	})

});
/*-----end log interface----*/

app.get("/calendar", async (req, res) =>{
	console.log("loading calendar for " + user.username);
	
	//set week if no week provided
	var date;
	if (Object.keys(req.query).length==0){
		date=await getCurrentWeekday();	
	}
	else{
		date =await getCurrentWeekday(await getDateFromWeekday({day:1, week:req.query.week, year:req.query.year},req.query.weekshift+' week')); //because postgresql
	}
	const week=date.week;
	const year=date.year;

	var logquery = "SELECT r.recipeID, name, " +nutrientList.join(", ") + ", imageurl, date(time) AS date, date_part('hour', time) AS h, date_part('minute', time) AS m, date_part('isodow', time) AS day, date_part('week', time) AS week, date_part('isoyear', time) AS year, servings FROM recipe r INNER JOIN log l ON l.recipeID = r.recipeID INNER JOIN users u ON u.userID = l.userID WHERE username = $1 AND date_part('week', time) = $2 AND date_part('isoyear', time) = $3;";

	//get day range for the current week
    const weekdayrange=[await getDateFromWeekday({year:year, week:week,day:1}),await getDateFromWeekday({year:year, week:week,day:7})];
	console.log(weekdayrange);

	weeklog=await getMeals(logquery,[user.username, week,year]);
	console.log('calmeals',weeklog);
	res.render("pages/calendar", {username: req.session.user.user.username, weeklog: weeklog, year:year,week: week,dayrange:[prettyDate(weekdayrange[0]),prettyDate(weekdayrange[1])], nutrients:{fields: nutrientList,info:nutrientInfo}});



});

 app.get("/library", (req, res) => {
	var userquery = '';
	
	//bug fix surrounding lastQuery
	if(req.query.flag){
		//user just clicked on library tab. reset .lastQuery
		req.session.user.lastQuery = "";
	}

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
			else if(req.query.sort == "CAR"){
				userquery += ' ORDER BY carbohydrates ASC;';
			}
			else if(req.query.sort == "FAT"){
				userquery += ' ORDER BY fat DESC;';
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

app.post("/addSpoonToLib",async (req,res)=> {
	console.log("adding recipe to library...",req.body);
	var SpoonRecipeData,SpoonRecipeName;
//input for call to 3rd party
	const options = {
		method: 'GET',
		url: 'https://spoonacular-recipe-food-nutrition-v1.p.rapidapi.com/recipes/' + req.body.recipeid+'/information',
		params: {
			includeNutrition: true
		},
		headers: {
			'X-RapidAPI-Key': req.session.user.api_key,
			'X-RapidAPI-Host': req.session.user.api_host
		}
	};
 
	console.log(options.url)
 
	await axios.request(options).then(function (results) {
		//console.log(results.data)
		SpoonRecipeImage = results.data.image;
		SpoonRecipeName = results.data.title;
		SpoonRecipeData = results.data.nutrition.nutrients;
	})
		.catch(function (error) {
			console.error(error);
		});


	console.log(SpoonRecipeData);
	
	recipeData={name:SpoonRecipeName,imageurl:SpoonRecipeImage};
	nutrientList.forEach(function(nutr){
		SpoonRecipeData.forEach(function(n,i) {
			if (n.name.toUpperCase()==nutr.toUpperCase()) {
				recipeData[nutr]=n.amount;
			}
		});
	});

	console.log("RECIPE",recipeData);


	addToRecipes(recipeData, req.session.user.ID,true)
		.catch(function(error){
			res.render('pages/discover',{
				results: [],
				error: true,
				message: 'Add Recipe Failed'
			});
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


//Get Profile 
app.get('/profile', async (req, res) => {
	var username = req.session.user.user.username;
	console.log("calling page profile");
	
	if (username != undefined) {
		console.log("profile-page - username = " + username);
		try {
			const [row] = await db.query(
			  "select * from profile where username=$1;",
			  [req.session.user.user.username]
			);
			if (row){
				console.log(row.mydescription + ", " + row.favorites);
				res.render("pages/profile", {mydescription : row.mydescription, favorites : row.favorites, username : username});
			}
			else {
				console.log("no db record in profile table for user = " + req.session.user.username);
				res.render("pages/profile", {mydescription : '', favorites : '', username : username});
			}
		}
		catch (err) {
			console.log("profile table returned an error = " + err);
		}
	}
	else {
		res.render("pages/profile");
	}
});

app.get("/addProfile", async (req, res) =>{
	var mydescription = req.query.mydescription;
	var myfavorites = req.query.myfavorites;
	var username = req.session.user.user.username;
	var query1 = "update profile set mydescription = $2, favorites = $3 where username = $1;";
	var query2 = "insert into profile (username, mydescription, favorites) values ($1, $2, $3);";
	
	console.log("adding/updating profile in db");

	if (username != undefined) {
		console.log("addProfile-page - username = " + username);
		try {
			const [row] = await db.query(
			  "select * from profile where username=$1;",
			  [req.session.user.user.username]
			);
			if (row){
				console.log("record exists in db, so adding query");
				console.log(username + ", " + mydescription + ", " + myfavorites);
				// update record
				db.any(query1, [username, mydescription, myfavorites]
				)
				.then(() =>{
					res.render("pages/profile", {mydescription : row.mydescription, favorites : myfavorites, username : username});
				})
			}
			else {
				
				console.log("record does not exists in db, so insert query");
				console.log(username + ", " + mydescription + ", " + myfavorites);
				// insert a record
				db.any(query2,[username, mydescription, myfavorites]
				)
				.then(() =>{
					res.redirect("/profile", 200, {mydescription : mydescription, favorites : myfavorites, username : username})
				})
			}
		}
		catch (err) {
			console.log(err);
			res.redirect("/profile", {
				message: 'Error updating profile db'
			});
		}
	}	
 });


app.listen(3000);
console.log('Server is listening on port 3000');
