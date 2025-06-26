// netlify/functions/get-sheets.js
exports.handler = async function(event, context) {
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
                "Content-Type": "text/csv",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", // Empêche la mise en cache
                "Pragma": "no-cache", // Pour la compatibilité avec d'anciens caches
                "Expires": "0" // Pour la compatibilité avec d'anciens caches
            },
