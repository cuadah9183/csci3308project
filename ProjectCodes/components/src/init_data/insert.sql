INSERT INTO recipe (name, calories, protein, fat, carbohydrates) VALUES ('Casserole', 450, 18, 12, 280), ('Tea', 120, 4, 0, 50);

INSERT INTO log (recipeID, userID, time, servings) VALUES (1, 1, current_timestamp - interval '7 hours', 2), (2, 1, current_timestamp - interval '6 hours', 2), (1, 1, current_timestamp - interval '2 days', 1), (1, 1, current_timestamp - interval '8 days', 1);

INSERT INTO library (recipeID, userID) VALUES (1, 1), (2, 1);

INSERT INTO profile (username, mydescription, favorites)
    VALUES ('t','I am a resident of Colorado and fond of hiking and skiing', 'I love lemon cake!');
