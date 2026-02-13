import * as functions from "firebase-functions";
import axios from "axios";

export const getLexwareContacts = functions.https.onCall(async (data, context) => {
    // Use the secret key from environment variables
    const apiKey = process.env.LEXWARE_API_KEY;

    try {
        const response = await axios.get('https://api.lexware.io/v1/contacts', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'Failed to fetch from Lexware');
    }
});