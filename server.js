/* Lastpass Enterprise API Test
 * mkerai@logmein.com Nov 2020
 */

//****** Set up Express Server and socket.io
var http = require('http');
//var crypto = require('crypto');
var app = require('express')();
var bodyParser = require('body-parser');
var azure = require('azure-storage');
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

//********** Get port used by Heroku or use a default
var port = Number(process.env.PORT || 7979);
var server = http.createServer(app).listen(port);
var	io = require('socket.io')(server);
console.log("Server started on port "+port);

//********** Global variable (all should begin with a capital letter)
const AZURE_STORAGE_ACCOUNT = process.env.AZUREACCOUNT;
const AZURE_STORAGE_ACCESS_KEY = process.env.AZUREKEY;

const LP_url =  'https://lastpass.com/enterpriseapi.php';
var PollInterval = 3600;	// default poll interval is 1 hour
var CID = "";
var PHASH = "";
var Timer = 0;
var LastMessage = {"Initial":0};

var QueueService = azure.createQueueService(AZURE_STORAGE_ACCOUNT,AZURE_STORAGE_ACCESS_KEY);

QueueService.createQueueIfNotExists('outqueue', function(error) {
  if (!error) {
	console.log("Azure Connection to Queue Successful");
  }
});


//****** process valid URL requests
app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});
app.get('/favicon.ico', function(req, res){
	res.sendFile(__dirname + '/favicon.ico');
});
app.get('/*.html', function(req, res){
    res.sendFile(__dirname + req.path);
});
app.get('/*.js', function(req, res){
    res.sendFile(__dirname + req.path);
});
app.get('/*.css', function(req, res) {
    res.sendFile(__dirname + req.path);
});
app.get('/*.png', function(req, res) {
    res.sendFile(__dirname + req.path);
});
//keep it last when all the above routes not found we come here
app.get('*', function(req, res) {
    res.sendFile(__dirname + "404.html");
});
// Set up socket actions and responses
io.on('connection', function(socket){

	socket.on('disconnect',function(data){
		removeSocket(socket.id,"disconnect");
	});

	socket.on('end',function(data){
		removeSocket(socket.id,"end");
	});

	socket.on('error',function(data){
		console.log("Socket Error");
		removeSocket(socket.id, "Socket Error");
	});

	socket.on('connect_timeout',function(data) {
		removeSocket(socket.id, "timeout");
	});

	// This is called to start new polling request from the front end UI
	socket.on('sendPollRequest',function(pdata) {
		console.log("polling request received");
	
		PollInterval = pdata.pollinterval;
		CID = pdata.cid;
		PHASH = pdata.phash;
		clearTimeout(Timer);		// clear existing timer
		Timer = setTimeout(doPolling,PollInterval*1000);	// kick off API polling
	});

	socket.on('stopPollRequest',function(pdata) {
		clearTimeout(Timer);		// clear existing timer
		console.log("polling stopped: "+Timer);
		Timer = 0;
	});

	socket.on('checkPollRequest',function() {
		var pollinfo = new Object();
		pollinfo["cid"] = CID;
		pollinfo["phash"] = PHASH;
		pollinfo["pollinterval"] = PollInterval;
		pollinfo["status"] = (Timer) ? "Active" : "Stopped";
		socket.emit('checkPollResponse', pollinfo);
	});

	socket.on('testConnectionRequest',function(api) {
		console.log("Test request received");
		apireq = new Object();
		apireq["cid"] = api.cid;
		apireq["provhash"] = api.phash;
		apireq["cmd"] = 'reporting';
		apireq["data"] = {"from": "2021-10-01 00:00:00","to": "2021-10-01 01:00:00"};
//		console.log("API Request: "+JSON.stringify(apireq));
		fetch(LP_url, {method: 'POST',body: JSON.stringify(apireq), headers: {'Content-Type':'application/json'}})
		.then(res => res.text())	// LP API returns a JSON message
		.then(jmsg => {
//			console.log("MSG: "+jmsg);
			genericCallback(socket,jmsg);		// send to front end
		});
	});

	socket.on('showLastMsgRequest',function() {
		socket.emit('showLastMsgResponse', LastMessage);
	});

});

