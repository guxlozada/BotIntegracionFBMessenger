
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
  crypto = require('crypto'),
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

/**
 * GLOZADA NOTA IMPORTANTE: Asegurese de configurar las variables de ambiente antes de ejecutar 
 * esta parte del codigo. La configuracion se la realiza utilizando variables de ambiente (Internas o Externas) 
 * o modificando el archivo de configuracion en el directorio '/config/*.json'.
 */

// App Secret can be retrieved from the App Dashboard
const APP_SECRET = process.env.APP_SECRET || config.get('appSecret');
// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || config.get('pageAccessToken');
// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = process.env.VALIDATION_TOKEN || config.get('validationToken');
// Endpoint del servicio REST para vincular el usuario
const URI_AUT_REST_LINKUSER = process.env.URI_AUT_REST_LINKUSER || config.get('uriAUTRestLinkUser');
// Servlet para generar la pagina de autnticacion
const URI_AUT_SERVLET_LOGIN = process.env.URI_AUT_SERVLET_LOGIN || config.get('uriAUTServletAutenticacion');
// Endpoint del servicio REST utilizado para retornar respuestas al chatbot 
const URI_REQ_FB_MESSENGER = process.env.URI_REQ_FB_MESSENGER || config.get('uriHttpRequestMessengerPlatform');
// Contexto de la app Bot-NLP
const URI_NLP_CONTEXTO = process.env.URI_NLP_CONTEXTO || config.get('uriNLPContexto');
// PATH base de los servicios REST de la app Bot-NLP
const URI_NLP_REST = process.env.URI_AUT_REST || config.get('uriNPLRest');
const ID_APP = 'BOT-FB';
// Ambiente de operacion (default=desarrollo maquina local; desarrollo; certificacion; produccion)
const NODE_ENV = process.env.NODE_ENV || 'default';
const MODO_PRODUCCION = NODE_ENV === 'production';
const PUERTO_HTTP = process.env.PORT || 5000;


var app = express();
app.set('view engine', 'ejs');
if (MODO_PRODUCCION) {
  app.use(body_parser.json({ verify: verifyRequestSignature }));
} else {
  app.use(body_parser.json());
}
// GLOZADA: use the following code to serve images, CSS files, and JavaScript files in a directory named public
app.use(express.static('public'));

// GLOZADA: Crear un archivo de log personalizado
var logFile = fs.createWriteStream(__dirname + '/node.log', { flags: 'w' });
var logStdout = process.stdout;

// GLOZADA: re-definir las funciones por omision para la consola de mensajes
function logFormat(nivel, msj, resaltar) {
  let msjAuditoria = msj + '\n';
  if (NODE_ENV === 'default') {
    msjAuditoria = '[' + new Date().toLocaleTimeString('it-IT', { timeZone: 'America/Bogota' })
      + '] ' + msjAuditoria;
    logFile.write([ID_APP, ' ', nivel, ' ', msjAuditoria].join(''));
  }
  if (resaltar) {
    if (nivel == 'ERROR' || nivel === 'WARNING') {
      logStdout.write(['\x1b[', resaltar, 'm[', ID_APP, ' ', nivel, '] ', msjAuditoria, '\x1b[0m'].join(''));
    } else {
      logStdout.write(['\x1b[', resaltar, 'm[', ID_APP, ' ', nivel, '] \x1b[0m', msjAuditoria].join(''));
    }
  } else {
    logStdout.write(['[', ID_APP, ' ', nivel, '] ', msjAuditoria].join(''));
  }
}

// GLOZADA: redefinir las funciones para los mensajes de consola
console.config = function () { logFormat("CFG", util.format.apply(null, arguments), 32); };
console.error = function () { logFormat("ERROR", util.format.apply(null, arguments), 33); };
console.info = function () { logFormat("INF", util.format.apply(null, arguments)); };
console.log = function () { logFormat("LOG", util.format.apply(null, arguments)); };
console.trace = function () { if (!MODO_PRODUCCION) logFormat("DEBUG", util.format.apply(null, arguments), 36); };
console.warn = function () { logFormat("*WARNING*", util.format.apply(null, arguments), 36); };

