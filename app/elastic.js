/*
 * HEP-PUBSUB Interface Controller for Elastic
 * (C) 2019 QXIP BV
 */

try {
  var config = require('./config.js');
} catch(e) { console.log('Missing config!',e); process.exit(1); }

var express = require('express');
const app = express();
var bodyParser = require("body-parser");
app.use(bodyParser.json());

var port = config.service.port;

/* API SETTINGS */
app.all('*', function(req, res, next) {
   res.header("Access-Control-Allow-Origin", "*");
   res.header("Access-Control-Allow-Headers", "X-Requested-With");
   next();
});

/* HEP Post Paths */
app.post('/get/:id', function (req, res) {
  if (config.debug) console.log('NEW API POST REQ', req.body);
  var data = req.body.data;
  if (!data) { res.send(500); return }
  if (!data.constructor === Array) data = [data];
  var settings = {
      "params": [
        {
          "OriginIDs": data
        }
      ],
      "id": 0,
      "method": "ApierV2.GetCDRs"
  };
  getElastic(settings, res);
})

app.listen(port, () => console.log('API Server started',port))

/* ELASTIC API Proto */

var getElastic = function(settings, res){

  try {
    const client = new Client({ node:  config.elastic.url || 'http://localhost:9200' })
    client.search({
      index: config.elastic.index || 'my-index',
      body: settings
    }, (err, result) => {
      if (err) {
          if (config.debug) console.log('ELASTIC API ERROR', err.message)
          res.status(500).end();
      } else {
         if (config.debug) console.log('ELASTIC API RESPONSE',result)
         res.send(result).end();
      }
    })

  } catch(e) { console.error(e) }

}

/* HEP PUBSUB Hooks */
var req = require('req-fast');
var api = config.backend;
const uuidv1 = require('uuid/v1');
var uuid = uuidv1();
var ttl = config.service.ttl;

var publish = function(){
  try {
    var settings = config.service;
    settings.uuid = uuid;
    req({
      method: 'POST',
      url: api,
      dataType: 'JSON',
      data: settings
    }, (err, res) => {
      if (err) {
        if (config.debug) console.log('REGISTER API ERROR', err.message);
	process.exit(1);
      }
      if (config.debug) console.log('REGISTER API',res.body||'no response')
    })
  } catch(e) { console.error(e) }
}

/* REGISTER SERVICE w/ TTL REFRESH */
if (ttl) {
	publish();
	/* REGISTER LOOP */
	setInterval(function() {
	   publish()
	}, (.9 * ttl)*1000 );
}

/* END */