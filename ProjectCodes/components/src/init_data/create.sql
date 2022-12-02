CREATE TABLE users (
    userID SERIAL PRIMARY KEY,
    username VARCHAR(45) NOT NULL,
    password VARCHAR(200) NOT NULL
);

CREATE TABLE recipe(
    recipeID SERIAL PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    calories INT,
    protein INT,
    fat INT,
    carbohydrates INT,
    imageURL VARCHAR(500) DEFAULT 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Pictograms-nps-food_service-2.svg/640px-Pictograms-nps-food_service-2.svg.png'
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
    VALUES ('t','$2b$10$HLdoFVwuFzwtgDqr/dbybeA3u4gYF9oo4XYb76qmeUJsqAZGMnbFW');
