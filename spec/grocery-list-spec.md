# Weekly Menu / Grocery planner

## Problem
Each week I create a meal plan and from that a grocery list.  
This list includes all of the food and house hold items needed for the week.

I repeat recipes, and use new recipes.  
I don't want to buy incredients I already have.  
Some incredients are purchased everyweek.
Some incredients are purchased every 'n' weeks.

## Solution
Create a solution to help me plan my week of food. This could be a stand alone script, claude skill, or artifact.
It should follow these steps to create meal plan and grocery list.
* Plan what we are having for dinners, but allow for extra recipes, deserts, fancy breakfast, lunch meal planning.
* Create a list of items to buy
* Allow me to review and approve list
  * Indicate item I aleady have
* Output HTML artifact with meal plan and grocery list
* Update the Pantry.  

## Data Definitions
* Pantry - Incredients on hand: name, amount on hand, unit of measurement
* Recipe - name, number of servings made, incredient list w/ ammounts, steps to execute, possible url source
* Repeated Items - Things we buy everyweek.  We will seed with a list. incredient name 

## Inputs to week
* Number of dinners to plan - default 6
* Number of eaters for each dinner - default 2

## User Stories

As a user I want to confirm the default values which determine how many total dinner serving I need to make.

As a user I want to enter recipes for the week.  They should make enough servings for each eater. 
- Some meals, may get an idea, but not a recipe.  Incredients and servings to be manually added.  For instance, Grilled Salmon, no recipe needed
- For each meal, make certain the recipe specfies enough servings
- More than the number of eaters, means it will last multiple nights.  
- Less than the number of dinners, ask if the recipe should be doubled, tripled... Update incredient list for recipe

As a user I want to know when I've covered the meals required

As a user I may want to add additional recipes, non dinner recipes

As a user I want to buy all of the incredients required by my recipes, de-deplicated

As a user I want my grocery list to include items I purchase every week. e.g. salad  

As a user I want the system to notice new repeated items, and ask to add them to the repeated item list

As a user I want to review the grocery list, add and remove items, see things that may be in my pantry

As as user I would like to review my, Pantry, add and remove items.

As as user I would like my grocery list to update my Pantry.

As a user I would like the system to recomend things I buy on a cadence, such as salad dressing every two weeks, napkins once a month...