// Inicio del despliegue de la applicacion
console.config("[DESPLIEGUE] La aplicacion se esta iniciando...");
console.config('[DESPLIEGUE] APP_SECRET:', APP_SECRET);
console.config('[DESPLIEGUE] NODE_ENV:', NODE_ENV);
console.config('[DESPLIEGUE] PAGE_ACCESS_TOKEN:', PAGE_ACCESS_TOKEN);
console.config('[DESPLIEGUE] PUERTO_HTTP:', PUERTO_HTTP);
console.config('[DESPLIEGUE] VALIDATION_TOKEN:', VALIDATION_TOKEN);
console.config('[DESPLIEGUE] URI_AUT_REST_LINKUSER:', URI_AUT_REST_LINKUSER);
console.config('[DESPLIEGUE] URI_AUT_SERVLET_LOGIN:', URI_AUT_SERVLET_LOGIN);
console.config('[DESPLIEGUE] URI_REQ_FB_MESSENGER:', URI_REQ_FB_MESSENGER);
console.config('[DESPLIEGUE] URI_NLP_CONTEXTO:', URI_NLP_CONTEXTO);
console.config('[DESPLIEGUE] URI_NLP_REST:', URI_NLP_REST);

/**
 * Verificar que se haya asignado valores a las claves de confianza (tokens) para integrar la aplicacion
 * con la plataforma de messenger.
 */
if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN)) {
  console.error("[DESPLIEGUE] La aplicacion no se puede iniciar si no se ha definido las variables de ambiente:"
    + " para las claves de confianza: APP_SECRET,VALIDATION_TOKEN y PAGE_ACCESS_TOKEN.");
  process.exit(1);
}

/**
 * Verificar que se haya mapeado las URI de las aplicaciones/recursos con los que es necesario
 * que interopere la aplicacion:
 *  (1) Plataforma Messenger
 *  (2) Bot-Autenticacion
 *  (3) Bot-NLPServer
 */
if (!(URI_AUT_REST_LINKUSER && URI_AUT_SERVLET_LOGIN && URI_REQ_FB_MESSENGER
  && URI_NLP_CONTEXTO && URI_NLP_REST)) {
  console.error("[DESPLIEGUE] La aplicacion no se puede iniciar si no se ha definido las"
    + " URI de las aplicaciones/recursos con los que necesita interoperar.");
  process.exit(1);
}

/**
 * GET methos route for endpoint '/webhook'
 * 
 * Use your own validation token. Check that the token used in the Webhook setup is the same token used here.
 * 
 * GLOZADA: La plataforma de Messenger siempre enviara una solicitud GET al webhook para validar la
 * clave de confianza (VALIDATION_TOKEN) para empezar la 'conversacion' entre la aplicacion y la 
 * plataforma de Messenger. Posterior ha esta peticion de validacion permite atender los eventos
 * generados por las personas en el chatbot.
 * NOTA IMPORTANTE: Verificar que el valor de 'VALIDATION_TOKEN' corresponda el mismo valor
 * configurado en:
 *  (1) PLATAFORMA MESSENGER: Pagina de administracion de las aplicaciones de la plataforma messenger
 *      (https://developers.facebook.com/docs/messenger-platform)> Mis aplicaciones> NOMBRE_APP> 
 *      Menu PRODUCTOS> Messenger> Configuracion-panel Webhooks-boton Configurar Webhooks> 
 *      Identificador de verificacion
 *  (2) APLICACION: Variable de ambiente 'process.env.VALIDATION_TOKEN' (EXTERNO) o 
 *      la constante 'validationToken' del archivo '/config/AMBIENTE.json' (INTERNO)
 */
app.get('/webhook', (req, res) => {
  console.trace('[app.get] Request GET /webhook. LLamada para validacion de la'
    + ' clave de confianza (VALIDATION_TOKEN).');

  // Parse params from the webhook verification request
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === VALIDATION_TOKEN) {
      // Respond with 200 OK and challenge token from the request
      console.trace('[app.get] WEBHOOK_VERIFICADO');
      res.status(200).send(challenge);
    } else {
      console.error("[app.get] La clave de confianza (VALIDATION_TOKEN) no es la correcta.");
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  } else {
    console.error("[app.get] La request no contiene los parametros requeridos para la validacion"
      + " de la clave de confianza (VALIDATION_TOKEN).");
    // Responds with '403 Forbidden' if GET params no exist
    res.sendStatus(403);
  }
});

