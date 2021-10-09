var socket = io.connect();
const version = "LPS v1.0";

$(document).ready(function() {
	$('#version').text(version);
	$('#cform').hide();
	$('#hc').hide();
	readCredsFromCookies();
	// used for testing look and feel
	// var jobj = '{"username":"testuser@test.com","fullname":"test user","password":"validationpwd","attribs": {"department":"Finance"}}';
	// $("#message1").html("<pre>"+JSON.stringify(JSON.parse(jobj),null,2)+"</pre>");
	socket.emit("checkPollRequest",'');
});

function toggle() {
	$('#cform').toggle();
	$('#hc').toggle();
	$('#sc').toggle();
}

function csave() {
	var cid = $('#cid').val();
	var phash = $('#phash').val();
	saveCookie("cid",cid,99);
	saveCookie("phash",phash,99);
	console.log("Saved: "+cid+", "+phash);
}

function cclear() {
	delCookie("cid",cid);
	delCookie("phash",phash);
	readCredsFromCookies();
}

function readCredsFromCookies() {
	var cid = readCookie("cid");
	var phash = readCookie("phash");
	$('#cid').val(cid);
	$('#phash').val(phash);
}

function submit() {
	var cid = $('#cid').val();
	var phash = $('#phash').val();
	if(cid == "" || phash == "")
		return(alert("Please enter the CID and Provisioning Hash"));
	var pollreq = new Object();
	pollreq["cid"] = cid;
	pollreq["phash"] = phash;
	pollreq["pollinterval"] = $('#poll').val();
	socket.emit("sendPollRequest",pollreq);
	socket.emit("checkPollRequest",'');
}

function stop_polling() {
	socket.emit("stopPollRequest",'');
	socket.emit("checkPollRequest",'');
}

// Check the LP API by send a request using the credentials
function test_connection() {
	var cid = $('#cid').val();
	var phash = $('#phash').val();
	if(cid == "" || phash == "")
		return(alert("Please enter the CID and Provisioning Hash"));
	var req = new Object();
	req["cid"] = cid;
	req["phash"] = phash;
	socket.emit("testConnectionRequest",req);
}

// Show the last event message sent to Azure storage
function show_message() {
	socket.emit("showLastMsgRequest",'');
}

socket.on('errorResponse', function(data){
	$("#error").text(data);
});

socket.on('goodResponse', function(data){
	$("#message1").html("<pre>"+JSON.stringify(JSON.parse(data),null,2)+"</pre>");
});	

socket.on('checkPollResponse', function(data){
	var str = "Status: "+data.status+" with Polling Rate: "+data.pollinterval+" seconds";
	$("#status").html(str);
});

socket.on('showLastMsgResponse', function(data){
	$("#message1").html("<pre>"+JSON.stringify(data,null,2)+"</pre>");
});	

function readCookie(name)
{
  name += '=';
  var parts = document.cookie.split(/;\s*/);
  for (var i = 0; i < parts.length; i++)
  {
    var part = parts[i];
    if (part.indexOf(name) == 0)
      return part.substring(name.length);
  }
  return null;
}

/*
 * Saves a cookie for delay time. If delay is blank then no expiry.
 * If delay is less than 100 then assumes it is days
 * otherwise assume it is in seconds
 */
function saveCookie(name, value, delay)
{
  var date, expires;
  if(delay)
  {
	  if(delay < 100)	// in days
		  delay = delay*24*60*60*1000;	// convert days to milliseconds
	  else
		  delay = delay*1000;	// seconds to milliseconds

	  date = new Date();
	  date.setTime(date.getTime()+delay);	// delay must be in seconds
	  expires = "; expires=" + date.toGMTString();		// convert unix date to string
  }
  else
	  expires = "";

  document.cookie = name+"="+value+expires+"; path=/";
}

/*
 * Delete cookie by setting expiry to 1st Jan 1970
 */
function delCookie(name) {
    document.cookie = name + "=; expires=Thu, 01-Jan-70 00:00:01 GMT; path=/";
}

