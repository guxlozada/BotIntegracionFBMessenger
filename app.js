
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
 * 3. Update the TOKEN_VERIFY
 * 4. Add your TOKEN_PAGE_ACCESS to your environment vars
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
  /** GLOZADA - LOG > INICIO: definir variables */
  https = require('https'),

  fs = require('fs'),
  util = require('util');
  /** GLOZADA - LOG > FIN: definir variables */
const MODO_PRODUCCION = process.env.MODOPRODUCCION || false;
const PUERTO_HTTP = process.env.PORT || 5000;
const TOKEN_PAGE_ACCESS = process.env.TOKENPAGEACCESS || config.get('pageAccessToken');
const TOKEN_VERIFY = process.env.TOKENVERIFY || config.get('validationToken');

var app = express();
app.set('view engine', 'ejs');
app.use(body_parser.json());
// GLOZADA: use the following code to serve images, CSS files, and JavaScript files in a directory named public
app.use(express.static('public'));

/** GLOZADA - LOG > INICIO: modificar console.log */
var log_file = fs.createWriteStream(__dirname + '/node.log', { flags: 'w' });
var log_stdout = process.stdout;

function logFormat(nivel, msg) {
  var prefijoFecha = '[' + new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') + '] ';
  log_file.write(prefijoFecha + nivel + util.format(msg) + '\n');
  log_stdout.write(prefijoFecha + nivel + util.format(msg) + '\n');
}

console.log = function (msg) { logFormat("<LOG> ", msg); };
console.info = function (msg) { logFormat("<INFO> ", msg); };
console.warn = function (msg) { logFormat("<WARN> ", msg); };
console.error = function (msg) { logFormat("<ERROR> ", msg); };
console.config = function (msg) { logFormat("<CONFIG> ", msg); };
/** GLOZADA - LOG > FIN: modificar console.log */


console.config("[DESPLIEGUE] Bot-IntegracionFBMessenger se esta iniciando...");

// Sets server port and logs message on success
//app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));
app.listen(PUERTO_HTTP, function () {
  console.config('[app.listen] MODO_PRODUCCION: ' + MODO_PRODUCCION);
  console.config('[app.listen] PUERTO_HTTP: ' + PUERTO_HTTP);
  console.config('[app.listen] TOKEN_PAGE_ACCESS: ' + TOKEN_PAGE_ACCESS);
  console.config('[app.listen] TOKEN_VERIFY: ' + TOKEN_VERIFY);
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
  console.info('[app.post] GLOZADA Inicio');
  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {

    body.entry.forEach(function(entry) {

      // Gets the body of the webhook event
      // GLOZADA: https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/
      let webhook_event = entry.messaging[0];
      console.log('[app.post] webhook_event: ' + webhook_event);


      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('[app.post] Sender ID: ' + sender_psid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);        
      } else if (webhook_event.postback) {
        
        handlePostback(sender_psid, webhook_event.postback);
      }
      
    });
    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

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
  console.info('[app.get] GLOZADA Inicio');
  // Parse params from the webhook verification request
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Check if a token and mode were sent
  if (mode && token) {
  
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === TOKEN_VERIFY) {
      
      // Respond with 200 OK and challenge token from the request
      console.log('[app.get] WEBHOOK_VERIFIED');
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
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": TOKEN_PAGE_ACCESS },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('[callSendAPI] message sent!')
    } else {
      console.error("[callSendAPI] Unable to send message:" + err);
    }
  }); 
}



module.exports = app;