/*
 * POST methos route for endpoint '/webhook'
 * 
 * All callbacks for Messenger are POST-ed. They will be sent to the same webhook. 
 * Be sure to subscribe your app to your page to receive callbacks for your page.
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 * 
 * GLOZADA: La plataforma de Messenger envía eventos al webhook para informar a la aplicacion
 * de las interacciones o los eventos que tienen lugar, incluidos los mensajes, que envia una persona. 
 * La plataforma envia los eventos de webhook como solicitudes POST al webhook.
 */
app.post('/webhook', (req, res) => {
  console.trace('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
  console.trace('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< \n \n \n');
  console.trace('[app.post] Request POST /webhook. Llamada de eventos webhook');
  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {

    // GLOZADA: Mensaje requerido para las peticiones 'POST dummies'
    let msjResponseDummies = 'EVENTO_WEBHOOK_ATENDIDO';

    body.entry.forEach(function (pageEntry) {

      // Iterate over each messaging event, gets the body of the webhook event
      // GLOZADA: Solo existe un evento_webhook asociado a cada request
      // https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/
      pageEntry.messaging.forEach(function (webhookEvent) {
        let senderId = webhookEvent.sender.id;
        console.trace('[app.post] webhookEvent:', jsonToTextoIdentado(webhookEvent));

        // Checkthe event type and pass the event to the appropriate handler function
        if (webhookEvent.message) {
          // GLOZADA: eventos de envio de mensaje de texto enviado por el usuario
          receivedMessage(senderId, webhookEvent.message);
        } else if (webhookEvent.postback) {
          // GLOZADA: eventos de respuesta recibida a multi-opcion generada previamente
          handlePostback(senderId, webhookEvent.postback);
        } else if (webhookEvent.account_linking) {
          // GLOZADA: eventos de vinculacion de cuentas. 
          receivedAccountLink(senderId, webhookEvent.account_linking);
        } else if (webhookEvent.optin) {
          // GLOZADA: eventos con mensaje de autenticacion recibida
          receivedAuthentication(senderId, webhookEvent);
        } else {
          msjResponseDummies = 'EVENTO_WEBHOOK_NO_ATENDIDO';
          console.warn("[app.post] La aplicacion no esta preparada para atender el tipo de evento webhook:",
            jsonToTextoIdentado(webhookEvent));
        }
      });
    });

    // Return a '200 OK' response to all events. You must send back a 200, within 20 seconds, 
    // to let us know you've successfully received the callback. Otherwise, the request will time out.
    if (MODO_PRODUCCION) {
      res.sendStatus(200);
    } else {
      res.status(200).send(msjResponseDummies);// Mensaje requerido para las peticiones 'POST dummies' 
    }

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

/*
 * Handler for Message Event
 *
 * This event is called when a message is sent to your page. The 'message' 
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 * 
 * GLOZADA: funcion utilizada para procesar el mensaje obtenido del evento webhook 'messagingEvent.message'.
 * Se puede recibir mensaje de tipo texto, respuesta rapida(multi-opcion), eco o archivos.
 * ver: https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/messages#attachment
 */
function receivedMessage(senderId, message) {
  console.trace("[receivedMessage] Procesando evento webhook 'message': %j", message);

  let messageId = message.mid;

  if (message.quick_reply) {
    // GLOZADA: Propaga a la app Bot-NLP el procesamiento de la respuesta a pregunta con opcion multiple
    let quickReplyPayload = message.quick_reply.payload;
    console.trace("[receivedMessage] Quick reply para el mensaje: %s, con la informacion: ",
      messageId, quickReplyPayload);
    /** GLOZADA: PENDIENTE IMPLEMENTAR
      quickReplyReceived(senderId, quickReplyPayload);
    */
    return; // Obliga a finalizar el procesamiento del mensaje
  } else if (message.text) {
    // GLOZADA: Propaga a la app Bot-NLP el procesamiento del mensaje 
    /** GLOZADA: PENDIENTE IMPLEMENTAR
      sendTextMessageNPL(senderId, message.text);
    */
    callSendAPI(senderId, textoToMensajeGenerico(util.format("De momento no se procesa el texto:", message.text)));
    return; // Obliga a finalizar el procesamiento del mensaje
  }

  // Los mensajes que no son capturados por los filtros, se omiten y se responde un mensaje  generico

  if (message.is_echo) {
    // GLOZADA: Simplemente registra en el log de la consolo el mensaje de eco
    console.trace("[receivedMessage] Se ha recibido un mensaje de eco. mid: %s, app_id: %d, metadata %s",
      messageId, message.app_id, message.metadata);
  }
  //ORIGINAL: simplificado
  //sendTextMessage(senderID, "Lo siento, no puedo entender este tipo de mensajes.");
  callSendAPI(senderId, textoToMensajeGenerico("Lo siento, no puedo entender este tipo de mensajes."))

}

/*
 * Handler for Account Link Event
 * 
 * This event is called when the Link Account or UnLink Account action has been tapped.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/account-linking
 * 
 * GLOZADA: funcion utilizada para  invocar la autenticacion del usuario y vincular la cuenta 
 * para poder realizar consultas de 'negocio' a la app Bot-NLP.
 */
function receivedAccountLink(senderId, accountLinking) {
  console.trace("[receivedMessage] Procesando evento webhook 'account_linking': %j", accountLinking);

  let status = accountLinking.status;

  if (status === 'unlinked') {
    // GLOZADA: Apartado para desvincular la cuenta
    console.trace("[receivedAccountLink] Se ha recibido la solicitud para desvincular el usuario: ", senderId);
    /** GLOZADA: PENDIENTE IMPLEMENTAR
      llamada a un servicio REST que haga lo contrario a URI_AUT_REST_LINKUSER, donde se 
      elimine/inactibe el registro de BD mongo donde queda vinculado el usuario.
    */

    redis.del("UsuarioFB:" + senderId).then(() => { callSendAPI(senderId, textoToMensajeGenerico("Sesion Finalizada")); });
    return;// Obliga a finalizar el procesamiento del mensaje
  }
  // GLOZADA: Apartado para vincular la cuenta
  // authorization_code es generado al final de la autenticacion en la app Bot-AutenticacionBE
  var authCode = accountLinking.authorization_code;

  console.trace("[receivedAccountLink] Se ha recibido la solicitud para registrar la vinculacion"
    + " del usuario: %s, con el codigo de autorizacion:", senderId, authCode);

  // GLOZADA: PENDIENTE IMPLEMENTAR: Verificar porque se persiste antes de verificar si se 
  // ha registrado la vinculacion en el Bot-AutenticacionBE, este deberia almacenarse
  // una vez verificado la llamada al REST lin kUserFB y que se almacene con timeout configurado
  // ORIGINAL: Se movio para mejorar la ubicacion del registro de sesion de usuario autenticado
  // en redis
  // redis.set(senderId, authCode);

  // GLOZADA: Llama al api de autenticacion para registrar el senderId y relacionarlo.
  let optionsLinkUser = {
    "method": 'POST',
    // ORIGINAL: uri: config.get('uriAuthenticationBase') + '/linkUserFB',
    "uri": URI_AUT_REST_LINKUSER,
    // GLOZADA Informacion requerida por el servicio REST para vincular el usuario
    "json": {
      "authCode": authCode,
      "senderId": senderId
    }
  };
  /** GLOZADA: PENDIENTE IMPLEMENTAR
   * Separar la vinculacion de cuenta con el inicio de conversacion con el chatbot. 
   */
  request(optionsLinkUser, function (error, response, body) {
    console.info("[receivedAccountLink] Response llamada servicio REST /linkUserFB. ");
    // GLOZADA: se descomenta el log solo para depuraciones de servicios REST
    // console.trace("[receivedAccountLink] Response llamada servicio REST /linkUserFB. response: ", jsonToTextoIdentado(response));

    if (!error && response.statusCode == 200) {
      console.trace("[receivedAccountLink] Usuario vinculado y registrado:", senderId);

      // GLOZADA: Agregado para mejorar el lugar donde se registro de sesion de usuario autenticado
      redis.set("UsuarioFB:" + senderId, authCode).then(function (resBD) {
        if (resBD !== 'OK') {
          sendErrorMessage(senderId, "receivedAccountLink_redis_vinculacion_usuario", new Error("Se produjo un error"
            + "al registrar la vinculacion del usuario en Redis BD"));
        } else {
          // GLOZADA: Hace la llamada a la app Bot-NLP para generar el mensaje inicial de respuesta al usuario
          let optionsInitChat = {
            "method": 'GET',
            // ORIGINAL: uri: config.get('uriNPLBase') + '/initChat?token=' + authCode
            "uri": URI_NLP_REST + '/initChat?token=' + authCode
          };
          request(optionsInitChat, function (error1, response1, body1) {
             // GLOZADA: se descomenta el log solo para depuraciones de servicios REST
            console.trace("[receivedAccountLink] Response llamada servicio REST /initChat. response:" , jsonToTextoIdentado(response1));
            if (!error1 && response1.statusCode == 200) {
              console.trace("[receivedAccountLink] Usuario autenticado en la aplicacion Bot-NLP");
              let bodyObj = JSON.parse(body1);
              callSendAPI(senderId, {
                "text": bodyObj['text'],
                "metadata": "INIT_BOT"
              });
            } else {
              sendErrorMessage(senderId, "receivedAccountLink_initChat", error1, body1);
            }
          });
        }

      });
    } else {
      sendErrorMessage(senderId, "receivedAccountLink_linkUserFB", error, body);
    }
  });
}

/*
 * Handler for Authorization Event
 * 
 * The value for 'optin.ref' is defined in the entry point. For the "Send to
 * Messenger" plugin, it is the 'data-ref' field. Read more at
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/authentication
 */
function receivedAuthentication(senderId, webhookEvent) {
  console.trace("[receivedMessage] Procesando evento webhook 'optin': %j", webhookEvent.optin);

  let recipientId = webhookEvent.recipient.id;
  let timeOfAuth = webhookEvent.timestamp;

  // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
  // The developer can set this to an arbitrary value to associate the
  // authentication callback with the 'Send to Messenger' click event. This is
  // a way to do account linking when the user clicks the 'Send to Messenger' plugin.
  let passThroughParam = webhookEvent.optin.ref;

  console.trace("[receivedAuthentication] Autenticacion recibida. usuario: %s, pagina: %s, fecha: %d,"
    + " con la informacion de referencia: %s", senderId, recipientId, timeOfAuth, passThroughParam);

  // When an authentication is received, we'll send a message back to the
  // sender to let them know it was successful.
  //ORIGINAL: reemplazado por llamada simplificada
  //sendTextMessage(senderID, "Autenticación satisfactoria");
  callSendAPI(senderId, textoToMensajeGenerico("Autenticación satisfactoria"));
}

/**
 * Funcion generica para procesar errores generados por llamadas remotas.
 * 
 * @param {*} senderId PSID del usuario destinatario. NOTA IMPORTANTE: no utilizar el atributo 'recipient.id'
 *    del mensaje de la peticion recibida para procesar.
 * @param {String} origenTxt Texto fijo que representa el origen que genero el error.
 * @param {Error} error Informacion del error generado al procesar las reglas de negocio.
 * @param {String} body GLOZADA: temporalmente se lee el objeto de retorno no estandarizado par tratar de identificar la app origen
 */
function sendErrorMessage(senderId, origenTxt, error, body) {

  let sufijoMetadata = origenTxt || 'DESCONOCIDO';

  if (error instanceof Error) {
    console.error("[sendErrorMessage] Error reportado. origen: %s, error: %s \n, stack: \n",
      sufijoMetadata, jsonToTextoIdentado(error), error.stack);
  } else if (body.origen) {
    sufijoMetadata = body.origen;
    console.error("[sendErrorMessage] Error reportado. origen: %s, servicioREST: %s, error:",
      body.origen, body.servicioREST, body.mensajeError);
  } else {
    console.error("[sendErrorMessage] Error reportado. origen: %s, error:", sufijoMetadata, error);
  }
  let messageData = {
    "text": "Lamentamos informar que ocurrió un error al procesar su mensaje, estamos trabajando en resolverlo.",
    "metadata": "ERROR_IN_" + sufijoMetadata.toUpperCase()
  };
  callSendAPI(senderId, messageData);
}

/**
 * Call the Send API. The message data goes in the body. If successful, we'll
 * get the message id in a response
 * GLOZADA:  Funcion utilizada para enviar el mensaje de respuesta a los eventos webhooks procesados.
 * 
 * @param {*} senderId PSID del usuario destinatario. NOTA IMPORTANTE: no utilizar el atributo 'recipient.id'
 *    del mensaje de la peticion recibida para procesar.
 * @param {Object} messageData Objeto json que contiene la informacion para el atributo 'message' de 
 *    la respuesta que se genera para la plataforma de messenger. La informacion contenida en el 
 *    objeto corresponde al contenido que se desea presentar en el chatbot. (ver archivo messageData.ayuda)
 */
function callSendAPI(senderId, messageData) {
  // Construct the message body
  let requestBody = {
    "recipient": {
      "id": senderId
    },
    "message": messageData
  }

  // Send the HTTP request to the Messenger Platform
  request({
    //ORIGINAL: Se cambio a variable de entorno 
    //"uri": "https://graph.facebook.com/v2.6/me/messages",
    "uri": URI_REQ_FB_MESSENGER,
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": requestBody
  }, (error, response, body) => {
    console.trace("[callSendAPI] Response llamada servicio REST %s. response.statusCode: %s,"
      + " response.statusMessage:", URI_REQ_FB_MESSENGER, response.statusCode, response.statusMessage);
    if (!error && response.statusCode == 200) {
      console.trace("[callSendAPI] El envio del mensaje fue satisfactorio. id mensaje: %s, destinatario: %s",
        body.recipient_id, body.message_id);
    } else {
      console.error("[callSendAPI] El envio del mensaje fallo. statusCode: %s, statusMessage: %s, error:\n",
        response.statusCode, response.statusMessage, body.error);
    }
  });
}

/*
 * Verify that the callback came from Facebook. Using the App Secret from the
 * App Dashboard, we can verify the signature that is sent with each callback in
 * the x-hub-signature field, located in the header.
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 * 
 * GLOZADA: Verifica que todas las peticiones a la aplicacion contengan una clave de confianza
 * generada para la aplicacion (APP_SeCRET), de esta forma solo se atienden peticiones generadas
 * por la plataforma de messenger
 * ver: https://developers.facebook.com/docs/messenger-platform/webhook 
 */
function verifyRequestSignature(req, res, buf) {
  let signature = req.headers["x-hub-signature"];
  if (!signature) {
    //console.error("[verifyRequestSignature] La request no contiene la firma de la aplicacion(APP_SECRET).");
    throw new Error("La request no contiene en el encabezado la firma de la aplicacion(APP_SECRET).");
  }
  console.trace("[verifyRequestSignature]  Verificando la firma de la aplicacion(APP_SECRET). signature:", signature);

  let elements = signature.split('=');
  // GLOZADA: desuso
  //let method = elements[0];
  let signatureHash = elements[1];
  let expectedHash = crypto.createHmac('sha1', APP_SECRET)
    .update(buf)
    .digest('hex');
  if (signatureHash != expectedHash) {
    //console.error("[verifyRequestSignature] La firma de la aplicacion(APP_SECRET) presente en la request no es valida.");
    throw new Error("La firma de la aplicacion(APP_SECRET) presente en la request no es valida.");
  }
}

/**
 * Convierte un objeto en notacion json a un texto identado multilinea.
 * 
 * @param {Object} obj Objeto en notacion json. 
 */
function jsonToTextoIdentado(obj) {
  return JSON.stringify(obj, null, '\t');
}

/**
 * Convierte un texto en un objeto json que puede ser enviado como respuesta al chatbot.
 * 
 * @param {String} textoMsj Texto que se desea retornar como mensaje generico.
 */
function textoToMensajeGenerico(textoMsj) {
  return {
    "text": textoMsj,
    "metadata": "MENSAJE_GENERICO"
  }
}

/**
 * Start server.
 * Webhooks must be available via SSL with a certificate signed by a valid
 * GLOZADA: Inicia el servidor HTTP. Se asigna el puerto y despliega para depuracion los
 * valores de las variables de ambiente con las que opera la aplicacion.
 */
//app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));
app.listen(PUERTO_HTTP, function () {
  // GLOZADA: Se realiza una prueba de persistencia en la BD Redis
  redis.set('registroprueba', APP_SECRET).then(function (resBD) {
    if (!resBD) {
      console.error('[app.listen] REDIS BD: No se pudo persistir el registro de prueba.');
    } else {
      console.config('[app.listen] REDIS BD:', resBD);
      redis.del("registroprueba");
    }
    console.config("[app.listen] La aplicacion se ha desplegado correctamente y esta disponible"
      + " para atender peticiones en el puerto %d", PUERTO_HTTP);
  });

});

/**
 * GLOZADA: Validar que en las llamadas al cliente de Redis se tenga una conexion activa.
 */
redis.on('error', function (err) {
  console.error("[RUNTIME] No se pudo obtener la conexion con la BD Redis. Se detiene la aplicacion. Detalles:\n", err);
  process.exit(1);
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// CODIGO PARA PRUEBAS TMP
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Listener para respuestas a FB Messenger para pruebas generadas por Bot-AutenticacionBE.
 */
app.get('/autenticacionBE', (req, res) => {
  console.trace('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');
  console.trace('Request GET /autenticacionBE;  HTTP request Dummy de FB Messenger');
  let senderId = req.query['sender_id'];
  let authorizationCode = req.query['authorization_code'];
  console.trace('authorization_code: ', req.query['authorization_code']);
  console.trace('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');

  let accountLinkingData = { "status": "unlinked" };
  if (authorizationCode) {
    accountLinkingData = {
      "status": "linked",
      "authorization_code": authorizationCode
    };
  }

  // Construct the message body
  let requestBody = {
    "object": "page",
    "entry": [
      {
        "id": "PAGE_ID_AAA",
        "time": 1458692752478,
        "messaging": [
          {
            "sender": {
              "id": senderId
            },
            "recipient": {
              "id": "PAGE_ID_AAA"
            },
            "timestamp": 1234567890,
            "account_linking": accountLinkingData
          }
        ]
      }
    ]
  }

  // Generar manualmente un evento webhook account_linking
  request({
    "uri": "http://localhost:5000/webhook",
    "method": "POST",
    "json": requestBody
  }, (error, response, body) => {
    if (!error && response.statusCode == 200) {
      console.trace("[autenticacionBE] La generacion de evento webhook de prueba fue satisfactorio.");
      // Return a '200 OK' response to all events
      res.status(200).send('EVENTO_WEBHOOK_DUMMY_ACCOUNT_LINKING_SATISFACTORIO');
    } else {
      console.error("[autenticacionBE] La generacion de evento webhook fallo. statusCode: %s, statusMessage: %s, error:\n",
        response.statusCode, response.statusMessage, body.error);
      // Return a '200 OK' response to all events
      res.status(200).send('EVENTO_WEBHOOK_DUMMY_ACCOUNT_LINKING_FALLO');
    }
  });

});

/**
 * Listener para respuestas a FB Messenger para pruebas generadas por Bot-IntegracionFBMessenger.
 */
app.post('/messages', (req, res) => {
  console.trace('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');
  console.trace('Request POST /messages;  HTTP request Dummy de FB Messenger');
  console.trace('body: ' + jsonToTextoIdentado(req.body));
  console.trace('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');

  // Return a '200 OK' response to all events
  res.status(200).send('RESPUESTA_RECIBIDA_FBMESSENGER');

});

module.exports = app;

/** 
 //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// CODIGO DE EJEMPLO ORIGINAL
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function handleMessage(sender_psid, received_message) {
  console.info("[handleMessage] sender_psid:%s \n mensaje:", sender_psid, jsonToTextoIdentado(received_message));
  let messageData;

  // Checks if the message contains text
  if (received_message.text) {
    // Create the payload for a basic text message, which
    // will be added to the body of our request to the Send API
    messageData = {
      "text": `You sent the message: "${received_message.text}". Now send me an attachment!`
    }
  } else if (received_message.attachments) {
    // Get the URL of the message attachment
    let attachment_url = received_message.attachments[0].payload.url;
    messageData = {
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
  callSendAPI(sender_psid, messageData);
}

function handlePostback(sender_psid, received_postback) {
  console.log('[handlePostback] ok')
  let messageData;
  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === 'yes') {
    messageData = { "text": "Thanks!" }
  } else if (payload === 'no') {
    messageData = { "text": "Oops, try sending another image." }
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, messageData);
}
 */