process.on('uncaughtException', function (err) {
	var estr = 'Exception: ' + err;
	console.log(estr);
});

/*
 ************* Everything below this are functions **********************************
 */

function removeSocket(id, evname) {
	console.log("Socket "+evname+" at "+ new Date().toString());
}

function reportError(name, message) {
	console.log(name+": "+message);
}

function debugLog(name, dataobj) {
	console.log(name+": ");
	for(key in dataobj)
	{
		if(dataobj.hasOwnProperty(key))
			console.log(key +":"+dataobj[key]);
	}
}

function genericCallback(socket,data) {
	try {
        JSON.parse(data);
		socket.emit('goodResponse',data);
    } catch (e) {
		if(data.indexOf("Authorization Error") > 1)		// this means str contains auth error
			socket.emit('errorResponse',"Authorization Error");
		else {
		console.log(data);
		socket.emit('errorResponse',e.message);
		}
    }
}

function dummyCallback(data,param) {
	console.log(data);
}

/* function sendToAzureStorage(data) {
	var qdata = "<QueueMessage><MessageText>"+ data +"</MessageText></QueueMessage>";
	const key1 = 'SharedKey sentinel23:btSm7KF/fko5bR6KtRU20eMDe9ghqvQqwT6wwPeRkJpZC6HTf1SeqFtA+4ALfFvM0qGf5CDZJZqSmZBVkZAirg==';
	const azure_url = 'https://sentinel23.queue.core.windows.net/outqueue/messages';
	const myaccount = '/sentinel23';
	const mycontainer = '/outqueue/messages';
	const xdate = new Date().toUTCString();
	const strtosign = 'POST\n\napplication/xml\n'+xdate+'\n'+myaccount+mycontainer;
	console.log("Str to sign: "+strtosign);
	const signedhmac = crypto.createHmac('sha256', strtosign).update("utf-8").digest("base64");
	const signedhmac2 = crypto.createHmac('sha256', strtosign).digest("base64");
	console.log("HMAC: "+signedhmac);
	console.log("HMAC2: "+signedhmac2);
	const signedauth = "SharedKeyLite sentinel23:"+signedhmac2;
	const httpheaders = {
		'Content-Type':'application/xml',
		'Date':xdate,
	//	'x-ms-version':'2015-02-21',
		'Authorization':signedauth
		};
	fetch(azure_url, {method: 'POST',body: qdata, headers: httpheaders})
	.then(res => res.text())
	.then(text => {
		console.log("Time3");
		console.log(text);
	});
} */

function doPolling() {

	if(CID == "" || PHASH == "" || !PollInterval)
		return(console.log("No API credentials"));

	var currenttime = new Date().toISOString().substring(0,19).replace("T", " ");
	var earlier = new Date().getTime() - PollInterval*1000;
	var newtime = new Date(earlier).toISOString().substring(0,19).replace("T", " ");

	apireq = new Object();
	apireq["cid"] = CID;
	apireq["provhash"] = PHASH;
	apireq["cmd"] = 'reporting';
	apireq["data"] = {"from": newtime,"to": currenttime};
//	console.log("API Request: "+JSON.stringify(apireq));

	fetch(LP_url, {method: 'POST',body: JSON.stringify(apireq), headers: {'Content-Type':'application/json'}})
	.then(res => res.text())	// LP API returns a JSON message
	.then(jmsg => {
		LastMessage = JSON.parse(jmsg);		// save a copy for front end request
		QueueService.createMessage('outqueue', jmsg, function(error) {
			if (!error) {
				console.log("Message inserted");
			}
		});
	});
	Timer = setTimeout(doPolling,PollInterval*1000);	// kick off next API poll
}

