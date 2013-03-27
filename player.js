var sp = require('node-libspotify');
var Speaker = require('speaker');

// Because we're running in our own process we need to handle messages from the parent process like this
process.on('message', function(msg) {
    switch (msg.cmd) {
        case 'init':
            init(msg.data);
            break;
        case 'login':
            if (initialised) {
                login(msg.data);
            }
            break;
        case 'play':
                play(msg.data);
            break;
        case 'pause':
                pause(msg.data);
            break;
        case 'search':
            if (initialised) {
                search(msg.data);
            }
            break;
    };
});


var player, spk, session, initialised = false, self = this;

var pause = function(data) {
    player.stop();
};

var play = function(data) {
    if (data.hasOwnProperty('trackUrl')) {
        var track = sp.Track.getFromUrl(data.trackUrl);
        
        console.log('Playing track [' + track.name + ' : ' + track.artist.name + ']');

        player.load(track);
    }
    player.play();
};

var login = function (data) {
    session.once('login', function(err) {
        if (err) {
            process.send({ cmd: 'error', data: err });
            return;
        }
        player = session.getPlayer();
        player.pipe(spk);
        process.send({ cmd: 'loginComplete', data: data });
    }); 

    session.login(data.user.username, data.user.password);
};

var search = function (data) {
    var s = new sp.Search(data.searchString);
    s.trackCount = data.trackCount;

    s.execute();

    s.once('ready', function () {
        // We're going to add the spotify URL into the track object here because we're passing it to another process so we won't be able to call getUrl there
        // The URL is all we really need to identify the track
        for (var i = 0; i < s.tracks.length; i++) {
            s.tracks[i].__spotifyUrl = s.tracks[i].getUrl();
        }

        data.tracks = s.tracks;
        process.send({ cmd: 'searchComplete', data: data });
    });

    // TODO we should add all the other search options in here too
};

var init = function (data) {
    var appkey = data.appkey;
    var config = data.config;

    spk = new Speaker({
        channels: config.channels || 2,
        bitDepth: config.bitDepth || 16,
        sampleRate: config.sampleRate || 44100
    });

    session = new sp.Session({
        applicationKey: appkey
    });

    initialised = true;

    process.send({ cmd: 'initComplete', data: data });
};
