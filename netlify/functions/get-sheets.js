// netlify/functions/get-sheet.js
exports.handler = async function(event, context) {
    // Votre logique pour récupérer le CSV ici
    const GOOGLE_SHEET_CSV_URL_BASE = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPS5zMM1RwapLlcJ0ljKeaHbYqGGoQSrCfN8YoWxYcxWCSphQNFpqBYCMxwECVt_qr1MoaC0ExFgf-/pub?gid=0&single=true&output=csv";
    try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL_BASE);
        if (!response.ok) {
            return {
                statusCode: response.status,
                body: `Erreur lors de la récupération de la feuille Google: ${response.statusText}`
            };
        }
        const csvData = await response.text();
        return {
            statusCode: 200,
            headers: {
                "Content-Type": "text/csv", // Important pour que le navigateur sache que c'est du CSV
                 "Access-Control-Allow-Origin": "*" // Important pour les requêtes CORS
            },
            body: csvData
        };
    } catch (error) {
        console.error("Erreur dans la fonction Netlify:", error);
        return {
            statusCode: 500,
            body: `Erreur interne du serveur: ${error.message}`
        };
    }
};
