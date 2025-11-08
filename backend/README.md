# AURA Personal AI Assistant - Backend

This folder contains the Node.js and Express backend server for the AURA application.

The backend serves two main purposes:
1.  **Secure API Proxy:** It securely handles the Google Gemini API key and proxies requests from the frontend to the Gemini API. This prevents the API key from being exposed in the browser.
2.  **Data Persistence:** It provides API endpoints for the frontend to save and retrieve data (People, Expenses, Reminders) from a MongoDB database.

## Setup Instructions

### 1. Install Dependencies
Navigate to this `backend` directory in your terminal and run:
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in this directory by copying the example file:
```bash
cp .env.example .env
```
Now, open the `.env` file and add your credentials:
- `API_KEY`: Your Google Gemini API key.
- `MONGO_URI`: (Optional) Your connection string for a MongoDB database. If you don't provide this, the app will work, but data won't be saved between server restarts.

### 3. Start the Server
Run the following command to start the backend server:
```bash
npm start
```
By default, the server will run on `http://localhost:8082`. You can change the port in the `.env` file.
