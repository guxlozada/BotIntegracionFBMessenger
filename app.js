
/**
 * Copyright 2017-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Messenger Platform Quick Start Tutorial
 *
 * This is the completed code for the Messenger Platform quick start tutorial
 *
 * https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start/
 *
 * To run this code, you must do the following:
 *
 * 1. Deploy this code to a server running Node.js
 * 2. Run `npm install`
 * 3. Update the VALIDATION_TOKEN
 * 4. Add your PAGE_ACCESS_TOKEN to your environment vars
 *
 */

'use strict';

// Imports dependencies and set up http server
const
  request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  config = require('config'),
  //app = express().use(body_parser.json()), // creates express http server
  // GLOZADA: Manejo de log
  fs = require('fs'),
  // GLOZADA: Manejo de log
  util = require('util'),
  // GLOZADA: BD Redis
  Redis = require('ioredis'),
  redis = new Redis(process.env.REDIS_URL);

// GLOZADA: Se utiliza para forzar la asignacion de la variables de ambiente desde el archivo '.env'
// para poder realizar la misma accion sin necesidad de esta linea, se arranca el servidor 
// con el comando 'heroku local' en lugar de 'npm start', siempre que se cuente con el cliente de heroku
//require('dotenv').config();

const APP_SECRET = process.env.APP_SECRET || config.get('appSecret');
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || config.get('pageAccessToken');
const VALIDATION_TOKEN = process.env.VALIDATION_TOKEN || config.get('validationToken');
const NODE_ENV = process.env.NODE_ENV || 'default';
const PUERTO_HTTP = process.env.PORT || 5000;

var app = express();
app.set('view engine', 'ejs');
app.use(body_parser.json());
// GLOZADA: use the following code to serve images, CSS files, and JavaScript files in a directory named public
app.use(express.static('public'));

/** GLOZADA - LOG > INICIO: modificar console.log */
var log_file = fs.createWriteStream(__dirname + '/node.log', { flags: 'w' });
var log_stdout = process.stdout;

function logFormat(nivel, msj) {
  if (NODE_ENV === 'produccion') {
    log_stdout.write('[' + nivel + '] ' + msj + '\n');
  } else {
    let prefijoFecha = '[' + new Date().toLocaleTimeString('it-IT', {
      timeZone: 'America/Bogota'
    }) + ' ' + nivel + '] ';
    log_file.write(prefijoFecha + msj + '\n');
    log_stdout.write(prefijoFecha + msj + '\n');
  }
}

console.log = function () { logFormat("LOG", util.format.apply(null, arguments)); };
console.info = function () { logFormat("INFO", util.format.apply(null, arguments)); };
console.warn = function () { logFormat("WARN", util.format.apply(null, arguments)); };
console.error = function () { logFormat("ERRO", util.format.apply(null, arguments)); };
console.config = function () { logFormat("CFG", util.format.apply(null, arguments)); };
/** GLOZADA - LOG > FIN: modificar console.log */

console.config("[DESPLIEGUE] Bot-IntegracionFBMessenger se esta iniciando...");

// Sets server port and logs message on success
//app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));
// GLOZADA: Utilizada para arrancar el servidor HTTP
app.listen(PUERTO_HTTP, function () {
  // GLOZADA: BD Redis
  redis.set('registroprueba', 'RedisBD:IntegracionFBMessenger').then(function (resBD) {
    if (!resBD) {
      console.error('[app.listen] REDIS BD: No se pudo persistir el registro de prueba.');
    } else {
      console.config('[app.listen] REDIS BD:', resBD);
      redis.del("registroprueba");
    }
  });
  console.config('[app.listen] APP_SECRET:', APP_SECRET);
  console.config('[app.listen] NODE_ENV:', process.env.NODE_ENV);
  console.config('[app.listen] PAGE_ACCESS_TOKEN:', PAGE_ACCESS_TOKEN);
  console.config('[app.listen] PUERTO_HTTP:', PUERTO_HTTP);
  console.config('[app.listen] VALIDATION_TOKEN:', VALIDATION_TOKEN);
});

