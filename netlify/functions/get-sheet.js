const admin = require('firebase-admin');

// Ensure Firebase is initialized only once
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin initialized successfully.");
    } catch (e) {
        console.error("Erreur lors de l'initialisation de Firebase Admin:", e);
        throw new Error("Erreur de configuration Firebase.");
    }
}

const db = admin.firestore();

exports.handler = async (event, context) => {
    try {
        const pins = [];
        const snapshot = await db.collection('pins').get();

        snapshot.forEach(doc => {
            const data = doc.data();
            // Ensure proper fields are present before pushing
            if (data.PIN && data.arrivalDateTime && data.departureDateTime) {
                pins.push({
                    PIN: data.PIN,
                    arrivalDateTime: data.arrivalDateTime,
                    departureDateTime: data.departureDateTime
                });
            }
        });

        // Convert data to CSV format
        // Headers for the CSV
        const headers = ["PIN", "arrivalDateTime", "departureDateTime"];
        let csv = headers.join(',') + '\n';

        // Add each PIN entry to the CSV
        pins.forEach(pin => {
            // CORRECTION ICI: Utilisez .toDate() avant .toISOString()
            const row = [
                `"${pin.PIN}"`,
                `"${pin.arrivalDateTime.toDate().toISOString()}"`, // Convertir en Date JavaScript
                `"${pin.departureDateTime.toDate().toISOString()}"`  // Convertir en Date JavaScript
            ].join(',');
            csv += row + '\n';
        });

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "text/csv",
                // Disable caching for the function's response to ensure fresh data
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
                "Surrogate-Control": "no-store",
            },
            body: csv,
        };
    } catch (error) {
        console.error("Erreur lors de la récupération des données Firestore:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Erreur lors de la récupération des données Firestore.", details: error.message }),
        };
    }
};
