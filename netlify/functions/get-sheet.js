// netlify/functions/get-sheets.js
exports.handler = async function(event, context) {
    // Le lien vers votre feuille Google Sheets publiée au format CSV
    const GOOGLE_SHEET_CSV_URL_BASE = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPS5zMM1RwapLlcJ0ljKeaHbYqGGoQSrCfN8YoWxYcxWCSphQNFpqBYCMxwECVt_qr1MoaC0ExFgf-/pub?gid=0&single=true&output=csv";

    try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL_BASE);

        if (!response.ok) {
            // Si la requête vers Google Sheets échoue
            return {
                statusCode: response.status,
                body: `Erreur lors de la récupération de la feuille Google: ${response.statusText}`
            };
        }

        const csvData = await response.text();

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "text/csv", // Indique que le contenu est du CSV
                "Access-Control-Allow-Origin": "*", // Autorise les requêtes CORS depuis n'importe quelle origine
                // En-têtes pour empêcher la mise en cache :
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                "Pragma": "no-cache", // Compatibilité descendante pour certains caches
                "Expires": "0" // Fait expirer le contenu immédiatement
            },
            body: csvData
        };
    } catch (error) {
        // Gère les erreurs serveur ou réseau
        console.error("Erreur dans la fonction Netlify:", error);
        return {
            statusCode: 500,
            body: `Erreur interne du serveur: ${error.message}`
        };
    }
};
