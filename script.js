'use strict';

// Encapsulation de tout le script pour éviter la pollution de l'espace global
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
    managerPinCode: 'XTOF', // NOUVEAU : Ajout du code PIN spécial pour l'accès Manager
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
    // Apps
    guestApp: document.getElementById('guest-app'),
    managerApp: document.getElementById('manager-app'),
    // Guest App
    guest: {
      logo: document.getElementById('guestLogo'),
      message: document.getElementById('guestMessage'),
      pinInput: document.getElementById('guestPinInput'),
      pinEntry: document.getElementById('guestPinEntry'),
      dynamicContent: document.getElementById('dynamicGuestContent'),
      checkPinButton: document.getElementById('guestCheckPinButton'),
      backspaceButton: document.getElementById('guestBackspaceButton'),
      portalButton: document.getElementById('portalBtn'),
      resetButton: document.getElementById('resetButton'),
      loginContainer: document.getElementById('guestLoginContainer'),
      googleSignInBtn: document.getElementById('google-sign-in-btn'),
    },
    // Manager App
    manager: {
      auth: {
        loggedInView: document.getElementById('logged-in-view'),
        userEmail: document.getElementById('user-email'),
        signOutBtn: document.getElementById('sign-out-btn'),
      },
      returnToGuestBtn: document.getElementById('returnToGuestButton'),
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

  // --- 4. SERVICES (ex: Firebase) ---
  firebase.initializeApp(config.firebase);
  const db = firebase.firestore();
  const auth = firebase.auth();
  const googleProvider = new firebase.auth.GoogleAuthProvider();

  // --- 5. FONCTIONS UTILITAIRES ---
  const utils = {
    formatDateDisplay: (dateObject) => {
      if (!dateObject instanceof Date || isNaN(dateObject)) return '';
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
    // Fonctions de messages génériques
    showMessage: (type, message, duration = 3000) => {
      Object.values(dom.manager.messages).forEach((el) => (el.style.display = 'none'));
      let messageEl;
      if (type === 'success') messageEl = dom.manager.messages.success;
      else if (type === 'danger') messageEl = dom.manager.messages.danger;
      else if (type === 'info' || type === 'primary') messageEl = dom.manager.messages.primary;
      else return;

      messageEl.textContent = message;
      messageEl.style.display = 'block';
      setTimeout(() => {
        messageEl.style.display = 'none';
      }, duration);
    },

    // Fonctions spécifiques au Guest
    guest: {
      showApp: () => {
        dom.managerApp.classList.add('app-hidden');
        dom.guestApp.classList.remove('app-hidden');
        ui.guest.resetSystem();
      },
      displayMessage: (type, message) => {
        dom.guest.message.textContent = message;
        dom.guest.message.className = 'guest-message'; // Reset classes
        if (type) dom.guest.message.classList.add(type);
      },
      updateButtonStates: () => {
        const pinLength = dom.guest.pinInput.value.length;
        dom.guest.checkPinButton.disabled = pinLength !== config.pinLength;
        dom.guest.backspaceButton.disabled = pinLength === 0;
      },
      resetSystem: () => {
        if (state.guest.intervalId) clearInterval(state.guest.intervalId);
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
              ui.guest.resetSystem();
            }
          }, 1000);
        }
      },
    },

    // Fonctions spécifiques au Manager
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
        const dateIn = pin.dateIn ? pin.dateIn.toDate() : null;
        const dateOut = pin.dateOut ? pin.dateOut.toDate() : null;
        const status = utils.getPinStatus({ dateIn, dateOut }, now);

        const pinItem = document.createElement('div');
        pinItem.className = `pin-item status-${status}`;
        pinItem.dataset.id = pin.id;

        // Structure à 4 colonnes
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
        const {
          pinCodeInput,
          contactInput,
          dateInInput,
          dateOutInput,
          submitButton,
          cancelButton,
        } = dom.manager.form;
        const isPinCodeValid = pinCodeInput.value.length === config.pinLength;
        const isContactValid = contactInput.value.trim().length > 0;
        const isDateInValid = dateInInput.value !== '';
        const isDateOutValid = dateOutInput.value !== '';

        const canSubmit =
          state.currentEditingPinId ||
          (isPinCodeValid && isContactValid && isDateInValid && isDateOutValid);
        submitButton.disabled = !canSubmit;
        cancelButton.disabled =
          !state.currentEditingPinId &&
          !pinCodeInput.value &&
          !contactInput.value &&
          !dateInInput.value &&
          !dateOutInput.value;
      },
      updateSortMenu: () => {
        dom.manager.controls.sortMenu.querySelectorAll('.dropdown-item').forEach((item) => {
          item.classList.toggle('active', item.dataset.sortBy === state.currentSortBy);
        });
      },
    },
  };

  // --- 7. GESTIONNAIRES D'ÉVÉNEMENTS (LOGIQUE APPLICATIVE) ---
  const handlers = {
    // Guest Handlers
    guest: {
      handlePinInput: () => {
        dom.guest.pinInput.value = dom.guest.pinInput.value.toUpperCase();
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
        dom.guest.pinInput.value = ''; // Efface l'entrée
        ui.guest.updateButtonStates();

        if (enteredPin.length !== config.pinLength) {
          ui.guest.displayMessage(
            'alert',
            `Le code PIN doit contenir ${config.pinLength} caractères.`
          );
          return;
        }

        // NOUVEAU : Vérification du code PIN Manager 'XTOF'
        if (enteredPin === config.managerPinCode) {
          dom.guest.loginContainer.classList.remove('app-hidden');
          dom.guest.pinEntry.classList.add('app-hidden');
          dom.guest.dynamicContent.classList.add('app-hidden');
          ui.guest.displayMessage('info', 'Accès Manager. Connectez-vous avec Google.');
          return; // Arrête l'exécution pour ne pas valider via Firebase
        }
        // FIN NOUVEAU

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
          const dateIn = pinData.dateIn ? pinData.dateIn.toDate() : null;
          const dateOut = pinData.dateOut ? pinData.dateOut.toDate() : null;

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
            ui.guest.startExpirationTimer();
            ui.guest.displayMessage('success', 'Code PIN actif. Bienvenue !');
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

    // Manager Handlers
    manager: {
      handleFormSubmit: async (e) => {
        e.preventDefault();
        const { pinCodeInput, dateInInput, dateOutInput, contactInput, phoneInput } =
          dom.manager.form;

        const pinData = {
          pinCode: pinCodeInput.value.toUpperCase(),
          dateIn: firebase.firestore.Timestamp.fromDate(new Date(dateInInput.value)),
          dateOut: firebase.firestore.Timestamp.fromDate(new Date(dateOutInput.value)),
          contact: contactInput.value.trim(),
          phone: phoneInput.value.trim(),
        };

        try {
          if (state.currentEditingPinId) {
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
            await db
              .collection('pins')
              .add({ ...pinData, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
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
        dom.manager.controls.resultsCount.textContent = searchQuery
          ? `${filteredPins.length}/${pins.length}`
          : `${pins.length}`;
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
          const { pinCodeInput, dateInInput, dateOutInput, contactInput, phoneInput } =
            dom.manager.form;

          pinCodeInput.value = data.pinCode;
          dateInInput.value = data.dateIn.toDate().toISOString().slice(0, 16);
          dateOutInput.value = data.dateOut.toDate().toISOString().slice(0, 16);
          contactInput.value = data.contact;
          phoneInput.value = data.phone || '';
          state.currentEditingPinId = pinId;

          ui.manager.updateButtonStates();
          dom.manager.form.form.classList.add('is-active');
          pinCodeInput.focus();
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

    // Auth Handlers
    auth: {
      onAuthStateChanged: (user) => {
        if (user && user.email === config.adminEmail) {
          dom.manager.auth.userEmail.textContent = user.email;
          dom.manager.auth.loggedInView.style.display = 'block';
          ui.manager.showApp();
        } else {
          if (user) {
            // If user is logged in but not admin
            auth.signOut();
            ui.showMessage('danger', 'Accès refusé. Compte non administrateur.');
          }
          dom.manager.auth.loggedInView.style.display = 'none';
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
    document.addEventListener('click', () =>
      dom.manager.controls.sortMenu.classList.remove('show')
    );

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
    dom.manager.returnToGuestBtn.addEventListener('click', ui.guest.showApp);
    dom.manager.auth.signOutBtn.addEventListener('click', handlers.auth.signOut);
    dom.manager.form.form.addEventListener('submit', handlers.manager.handleFormSubmit);
    dom.manager.form.cancelButton.addEventListener('click', ui.manager.resetForm);
    Object.values(dom.manager.form).forEach((input) =>
      input.addEventListener?.('input', ui.manager.updateButtonStates)
    );
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

  // Lancer l'application une fois le DOM chargé (géré par l'attribut defer)
  init();
})();
