This project provides a simple way to give temporary access to my RBnB guests to operate the motorized gate of my property using a smartphone. This way Guests do not need a remote control (they tend to loose or never return), they just use their own smartphone. In addition access is date/time controlled.
I provide a unique PIN code that is associated with an expiration date and a link to my special website with a PIN entry screen.
The gest must type the PIN code I sent him and if valid and not expired an "open/close gate" button will be automatically unlocked.
The guest can now operate the gate until the expiry date associated with the PIN Code is reached.
When the guest clicks on the active "open/close gate" button it activates a SONOFF Dry contact switch connected to the gate controler mainboard and associated with an ALEXA Routine.
Once the PIN code is expired the Guest cannot operate the gate anymore and the user is invited to enter a valid PIN Code.
I am notified in real time of the opening / closing of the gate.
I use a Google Firebase Firestore Database to store alaphanumeric PIN Codes and a "dd/mm/yyyy hh:mm" Expiry date.
