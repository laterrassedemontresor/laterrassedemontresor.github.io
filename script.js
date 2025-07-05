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
(async () => {
  // <--- ADDED 'async' HERE
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
      portalButtonClickHandler: null, // New: To store the click handler for removal
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
      portalButton: document.getElementById('mainPortalButton'), // Updated ID
      portalActionText: document.getElementById('portalActionText'), // New: Select the portal action text
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
    appVersionDisplay: document.getElementById('app-version-display'),
  };
  // Removed old button sizing logic as the new button has fixed dimensions
  // const oldBtn = document.querySelector('.action-btn--success');
  // const newBtn = document.getElementById('portalBtn');
  // if (oldBtn && newBtn) {
  //   const rect = oldBtn.getBoundingClientRect();
  //   newBtn.style.width = `${rect.width}px`;
  //   newBtn.style.height = `${rect.width}px`;
  // }
  // --- 4. SERVICES (Firebase) ---
  firebase.initializeApp(config.firebase);
  const db = firebase.firestore();
  const auth = firebase.auth();
  const googleProvider = new firebase.auth.GoogleAuthProvider();

  // --- 5. FONCTIONS UTILITAIRES ---
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

  // --- NOUVELLE FONCTION POUR RÉCUPÉRER LA VERSION DU SERVICE WORKER VIA FETCH ---
  /**
   * Récupère la version du Service Worker en parsant le contenu de service-worker.js
   * via une requête fetch.
   * @returns {Promise<string|null>} La version du Service Worker ou null si non trouvée/erreur.
   */
  async function getServiceWorkerVersionFromFetch() {
    try {
      // Effectue une requête pour récupérer le contenu du service-worker.js
      // Assurez-vous que le chemin '/service-worker.js' est correct pour votre application.
      const response = await fetch('/service-worker.js');

      if (!response.ok) {
        console.error(
          `Erreur HTTP lors de la récupération du service-worker.js: ${response.status}`
        );
        return null;
      }

      const swContent = await response.text();

      // Utilise une expression régulière pour trouver la version.
      // Cette regex cherche 'const CACHE_VERSION = ' suivi d'une chaîne entre guillemets simples ou doubles.
      const versionMatch = swContent.match(/const\s+CACHE_VERSION\s*=\s*["']([^"']+)["']/);

      if (versionMatch && versionMatch[1]) {
        return versionMatch[1]; // Retourne la version capturée
      } else {
        console.warn(
          "Impossible de trouver 'CACHE_VERSION' dans le fichier service-worker.js. Vérifiez le format."
        );
        return null;
      }
    } catch (error) {
      console.error('Erreur lors de la récupération ou du traitement du service-worker.js:', error);
      return null;
    }
  }
  // --- FIN DE LA NOUVELLE FONCTION ---

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
            ui.guest.displayMessage('success', 'Code PIN actif. Bien bienvenue !');

            if (dateOut) {
              dom.guest.dateOut.textContent =
                "Valable jusqu'au : " + utils.formatDateDisplay(dateOut);
              dom.guest.dateOut.style.display = ''; // Ensure it's visible
            } else {
              dom.guest.dateOut.textContent = '';
              dom.guest.dateOut.style.display = 'none';
            }

            dom.guest.pinEntry.classList.add('app-hidden');
            dom.guest.dynamicContent.classList.remove('app-hidden');

            // --- START New/Modified Code for Portal Action Screen ---
            dom.guestApp.classList.add('portal-active'); // Add class to guest-app to hide header elements
            // dom.guest.portalButton.textContent = ''; // REMOVED: This line was removing the icon from the button
            dom.guest.portalActionText.classList.remove('app-hidden'); // Show the instruction text

            // Add click listener for button background inversion
            const handlePortalButtonClick = () => {};
            // Store the handler so it can be removed on reset
            // --- END New/Modified Code ---
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

        // --- START New/Modified Code for Portal Action Screen Reset ---
        dom.guestApp.classList.remove('portal-active'); // Remove class to show header elements
        dom.guest.portalActionText.classList.add('app-hidden'); // Hide the instruction text
        // Remove the click listener
        if (state.guest.portalButtonClickHandler) {
        }
        // --- END New/Modified Code ---
      },
      startExpirationTimer: () => {
        if (state.guest.intervalId) clearInterval(state.guest.intervalId);
        if (state.guest.pin && state.guest.expirationDate) {
          state.guest.intervalId = setInterval(() => {
            if (new Date() >= state.guest.expirationDate) {
              ui.guest.displayMessage('alert', `Code PIN "${state.guest.pin}" expiré.`);
              utils.storage.clearPinData();
              ui.guest.resetSystem();
            }
          }, 1000);
        }
      },
    },

    manager: {
      showApp: () => {
        dom.guestApp.classList.add('app-hidden');
        dom.managerApp.classList.remove('app-hidden');
        handlers.manager.loadPins();
      },
      resetForm: () => {
        dom.manager.form.form.reset();
        state.currentEditingPinId = null;
        dom.manager.form.submitButton.textContent = '✓';
        ui.manager.updateButtonStates();
        dom.manager.form.form.classList.remove('is-active');
        dom.manager.form.pinCodeInput.focus();
      },
      addPinToDOM: (pin) => {
        const now = new Date();
        const dateIn = pin.dateIn?.toDate();
        const dateOut = pin.dateOut?.toDate();
        const status = utils.getPinStatus(
          {
            dateIn,
            dateOut,
          },
          now
        );

        const li = document.createElement('li');
        li.dataset.id = pin.id;
        li.classList.add('pin-item');

        let statusClass = '';
        switch (status) {
          case 'active':
            statusClass = 'active';
            break;
          case 'expired':
            statusClass = 'expired';
            break;
          case 'future':
            statusClass = 'future';
            break;
        }

        li.innerHTML = `
          <div class="pin-details">
            <div class="pin-code ${statusClass}">${pin.pinCode}</div>
            <div class="pin-contact">${pin.contact || 'N/A'}</div>
            <div class="pin-phone">${pin.phone || 'N/A'}</div>
          </div>
          <div class="pin-dates-display">
            <div class="pin-date-in-display">Du: ${
              dateIn ? utils.formatDateDisplay(dateIn) : 'N/A'
            }</div>
            <div class="pin-date-out-display">Au: ${
              dateOut ? utils.formatDateDisplay(dateOut) : 'N/A'
            }</div>
          </div>
          <div class="pin-actions">
            <button class="action-btn btn-edit" data-action="edit">
              <img width="24" height="24" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iI2ZmZiIgY2xhc3M9ImJpIGJpLWVkaXQiIHZpZXdCb3g9IjAgMCAxNiAxNiI+CiAgPHBhdGggZD0iTTE1LjUxNCAwLjkwN2wtMS41ODctMS41ODZhMSAxIDAgMCAwLTEuNDE0IDBMOS44MTcgMy42NDdsNC45MDUgNC45MDVsMy42NDUtMy42NDdhMSAxIDAgMCAwIDAtMS40MTRsLTEuNTg2LTEuNTg3YTEgMSAwIDAgMC0uMDAyLS4wMDJ6TTYuNjk3IDguNjQ2bC00LjY0NiAxLjUzNkExLjUgMS41IDAgMCAwIDAgMTAuODY4di4yMzJsLTMuMjM1IDQuNDEzYTEgMSAwIDAgMCAuNzQ2IDEuNTQxbDIuMjgxIDAtLjQyNyAyLjc3MWExLjUgMS41IDAgMCAwIDEuNzI0IDEuMjI0bDIuMzE1LS40NDkgMi43NzQtLjQyNyAxLjUzNS00LjY0N3pNNS43ODkgMTIuNzIxTDEuNjQ2IDguMjM1bDMuNjQ2LTMuNjQ1bDMuMjM1IDQuOTAyekIvPgo8L3N2Zz4=" />
            </button>
            <button class="action-btn action-btn--danger btn-danger" data-action="delete">
              <img width="24" height="24" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iI2ZmZiIgY2xhc3M9ImJpIGJpLXRyYXNoIiB2aWV3Qm94PSIwIDAgMTYgMTYiPgogIDxwYXRoIGQ9Ik01LjUgNWExLjUgMS41IDAgMCAxIDAtMyAzLjUgMy41IDAgMCAwLTcuNSA3LjVoLS41YTEgMSAwIDAgMSAwLTJoLjVhMi41IDIuNSAwIDAgMSAyLjUtMi41VjUuNXptNi0xYTIuNSAyLjUgMCAwIDAtNSAwVjIuNWExLjUgMS41IDAgMCAxIDMtLjUu5.5IDAgMCAwIDAtMUExLjUgMS41IDAgMCAxIDcuNSAyLjVWMXptMi41IDZhNC41IDQuNSAwIDEgMSAtOSAwIDQuNSg0LjUgMCAwIDEtMS41IDAtLjUu9IDAgMCA0gItMSAwLTQuNSAzIDAgMSAwLjk4IDktLjI2MiAxLjYgMS42IDAgMCAwIDEuMjU2IDIgMy43IDMyNjk2NCwyMzI5NjQsMjMzOTY0LDE3Mjk2NCwyMTg5NjUsMjMzOTY1LDE2MjUwNiwyMzYwMzYsMjM5NzYzLDIzOTk2MywxNzI5NjUsMTYyMjMzLDYzODMzMywxNzU5NjcsMjMxOTY0LDE3ODMyMSwxODU2NjcsMjAzOTY4LDY5NjMzNCwxNjkzMzQsMTU2OTY0LDE2OTQ0NCwxNjg4MzYsMTc0NjY3LDE3NTk2NywxODExMDUsMTc1OTY3LDE2MzIyNywxNTU0ODMsMTU4MjMyLDE2MTk2MywxNjIyODMsMTUzOTY0LDE1Mjk2NSwxNTcwNDYsMTU0NDU1LDE1NTk1NywxNjIzMTIsMTU3ODMyLDE1NzE0MywxNjk5NjQsMTYxNDQ3LDE3NjU5OCwxNjI0ODMsMTcxOTY3LDE3NDc0NSwxODA2NjQsMTg1MTk2LDE4ODc2NCwxODMzMzMsMTkwMzM2LjAxMiAyNzQgMjUxLjYzNCAzMjIuNTk1IDM1Ny41MDcgMzg4LjY3IDQ0Mi41MzUgNDg2LjY3NSA1MDEuMjMzIDUxMy44IDMzMy42NjggMzU2LjcwMiAzNjcuNjk3IDM5OC42NjkgMzk2LjcyNyA0MTUuOTk1IDQ0Ni43OTkgNDY5LjA0MiA0OTkuNTA1IDU0Mi4xNDIgNTUxLjg2NyA1OTYuNzY0IDYzOS43OTIgNjg5LjAxMiA3MTMuMjk1IDc3Ni44MzcgODc0Ljk0NiA5ODMuNTY2IDEwODcuNDk5IDEyMjUuNDgxIDEzNzUuOTU0IDE0ODcgMTczMi4xODUgMjE1Ni43OTUgMjYxNC40NDMgMzExNC4yNzMgMzQ1NC45OTggNDI4OC41MTcgNDczNi4zMDYgNTcxMi4wNjggNTkxNC4wMDMgNzEyNC40OTggODc5NC4xMTYgMTA0NzEuODU4IDEyMTY3LjEyNSAxNzAyNi40MjIgMjQyMjIuNzQ3IDI3MjQ1LjU1NiAzNjk3Ny43NzcgNDgzMDIuNDI0IDU5Mjg2LjU5MiA3NDczOC41NjggOTg0NTMuNzUgMTU3NjQ4LjcyMyAyMDE5NTYuNjkgMjc0MTE3Ljg1MyAzNjYzMTIuMjQxIDQ4ODI0My43NDcgNzAzMzUwLjM3NSAxMTA2Nzc4LjAyNyAxNjY0NjEyLjkwMiAyNTM3MDQyLjgwNyA1NDMxOTAxLjMxNyA1Nzc0MjY2LjIyNiA3NzY1OTI4LjM0NCAxMTY1MzQ2Mi41MzcgMTYxMzc4MTkuMTMgMjM0ODE5NjcuMDQ0IDMyMDg2NTM0MC45MSAzNDQ0MDQ0NzcuNDQ2IDYwNTUwODMzMy4zMyA4MTc3MjM2MTEuMDkxIDEwMjYwNDAxMjYuMjUzIDExNzY3Nzc2OTMuNjI4IDEzMTc0MDU2MzMuOTExIDE0MzM0ODY3MDQuMDY5IDE1Mjk2NzU2NzcuOTgxIDE2MDc3OTMwNzkuNjg1IDE2NDY4ODk1MTAuNzggMTY2NzQwMzEwMi44MiAxNjkzMzMyODQ3Ljc4IDE3MDUyMjc2MzIuOTIgMTcwODM0OTM1MS45NiAxNzA3NzI0NDQyLjYyIDE2ODk1NzMyODcuMTIgMTY0NDczODExNy40NCAxNTc0ODIyOTM0LjI3IDE0OTMyNjk0ODQuMDMgMTQxMDgwMzkyMy4zMyAxMzE5OTg2NDE2Ljc3IDEyMjk0MzYzODEuMDMgMTE0MzcxNDg0Ni4xOCAxMDU1OTczOTM3LjA3IDk2ODk4MjQ4MS4zMyA4ODJDNjE4MzUuOTMgNzk2MTQ3NTM4LjIzIDcxMTIwODY0OS41IDYxODc2NjUyNS44IDUyNTY5MDk3OS4zIDQzMjczMDUzMS42NiAzMzI1MDAwMDcuNCAyMzg0MTIwNDEuMiAxNDk4NDkzNjIuNCA2NzYxMzAwMC40NCAxMTYyNjg3Ni42OCAxMjE0NzIyLjI5IDI5NTY2MTcuMDYgNzk1Njc4LjAzIDc5MzkxLjQ1IDQzNjEzLjY4IDM5NTI2LjQ1IDM1NDc0Ljc0IDMzNDI1LjEzIDI1OTMxLjkyIDIyMjQyLjk2IDE2ODU2LjY1IDExMzg4LjYxIDI1NDQuNSAxMTI0LjEgMC45OSAxLjAtNi41OS0zNS40OSAwLTM3LjQ4Ni01MC01Ny45NC03My42OTgtOTIuOTc4LTExNS41ODQtMTQ4LjU4Mi0xNjQuOTM3LTIxNC4wNzktMjI5Ljg1LTI3NC42NTMtMjg1Ljc3My0zMTIuNzg1LTI5OS40MjQtMzE1LjEzLTMwNy42MjEtMjk1LjE0NS0yODUuNTA5LTI1My4zNi0yMTUuMzk5LTExNi41NzEtNDguNTA5LTE0LjExMi0xNi4wMzItOS41MjgtNy40MTItMy40OTctMy4xNTktMC43NDUtMC4xMzctMC4wMTctMC4wMDEtNS42OS02OC4yMzgtMTIzLjA0Mi0xNzQuOTgzLTIzMi4zMDgtMzQyLjM0OC01NTguNjM2LTYxNy4xMzgtOTc5LjQ0Ni0xMzAxLjE0My0xOTQ2LjM2NC0yOTk4Ljc4NC0yOTQyLjUyNy00Mzg4LjA2Ni01NzY3Ljk2Ny01OTg0LjUxMS03MjUyLjI2NC03OTM5LjY5OC05NTY2LjA5NC0xMTMwMC44NjctMTMyNTIuMzY5LTE2NTEyLjc5LTI0MTk0LjU3OC0zNjAzNy42NjQtNDM2NzAuMTk1LTYwMjM1LjAyNS04MDk2NS45NDgtMTIxMjE1LjA3NS0xNzk4NjUuNTYzLTI2NzY3Mi42OTUtMzc1NTk2Ljc1OC01MDc2MzAuODI4LTc5MjMzOC44MTItMTIwNjg3My4wMzgtMTgxMTA3MC44ODYtMjcyMTg0NS43NTktMzgwNDMzMy4xNDMtNTY5NDYxNy42NzQtODEwOTM3Ny4zNzYtMTMxNDExNTIuOTA3LTE4NDQzNjA1LjM0Ni0yNDgwMjUxMy4zNjMtMzQ0NTUwMDYuMTc2LTQ4MTY0MzAzLjUyNS01OTA2NjQ3MC40OC03OTE2ODAzOC44NTItOTQzNzg2NDkuODQ2LTEwODU1MTczNC4zNjMtMTIxNTUzOTIyLjU4Ni0xMzE4MjQwOTIuNTM3LTE0MDY5NjA0MC40OTctMTQ4OTYzMDUwLjMxMy0xNTY2MDAxMzcuODExLTE2MjU4MDE2MC4yMTQtMTY3NDg3NDgxLjIxOC0xNjg5Nzc0MTcuMjgtMTY4MDkzOTg0LjI0LTE2NjM1NTUxMC4zMS0xNjA1MzkxMjYuMjYtMTUwMzQ4ODU5Ljk3LTEzNzAwNTMzNy4xMS0xMTc4NjYyOTcuOTMtMTA2NDMxOTM3LjY1LTk5NTM4ODcwLjMyLTkyNDc3MjU0LjA3LTg3MDk0NzQ1LjQyLTgwNjgwNTE3LjczLTc0NjMyNzU5LjA3LTY2MTEyNzQ1LjIyLTU3NjE4NTQ1Ljc2LTQ5NjgxOTE5LjEzLTQxNzA4OTEzLjAzLTM1MjQ0NTcxLjQ4LTI5NzMzNzU2Ljk3LTI0NzkzMDQ5LjEzLTIxNjY2NjY2LjY3LTE4NDQ0NDQ0LjQ0LTE2NDcyNjc2Ljc2LTE0Nzc0MDc0LjA3LTExMTc5NTU1LjU2LTY5NzcwNjAuNi0yOTE5NjIxLjI3LTEwMjg0ODQuODQtMzM1ODUwLjE2LTIzNjMyNy4yNS0xNjY4MjAuNTktMTQwOTc4LjUzLTEzMzU1Ny44NS04ODgzNi45Mi04MTgxOC4xOC02OTY5Ni45Ny01ODc4Ny44OC00NzMyMi4yMi0zMzA3MC44Ni0yNTA5My4zMy0xOTUyNi4yNi0xNjY0Ni40Ni0xMjgyOC4yOC02NTA1LjA1LTMwODAuODEtMjQyNC4yNC0xMjYyLjYzLTU4Mi44My0yNDIuNDItOTAuOTA5LTQwLjQxNi02LjA2LTEuNTY1LTAuNTA2LTAuMDk1LTAuMDE0IDIuNzYzIDU1LjU3NSA5MS41NTggMTIzLjE0OSAxNTYuNjI0IDIxMC45NTggMzI2LjY5MiA0MTguMjQgNTQyLjYwMyA4MjkuMDUxIDEyMjIuNzQ4IDE4OTQuODU4IDMxODkuNzI2IDU1OTcuMDk3IDkwMTQuOTkgMTU2NzAuNzY0IDI1MTU0LjU1NCA0MDcyNC40OTEgNTg0NTEuMTQzIDg3Mjk2LjQ2MyAxMjI5NTIuMDk2IDE1NDU5My4wOTIgMjUxOTY4LjQzNyAzOTgzMDUuOTU4IDY0ODE4MC4xMTggMTEwNzY1Mi42MDUgMTczMzI1Mi42MDUgMjUzMTMwNy41MTQgNDI4MTMyNi43MyA2ODA1Njk4LjEzMyAxMDMxMzY1Ny43MzggMTU0MDY2NDUuNzQ3IDIyNzYwMDczLjc0OSAzMDMxODg4OC44ODggMzkzODU4NTguNTg3IDQ4MTQ2MzYzLjYzMiA1NzEyMDQ3Ny40NTMgNjY1MDQ4OTguODg2IDc3MDYxOTk3Ljk4NSA4NjgzNjkwOS4wOTkgOTU4NDcwOTcuODUgMTA1NzcwNzU1LjY4MSAxMTQ4MzgyNDQuNDQxIDEyNDgyMTg3OS45MSAxMzI4NzQyODUuNzE2IDE0MDUxODU0Ni42NjggMTQ3Nzk5MTE1Ljc2NSAxNTI2NTAwOTUuMjMyIDE1Njk1Njk5My45OCAxNjE5MDE2OTAuOTcgMTY1MzU5NzEyLjQ1IDE2NzIzNjkxMy4wNjggMTY3NjUxNjM5LjIzNCAxNjU4NzYwOTEuNjEgMTYzNTMyOTIzLjQ5IDE1OTM4MjgzNC40MSAxNTI4MjkwNjMuNzkgMTQ1MzI2OTg4LjIyIDEzNjg3NjAxMy41MSAxMjgwMzE1MDMuODMgMTE5NzgzNzM1LjgyIDEwOTM4NTMzOC4xOSAxMDA3NTYyNTYuMDcgOTIxNDExMTkuNDkgNzQwNTg1MTcuNjYgNjU2NjIyNjEuNiA1NTg0MDQ3Ni4xOSA0ODAxMjk2My43IDQwNjY3NTE5LjI1IDMyODI1MjI4LjQ2IDI2MTA2MDYwLjYxIDIwMDAwMDAwIDE0NDI0MjQyLjQyIDExOTY5Njk2Ljk3IDg1NjU2NTYuNTcgNjQxNDA0MC40IDQwNjA2MDYuMDYgMjQyNDI0Mi40MiAxNDQ0NDQ0LjQ0IDU4NTg1OC41OCAyMjcyNzIuNzIgOTg5ODkuOSAzNzM3My43MyAxODU4NS44NiAxNjM3My43NCA1NzU3LjU3IDIxMjEuMjEgNDI0LjI0IDE4MS44MiAzMC4zMDMgMi4xODItMC4wOTctMC4wMDYtNS44Ny00MC42NDItNzYuOTY1LTExMC42NDItMTc0Ljg5NS0yNTguMjIzLTM5Ni4zOTktNTY5LjczNS04MjguODk5LTEzNzUuOTU0LTIzNjcuMzMzLTM4NTguNjcxLTYxNjMuMzMzLTExMzcyLjczNy0xNjM3My43My0yNjU2NS41OTktNDE4MTguMTc3LTU4NzQ2LjQ3NC04Nzk1Mi4xMDQtMTM4Njg2LjgzNy0xOTQ1NjUuNzM1LTMxNzM3NS43My01OTk1ODguNDUyLTEwMzg2NDcuMjYzLTE2MjkzNTkuMDMzLTI1NTAzMTIuNDMtNDAzNTM1My41MzUtNjA0NjY3Ny43NzgtOTE4ODcyNy4yNzQtMTMyNzQ4NzguNzc3LTE3NTYwNjA2LjA2Ni0yNjcwNjk0Mi41MzQtMzk4OTg2ODMuMTkxLTUwODMxNjM0LjYxNi02NDY5MjM4My4xOTEtODMxMzEzMTMuMTk0LTkxMjEyMTIxLjIyNy0xMDM2MDIwMjAuMjAzLTExNjk1OTQ5NC45NDctMTMwMjg5NjIxLjI3Ny0xNDAyMDQwNDAuNDA2LTE0NzUyMjMyMy4yMzUtMTUxMjgyNDg5LjguMS0xNTMxMjEyMTIuMTI1LTE1MjQ1NDU0NS40NTEtMTQ3OTE5MTkxLjkwNi0xNDE5MTk3OTcuOTgtMTMzNTY1NjU2LjU3OS0xMjUyNjI2MjYuMjU2LTExNjk1OTU5NS45NDYtMTAzNzM3MzczLjczNy05MjY1NjU2NS42NTYtODEzMjEwMTEuMTExLTY5Njc2NzY3LjY3Ni02MDQyNDI0Mi40MjYtNTE1MTUxNTEuNTE2LTQzMTQxNDE0LjE0Ni0zNTUwNTA1MC41MS0yNzM0NzQ3NC43NTQtMjExMTExMTEuMTEtMTU1NTU1NTUuNTU2LTExNjY4NjguNjggLTMxNzUuNzU4LTYwNi4wNi0zMzMuMzM2LTMwLjMwNi0xLjUxOS0wLjE5OC0wLjAyNS0wLjAxNyAwLjY2NS0zNS45MTktOTEuMjgyLTEzMS40NjktMTk0Ljk2OS0zMTkuNTQ2LTU0MC41NzYtODUwLjI1Ny0xNTI2Ljg5OS0yOTI4LjQ4NS00ODA3LjA2Ny05MTAyLjAyLTE1NTg3LjUyLTI0NDcxLjI5My00MDA2My4zNDYtNjA1OTYuODgxLTg3NDk4LjQ0My0xMzAwMjQuNzUtMjA2Mjg5LjUzOS0zMTg1MjkuMTUyLTM5MzUxOS40MjctNjU1Njg2LjE5Mi04NzMzMjkuMzkxLTEzMjkzNTQuMzYzLTE5Mjg5MzkuMzg1LTM2MTA5NzkuNzk5LTU0OTA3NzguOTg0LTgwMjk1MDYuMDY0LTExMzQzMDYzLjY1NC0xNTgxODgwNy44MDktMjE2MTQ4NDguNDg1LTI4ODgxODM4LjgyOS00MDEzMDI1Mi41MjMtNDg5NDc0NzQuNzU4LTY1MzM3MDY5LjY1OS04NDcwODQ4NC44NDYtMTAwNTU1NTU1LjU1My0xMTQzODc4NzguNjg3LTEyMzM5MDkxMC4xNzQtMTI5OTc0MDIxLjcxNC0xMzQ0NzY5MjMuMDc4LTE0MTcyNzU4NS4wMzItMTQ4ODc3NDg5LjIyLTE1NTE0MzE3MC41NTYtMTU5MTY4NjgyLjgyOS0xNjI4MzgzMzMuMzMzLTE2NDk3NzY0Ny45NzYtMTY1NjI0MzE0LjY5Mi0xNjI3NTc1NzUuNzU4LTE1ODQ4NTY2Mi40Ni0xNTI2NTM1NzQuMzctMTQ2MzYwNjA2LjA2OC0xMzk1NjU2NTYuNTY4LTEzMjQwNjA2MC42MDYtMTI0ODcxODcxLjY1OC0xMTU4NDU0NTQuNTQ2LTEwOTc0MzQzNC4zNDUtMTA1MTM3NTc1LjU3OC05NzcwMjE0NS4xNi04OTEyNzI3Mi43MjctODI3MjczNjcuNjYtNzU4NTg1ODUuODY0LTY2NjY2NjY2LjY2Ny01NTk1NzU3NS43NTctNDk3NjQ0NjQuNDU1LTQxNTU5Njk2Ljk3OS0zNTMwMzAzMC4zMDUtMjk4Mjg5ODkuOTk5LTIzOTQwNDE3LjE1MS0xODQ2NjU3Ni4wMi0xNDcwOTkwNi44OTItMTA4NTEwODAuMS03ODQ4NDg0LjgyLTMwMzAzMDMuMDM3LTkwOTE3LjkyOS01MTAwLjQ3Ni0yNzQ5LjYxOC04OTkuOTU5LTI1NC41NDYtMjcuODk3LTAuMzEzIDAuMTY0IDMzLjM3NiA2Mi45MDggMTA3LjEwNiAxODMuNjUxIDQ0OC43MjcgMTExNC4zNDggMTc4OS45MTcgMzA3MC44NiA1NzU3LjU3IDEwMzAzLjAzIDI0OTQ5LjQ5IDUwODAxLjQxNCA3NzQ4NC44NDggMTEzMjYyLjYyNSAxNjczNzMuNzM0IDI1OTAxNi42NjggMzQ2MTc5LjM1NyA0NjU0NTQuNTQ1IDY2Mjc2OS40ODcgOTY0NDQ0LjQ0NSAxMzEzOTM5LjM5NCAxOTAwNjA2LjA1OCAyOTE5NTk1Ljk1NiAzNzIzMjMyLjMyMyA0OTUyMTYyLjI4NyA2ODU4MjIzLjIzMiA5MjE0NTE1LjE1NCAxMjY2Njk2OS42OTYgMTU2OTY5NjkuNjk5IDE4NDg0ODQ4LjQ4NSAyMTIxMjEyMS4yMTMgMjQxMTE1MTUuMTUyIDI2MjgyNTYyLjcxNCAyNzU4NzMwMy4wMzIgMjg2NjU2NTYuNTY4IDI5NDg0ODQ4LjQ4MiAzMDMwMzAzMC4zMDIgMzA1MTUxNTEuNTEzIDMwNDIzMjMyLjMyNyAyOTEwNjA2MC42MDggMjc4MjI0MjQuMjQ1IDI2MTE3MTcxLjcxNiAyNDYzNjM2My42MzYgMjI3NjA2MDYuMDYxIDIxMTEyMTIxLjIxMiAxOTY5NjQ2NC42NDcgMTgzMjMyMzIuMzI4IDE2ODQ4NDg0Ljg0NiAxNDkxMzEzMS4zMTQgMTIzMjMyMzIuMzIyIDg2NzY3NjcuNjczIDUzMzMzMzMuMzMzIDMxNzU3NTcuNTc2IDEyODc4NzguNzc4IDYwNjA2LjA1NyAxODU4NS44NiAxNTQ1OC40ODcgMjg4NS44MiAwLjQ0NSAwLjcyMi01LjA0NC00MC42NDItNjUuNDk3LTExNi44NDYtMTg1Ljg2MS0zMDMuMDI2LTU1Ni42Mi05MDIuOTkzLTIwMDAuMTU3LTM5NTQuNjUzLTY0OTQuMDYyLTEwOTczLjg2NS0xNzk4Ni40MjQtMjY4MTguOTEtMzkzOTEuMTE0LTU0OTE5LjE4OS03NTAyNC41MTItMTA4NDgzLjkxMi0xNzM1MjMuMjMzLTI4MzMzMy42MDYtNDYzNjQ3LjcyMS03MzEyNjkuODYyLTExMzg5NjUuMTUtMTY4MTM5MC4xNzUtMjUwNTkzOS40MTUtMzg4MDY5OC44OTgtNjE1MzkzOS43MTYtOTYxMDI1OS4xNTUtMTQ1MzkzOTMuOTQ0LTIwOTU0Nzk3Ljk4OS0yOTMzODgwNy44MDktMzc1MDM1MDUuNTQ5LTQ2NjY1OTU5LjU5OC01NTc1NzU3NS43NTYtNjQ4NjA2MDYuMDYtNzMxOTY5NjkuNjk4LTgxNzU3NTc1Ljc1Ni04OTE4NjguNjgyLTk0OTEzMTMuMTkzLTk3NzkzNjc4LjQ5Ny05NjEzOTM2NzcuNTQxLTkwNTYzMjMzMi40NDItODI1MTgyNjI2LjUzNC03MzgxODE4MS44MTUtNjY4Njg2ODYuODY5LTU3OTczOTM5LjM5NC00ODcxNzMxMy4xMzMtNDI5Mjg3ODcuODc2LTM1Mjg3NDc0LjczNC0yOTc3OTc5Ny45NzYtMjM4Mzg3ODcuODc1LTE3MjE1MDQ3Ljc5LTEzNzU3NTcuNTc2LTIyNTM1LjMzMS02OTY2LjY1OS0zNzg3Ljg1My0xMjE0Ljk5NC00ODcuODc3LTk1LjY2OC0zOS41MTQtNS44NzktMC42NzctMC4wOTctMC4wMTItMS4wMjItMTYuNjItMzAuODE4LTU4LjM4Mi0xMTIuMzU4LTE4Mi42NTYtNDQwLjU2My03NjkuNDk1LTE5OTQuNzY1LTM3ODcuODc1LTYxOTguNDg1LTEwNDg1Ljg1Ni0xNzk4Ni40MjQtMjcxMTUuMTU4LTQxNTkxLjQ5NS01NzY1MC43OTktODM2NTYuNzAyLTE0NjU0OC41MDgtMjIzNzM0LjYzNy0zMzc5MzguODg4LTU1OTE2Ni42Njc1NS03ODI4NTguNjYxLTM3NDU2OTguMTktNTA1MjQwMC43MDktNzQ5NDgwOC45NzYtMTAzODg1MjcuOTc3LTE0NTIyNzI3LjI3Mi0yMTk5MjUwMi41MDUtMjgxMDE4MTguMTc3LTM1Njk1Njk2Ljk2OC00NDU2NDY0Ni40NjQtNTQzNTM1MzUuMzU2LTYzNTE0MTQxLjQxNC03MzQyNDI0Mi40MjgtODEyMjU0NTQuNTQ1LTg3OTE5MTkxLjkwNi05NTA1NjU2NS42NTUtMTAxNTE1MTUuMTUyLTExMzgzODc4Ny44NzUtMTI5OTg0MDQwLjQwNi0xMzU5NzQyMDguMjE1LTE0MjQ2OTY5Ni45NzQtMTQ3MzcyNzI3LjI3NC0xNTEzODczNzMuNzM0LTE1NDU4ODc4Ny44NzgtMTU2NTQ1NDU0LjU0OC0xNTY1MzYwNjAuNjA3LTE1NTI0MDQwNC4wNDItMTUyODQ3NzQ3LjczMy0xNDczOTY0NjQuNjQ1LTE0MDA0Mjg3OC43ODktMTMyODU4NTg1Ljg2MS0xMjU4OTI5MjkuMjg4LTExOTU2MjYzMi4zMjgtMTEyMDU2NDY0LjY0My0xMDU3MTExMTEuMTA5LTk5MTAxMDExLjExLTkzNjQ2NDY0LjY0Mi04ODE3MTcxLjcxOC04MDAyNzI3Mi43MjQtNzIwNjkwOTAuOTA5LTY0NjQ2NDY0LjY0Mi01NTg3ODc4Ny44NzQtNDY2MDUwNTUuNTU2LTM4MjE5MTkxLjkwNi0zMDY4NDg0OC40ODItMjQ2OTY5NjkuNjk5LTE4OTE3MTcxLjcxOC0xMzU5NTk1OS41OTcgODUwMTk5Ljk4OCAyMTA3NzUuNzU5LTE0NzQ2LjA0Mi02NTIzLjEyNy0zMzMzLjM3NS00NDguNDgyLTIzMi4zMjItMjAuMjAyLTIuNzc1LTAuNDk2LTAuMDg5LTAuMDEzLTAuMDAxLTIuNjI1LTQzLjI4OS05MS4zNDYtMTU0LjE1NS0yNTAuNTE0LTM4Ny42NS04NzQuNDMtMTQ3NC4zMTUtMjcyMS44ODMtNDUzMS41NzYtODAxMi43NzUtMTY0Mjc4MjgtMjU5NTkuNTk0LTM2NjM4LjQ2My01Mzk1My42Ny03MTE3OC4wMjgtMTEwNzU1LjM4NS0xNzY4NjUuNTc1LTI5ODk4OS44OTYtNTM2MzYzLjYzMi04NjU3NjcuNjczLTEzMTIxMjEuMjEzLTE5MDc0NzQuNzUwLTI5ODcwMDcuODMyLTQ0OTUxNTMuNTM0LTY2NTg2NTYuNTY4LTkyMTgyMzIuMzI0LTEzMzQ4NDg0LjgyOS0xNzc5MDkwOS4wOTEtMjUwNjA2MDYuMDYxLTMzMTk3NzM3LjM3Mi00MjMyNTI1Mi41MjMtNTI4NDg1ODUuODY0LTY3NzY0NzQ3LjQ3OS05MDYxNDExMS4xMS0xMDM2ODk5MDAuOTAxLTEyMTEwMTU3MC42NDYtMTM3OTE0NzkxLjcwOC0xNDQ1NzcxNzEuNzE3LTE1MDc2NzMyMy4wMzItMTU0OTI5MjkyLjkyOC0xNTc1NTA1MDQuNTA1LTE1OTU3MjMyMy4yMzQtMTYwNjQ1MDUwLjUwNS0xNjA0ODIzMjMuMjMyLTE1ODE2MzYzNi4zNjQtMTU0MjgwMzAyLjAyMy0xNDcyNzkwOTEuOTAyLTE0MDk5NjM2My42MzctMTM0MDE4NDg0LjgyNy0xMjcwMjY2OTYuOTctMTE5MjM3NjU4LjI5OS0xMDk4OTg1NzUuMTczLTEwMzUzNzY1OC4zLjk5LTEwOTg2NjI5Ny45My0xMjg5NjY1MTkuMjY2LTEzOTk1Njc4Mi43MTMtMTQ4NzY2NDAzLjI5NC0xNTY1NjY1NDEuNjgzLTE2MjY5OTE1Ny45ODctMTY3MTkxNDk1LjY2My0xNjgyNTg3Mjc2LjM1Ny0xNjgwNDg1MjM0LjM3Mi0xNjU4NzYwOTEuNjExLTE2MjU4Njk2OS42OTMtMTU2NDk5ODU5LjI1OS0xNDk1NTM0NzUuNDM2LTE0MjA1NjUyMy4xMzQtMTM1ODc1NzU3LjU1Ny0xMjk2ODY4NjguNjY3LTEyMzM5MDkwOS4wOTMtMTE3ODU3NjU4LjMwNi0xMTIwMzU2NTYuNTY4LTEwNjI4OTk3OS43OTMtOTQ1MzgzODUuMjQ2LTgyMzc4Njg2Ljg1OC03NDQwODE4MS44MTUtNjY0OTQ5NDkuNDk0LTU1Njc1NzU3LjU3Ny00NzQyMDcwNy4wNy0zOTM4Mjg1OC41ODctMzEzNjM2MzYuMzY2LTI0NDQ1OTU5LjU5OC0xODMyNTI1Mi41MjUtMTIzNzI3MjcuMjc0LTc3OTc5NzkuNzgyLTc4Nzg3OC43ODktMTIxMjEyLjEyNS00NTQ1NC41NDYtMzMyNi4wNS05Mi45Mi0zOS41MTgtMC41MTctMC4xMTgtMC4wMTUtMi4zMDYtMzguNjU0LTg3LjgyOC0xNTQuNzMzLTI1MC41MTYtMzcwLjYwOC02ODAuODQyLTEyMTMuMTcyLTI1NDUuNDU2LTU0NzUuNzU5LTEwMjAxLjYzNi0xOTIxMi40MjUtMzMwNTMuMDMyLTU1OTk1LjM1Ni03OTc5Ny42NTEtMTE2MjY5LjcwNC0xNTYzNzEuMDkyLTI1MDAwMC4wMDEtMzk4NTQ1LjQ1My02MzgwMTAuMDk1LTExMjg3ODcuODc2LTE3Mjg5MjkuMjg5LTI1MjQ1NDUuNDU1LTM4OTAwOTAuOTA4LTYxOTEzNTMuNTM2LTk4NTkzNTkuMTA0LTE1NTM1MzUzLjUzNy0yMzIxMjEyMS4yMTItMzE0NTQxNDEuNDE0LTM5OTE4NzkwLjk1NC00OTAwOTkwOS4wOTItNTc2NTY1NjUuNjU0LTY3Nzc3NzcuNzc3LTgyNzI3MjcyLjcyNy05OTE3NTc1Ny41NzQtMTA2Mjk2NzY3LjY3NS0xMjE5NTk1OTUuOTU0LTEzNzkwOTkwOS4wOTItMTQ4ODcwNzU1LjY4MS0xNTc1OTczNzMuNzM0LTE2NTI0NDY0Ni40NjgtMTcwMTAxMDEuMTA5LTE3MjY4NjgzMC4xNzUtMTczMDMwMzA2LjI1Ny0xNTYxOTU5NTk1Ljk1NC0xMzEzOTM5MjMuMjM1LTExNjg3ODc4Ny44NzUtMTAxNzkwNjA2LjA2Mi0zNzk4OTkwOS4wOTItMTA1NzM4Mjg3Ljg3Ni0xMjAwNDQ0NDQuNDQ2LTE1NjUzNTY1Ni41NzgtMTcyOTA5MDkxLjkwOS0xNzcyNjI1NzUuNzU3LTE3NTY5NDAyMC4yMjYtMTY2ODQ4NjQ2LjQ2LTE1MjczNzU3NS43NTktMTQ3NTI1MDI1LjEwMy0xMzcyNzE4NzEuNzE2LTEzMDc1NzU3NS43NTgtMTI0NzYwMTYxLjYxNC0xMTc0MzM2NTYuNTY4LTExMDkyNDc0Ny40NjUtMTA1ODYwNjA2LjA2My05Mzg5ODk4OS45ODgtODUwNjU2NTYuNTY4LTc2MjAyMDIwLjIwMy02NzM0MzQzNC4zNDQtNTc3MjIyMjIuMjIyLTUwNzM3MjcyLjcyOC00MjU4NTg1OC41ODYtMzY4Njg2ODYuODY5LTMwMzAzMDMwLjMwNi0yMzYzNzM3Ni40NTMtMTgzMDMwMzAuMzA1LTEzMDM1MzUzLjUzNi0yMjU1OTUuOTYtNDA5OTIuMTI3LTE4NzIzLjUzOC05ODk3LjYxNi0yNDk2LjEwMi0zMzMuMzM3LTMwLjMxMi0wLjc1Ni0wLjIyMS0wLjAyOC0wLjAwNC0yLjA2NC0yMi4yNTktNDQuOTk3LTg3LjI0NS0xNTAuOTkzLTI3Ni4zNzQtNTgzLjI3LTEwNjIuOTI2LTIwNjAuNDI3LTM3MTkuNzc3LTYzNzkuNDQ5LTEwMjE0LjM2OS0xNTExNS43Ni0yMzgyOC4xODYtMzg0ODQuODQ2LTU1OTk1Ljk1OC04MDU4NS44NjEtMTI0ODI4LjI4OC0yMDM0MzQuMzQ0LTMwNDAxOS45OTMtNDc0NTg1LjU1NC03Nzg3ODcuODc3LTEyMTU2NTYuNTY4LTE4ODk5MDkuMDkyLTI4NDg0ODQuODQ3LTQwMTIxMjEuMjEyLTUzNTc1NzUuNzU5LTczMTk2OTYuNjk4LTk1MDEzMTMuMTkzLTExOTYzNjM2LjM2NC0xNjA0ODg4OC44ODgtMjA2NjU2NTYuNTY4LTI5OTU5NTk1Ljk1NC00MDQ1MjUyNS4yNTItNDk3MzczNzMuNzM3LTYwNjQ2NDY0LjY0Mi02OTg0ODQ4NC44NDYtNzkwOTA5MDkuMDg3LTg3NDExNDE0LjQxNC05MzIzMjMyMy4zMjItMTAwOTkyOTI5LjI4OC0xMTA0ODc4NzguNzg5LTExOTM3NjU4LjMwNi0xMjY2Njk2OTYuOTctMTMzMzA3MDcxLjQ5MS0xMzk3ODQ4NDguNDg0LTE0NjExMDExMS4xMS0xNTIwNTA1MDcuNzQ5LTE1NDczNzM3My43MzgtMTU2NTQ1NDU0LjU0OC0xNTc0MzIzMjMuMjMyLTE1ODE0MjgyOC42OTYtMTQ5Njc0MzEzLjE5NC0xMzQyNDM4MDIuMDI0LTExNjk1OTQ5NC45NDctNzg2MzgyMTIuMzA2LTMwMzAzMDMuMDM4LTcwNzcuNjE1LTM0MDguNDc2LTYwNi4wNi0zMC4zMDMtMS4yNDctMC4yNTYtMC4wMjktMC4wMDYtNS44ODUtNDEuNTgyLTg5LjM3My0xNDYuMjczLTI0NS40NzMtMzg1LjIxNi01NDEuNDQyLTk3Mi43MTEtMTc1Mi43ODgtMzE2MS42MTYtNTY0NS43NTgtOTUzOS4zODctMTU4NzIuNDI3LTI0Nzc0Ljc2NC0zOTU1OS40NzMtNTk1MDUuOTU5LTg1ODgyLjg1OC0xMjk2OTY5Ni45NzEtMTkzNTc1NzUuNzU4LTI4OTcwNzU3LjU3NS00Mzk4OTg5OC45ODctNjY0MjczNzMuNzM4LTg3NzQ2NDY0LjY0OS0xMTY1MzAzMC4zMDI= " />
            </button>
          </div>
        `;
        dom.manager.pinsList.prepend(li); // Ajouter au début pour les nouveaux pins
      },
      clearPinsList: () => {
        dom.manager.pinsList.innerHTML = '';
      },
      updateButtonStates: () => {
        const pinCodeValid = dom.manager.form.pinCodeInput.value.length === config.pinLength;
        const dateInValid = dom.manager.form.dateInInput.value !== '';
        const dateOutValid = dom.manager.form.dateOutInput.value !== '';

        dom.manager.form.submitButton.disabled = !(pinCodeValid && dateInValid && dateOutValid);
      },
      updateResultsCount: (count) => {
        dom.manager.controls.resultsCount.textContent = `${count} résultat${
          count !== 1 ? 's' : ''
        }`;
      },
      updateSortMenu: () => {
        dom.manager.controls.sortMenu.querySelectorAll('button').forEach((button) => {
          button.classList.remove('active');
          button.querySelector('.icon-asc')?.classList.add('app-hidden');
          button.querySelector('.icon-desc')?.classList.add('app-hidden');

          const sortBy = button.dataset.sortBy;
          if (sortBy === state.currentSortBy) {
            button.classList.add('active');
            if (state.currentSortOrder === 'asc') {
              button.querySelector('.icon-asc')?.classList.remove('app-hidden');
            } else {
              button.querySelector('.icon-desc')?.classList.remove('app-hidden');
            }
          }
        });
      },
    },
  };

  // --- 7. GESTIONNAIRES D'ÉVÉNEMENTS ---
  const handlers = {
    guest: {
      handlePinInput: (e) => {
        const input = e.target;
        input.value = input.value.replace(/[^A-Z0-9]/g, '').toUpperCase();
        if (input.value.length > config.pinLength) {
          input.value = input.value.substring(0, config.pinLength);
        }
        ui.guest.updateButtonStates();
        ui.guest.displayMessage('info', "Saisissez votre code d'accès");
      },
      handlePinButtonClick: (e) => {
        const value = e.target.dataset.value;
        const input = dom.guest.pinInput;
        if (value === 'backspace') {
          input.value = input.value.slice(0, -1);
        } else if (value === 'check') {
          handlers.guest.checkPin();
        } else {
          if (input.value.length < config.pinLength) {
            input.value += value;
          }
        }
        ui.guest.updateButtonStates();
        ui.guest.displayMessage('info', "Saisissez votre code d'accès");
      },
      checkPin: async () => {
        const enteredPin = dom.guest.pinInput.value;
        if (enteredPin.length !== config.pinLength) {
          ui.guest.displayMessage('alert', 'Code PIN invalide.');
          return;
        }

        try {
          const querySnapshot = await db
            .collection('pins')
            .where('pinCode', '==', enteredPin)
            .limit(1)
            .get();

          if (querySnapshot.empty) {
            ui.guest.displayMessage('alert', 'Code PIN non trouvé.');
            dom.guest.pinInput.value = '';
            ui.guest.updateButtonStates();
            return;
          }

          const pinData = querySnapshot.docs[0].data();
          const now = new Date();
          const dateIn = pinData.dateIn?.toDate();
          const dateOut = pinData.dateOut?.toDate();

          if (dateIn && now < dateIn) {
            ui.guest.displayMessage(
              'alert',
              `Votre code sera actif à partir du ${utils.formatDateDisplay(dateIn)}.`
            );
            dom.guest.pinInput.value = '';
            ui.guest.updateButtonStates();
          } else if (dateOut && now > dateOut) {
            ui.guest.displayMessage(
              'alert',
              `Votre code PIN a expiré le ${utils.formatDateDisplay(dateOut)}.`
            );
            dom.guest.pinInput.value = '';
            ui.guest.updateButtonStates();
          } else {
            state.guest.pin = enteredPin;
            state.guest.expirationDate = dateOut;

            utils.storage.savePinData(enteredPin, dateOut);

            ui.guest.startExpirationTimer();
            ui.guest.displayMessage('success', 'Code PIN actif. Bien bienvenue !');

            if (dateOut) {
              dom.guest.dateOut.textContent =
                "Valable jusqu'au : " + utils.formatDateDisplay(dateOut);
              dom.guest.dateOut.style.display = ''; // Ensure it's visible
            } else {
              dom.guest.dateOut.textContent = '';
              dom.guest.dateOut.style.display = 'none';
            }

            dom.guest.pinEntry.classList.add('app-hidden');
            dom.guest.dynamicContent.classList.remove('app-hidden');

            // --- START New/Modified Code for Portal Action Screen ---
            dom.guestApp.classList.add('portal-active'); // Add class to guest-app to hide header elements
            // dom.guest.portalButton.textContent = ''; // REMOVED: This line was removing the icon from the button
            dom.guest.portalActionText.classList.remove('app-hidden'); // Show the instruction text

            // Add click listener for button background inversion
            const handlePortalButtonClick = () => {};
            // --- END New/Modified Code ---
          }
        } catch (error) {
          console.error('Erreur lors de la vérification du code PIN:', error);
          ui.guest.displayMessage('alert', 'Erreur système. Veuillez réessayer.');
          dom.guest.pinInput.value = '';
          ui.guest.updateButtonStates();
        }
      },
      handleLogoClick: () => {
        state.guest.tripleClickCount++;
        if (state.guest.tripleClickTimer) {
          clearTimeout(state.guest.tripleClickTimer);
        }

        state.guest.tripleClickTimer = setTimeout(() => {
          if (state.guest.tripleClickCount >= 3) {
            dom.guest.loginContainer.classList.remove('app-hidden');
            ui.guest.displayMessage('info', 'Connectez-vous en tant que gestionnaire.');
          }
          state.guest.tripleClickCount = 0;
        }, config.tripleClickThresholdMs);
      },
      handleGoogleSignIn: async () => {
        try {
          await auth.signInWithPopup(googleProvider);
          // Redirigé par l'observateur d'état d'authentification
        } catch (error) {
          console.error('Erreur de connexion Google:', error);
          ui.guest.displayMessage('danger', 'Échec de la connexion. Réessayez.');
        }
      },
      handleResetButton: () => {
        ui.guest.resetSystem();
      },
      handlePortalButton: async () => {
        // Nouvelle implémentation complète du gestionnaire
        try {
          const response = await fetch(config.webhookUrl);
          if (!response.ok) {
            console.error(`Webhook failed: ${response.status} ${response.statusText}`);
            ui.guest.displayMessage('alert', "Erreur lors de l'activation du portail");
          } else {
            console.log('Portail activé avec succès!');
            ui.guest.displayMessage('success', 'Portail activé');
          }
        } catch (error) {
          console.error('Error triggering portal:', error);
          ui.guest.displayMessage('danger', 'Erreur système. Veuillez réessayer.');
        }
      },
    },
    manager: {
      loadPins: async () => {
        try {
          ui.manager.clearPinsList();
          let query = db.collection('pins');

          const searchQuery = dom.manager.controls.searchQueryInput.value.toLowerCase();
          if (searchQuery) {
            query = query
              .orderBy('pinCodeLower')
              .startAt(searchQuery)
              .endAt(searchQuery + '\uf8ff');
          }

          if (state.currentSortBy) {
            query = query.orderBy(state.currentSortBy, state.currentSortOrder);
          }

          const querySnapshot = await query.get();
          ui.manager.updateResultsCount(querySnapshot.size);

          querySnapshot.forEach((doc) => {
            ui.manager.addPinToDOM({
              id: doc.id,
              ...doc.data(),
            });
          });
        } catch (error) {
          console.error('Erreur lors du chargement des pins:', error);
          ui.showMessage('danger', 'Erreur lors du chargement des codes PIN.');
        }
      },
      handleFormSubmit: async (e) => {
        e.preventDefault();

        const pinCode = dom.manager.form.pinCodeInput.value.toUpperCase();
        const dateIn = firebase.firestore.Timestamp.fromDate(
          new Date(dom.manager.form.dateInInput.value)
        );
        const dateOut = firebase.firestore.Timestamp.fromDate(
          new Date(dom.manager.form.dateOutInput.value)
        );
        const contact = dom.manager.form.contactInput.value;
        const phone = dom.manager.form.phoneInput.value;

        const pinData = {
          pinCode,
          pinCodeLower: pinCode.toLowerCase(),
          dateIn,
          dateOut,
          contact,
          phone,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        try {
          if (state.currentEditingPinId) {
            await db.collection('pins').doc(state.currentEditingPinId).update(pinData);
            ui.showMessage('success', 'Code PIN mis à jour avec succès!');
          } else {
            // Vérifier l'existence du code PIN avant d'ajouter
            const existingPin = await db
              .collection('pins')
              .where('pinCode', '==', pinCode)
              .limit(1)
              .get();
            if (!existingPin.empty) {
              ui.showMessage('danger', 'Un code PIN identique existe déjà.');
              return;
            }
            await db.collection('pins').add(pinData);
            ui.showMessage('success', 'Code PIN ajouté avec succès!');
          }
          ui.manager.resetForm();
          handlers.manager.loadPins();
        } catch (error) {
          console.error('Erreur lors de la sauvegarde du code PIN:', error);
          ui.showMessage('danger', 'Erreur lors de la sauvegarde du code PIN.');
        }
      },
      handlePinListClick: async (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const li = button.closest('li.pin-item');
        const pinId = li.dataset.id;
        if (!pinId) return;

        const action = button.dataset.action;

        if (action === 'edit') {
          try {
            const doc = await db.collection('pins').doc(pinId).get();
            if (!doc.exists) {
              ui.showMessage('danger', 'Code PIN non trouvé.');
              return;
            }
            const pinData = doc.data();
            state.currentEditingPinId = pinId;

            dom.manager.form.pinCodeInput.value = pinData.pinCode;
            dom.manager.form.dateInInput.value = pinData.dateIn
              ? pinData.dateIn.toDate().toISOString().split('T')[0]
              : '';
            dom.manager.form.dateOutInput.value = pinData.dateOut
              ? pinData.dateOut.toDate().toISOString().split('T')[0]
              : '';
            dom.manager.form.contactInput.value = pinData.contact || '';
            dom.manager.form.phoneInput.value = pinData.phone || '';

            dom.manager.form.submitButton.textContent = 'Mettre à jour';
            dom.manager.form.form.classList.add('is-active');
            ui.manager.updateButtonStates();
          } catch (error) {
            console.error('Erreur lors de la récupération du code PIN pour édition:', error);
            ui.showMessage('danger', "Erreur lors de l'édition du code PIN.");
          }
        } else if (action === 'delete') {
          if (confirm('Voulez-vous vraiment supprimer ce code PIN?')) {
            try {
              await db.collection('pins').doc(pinId).delete();
              li.remove();
              ui.showMessage('success', 'Code PIN supprimé avec succès!');
              handlers.manager.loadPins(); // Recharger pour mettre à jour le compte
            } catch (error) {
              console.error('Erreur lors de la suppression du code PIN:', error);
              ui.showMessage('danger', 'Erreur lors de la suppression du code PIN.');
            }
          }
        }
      },
      handleSortMenuClick: (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const newSortBy = button.dataset.sortBy;
        let newSortOrder = 'asc';

        if (newSortBy === state.currentSortBy) {
          newSortOrder = state.currentSortOrder === 'asc' ? 'desc' : 'asc';
        }

        state.currentSortBy = newSortBy;
        state.currentSortOrder = newSortOrder;

        ui.manager.controls.sortMenu.classList.remove('show');
        handlers.manager.loadPins();
      },
      handleSearchInput: () => {
        clearTimeout(state.debounceTimer);
        state.debounceTimer = setTimeout(() => {
          handlers.manager.loadPins();
          const hasSearchQuery = dom.manager.controls.searchQueryInput.value.length > 0;
          dom.manager.controls.clearSearchBtn.style.display = hasSearchQuery ? 'block' : 'none';
        }, 300); // Debounce de 300ms
      },
      handleClearSearch: () => {
        dom.manager.controls.searchQueryInput.value = '';
        dom.manager.controls.clearSearchBtn.style.display = 'none';
        handlers.manager.loadPins();
      },
    },
  };

  // --- 8. INITIALISATION ET ÉVÉNEMENTS GLOBALS ---
  auth.onAuthStateChanged((user) => {
    if (user && user.email === config.adminEmail) {
      ui.manager.showApp();
      if (dom.manager.userAvatar) {
        dom.manager.userAvatar.src = user.photoURL || './icons/default-avatar.png';
        dom.manager.userAvatar.title = user.displayName || user.email;
      }
    } else {
      auth.signOut().then(() => {
        ui.guest.showApp();
      });
    }
  });

  // Gestionnaire pour le clavier numérique
  document.querySelectorAll('.pin-key-button').forEach((button) => {
    button.addEventListener('click', handlers.guest.handlePinButtonClick);
  });

  // Initialisation des listeners pour l'interface Guest
  dom.guest.pinInput.addEventListener('input', handlers.guest.handlePinInput);
  dom.guest.checkPinButton.addEventListener('click', handlers.guest.checkPin);
  dom.guest.backspaceButton.addEventListener('click', handlers.guest.handlePinButtonClick);
  dom.guest.logo.addEventListener('click', handlers.guest.handleLogoClick);
  dom.guest.googleSignInBtn.addEventListener('click', handlers.guest.handleGoogleSignIn);
  dom.guest.resetButton.addEventListener('click', handlers.guest.handleResetButton);
  dom.guest.portalButton.addEventListener('click', handlers.guest.handlePortalButton); // Keep this for any primary action

  // Initialisation des listeners pour l'interface Manager
  dom.manager.returnToGuestBtn.addEventListener('click', () => {
    ui.guest.resetSystem();
    ui.guest.showApp();
  });
  dom.manager.form.pinCodeInput.addEventListener('input', ui.manager.updateButtonStates);
  dom.manager.form.dateInInput.addEventListener('input', ui.manager.updateButtonStates);
  dom.manager.form.dateOutInput.addEventListener('input', ui.manager.updateButtonStates);
  dom.manager.form.form.addEventListener('submit', handlers.manager.handleFormSubmit);
  dom.manager.form.cancelButton.addEventListener('click', ui.manager.resetForm);
  dom.manager.pinsList.addEventListener('click', handlers.manager.handlePinListClick);
  dom.manager.controls.generatePinBtn.addEventListener('click', () => {
    dom.manager.form.pinCodeInput.value = utils.generateRandomPin(config.pinLength);
    ui.manager.updateButtonStates();
  });

  dom.manager.controls.sortBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.manager.controls.sortMenu.classList.toggle('show');
    ui.manager.updateSortMenu();
  });

  dom.manager.controls.sortMenu.addEventListener('click', handlers.manager.handleSortMenuClick);
  dom.manager.controls.searchQueryInput.addEventListener(
    'input',
    handlers.manager.handleSearchInput
  );
  dom.manager.controls.clearSearchBtn.addEventListener('click', handlers.manager.handleClearSearch);

  // Initialisation et affichage de la version du Service Worker
  const swVersion = await getServiceWorkerVersionFromFetch(); // This is now inside an async IIFE
  if (swVersion) {
    console.log("Version de l'application (via Service Worker fetch):", swVersion);
    if (dom.appVersionDisplay) {
      dom.appVersionDisplay.textContent = `Version: ${swVersion}`;
    }
  } else {
    console.log("La version du Service Worker n'a pas pu être récupérée via fetch.");
    if (dom.appVersionDisplay) {
      dom.appVersionDisplay.textContent = `Version: Non disponible`;
    }
  }

  // Fermer le menu de tri si on clique en dehors
  document.addEventListener('click', (e) => {
    if (
      !dom.manager.controls.sortMenu.contains(e.target) &&
      !dom.manager.controls.sortBtn.contains(e.target)
    ) {
      dom.manager.controls.sortMenu.classList.remove('show');
    }
  });

  // Appliquer la mise à l'échelle dès le chargement de la page
  // Cette fonction devrait être dans le script principal ou une fonction d'initialisation globale
  // Si elle n'est pas déjà présente dans index.html
  // Si l'application est dans un élément #app-wrapper qui est déjà géré par un script intégré,
  // cette partie pourrait être redondante ou mal placée ici.
  // Cependant, pour s'assurer que le scaling est appliqué si le JS externe est chargé en premier.
  const appWrapper = document.getElementById('app-wrapper');
  const DESIGN_WIDTH = 400;
  const DESIGN_HEIGHT = 650;

  function applyScaling() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scaleX = viewportWidth / DESIGN_WIDTH;
    const scaleY = viewportHeight / DESIGN_HEIGHT;
    const scaleFactor = Math.min(scaleX, scaleY);
    appWrapper.style.transform = `translate(-50%, -50%) scale(${scaleFactor})`;
  }

  if (appWrapper) {
    applyScaling();
    window.addEventListener('resize', applyScaling);
    window.addEventListener('orientationchange', applyScaling);
  } else {
    console.warn('#app-wrapper not found. Scaling might not be applied.');
  }
})();
