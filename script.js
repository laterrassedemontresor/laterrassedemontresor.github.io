'use strict';

// Enregistrement du Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker enregistré avec succès:', registration.scope);
      })
      .catch((error) => {
        console.error("Échec de l'enregistrement du Service Worker:", error);
      });
  });
}

// Encapsulation de tout le script
(() => {
  // --- 1. CONFIGURATION ---
  const config = {
    firebase: {
      apiKey: 'AIzaSyAez8fncKVaNuOzrTfDXmacs_2K_ptZFQI',
      authDomain: 'poartailaccesspins.firebaseapp.com',
      projectId: 'poartailaccesspins',
      storageBucket: 'poartailaccesspins.appspot.com',
      messagingSenderId: '248588255030',
      appId: '1:248588255030:web:d1a50104cbc330412cbd97',
    },
    webhookUrl:
      'https://www.virtualsmarthome.xyz/url_routine_trigger/activate.php?trigger=e8510729-ccdb-48a6-9318-69b1fcfb9b66&token=df891f32-7468-4fb0-844d-571d6cba056b&response=html',
    pinLength: 4,
    adminEmail: 'cunrug@gmail.com',
    tripleClickThresholdMs: 500,
    managerPinCode: 'XTOF',
  };

  // --- 2. ÉTAT DE L'APPLICATION ---
  const state = {
    currentEditingPinId: null,
    currentSortBy: 'dateOut',
    currentSortOrder: 'asc',
    guest: {
      pin: null,
      expirationDate: null,
      intervalId: null,
      tripleClickCount: 0,
      tripleClickTimer: null,
    },
    debounceTimer: null,
  };

  // --- 3. SÉLECTION DES ÉLÉMENTS DU DOM ---
  const dom = {
    guestApp: document.getElementById('guest-app'),
    managerApp: document.getElementById('manager-app'),
    guest: {
      logo: document.getElementById('guestLogo'),
      message: document.getElementById('guestMessage'),
      pinInput: document.getElementById('guestPinInput'),
      pinEntry: document.getElementById('guestPinEntry'),
      dynamicContent: document.getElementById('dynamicGuestContent'),
      dateOut: document.getElementById('guestDateOut'),
      checkPinButton: document.getElementById('guestCheckPinButton'),
      backspaceButton: document.getElementById('guestBackspaceButton'),
      portalButton: document.getElementById('portalBtn'),
      resetButton: document.getElementById('resetButton'),
      loginContainer: document.getElementById('guestLoginContainer'),
      googleSignInBtn: document.getElementById('google-sign-in-btn'),
    },
    manager: {
      returnToGuestBtn: document.getElementById('returnToGuestButton'),
      userAvatar: document.getElementById('user-avatar'),
      messages: {
        success: document.getElementById('message-success'),
        danger: document.getElementById('message-danger'),
        primary: document.getElementById('message-primary'),
      },
      form: {
        form: document.getElementById('pinForm'),
        pinCodeInput: document.getElementById('form-pin-code'),
        dateInInput: document.getElementById('form-date-in'),
        dateOutInput: document.getElementById('form-date-out'),
        contactInput: document.getElementById('form-contact'),
        phoneInput: document.getElementById('form-phone'),
        submitButton: document.getElementById('submitForm'),
        cancelButton: document.getElementById('cancelForm'),
      },
      pinsList: document.getElementById('pinsList'),
      controls: {
        generatePinBtn: document.getElementById('generatePinButton'),
        sortBtn: document.getElementById('sortButton'),
        sortMenu: document.getElementById('sortMenu'),
        searchQueryInput: document.getElementById('permanentSearchQuery'),
        resultsCount: document.getElementById('results-count'),
        clearSearchBtn: document.getElementById('clearSearchButton'),
      },
    },
  };

  // --- 4. SERVICES (Firebase) ---
  firebase.initializeApp(config.firebase);
  const db = firebase.firestore();
  const auth = firebase.auth();
  const googleProvider = new firebase.auth.GoogleAuthProvider();
  // Scaling - Modif debut
  // Variables pour les dimensions de base de votre design
  const DESIGN_WIDTH = 400; // Largeur de référence de votre design
  const DESIGN_HEIGHT = 650; // Hauteur de référence de votre design

  // Référence à l'élément principal de l'application
  const appWrapper = document.getElementById('app-wrapper');

  /**
   * Applique une mise à l'échelle à l'application pour l'adapter à la taille du viewport,
   * tout en maintenant le ratio d'aspect.
   */
  function applyScaling() {
    // Dimensions de la fenêtre visible (viewport)
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calcul du facteur d'échelle pour que l'application rentre dans l'écran
    const scaleX = viewportWidth / DESIGN_WIDTH;
    const scaleY = viewportHeight / DESIGN_HEIGHT;
    // Prend le plus petit facteur pour maintenir les proportions et éviter de dépasser l'écran
    const scaleFactor = Math.min(scaleX, scaleY);

    // Applique la transformation CSS de centrage et de mise à l'échelle
    if (appWrapper) {
      // Vérification pour s'assurer que l'élément existe avant de le manipuler
      appWrapper.style.transform = `translate(-50%, -50%) scale(${scaleFactor})`;
    }
  }

  // Appliquer la mise à l'échelle dès que l'élément appWrapper est disponible
  // et réappliquer si la fenêtre est redimensionnée ou l'orientation change.
  if (appWrapper) {
    // S'assurer que l'élément #app-wrapper est bien disponible
    applyScaling(); // Appel initial au chargement du script
    window.addEventListener('resize', applyScaling); // Réagir aux redimensionnements de la fenêtre (ex: sur PC)
    window.addEventListener('orientationchange', applyScaling); // Réagir aux changements d'orientation sur mobile
  }
  // Scaling - Modif fin

  // --- 5. FONCTIONS UTILITAIRES ---
  
  // Variable pour stocker le contexte audio de manière persistante.
  let audioContextInstance = null;
  
  /**
   * Obtient ou crée l'AudioContext et tente de le relancer s'il est suspendu (bloqué par le navigateur).
   * @returns {AudioContext | null} L'instance du contexte audio, ou null si l'API n'est pas supportée.
   */
  const getAudioContext = () => {
    if (!window.AudioContext && !window.webkitAudioContext) {
        console.error('API Web Audio non supportée par ce navigateur.');
        return null;
    }
    
    if (!audioContextInstance) {
      audioContextInstance = new (window.AudioContext || window.webkitAudioContext)();
      console.log('AudioContext créé pour la première fois.');
    }
    
    // Tente de reprendre le contexte s'il est suspendu (bloqué)
    if (audioContextInstance.state === 'suspended') {
      console.log('AudioContext est suspendu. Tentative de reprise...');
      // La reprise doit être gérée par une promesse
      audioContextInstance.resume().then(() => {
          console.log('AudioContext repris (était suspendu). État actuel:', audioContextInstance.state);
      }).catch(e => console.error("Erreur lors de la reprise du contexte audio:", e));
    } else {
        console.log('AudioContext déjà actif. État actuel:', audioContextInstance.state);
    }
    
    return audioContextInstance;
  }
  
  /**
   * Génère une série de bips audio pour simuler un carillon, en utilisant l'API Web Audio.
   * @param {number} count Le nombre de bips à jouer (par défaut 5).
   * @param {number} durationMs La durée de chaque bip en millisecondes (par défaut 100).
   * @param {number} intervalMs L'intervalle entre chaque bip en millisecondes (par défaut 150).
   * @param {number} frequency La fréquence du son en Hertz (par défaut 880).
   */
  const simulateFiveBeeps = (count = 5, durationMs = 100, intervalMs = 150, frequency = 880) => {
    console.log(`Début de la simulation de ${count} bips...`);
    const audioCtx = getAudioContext();
    if (!audioCtx) {
        console.warn('Impossible de jouer les bips car aucun AudioContext n a pu être obtenu.');
        return;
    }
    
    const durationSec = durationMs / 1000;
    const intervalSec = intervalMs / 1000;

    for (let i = 0; i < count; i++) {
      // Créer un nœud d'oscillateur (génère la forme d'onde)
      const oscillator = audioCtx.createOscillator();
      // Créer un nœud de gain (contrôle le volume)
      const gainNode = audioCtx.createGain();

      // Connecter l'oscillateur au gain, puis le gain à la destination (haut-parleurs)
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      // Définir la forme d'onde et la fréquence
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

      // Définir le volume (gain)
      gainNode.gain.setValueAtTime(1, audioCtx.currentTime);

      // Calculer l'heure de début et d'arrêt de ce bip
      const startTime = audioCtx.currentTime + i * intervalSec;
      const stopTime = startTime + durationSec;

      // Planifier le démarrage et l'arrêt du son
      oscillator.start(startTime);
      oscillator.stop(stopTime);
      
      // Ajouter une petite rampe de descente du gain à la fin pour éviter un "clic" audible
      gainNode.gain.exponentialRampToValueAtTime(0.00001, stopTime); 
    }
    console.log('Fin du séquencement des bips dans l AudioContext.');
  };
  
  const utils = {
    storage: {
      savePinData: (pinCode, expirationDate) => {
        const pinData = {
          pinCode,
          expirationDate: expirationDate ? expirationDate.getTime() : null,
          savedAt: new Date().getTime(),
        };
        localStorage.setItem('guestPinData', JSON.stringify(pinData));
      },
      loadPinData: () => {
        try {
          const stored = localStorage.getItem('guestPinData');
          if (!stored) return null;
          const pinData = JSON.parse(stored);
          return {
            pinCode: pinData.pinCode,
            expirationDate: pinData.expirationDate ? new Date(pinData.expirationDate) : null,
            savedAt: new Date(pinData.savedAt),
          };
        } catch (error) {
          console.error('Erreur lors du chargement des données PIN:', error);
          return null;
        }
      },
      clearPinData: () => {
        localStorage.removeItem('guestPinData');
      },
    },
    formatDateDisplay: (dateObject) => {
      if (!(dateObject instanceof Date) || isNaN(dateObject)) return '';
      const options = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      };
      return dateObject.toLocaleDateString('fr-FR', options);
    },
    generateRandomPin: (length) => {
      let result = '';
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      return result;
    },
    getPinStatus: (pinData, now) => {
      const dateIn = pinData.dateIn;
      const dateOut = pinData.dateOut;
      if (dateIn && now < dateIn) return 'future';
      if (dateOut && now > dateOut) return 'expired';
      return 'active';
    },
  };

  // --- 6. MANIPULATION DE L'UI ---
  const ui = {
    showMessage: (type, message, duration = 3000) => {
      Object.values(dom.manager.messages).forEach((el) => (el.style.display = 'none'));
      const messageEl = dom.manager.messages[type === 'info' ? 'primary' : type];
      if (!messageEl) return;

      messageEl.textContent = message;
      messageEl.style.display = 'block';
      setTimeout(() => {
        messageEl.style.display = 'none';
      }, duration);
    },

    guest: {
      checkStoredPin: async () => {
        const storedPinData = utils.storage.loadPinData();
        if (!storedPinData?.pinCode) {
          ui.guest.resetSystem();
          return;
        }

        try {
          const querySnapshot = await db
            .collection('pins')
            .where('pinCode', '==', storedPinData.pinCode)
            .limit(1)
            .get();

          if (querySnapshot.empty) {
            utils.storage.clearPinData();
            ui.guest.resetSystem();
            return;
          }

          const pinData = querySnapshot.docs[0].data();
          const now = new Date();
          const dateIn = pinData.dateIn?.toDate();
          const dateOut = pinData.dateOut?.toDate();

          if (dateIn && now < dateIn) {
            ui.guest.displayMessage(
              'info',
              `Votre code sera actif à partir du ${utils.formatDateDisplay(dateIn)}.`
            );
            ui.guest.resetSystem();
            utils.storage.clearPinData();
          } else if (dateOut && now > dateOut) {
            ui.guest.displayMessage(
              'alert',
              `Votre code PIN a expiré le ${utils.formatDateDisplay(dateOut)}.`
            );
            ui.guest.resetSystem();
            utils.storage.clearPinData();
          } else {
            state.guest.pin = storedPinData.pinCode;
            state.guest.expirationDate = dateOut;

            if (
              dateOut &&
              (!storedPinData.expirationDate ||
                Math.abs(dateOut.getTime() - storedPinData.expirationDate.getTime()) > 1000)
            ) {
              utils.storage.savePinData(storedPinData.pinCode, dateOut);
            }

            ui.guest.startExpirationTimer();
            ui.guest.displayMessage('success', 'Code PIN actif. Bienvenue !');

            if (dateOut) {
              dom.guest.dateOut.textContent =
                "Valable jusqu'au : " + utils.formatDateDisplay(dateOut);
              dom.guest.dateOut.style.display = '';
            } else {
              dom.guest.dateOut.textContent = '';
              dom.guest.dateOut.style.display = 'none';
            }

            dom.guest.pinEntry.classList.add('app-hidden');
            dom.guest.dynamicContent.classList.remove('app-hidden');
          }
        } catch (error) {
          console.error('Erreur lors de la vérification du PIN stocké:', error);
          utils.storage.clearPinData();
          ui.guest.resetSystem();
        }
      },
      showApp: () => {
        dom.managerApp.classList.add('app-hidden');
        dom.guestApp.classList.remove('app-hidden');
        ui.guest.checkStoredPin();
      },
      displayMessage: (type, message) => {
        dom.guest.message.textContent = message;
        dom.guest.message.className = 'guest-message';
        if (type) dom.guest.message.classList.add(type);
      },
      updateButtonStates: () => {
        const pinLength = dom.guest.pinInput.value.length;
        dom.guest.checkPinButton.disabled = pinLength !== config.pinLength;
        dom.guest.backspaceButton.disabled = pinLength === 0;
      },
      resetSystem: () => {
        if (state.guest.intervalId) clearInterval(state.guest.intervalId);
        if (dom.guest.dateOut) {
          dom.guest.dateOut.textContent = '';
          dom.guest.dateOut.style.display = 'none';
        }

        utils.storage.clearPinData();
        Object.assign(state.guest, {
          pin: null,
          expirationDate: null,
          intervalId: null,
          tripleClickCount: 0,
        });

        if (state.guest.tripleClickTimer) clearTimeout(state.guest.tripleClickTimer);

        dom.guest.pinInput.value = '';
        ui.guest.updateButtonStates();
        ui.guest.displayMessage('info', "Saisissez votre code d'accès");
        dom.guest.pinEntry.classList.remove('app-hidden');
        dom.guest.dynamicContent.classList.add('app-hidden');
        dom.guest.loginContainer.classList.add('app-hidden');
      },
      startExpirationTimer: () => {
        if (state.guest.intervalId) clearInterval(state.guest.intervalId);
        if (state.guest.pin && state.guest.expirationDate) {
