exports.handler = async function(event, context) {
    // L'URL de votre feuille Google Sheets (la même que dans votre HTML)
    const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPS5zMM1RwapLlcJ0ljKeaHbYqGGoQSrCfN8YoWxYcxWCSphQNFpqBYCMxwECVt_qr1MoaC0ExFgf-/pub?gid=0&single=true&output=csv";

    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        if (!response.ok) {
            // Si Google Sheets renvoie une erreur (par ex. 404, 500)
            return {
                statusCode: response.status,
                body: `Erreur du serveur Google Sheets : ${response.statusText}`
            };
        }
        const data = await response.text();

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*", // Autorise l'accès depuis n'importe quel domaine (votre site Netlify)
                "Access-Control-Allow-Methods": "GET",
                "Content-Type": "text/csv; charset=utf-8" // Spécifie le type de contenu et l'encodage
            },
            body: data
        };
    } catch (error) {
        console.error("Erreur dans la fonction Netlify:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Erreur interne du serveur: ${error.message}` })
        };
    }
};
