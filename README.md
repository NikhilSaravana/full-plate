# FullPlate

### What is FullPlate?
FullPlate is a web app for food banks to keep track of inventory, food intake, and outgoing distributions. It helps volunteers and managers record what food items come in, go out, and how much is on hand. You can also use it to check if your food supply matches balanced nutrition standards (MyPlate), and see analytics about everything in one dashboard. Click [here](http://food-bank-inventory-7372d.web.app) to access FullPlate!

***

### Main Features
- **Inventory Management:** Add, edit, and view all food on hand. Supports bulk imports, individual item tracking, search, and removes expired stock.
- **Food Intake Logging:** Record food donations by item, category, and details including expiration dates and sources. Bulk entry with CSV-like format is supported.
- **Distribution Tracking:** Record outgoing food with client counts, amount served, and keep a history for reports.
- **Nutrition Analysis:** The app measures how well your inventory matches USDA MyPlate nutrition goals for various food categories (i.e. fruits, veggies, grains, protein, and dairy).
- **Analytics Dashboard:** See key stats, distribution history, and alerts right from the dashboard.
- **User System:** Secure sign-in, simple profile, and easy account management via Firebase authentication.
- **Alerts for Expired Stock:** The dashboard and inventory sections show warning alerts if expired items are in your inventory
- **Backup & Restore:** Export or import all your inventory data for convenience, and see last backup time on the dashboard.

***

### Getting Started
1. **Install:** Clone this repo and run `npm install` to get needed packages.
2. **Configure:** Rename `.env.sample` to `.env` and fill in your Firebase project keys.
3. **Run:** Use `npm start` to start the app on your computer.
4. **Login:** Make an account or sign in to start managing your food bank.

***

### How it Works
- **Inventory:** Use the “Food Intake” tab to add food. Use “Inventory Management” for edits or advanced item tracking.
- **Distribution:** When food is given out, use “Distribution” to log how much and to whom.
- **Analytics:** Check the dashboard for totals, MyPlate status, and quick actions. Warnings will show if stock gets low or if nutrition balance is off.
- **Help:** Click the help button in the bottom-right corner of your screen and copy the email address for support.

***

### Notes
- Created by Aayan Ali, Zong Rui Lee, and Nikhil Saravana.
- Built with ReactJS and Firebase.
- Designed for simple use by volunteers and managers.
- This project was made to fill a gap in food bank tracking tools and nutrition analysis for everyday organizations.
- Please contact our team at [fullplateusa@gmail.com](mailto:fullplateusa@gmail.com) if you have any questions or concerns.