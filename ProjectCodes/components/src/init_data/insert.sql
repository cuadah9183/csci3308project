INSERT INTO users (userID, username, password) VALUES (1, 'test', 'Password@1');

INSERT INTO recipe (recipeID, name, calories, protein, fiber, sodium) VALUES (1, 'Casserole', 450, 18, 12, 280), (2, 'Tea', 120, 4, 0, 50);

INSERT INTO log (recipeID, userID, date, time, servings) VALUES (1, 1, '2022-11-09', current_time, 2), (2, 1, '2022-11-09', current_time + interval '3 hours', 2);

INSERT INTO library (recipeID, userID) VALUES (1, 1);