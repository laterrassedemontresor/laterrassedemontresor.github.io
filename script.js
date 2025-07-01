'use strict';

// Enregistrement du Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker enregistré avec succès avec le scope :', registration.scope);
      })
      .catch((error) => {
        console.error("Échec de l'enregistrement du Service Worker :", error);
      });
  });
}

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
        // loggedInView: document.getElementById('logged-in-view'), // Supprimé car l'élément HTML n'existe plus
        // userEmail: document.getElementById('user-email'), // Supprimé
        // signOutBtn: document.getElementById('sign-out-btn'), // Supprimé
      },
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
        // Xtof debut modif
        localStorage.removeItem('guestPin');
        // Xtof fin modif
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
                    <div class="pin-col pin-code">${pin.pinCode}</div>
                    <div class="pin-col pin-dateIn">${
                      dateIn ? utils.formatDateDisplay(dateIn) : ''
                    }</div>
                    <div class="pin-col pin-dateOut">${
                      dateOut ? utils.formatDateDisplay(dateOut) : ''
                    }</div>
                    <div class="pin-col pin-contact">${pin.contact || ''}</div>
                    <div class="pin-col pin-phone">${pin.phone || ''}</div>
                    <div class="pin-col pin-actions">
                        <button class="edit-btn" title="Modifier">✎</button>
                        <button class="delete-btn" title="Supprimer">🗑️</button>
                    </div>
                `;
        dom.manager.pinsList.appendChild(pinItem);
      },
      updateButtonStates: () => {
        const isEditing = !!state.currentEditingPinId;
        dom.manager.form.submitButton.disabled =
          !dom.manager.form.pinCodeInput.value ||
          !dom.manager.form.dateInInput.value ||
          !dom.manager.form.dateOutInput.value;
        dom.manager.form.cancelButton.disabled = !isEditing;
      },
    },
  };

  // Xtof debut modif
  // Restauration automatique du PIN invité si présent dans le localStorage
  document.addEventListener('DOMContentLoaded', () => {
    const storedPin = localStorage.getItem('guestPin');
    if (storedPin) {
      dom.guest.pinInput.value = storedPin;
      ui.guest.updateButtonStates();
      handlers.guest.checkPin(true); // true = appel auto
    }
  });
  // Xtof fin modif

  // --- 7. HANDLERS (Gestionnaires d'événements) ---
  const handlers = {
    guest: {
      // Xtof debut modif
      checkPin: async (auto = false) => {
        // Xtof fin modif
        const pin = dom.guest.pinInput.value.trim().toUpperCase();
        if (pin.length !== config.pinLength) {
          ui.guest.displayMessage('danger', 'Code PIN incomplet.');
          return;
        }
        // Recherche du PIN dans Firestore
        try {
          const querySnapshot = await db
            .collection('pins')
            .where('pinCode', '==', pin)
            .limit(1)
            .get();
          if (querySnapshot.empty) {
            ui.guest.displayMessage('danger', 'Code PIN invalide.');
            // Xtof debut modif
            localStorage.removeItem('guestPin');
            if (auto) ui.guest.resetSystem();
            // Xtof fin modif
            return;
          }
          const pinDoc = querySnapshot.docs[0];
          const pinData = pinDoc.data();
          const now = new Date();
          const dateIn = pinData.dateIn ? pinData.dateIn.toDate() : null;
          const dateOut = pinData.dateOut ? pinData.dateOut.toDate() : null;
          if ((dateIn && now < dateIn) || (dateOut && now > dateOut)) {
            ui.guest.displayMessage('alert', `Code PIN "${pin}" expiré.`);
            // Xtof debut modif
            localStorage.removeItem('guestPin');
            if (auto) ui.guest.resetSystem();
            // Xtof fin modif
            return;
          }
          // PIN valide
          state.guest.pin = pin;
          state.guest.expirationDate = dateOut;
          dom.guest.pinEntry.classList.add('app-hidden');
          dom.guest.dynamicContent.classList.remove('app-hidden');
          ui.guest.displayMessage('success', `Bienvenue !`);
          ui.guest.startExpirationTimer();
          // Xtof debut modif
          if (!auto) {
            localStorage.setItem('guestPin', pin);
          }
          // Xtof fin modif
        } catch (error) {
          ui.guest.displayMessage('danger', 'Erreur réseau.');
          // Xtof debut modif
          if (auto) ui.guest.resetSystem();
          // Xtof fin modif
        }
      },
      handleInput: (e) => {
        const input = e.target;
        input.value = input.value
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, config.pinLength);
        ui.guest.updateButtonStates();
      },
      handleBackspace: () => {
        const input = dom.guest.pinInput;
        input.value = input.value.slice(0, -1);
        ui.guest.updateButtonStates();
      },
      handlePortalOpen: async () => {
        dom.guest.portalButton.disabled = true;
        try {
          await fetch(config.webhookUrl, { method: 'POST' });
          ui.guest.displayMessage('success', 'Portail ouvert !');
        } catch (e) {
          ui.guest.displayMessage('danger', "Erreur lors de l'ouverture du portail.");
        }
        setTimeout(() => {
          dom.guest.portalButton.disabled = false;
        }, 2000);
      },
      handleReset: () => {
        ui.guest.resetSystem();
      },
      handleTripleClick: () => {
        state.guest.tripleClickCount++;
        if (state.guest.tripleClickCount === 1) {
          state.guest.tripleClickTimer = setTimeout(() => {
            state.guest.tripleClickCount = 0;
          }, config.tripleClickThresholdMs);
        }
        if (state.guest.tripleClickCount === 3) {
          state.guest.tripleClickCount = 0;
          dom.guest.loginContainer.classList.remove('app-hidden');
        }
      },
      handleManagerLogin: async () => {
        try {
          await auth.signInWithPopup(googleProvider);
          ui.manager.showApp();
        } catch (error) {
          ui.guest.displayMessage('danger', "Échec de l'authentification Google.");
        }
      },
    },
    manager: {
      loadPins: async () => {
        dom.manager.pinsList.innerHTML = '';
        const now = new Date();
        let query = db.collection('pins');
        if (state.currentSortBy) {
          query = query.orderBy(state.currentSortBy, state.currentSortOrder);
        }
        const snapshot = await query.get();
        snapshot.forEach((doc) => {
          const pin = { id: doc.id, ...doc.data() };
          ui.manager.addPinToDOM(pin);
        });
      },
      handleFormSubmit: async (e) => {
        e.preventDefault();
        const pinCode = dom.manager.form.pinCodeInput.value.trim().toUpperCase();
        const dateIn = new Date(dom.manager.form.dateInInput.value);
        const dateOut = new Date(dom.manager.form.dateOutInput.value);
        const contact = dom.manager.form.contactInput.value.trim();
        const phone = dom.manager.form.phoneInput.value.trim();
        if (state.currentEditingPinId) {
          await db.collection('pins').doc(state.currentEditingPinId).update({
            pinCode,
            dateIn,
            dateOut,
            contact,
            phone,
          });
        } else {
          await db.collection('pins').add({
            pinCode,
            dateIn,
            dateOut,
            contact,
            phone,
          });
        }
        ui.manager.resetForm();
        handlers.manager.loadPins();
      },
      handleEditPin: (id) => {
        state.currentEditingPinId = id;
        const pinItem = document.querySelector(`.pin-item[data-id="${id}"]`);
        dom.manager.form.pinCodeInput.value = pinItem.querySelector('.pin-code').textContent;
        dom.manager.form.dateInInput.value = pinItem.querySelector('.pin-dateIn').textContent;
        dom.manager.form.dateOutInput.value = pinItem.querySelector('.pin-dateOut').textContent;
        dom.manager.form.contactInput.value = pinItem.querySelector('.pin-contact').textContent;
        dom.manager.form.phoneInput.value = pinItem.querySelector('.pin-phone').textContent;
        dom.manager.form.submitButton.textContent = 'Modifier';
        dom.manager.form.form.classList.add('is-active');
      },
      handleDeletePin: async (id) => {
        await db.collection('pins').doc(id).delete();
        handlers.manager.loadPins();
      },
      handleCancelEdit: () => {
        ui.manager.resetForm();
      },
      handleGeneratePin: () => {
        dom.manager.form.pinCodeInput.value = utils.generateRandomPin(config.pinLength);
        ui.manager.updateButtonStates();
      },
      handleSort: (sortBy) => {
        if (state.currentSortBy === sortBy) {
          state.currentSortOrder = state.currentSortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          state.currentSortBy = sortBy;
          state.currentSortOrder = 'asc';
        }
        handlers.manager.loadPins();
      },
      handleSearch: async () => {
        const query = dom.manager.controls.searchQueryInput.value.trim().toUpperCase();
        dom.manager.pinsList.innerHTML = '';
        let pinsRef = db.collection('pins');
        if (query) {
          pinsRef = pinsRef.where('pinCode', '==', query);
        }
        const snapshot = await pinsRef.get();
        snapshot.forEach((doc) => {
          const pin = { id: doc.id, ...doc.data() };
          ui.manager.addPinToDOM(pin);
        });
      },
      handleClearSearch: () => {
        dom.manager.controls.searchQueryInput.value = '';
        handlers.manager.loadPins();
      },
    },
  };

  // --- 8. ÉVÉNEMENTS ---

  // Guest events
  dom.guest.pinInput.addEventListener('input', handlers.guest.handleInput);
  dom.guest.checkPinButton.addEventListener('click', () => handlers.guest.checkPin());
  dom.guest.backspaceButton.addEventListener('click', handlers.guest.handleBackspace);
  dom.guest.portalButton.addEventListener('click', handlers.guest.handlePortalOpen);
  dom.guest.resetButton.addEventListener('click', handlers.guest.handleReset);
  dom.guest.logo.addEventListener('click', handlers.guest.handleTripleClick);
  dom.guest.googleSignInBtn.addEventListener('click', handlers.guest.handleManagerLogin);

  // Manager events
  dom.manager.returnToGuestBtn.addEventListener('click', ui.guest.showApp);
  dom.manager.form.form.addEventListener('submit', handlers.manager.handleFormSubmit);
  dom.manager.form.cancelButton.addEventListener('click', handlers.manager.handleCancelEdit);
  dom.manager.controls.generatePinBtn.addEventListener('click', handlers.manager.handleGeneratePin);
  dom.manager.controls.sortBtn.addEventListener('click', () => {
    dom.manager.controls.sortMenu.classList.toggle('app-hidden');
  });
  dom.manager.controls.sortMenu.addEventListener('click', (e) => {
    if (e.target.dataset.sortBy) {
      handlers.manager.handleSort(e.target.dataset.sortBy);
    }
  });
  dom.manager.controls.searchQueryInput.addEventListener('input', handlers.manager.handleSearch);
  dom.manager.controls.clearSearchBtn.addEventListener('click', handlers.manager.handleClearSearch);
  dom.manager.pinsList.addEventListener('click', (e) => {
    const pinItem = e.target.closest('.pin-item');
    if (!pinItem) return;
    const id = pinItem.dataset.id;
    if (e.target.classList.contains('edit-btn')) {
      handlers.manager.handleEditPin(id);
    } else if (e.target.classList.contains('delete-btn')) {
      handlers.manager.handleDeletePin(id);
    }
  });

  // --- 9. INITIALISATION ---
  ui.guest.showApp();
})();
