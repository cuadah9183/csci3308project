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
    fiber INT,
    sodium INT,
    imageURL VARCHAR(45)
);

CREATE TABLE log(
    recipeID INT NOT NULL,
    userID INT NOT NULL,
    date timestamp NOT NULL,
    time TIME WITHOUT TIME ZONE NOT NULL,
    servings INT DEFAULT 1,
    PRIMARY KEY(recipeID, userID),
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