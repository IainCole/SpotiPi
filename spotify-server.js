var cp = require('child_process');

module.exports = function(user, config) {
    // We're creating the audio player in another process, I found on the pi that this helped a lot with the sound stability when other things are going on (e.g. http requests)
    var spotifyPlayer = cp.fork(__dirname + '/player.js'); // Thankfully node makes this really easy by providing fork which sets up an easy way of communicating between the processes.

    // I still need to handle what happens if the child process dies, it should be pretty easy to just start it again from the parent process and carry on where we left off.

    var sessions = [];
    var socketio = config.socketio;

    // This will be where the interaction with the front end happens
    socketio.sockets.on('connection', function(socket) {
        socket.emit('firstConnect', { hello: 'world' });
        socket.on('clientData', function(data) {
            console.log(data);
        });
    });

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
        console.log('Sending search message');

        // This is temporary while there's no front end to send messages
        spotifyPlayer.send({
            cmd: 'search',
            data: {
                searchString: 'artist:"rick astley" track:"never gonna give you up"',
                trackCount: 1
            }
        });
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

    // Send the init command to the audio player process
    spotifyPlayer.send({ cmd: 'init', data: { config: config.audio, appkey: config.appkey } });
};