function jsonToString(obj) {
  return JSON.stringify(obj, null, '\t');
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// CODIGO DE EJEMPLO ORIGINAL
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Listener para respuestas a FB Messenger para pruebas temporales
 */
app.post('/messages', (req, res) => {
  console.info('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');
  console.info('[app.post] GLOZADA Se recibio mensaje de respuesta en FB Messenger');
  console.info('[app.post] body: ' + jsonToString(req.body));
  console.info('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');

  // Return a '200 OK' response to all events
  res.status(200).send('EVENT_RECEIVED_POST_MESSAGE');

});

/*
 * Accepts POST requests at /webhook endpoint
 * All callbacks for Messenger are POST-ed. They will be sent to the same webhook. 
 * Be sure to subscribe your app to your page to receive callbacks for your page.
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 * GLOZADA OK: La plataforma de Messenger envía eventos de webhook para notificar al bot de Messenger
 * las acciones que se realizan en ella. Los eventos se envían al webhook en formato JSON como
 * solicitudes POST
 */
app.post('/webhook', (req, res) => {
  console.info('[app.post] Request POST /webhook');
  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {
    let resPendiente = true;
    body.entry.forEach(function (entry) {

      // Gets the body of the webhook event
      // GLOZADA: https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/
      let webhook_event = entry.messaging[0];
      console.log('[app.post] webhook_event: ', jsonToString(webhook_event));


      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('[app.post] Sender ID:', sender_psid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      } else if (NODE_ENV !== 'produccion'){
        resPendiente = false;
        res.status(200).send('EVENTO_NO_PROCESADO');
      }

    });
    if(resPendiente){
      // Return a '200 OK' response to all events
      res.status(200).send('EVENTO_RECIBIDO');
    }

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});


/*
 * Accepts GET requests at the /webhook endpoint
 * Use your own validation token. Check that the token used in the Webhook setup is the same token used here.
 * GLOZADA OK: La plataforma de Messenger enviara una solicitud GET al webhook con el identificador de verificacion
 * que se haya facilitado. Si el webhook es valido y se ha configurado correctamente para responder a la 
 * solicitud de verificacion, guarda la configuracion y permite atender los eventos generados por el chatbot.
 * NOTA IMPORTANTE: Verificar que el valor de 'TOKEN_VALIDATION' corresponda el mismo valor
 * configurado en:
 *   (1) Pagina de administracion de aplicaciones de la plataforma messenger >Mis aplicaciones >
 *       NOMBRE_APP > Menu PRODUCTOS > Messenger > Configuracion - panel Webhooks - boton Configurar Webhooks >
 *       Identificador de verificacion
 *   (2) Archivo 'default.json' - constante 'validationToken'
 */
app.get('/webhook', (req, res) => {
  console.info('[app.get] Request GET /webhook');
  // Parse params from the webhook verification request
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Check if a token and mode were sent
  if (mode && token) {

    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === VALIDATION_TOKEN) {

      // Respond with 200 OK and challenge token from the request
      console.log('[app.get] WEBHOOK_VERIFICADO');
      res.status(200).send(challenge);

    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  } else {
    // Responds with '403 Forbidden' if verify tokens do not match
    res.sendStatus(403);
  }
});

function handleMessage(sender_psid, received_message) {
  console.info("[handleMessage] sender_psid:%s \n mensaje:", sender_psid, jsonToString(received_message));
  let response;

  // Checks if the message contains text
  if (received_message.text) {
    // Create the payload for a basic text message, which
    // will be added to the body of our request to the Send API
    response = {
      "text": `You sent the message: "${received_message.text}". Now send me an attachment!`
    }
  } else if (received_message.attachments) {
    // Get the URL of the message attachment
    let attachment_url = received_message.attachments[0].payload.url;
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Is this the right picture?",
            "subtitle": "Tap a button to answer.",
            "image_url": attachment_url,
            "buttons": [
              {
                "type": "postback",
                "title": "Yes!",
                "payload": "yes",
              },
              {
                "type": "postback",
                "title": "No!",
                "payload": "no",
              }
            ],
          }]
        }
      }
    }
  }

  // Send the response message
  callSendAPI(sender_psid, response);
}

function handlePostback(sender_psid, received_postback) {
  console.log('[handlePostback] ok')
  let response;
  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === 'yes') {
    response = { "text": "Thanks!" }
  } else if (payload === 'no') {
    response = { "text": "Oops, try sending another image." }
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}

function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request({
    //GLOZADA: Se cambio a variable de entorno 
    //"uri": "https://graph.facebook.com/v2.6/me/messages",
    "uri": config.get('uriHttpRequestMessengerPlatform'),
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('[callSendAPI] EL mensaje fue enviado!')
    } else {
      console.error("[callSendAPI] No fue posible enviar el mensaje por el siguiente error: \n", err);
    }
  });
}

//GLOZADA: Validar que no haya errores para obtener la conexion con la BD Redis
redis.on('error', function (err) {
  console.error("No se pudo obtener la conexion con la BD Redis. Se detiene la aplicacion. \n", err);
  process.exit(1);
});

module.exports = app;
