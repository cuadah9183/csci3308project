INSERT INTO recipe (name, imageurl, calories,fat,protein,carbohydrates) VALUES ('Garlicky Pasta with Swiss Chard and Beans','https://spoonacular.com/recipeImages/482788-556x370.jpg',519,13,30,77),
('Italian Sausage Stew with White Beans and Kale','https://spoonacular.com/recipeImages/729352-556x370.jpg',449,15,35,47),
('Steak & Potato Kebabs with Creamy Cilantro Sauce for Two','https://spoonacular.com/recipeImages/695646-556x370.jpg',582,8,43,86),
('Lemon Pesto Zucchini Sandwich','https://spoonacular.com/recipeImages/510624-556x370.jpg',432,5,16,82),
('Butternut Squash & Chickpea Coconut Curry (Crock Pot )','https://spoonacular.com/recipeImages/627789-556x370.jpg',248,6,11,39),
('Slow Cooker Vegetable Curry with Chickpeas','https://spoonacular.com/recipeImages/483627-556x370.jpg',289,6,14,51),
('Green Bean Curry with Peas and Cashews','https://spoonacular.com/recipeImages/757858-556x370.jpg',352,17,12,44),
('Sweet Potato Curry With Spinach and Chickpeas','https://spoonacular.com/recipeImages/100560-556x370.jpg',421,4,12,87),
('Hungarian Beef Goulash','https://spoonacular.com/recipeImages/695418-556x370.jpg',219,6,28,13),
('Skinny Beef Stroganoff On Zucchini Ribbons','https://spoonacular.com/recipeImages/551385-556x370.png',425,12,56,25),
('Eastern European Red Lentil Soup','https://spoonacular.com/recipeImages/759690-556x370.jpg',208,5,11,32);

INSERT INTO log (recipeID, userID, time, servings) VALUES (1, 1, current_timestamp - interval '7 hours', 2), 
(2, 1, current_timestamp - interval '6 hours', 2), (1, 1, current_timestamp - interval '1 days', 1), (3, 1, current_timestamp - interval '2 days', 1),
(4, 1, current_timestamp - interval '3 days', 1), (5, 1, current_timestamp - interval '3 days', 1), (6, 1, current_timestamp - interval '4 days', 1),
(7, 1, current_timestamp - interval '5 days', 1), (8, 1, current_timestamp - interval '5 days', 1), (9, 1, current_timestamp - interval '6 days', 1),
(10, 1, current_timestamp - interval '7 days', 1), (11, 1, current_timestamp - interval '8 days', 1);

INSERT INTO library (recipeID, userID) VALUES (1,1),(2,1),(3,1),(4,1),(5,1),(6,1),(7,1),(8,1),(9,1),(10,1),(11,1);

INSERT INTO profile (username, mydescription, favorites)
    VALUES ('t','I am a resident of Colorado and fond of hiking and skiing', 'I love lemon cake!');
