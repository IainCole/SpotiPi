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
	        if (initialised) {
                play(msg.data);
            }
            break;
        case 'pause':
        	if (initialised) {
				pause(msg.data);
    		}
            break;
        case 'getPlaylistTracks':
        	if (initialised) {
				getPlaylistTracks(msg.data);
    		}
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

var track_ended = false;

var play = function(data) {
    if (data.hasOwnProperty('trackUrl')) {
        var track = sp.Track.getFromUrl(data.trackUrl);
        
        console.log('Playing track [' + track.name + ' : ' + track.artist.name + ']');

        player.load(track);
    }
    player.play();
    track_ended = false;
};

var login = function (data) {
    session.once('login', function(err) {
        if (err) {
            process.send({ cmd: 'error', data: err });
            return;
        }
        player = session.getPlayer();
        
        // Need to get a handle on all the audio buffer shiz, it's not doing what I would expect it to, I think libspotify is sending data faster than it is being consumed in node
        // Node is handling the backlog but it's causing issues with events like track_ended which is sent once libspotify has delivered all the samples for the track
        // This happens way before the track actually ends, also I player.stop() actually just stops the music delivery from libspotify, so if libspotify has sent the entire track already
        // calling stop doesn't actually do anything because node is still clearing the backlog of audio data that it's been sent, libspotify has built in controls for handling buffers being full
        // but I have no idea how to expose this between node and the libspotify-node addon
        
        player.on('track-end', function () {
			track_ended = true;
	        player.stop();
        });
        
        spk.on('drain', function() {
        	if (track_ended) {
	        	process.send({ cmd: 'trackEnd', data: {} });
        	}
        });
        
        player.pipe(spk);
        
        var plc = session.getPlaylistcontainer();
		
		plc.once('ready', function() {
			onPlaylistContainerLoaded(plc);
		});
        
        process.send({ cmd: 'loginComplete', data: data });
    }); 

    session.login(data.user.username, data.user.password);
};

var onPlaylistContainerLoaded = function (plc) {
	// We could send the loaded event to the spotify server but in reality all we are going to do is get the list of playlists anyway, so lets just do it internally and tell the server when the list of playlists is available / changes
	var onPlaylistChange = function() {
		plc.getPlaylists(function(playlists) {
			// We're going to iterate over the playlists and call getUrl as that's what's going to be used to identify the playlists
			for (var i = 0; i < playlists.length; i++) {
				playlists[i].getUrl();
			}
		
			process.send({ cmd: 'playlistContainerLoaded', data: { playlists: playlists } });		
			
			// We should probably handle the loading and unloading of playlists better than just reloading the listing the whole time
			plc.on('playlist_added', onPlaylistChange);
			plc.on('playlist_removed', onPlaylistChange);
			plc.on('playlist_moved', onPlaylistChange);
		});
	};

	onPlaylistChange();
};

var getPlaylistTracks = function (data) {
	var playlist = sp.Playlist.getFromUrl(data.url);
	playlist.getTracks(function(tracks) {
		for (var i = 0; i < tracks.length; i++) {
			tracks[i].getUrl();
		}
		
		data.tracks = tracks;
		
		process.send({ cmd: 'playlistTracksLoaded', data: data });		
	});
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

	session.on('play_token_lost', function(){ 
		if (player !== undefined) {
			player.stop();
		}
	});

    initialised = true;

    process.send({ cmd: 'initComplete', data: data });
};
