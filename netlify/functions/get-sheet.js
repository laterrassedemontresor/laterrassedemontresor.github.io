const admin = require('firebase-admin');

// Vérifiez si l'application Firebase est déjà initialisée
if (!admin.apps.length) {
    try {
        const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccountKey)
        });
    } catch (error) {
        console.error("Erreur lors de l'initialisation de Firebase Admin:", error);
        // Gérer l'erreur, par exemple, en arrêtant le processus ou en logguant
        throw new Error("Erreur de configuration Firebase.");
    }
}

const db = admin.firestore();

exports.handler = async function(event, context) {
    try {
        // Récupérer tous les documents de la collection 'pins'
        const snapshot = await db.collection('pins').get();
        
        let csvContent = "PIN,arrivalDateTime,departureDateTime\n"; // En-têtes CSV

        snapshot.forEach(doc => {
            const data = doc.data();
            const pin = data.pin || ''; // Assurez-vous que le champ 'pin' existe
            
            // Convertir les Timestamps en chaînes ISO 8601 pour le CSV
            // C'est important pour que JavaScript puisse les reparser facilement côté client
            const arrivalDateTime = data.arrivalDateTime ? data.arrivalDateTime.toDate().toISOString() : '';
            const departureDateTime = data.departureDateTime ? data.departureDateTime.toDate().toISOString() : '';

            csvContent += `${pin},"${arrivalDateTime}","${departureDateTime}"\n`;
        });

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "text/csv",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", // Empêche la mise en cache
                "Pragma": "no-cache", // Pour la compatibilité avec d'anciens caches
                "Expires": "0" // Pour la compatibilité avec d'anciens caches
            },
            body: csvContent
        };
    } catch (error) {
        console.error("Erreur dans la fonction Netlify:", error);
        return {
            statusCode: 500,
            body: `Erreur interne du serveur: ${error.message}`
        };
    }
};
