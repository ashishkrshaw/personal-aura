const express = require('express');
const axios = require('axios');
const { getDB } = require('../db');
const router = express.Router();

const getCollection = (collectionName) => {
    const db = getDB();
    if (!db) {
        console.error("Database not initialized, cannot get collection", collectionName);
        return null;
    }
    return db.collection(collectionName);
};

// Health Check
router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Generic GET handler
const handleGet = async (req, res, collectionName) => {
    const collection = getCollection(collectionName);
    if (!collection) return res.status(200).json([]); // Return empty array if DB is not available
    try {
        const data = await collection.findOne({});
        res.json(data ? data.items : []);
    } catch (err) {
        res.status(500).json({ error: `Failed to fetch ${collectionName}` });
    }
};

// Generic POST handler
const handlePost = async (req, res, collectionName) => {
    const collection = getCollection(collectionName);
    if (!collection) return res.status(200).json(req.body); // Return body if DB not available
    try {
        await collection.updateOne({}, { $set: { items: req.body } }, { upsert: true });
        res.status(200).json(req.body);
    } catch (err) {
        res.status(500).json({ error: `Failed to save ${collectionName}` });
    }
};

// People routes
router.get('/people', (req, res) => handleGet(req, res, 'people'));
router.post('/people', (req, res) => handlePost(req, res, 'people'));

// Expenses routes
router.get('/expenses', (req, res) => handleGet(req, res, 'expenses'));
router.post('/expenses', (req, res) => handlePost(req, res, 'expenses'));

// Reminders routes
router.get('/reminders', (req, res) => handleGet(req, res, 'reminders'));
router.post('/reminders', (req, res) => handlePost(req, res, 'reminders'));


// TTS Proxy Route
router.post('/synthesize-speech', async (req, res) => {
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: 'Text for speech synthesis is required.' });
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key is not configured on the server.' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:synthesizeSpeech?key=${apiKey}`;
    
    const requestBody = {
        "input": { "text": text },
        "voice": { "languageCode": "en-US" },
        "audioConfig": { "audioEncoding": "MP3" }
    };

    try {
        const ttsResponse = await axios.post(url, requestBody, {
            headers: { 'Content-Type': 'application/json' },
        });
        res.json(ttsResponse.data);
    } catch (error) {
        console.error('Error proxying TTS request to Google API:', error.response ? error.response.data : error.message);
        const status = error.response?.status || 500;
        const details = error.response?.data || 'An internal server error occurred.';
        res.status(status).json({ 
            error: 'Failed to synthesize speech via Google API.',
            details: details
        });
    }
});


module.exports = router;
