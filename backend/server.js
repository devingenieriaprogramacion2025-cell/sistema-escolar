const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env'), quiet: true });
const app = require('./src/app');

const puertoBase = Number(process.env.PORT || 5500);
const maxIntentos = 20;

const iniciarServidor = (puerto, intento = 0) => {
  const server = app.listen(puerto, () => {
    console.log(`Sistema escolar disponible en http://localhost:${puerto}/login.html`);
  });

  server.once('error', (error) => {
    if (error.code !== 'EADDRINUSE') {
      console.error(`No se pudo iniciar el servidor: ${error.message}`);
      process.exit(1);
    }

    if (intento >= maxIntentos) {
      console.error(`No hay puertos disponibles entre ${puertoBase} y ${puertoBase + maxIntentos}.`);
      process.exit(1);
    }

    const siguientePuerto = puerto + 1;
    console.warn(`Puerto ${puerto} en uso. Reintentando en ${siguientePuerto}...`);
    iniciarServidor(siguientePuerto, intento + 1);
  });
};

iniciarServidor(puertoBase);
