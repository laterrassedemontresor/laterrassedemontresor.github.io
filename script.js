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
  
  /**
   * Génère une série de bips audio pour simuler un carillon, en utilisant l'API Web Audio.
   * @param {number} count Le nombre de bips à jouer (par défaut 5).
   * @param {number} durationMs La durée de chaque bip en millisecondes (par défaut 100).
   * @param {number} intervalMs L'intervalle entre chaque bip en millisecondes (par défaut 150).
   * @param {number} frequency La fréquence du son en Hertz (par défaut 880).
   */
  const simulateFiveBeeps = (count = 5, durationMs = 100, intervalMs = 150, frequency = 880) => {
    // Vérifier la compatibilité de l'API Web Audio
    if (!window.AudioContext && !window.webkitAudioContext) return;
    
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

      // Définir la forme d'onde (sinus, carré, etc.) et la fréquence
      oscillator.type = 'square'; // Un son de type "carré" est plus "bip" que sinus
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
        const status = utils.getPinStatus({ dateIn, dateOut }, now);

        const pinItem = document.createElement('div');
        pinItem.className = `pin-item status-${status}`;
        pinItem.dataset.id = pin.id;

        pinItem.innerHTML = `
            <div class="pin-code ${status}">${pin.pinCode}</div>
            <div class="pin-contact-info">
                <span class="pin-contact">${pin.contact || ''}</span>
                <span class="pin-phone">${pin.phone || ''}</span>
            </div>
            <div class="pin-dates-display">
                <span class="pin-date-in-display">${utils.formatDateDisplay(dateIn)}</span>
                <span class="pin-date-out-display">${utils.formatDateDisplay(dateOut)}</span>
            </div>
            <div class="pin-actions">
                <button class="btn btn-edit" data-action="edit" aria-label="Modifier">✎</button>
                <button class="btn btn-danger" data-action="delete" aria-label="Supprimer">🗑</button>
            </div>
        `;
        dom.manager.pinsList.appendChild(pinItem);
      },
      updateButtonStates: () => {
        const { form } = dom.manager;
        const isPinCodeValid = form.pinCodeInput.value.length === config.pinLength;
        const isContactValid = form.contactInput.value.trim().length > 0;
        const isDateInValid = form.dateInInput.value !== '';
        const isDateOutValid = form.dateOutInput.value !== '';

        form.submitButton.disabled = !(
          state.currentEditingPinId ||
          (isPinCodeValid && isContactValid && isDateInValid && isDateOutValid)
        );

        form.cancelButton.disabled =
          !state.currentEditingPinId &&
          !form.pinCodeInput.value &&
          !form.contactInput.value &&
          !form.dateInInput.value &&
          !form.dateOutInput.value;
      },
      updateSortMenu: () => {
        dom.manager.controls.sortMenu.querySelectorAll('.dropdown-item').forEach((item) => {
          item.classList.toggle('active', item.dataset.sortBy === state.currentSortBy);
        });
      },
    },
  };

  // --- 7. GESTIONNAIRES D'ÉVÉNEMENTS ---
  const handlers = {
    guest: {
      handlePinInput: (e) => {
        e.target.value = e.target.value.toUpperCase();
        ui.guest.updateButtonStates();
      },
      handlePinKeydown: (e) => {
        if (e.key === 'Enter' && dom.guest.pinInput.value.length === config.pinLength) {
          handlers.guest.validatePin();
        }
      },
      handleBackspace: () => {
        dom.guest.pinInput.value = dom.guest.pinInput.value.slice(0, -1);
        ui.guest.updateButtonStates();
      },
      validatePin: async () => {
        const enteredPin = dom.guest.pinInput.value.toUpperCase();
        dom.guest.pinInput.value = '';
        ui.guest.updateButtonStates();

        if (enteredPin.length !== config.pinLength) {
          ui.guest.displayMessage(
            'alert',
            `Le code PIN doit contenir ${config.pinLength} caractères.`
          );
          return;
        }

        if (enteredPin === config.managerPinCode) {
          dom.guest.loginContainer.classList.remove('app-hidden');
          dom.guest.pinEntry.classList.add('app-hidden');
          dom.guest.dynamicContent.classList.add('app-hidden');
          ui.guest.displayMessage('info', 'Accès Manager. Connectez-vous avec Google.');
          return;
        }

        try {
          const querySnapshot = await db
            .collection('pins')
            .where('pinCode', '==', enteredPin)
            .limit(1)
            .get();

          if (querySnapshot.empty) {
            ui.guest.displayMessage('alert', 'Code PIN incorrect.');
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
          } else if (dateOut && now > dateOut) {
            ui.guest.displayMessage(
              'alert',
              `Votre code PIN a expiré le ${utils.formatDateDisplay(dateOut)}.`
            );
          } else {
            state.guest.pin = enteredPin;
            state.guest.expirationDate = dateOut;
            utils.storage.savePinData(enteredPin, dateOut);
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
          console.error('Erreur de validation du PIN:', error);
          ui.guest.displayMessage('danger', 'Erreur de connexion. Réessayez.');
        }
      },
      triggerPortal: async () => {
        if (!state.guest.pin) return;
        try {
          const response = await fetch(config.webhookUrl);
          const data = await response.text();
          if (response.ok && data.includes('Success')) {
            simulateFiveBeeps(); // ⬅️ MODIFICATION : Appel de la fonction de bips
            ui.guest.displayMessage('success', 'Portail activé !');
          } else {
            ui.guest.displayMessage('danger', `Erreur portail: ${data || response.statusText}`);
          }
        } catch (error) {
          console.error('Erreur webhook:', error);
          ui.guest.displayMessage('danger', 'commande éxécutée');
        }
      },
      handleLogoClick: () => {
        state.guest.tripleClickCount++;
        if (state.guest.tripleClickTimer) clearTimeout(state.guest.tripleClickTimer);

        state.guest.tripleClickTimer = setTimeout(() => {
          state.guest.tripleClickCount = 0;
        }, config.tripleClickThresholdMs);

        if (state.guest.tripleClickCount === 3) {
          clearTimeout(state.guest.tripleClickTimer);
          state.guest.tripleClickCount = 0;
          dom.guest.loginContainer.classList.remove('app-hidden');
          dom.guest.pinEntry.classList.add('app-hidden');
          dom.guest.dynamicContent.classList.add('app-hidden');
          ui.guest.displayMessage('info', 'Accès Manager. Connectez-vous avec Google.');
        }
      },
    },

    manager: {
      handleFormSubmit: async (e) => {
        e.preventDefault();
        const { form } = dom.manager;
        const dateIn = new Date(form.dateInInput.value);
        const dateOut = new Date(form.dateOutInput.value);

        if (dateIn > dateOut) {
          ui.showMessage('danger', 'Erreur de date : IN est postérieure à OUT');
          return;
        }

        const pinData = {
          pinCode: form.pinCodeInput.value.toUpperCase(),
          dateIn: firebase.firestore.Timestamp.fromDate(dateIn),
          dateOut: firebase.firestore.Timestamp.fromDate(dateOut),
          contact: form.contactInput.value.trim(),
          phone: form.phoneInput.value.trim(),
        };

        try {
          if (state.currentEditingPinId) {
            const existingPinQuery = await db
              .collection('pins')
              .where('pinCode', '==', pinData.pinCode)
              .get();

            if (
              !existingPinQuery.empty &&
              existingPinQuery.docs[0].id !== state.currentEditingPinId
            ) {
              ui.showMessage('danger', 'Ce code PIN existe déjà pour un autre enregistrement.');
              return;
            }

            await db.collection('pins').doc(state.currentEditingPinId).update(pinData);
            ui.showMessage('success', 'PIN mis à jour !');
          } else {
            const existingPin = await db
              .collection('pins')
              .where('pinCode', '==', pinData.pinCode)
              .get();

            if (!existingPin.empty) {
              ui.showMessage('danger', 'Ce code PIN existe déjà.');
              return;
            }

            await db.collection('pins').add({
              ...pinData,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            ui.showMessage('success', 'PIN ajouté avec succès !');
          }

          ui.manager.resetForm();
          handlers.manager.loadPins();
        } catch (error) {
          console.error('Erreur Firestore:', error);
          ui.showMessage('danger', `Erreur: ${error.message}`);
        }
      },
      loadPins: async () => {
        dom.manager.pinsList.innerHTML = '';
        const searchQuery = dom.manager.controls.searchQueryInput.value.trim().toLowerCase();
        let query = db.collection('pins');

        if (state.currentSortBy !== 'status') {
          query = query.orderBy(state.currentSortBy, state.currentSortOrder);
        }

        const snapshot = await query.get();
        let pins = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        if (state.currentSortBy === 'status') {
          const now = new Date();
          const statusOrder = { active: 1, future: 2, expired: 3 };
          pins.sort((a, b) => {
            const statusA = utils.getPinStatus(
              { dateIn: a.dateIn?.toDate(), dateOut: a.dateOut?.toDate() },
              now
            );
            const statusB = utils.getPinStatus(
              { dateIn: b.dateIn?.toDate(), dateOut: b.dateOut?.toDate() },
              now
            );
            return (
              (statusOrder[statusA] - statusOrder[statusB]) *
              (state.currentSortOrder === 'asc' ? 1 : -1)
            );
          });
        }

        const filteredPins = searchQuery
          ? pins.filter(
              (pin) =>
                pin.pinCode?.toLowerCase().includes(searchQuery) ||
                pin.contact?.toLowerCase().includes(searchQuery) ||
                pin.phone?.toLowerCase().includes(searchQuery)
            )
          : pins;

        filteredPins.forEach(ui.manager.addPinToDOM);

        const countText = searchQuery ? `${filteredPins.length}/${pins.length}` : `${pins.length}`;
        dom.manager.controls.resultsCount.textContent = countText;
        dom.manager.controls.clearSearchBtn.disabled = !searchQuery;
      },
      handlePinListClick: async (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;

        const pinItem = button.closest('.pin-item');
        const pinId = pinItem.dataset.id;
        const action = button.dataset.action;

        if (action === 'delete') {
          if (confirm('Supprimer ce PIN ?')) {
            await db.collection('pins').doc(pinId).delete();
            ui.showMessage('success', 'PIN supprimé.');
            handlers.manager.loadPins();
            if (state.currentEditingPinId === pinId) ui.manager.resetForm();
          }
        } else if (action === 'edit') {
          const doc = await db.collection('pins').doc(pinId).get();
          if (!doc.exists) return;

          const data = doc.data();
          const { form } = dom.manager;

          form.pinCodeInput.value = data.pinCode;
          form.dateInInput.value = data.dateIn.toDate().toISOString().slice(0, 16);
          form.dateOutInput.value = data.dateOut.toDate().toISOString().slice(0, 16);
          form.contactInput.value = data.contact;
          form.phoneInput.value = data.phone || '';
          state.currentEditingPinId = pinId;

          ui.manager.updateButtonStates();
          form.form.classList.add('is-active');
          form.pinCodeInput.focus();
        }
      },
      handleSortMenuClick: (e) => {
        const sortBy = e.target.dataset.sortBy;
        if (sortBy) {
          state.currentSortBy = sortBy;
          handlers.manager.loadPins();
          ui.manager.updateSortMenu();
          dom.manager.controls.sortMenu.classList.remove('show');
        }
      },
      handleSearchInput: () => {
        clearTimeout(state.debounceTimer);
        state.debounceTimer = setTimeout(handlers.manager.loadPins, 300);
      },
      handleClearSearch: () => {
        dom.manager.controls.searchQueryInput.value = '';
        handlers.manager.loadPins();
        dom.manager.controls.searchQueryInput.focus();
      },
    },

    auth: {
      onAuthStateChanged: (user) => {
        if (user && user.email === config.adminEmail) {
          dom.manager.returnToGuestBtn.style.display = 'flex';

          if (user.photoURL) {
            dom.manager.userAvatar.src = user.photoURL;
            dom.manager.userAvatar.style.display = 'block';
          } else {
            dom.manager.userAvatar.style.display = 'none';
          }

          ui.manager.showApp();
        } else {
          dom.manager.returnToGuestBtn.style.display = 'none';
          dom.manager.userAvatar.style.display = 'none';
          dom.manager.userAvatar.src = '';

          if (user) {
            auth.signOut();
            ui.showMessage('danger', 'Accès refusé. Compte non administrateur.');
          }

          ui.guest.showApp();
        }
      },
      signIn: () => {
        auth
          .signInWithPopup(googleProvider)
          .catch((err) => ui.showMessage('danger', `Erreur: ${err.message}`));
      },
      signOut: () => {
        auth.signOut().then(() => ui.showMessage('info', 'Déconnexion réussie.'));
      },
    },
  };

  // --- 8. INITIALISATION ---
  const init = () => {
    // General Listeners
    auth.onAuthStateChanged(handlers.auth.onAuthStateChanged);
    document.addEventListener('click', () => {
      dom.manager.controls.sortMenu.classList.remove('show');
    });

    // Guest Listeners
    dom.guest.pinInput.addEventListener('input', handlers.guest.handlePinInput);
    dom.guest.pinInput.addEventListener('keydown', handlers.guest.handlePinKeydown);
    dom.guest.checkPinButton.addEventListener('click', handlers.guest.validatePin);
    dom.guest.backspaceButton.addEventListener('click', handlers.guest.handleBackspace);
    dom.guest.portalButton.addEventListener('click', handlers.guest.triggerPortal);
    dom.guest.resetButton.addEventListener('click', ui.guest.resetSystem);
    dom.guest.logo.addEventListener('click', handlers.guest.handleLogoClick);
    dom.guest.googleSignInBtn.addEventListener('click', handlers.auth.signIn);

    // Manager Listeners
    dom.manager.returnToGuestBtn.addEventListener('click', handlers.auth.signOut);
    dom.manager.form.form.addEventListener('submit', handlers.manager.handleFormSubmit);
    dom.manager.form.cancelButton.addEventListener('click', ui.manager.resetForm);

    Object.values(dom.manager.form).forEach((input) => {
      if (input.addEventListener) {
        input.addEventListener('input', ui.manager.updateButtonStates);
      }
    });

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
    dom.manager.controls.clearSearchBtn.addEventListener(
      'click',
      handlers.manager.handleClearSearch
    );

    // Initial state
    ui.guest.showApp();
  };

  // Lancer l'application une fois le DOM chargé
  init();
})();
