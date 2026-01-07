const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');
const cors = require('cors');
const ngrok = require('ngrok');

const app = express();

// Configurar CORS para permitir peticiones desde cualquier origen
app.use(cors());
app.use(express.json());

let client = null;

// Inicializar el cliente de WhatsApp
async function initializeWhatsApp() {
  try {
    client = await wppconnect.create({
      session: 'sessionName',
      catchQR: (base64Qrimg, asciiQR, attempts, urlCode) => {
        console.log('Número de intentos para leer el QR:', attempts);
        console.log('QR Code (ASCII):\n', asciiQR);
        console.log('Escanea este QR con tu WhatsApp para conectarte');
      },
      statusFind: (statusSession, session) => {
        console.log('Estado de la sesión:', statusSession);
        console.log('Nombre de la sesión:', session);
      },
      headless: 'new',
      devtools: false,
      useChrome: true,
      debug: false,
      logQR: true,
      autoClose: 0, // Nunca cerrar automáticamente (0 = infinito)
      disableWelcome: true,
      browserArgs: [
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage'
      ]
    });

    console.log('✅ Cliente de WhatsApp iniciado correctamente');
    
    // Verificar el estado de la conexión
    client.onStateChange((state) => {
      console.log('Estado cambiado:', state);
      if (state === 'CONFLICT' || state === 'UNLAUNCHED') {
        client.useHere();
      }
    });

  } catch (error) {
    console.error('❌ Error al inicializar WhatsApp:', error);
  }
}

// Endpoint para verificar el estado
app.get('/status', (req, res) => {
  if (client) {
    res.json({ 
      status: 'connected',
      message: 'Cliente de WhatsApp conectado'
    });
  } else {
    res.json({ 
      status: 'disconnected',
      message: 'Cliente de WhatsApp no conectado'
    });
  }
});

// Endpoint para enviar mensaje
app.post('/send-message', async (req, res) => {
  try {
    const { number, message } = req.body;

    if (!number || !message) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere número y mensaje'
      });
    }

    if (!client) {
      return res.status(500).json({
        success: false,
        error: 'Cliente de WhatsApp no conectado'
      });
    }

    // Formatear número (agregar @c.us si no lo tiene)
    const formattedNumber = number.includes('@c.us') 
      ? number 
      : `${number}@c.us`;

    // Enviar mensaje
    const result = await client.sendText(formattedNumber, message);
    
    res.json({
      success: true,
      message: 'Mensaje enviado correctamente',
      data: result
    });

  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para enviar imagen
app.post('/send-image', async (req, res) => {
  try {
    const { number, imagePath, caption } = req.body;

    if (!number || !imagePath) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere número y ruta de imagen'
      });
    }

    if (!client) {
      return res.status(500).json({
        success: false,
        error: 'Cliente de WhatsApp no conectado'
      });
    }

    const formattedNumber = number.includes('@c.us') 
      ? number 
      : `${number}@c.us`;

    const result = await client.sendImage(
      formattedNumber,
      imagePath,
      'image',
      caption || ''
    );
    
    res.json({
      success: true,
      message: 'Imagen enviada correctamente',
      data: result
    });

  } catch (error) {
    console.error('Error al enviar imagen:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para obtener información de contacto
app.get('/contact/:number', async (req, res) => {
  try {
    const { number } = req.params;

    if (!client) {
      return res.status(500).json({
        success: false,
        error: 'Cliente de WhatsApp no conectado'
      });
    }

    const formattedNumber = number.includes('@c.us') 
      ? number 
      : `${number}@c.us`;

    const contact = await client.getContact(formattedNumber);
    
    res.json({
      success: true,
      contact: contact
    });

  } catch (error) {
    console.error('Error al obtener contacto:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Permite conexiones desde cualquier IP

app.listen(PORT, HOST, async () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🌐 Accesible desde la red en http://<tu-ip>:${PORT}`);
  
  // Crear túnel ngrok
  try {
    const url = await ngrok.connect({
      addr: PORT,
      proto: 'http'
    });
    console.log(`🌍 Túnel público creado: ${url}`);
    console.log(`   Puedes acceder desde cualquier lugar usando esta URL`);
  } catch (error) {
    console.error('❌ Error al crear túnel ngrok:', error.message);
    console.log('   Puede que necesites configurar ngrok authtoken');
    console.log('   Visita https://dashboard.ngrok.com/get-started/your-authtoken');
    console.log('   Luego ejecuta: npx ngrok config add-authtoken <tu-token>');
    console.log('   El servidor sigue corriendo localmente');
  }
  
  console.log('\n📱 Iniciando conexión con WhatsApp...\n');
  initializeWhatsApp();
});
