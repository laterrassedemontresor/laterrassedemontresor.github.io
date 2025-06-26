const fetch = require('node-fetch'); // Si Node 18+ natif, cette ligne peut être ignorée

exports.handler = async function(event, context) {
    const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPS5zMM1RwapLlcJ0ljKeaHbYqGGoQSrCfN8YoWxYcxWCSphQNFpqBYCMxwECVt_qr1MoaC0ExFgf-/pub?gid=0&single=true&output=csv";

    try {
        const response = await fetch(sheetUrl);
        const data = await response.text();
        return {
            statusCode: 200,
            body: data
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: "Erreur lors de la récupération du fichier"
        };
    }
};
