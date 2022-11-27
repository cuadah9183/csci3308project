CREATE TABLE users (
    userID SERIAL PRIMARY KEY,
    username VARCHAR(45) NOT NULL,
    password VARCHAR(45) NOT NULL
);

CREATE TABLE recipe(
    recipeID SERIAL PRIMARY KEY,
    name VARCHAR(45) NOT NULL,
    calories INT,
    protein INT,
    fat INT,
    carbohydrates INT,
    imageURL VARCHAR(45)
);

CREATE TABLE log(
    mealID SERIAL PRIMARY KEY,
    recipeID INT NOT NULL,
    userID INT NOT NULL,
    time TIMESTAMP NOT NULL,
    servings INT DEFAULT 1,
    FOREIGN KEY(recipeID)
        REFERENCES recipe(recipeID),
    FOREIGN KEY(userID)
        REFERENCES users(userID)
);

CREATE TABLE library(
    recipeID INT NOT NULL,
    userID INT NOT NULL,
    PRIMARY KEY(recipeID, userID),
    FOREIGN KEY(recipeID)
        REFERENCES recipe(recipeID),
    FOREIGN KEY(userID)
        REFERENCES users(userID)
);

CREATE TABLE profile (
    profileID SERIAL PRIMARY KEY,
	username VARCHAR(100) NOT NULL,
    mydescription VARCHAR(500) NULL,
    favorites VARCHAR(100) NULL
);

INSERT INTO users (username,password)
    VALUES ('t','t');
