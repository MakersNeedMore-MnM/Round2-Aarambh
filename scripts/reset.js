/** reset.js — delete the demo database so the next start seeds fresh data. */
const fs = require('fs');
const store = require('../src/store');
if (fs.existsSync(store.DB_FILE)) {
  fs.unlinkSync(store.DB_FILE);
  console.log('Removed ' + store.DB_FILE + '. Start the server to seed fresh demo data.');
} else {
  console.log('Nothing to remove. Start the server to seed demo data.');
}
