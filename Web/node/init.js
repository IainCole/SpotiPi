var http = require('http');
var fs = require('fs');
var io = require('socket.io');
var url = require('url');

var config, lang;

// Get the configuration for the application
console.log('Loading Configuration');
try 
{
	config = JSON.parse(fs.readFileSync('./config.json'));
}
catch (err) {
	console.log('There was an error reading the server configuration file [' + err + ']');
	process.exit(1);
}
console.log('Configuration Loaded');

// Get the language file (hard coded to en-gb for now, will fall back on stuff at a later date
console.log('Loading Language Pack');
try 
{
	lang = JSON.parse(fs.readFileSync('./lang/en-gb.json'));
}
catch (err) {
	console.log('There was an error reading the language file [' + err + ']');
	process.exit(1);
}
console.log('Language Pack Loaded');

// Set Up HTTP Server
var app = http.createServer(function (req, res) {
	var fileName = './html/index.html';
	var contentType = 'text/html';

	// We could build something that goes and serves files that are requested but this is basically everything, so what's the point
	switch (url.parse(req.url).pathname) {
		case '/SpotiPi.js':
			fileName = './html/js/SpotiPi.js';
			contentType = 'application/javascript';
		break;
		case '/jquery.js':
			fileName = './html/js/jquery.js';
			contentType = 'application/javascript';
		break;
		case '/SpotiPi.css':
			fileName = './html/css/SpotiPi.css';
			contentType = 'text/css';
		break;
	}

	fs.readFile(fileName, function (err, data) {
		if (err) {
			res.writeHead(404, { 'Content-Type': 'text/plain' });
			res.end(lang.FileNotFound);
		} else {
			res.writeHead(200, { 'Content-Type': contentType });
			res.end(data);
		}
	});
}).listen(config.Port);

console.log('Server listening on port ' + config.Port);

// Set up Websockets listener
console.log('Setting up WebSockets listener');

var socket = io.listen(app);

socket.sockets.on('connection', function (socket) {
	socket.emit('firstConnect', { hello: 'world' });
	socket.on('clientData', function (data) {
		console.log(data);
	});
});

console.log('WebSockets set up! We are go!');

