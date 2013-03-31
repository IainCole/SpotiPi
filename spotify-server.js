var cp = require('child_process');

module.exports = function(user, config) {
	// We're creating the audio player in another process, I found on the pi that this helped a lot with the sound stability when other things are going on (e.g. http requests)
	var spotifyPlayer = cp.fork(__dirname + '/player.js'); // Thankfully node makes this really easy by providing fork which sets up an easy way of communicating between the processes.

	// I still need to handle what happens if the child process dies, it should be pretty easy to just start it again from the parent process and carry on where we left off.

	var sessions = {};
	var socketio = config.socketio;
	var playlists = [];	
	var playlistsClient = [];
	
	var shufflePlaylistTracks = [];
	var currentShufflePlaylistUrl = null;
	var currentShufflePlaylistIndex = -1;
	
	var clientQueue = [];
	var currentTrack = null;
	var previousTracks = [];
	
	var serverStarted = false;
	
	// Handle messages from the audio player process
	spotifyPlayer.on('message', function(msg) {
		switch (msg.cmd) {
			case 'initComplete':
				onInit(msg.data);
				break;
			case 'loginComplete':
				onLogin(msg.data);
				break;
			case 'searchComplete':
				onSearchComplete(msg.data)				  
				break;
			case 'playlistContainerLoaded':
				onPlaylistContainerLoaded(msg.data);
				break;
			case 'playlistTracksLoaded':
				onPlaylistTracksLoaded(msg.data);
				break;
			case 'trackEnd':
				onTrackEnd();
				break;
		}
	});

	// Once the player has been set up, we log in
	var onInit = function() {
		console.log('Sending login message');
		spotifyPlayer.send({
			cmd: 'login',
			data: { user: user }
		});
	};

	var onLogin = function() {
		console.log('Getting shuffleplaylist tracks');


	};
	
	// For now we're still using libspotify to search, I might look at the possibility of using the Web API for this 
	var onSearchComplete = function(data) {
		console.log('Sending play message');
		var track = data.tracks[0];
		console.log('Sending play message with track url ' + track.__spotifyUrl);

		spotifyPlayer.send({
			cmd: 'play',
			data: {
				trackUrl: track.__spotifyUrl
			}
		});
	};
	
	var socketsInitialised = false;
	
	var onPlaylistContainerLoaded = function(data) {
		// The loading of the playlistcontainer is essentially the start of the application.
		// The server will pick the first playlist to be the one that gets randomised if no tracks are queued
		playlists = data.playlists;
		playlistsClient = new Array(playlists.length);
		
		// We're going to maintain a list of playlists consisting of just name / url that we can send to the clientside
		for (var i = 0; i < playlists.length; i++) {
			playlistsClient[i] = {
				name: playlists[i].name,
				url: playlists[i]._sp_url
			};
		}
		
		if (playlists.length > 0 && currentShufflePlaylistUrl != playlists[0]._sp_url) {
			currentShufflePlaylistUrl = playlists[0]._sp_url;
			
			// We need to go and get the list of tracks for the shuffle playlist url, the shuffle playlist is the first playlist in the playlist container
			// this means that you can have a different shuffle playlist just by moving things around
			spotifyPlayer.send({
				cmd: 'getPlaylistTracks',
				data: {
					url: currentShufflePlaylistUrl
				}
			});
		}
		
		if (!socketsInitialised) {			
			// This will be where the interaction with the front end happens
			socketio.sockets.on('connection', function(socket) {
				console.log('socket connected');
				sessions[socket.id] = { socket: socket };
				
				getFirstConnectData(function(data) {
					socket.emit('firstConnect', data);
				});
				
				socket.on('cmd', function(data) {
					handleSocketCommand(sessions[socket.id], data);
				});
				
				socket.on('disconnect', function () {
					console.log('deleting session: ' + socket.id);
					delete sessions[socket.id];
				});
			});
			
			socketsInitialised = true;
		}
	};
	
	var onTrackEnd = function() {
		// Move the current track into the previous tracks object
		if (currentTrack != null) {
			previousTracks.push(currentTrack);			
		}
	
		if (clientQueue.length > 0) { // We have some queued up tracks so we should play them			
			// Take the first item in the queue and put it in the current track object
			currentTrack = clientQueue.splice(0, 1);
		} else {
			if (currentShufflePlaylistIndex + 1 >= shufflePlaylistTracks.length) {
				// We've reached the end so we should re-shuffle and start again
				fisherYates(shufflePlaylistTracks);
				currentShufflePlaylistIndex = -1;
			}
			// Increment the shuffle track index and set that track as the current track
			currentTrack = shufflePlaylistTracks[++currentShufflePlaylistIndex]
		}
		
		spotifyPlayer.send({
			cmd: 'play',
			data: {
				trackUrl: currentTrack._sp_url
			}
		});
	};
	
	var onPlaylistTracksLoaded = function(data) {
		if (data.session === undefined) { 
			// We've been called by the server rather than from the client which means that we should be loading these tracks into the main shuffle playlist object
			shufflePlaylistTracks = data.tracks;

			// Shuffle the tracks and set the index to -1			
			fisherYates(shufflePlaylistTracks);
			currentShufflePlaylistIndex = -1;
			
			// if the server hasn't yet been started (i.e. playing some music) then we should randomise and start playing, otherwise it will just get picked up by the trackEnd loop
			if (!serverStarted) {
				onTrackEnd();
			}
		} else {
			emitSessionMessage(data.session, 'playlistTracksLoaded', data.tracks);
		}
	};
	
	var emitSessionMessage = function(session, message, data) {
		if (sessions.hasOwnProperty(session.socket.id)) {
			sessions[session.socket.id].socket.emit(message, data);
		}
	};
	
	var handleSocketCommand = function (session, cmd) {
		console.log(session.socket.id);
		console.log(cmd);
	};
	
	var getFirstConnectData = function(callback) {
		callback({
			playlists: playlistsClient
		}); 
	};
	
	var fisherYates = function fisherYates(arr) {
		var i = arr.length;
		if (i === 0) {
			return false;
		}
		
		while (--i) {
			var j = Math.floor(Math.random() * (i + 1));
			var tempi = arr[i];
			var tempj = arr[j];
			arr[i] = tempj;
			arr[j] = tempi;
		}
	}
	
	// Send the init command to the audio player process
	spotifyPlayer.send({ cmd: 'init', data: { config: config.audio, appkey: config.appkey } });
};
