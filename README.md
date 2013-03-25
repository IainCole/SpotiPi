SpotiPi
=======

Web based Spotify server for Raspberry Pi

A while ago I had the idea of having a communal music system for the office.

Everyone has different tastes in music and having something everybody can listen to is always a problem.

So as part of a R&D excercise I worked on building a server that would play a queue of music that could be controlled via a web interface. 

Using libspotify I managed to throw together an application in C#.NET that allowed people to queue up their chosen tracks and they would play in sequence on the server, shortly after I built a veto system that allowed people to vote to skip a track, enough votes? track gets skipped!

It's still in use to this day but I've always wanted to re-write it from scratch as it was thrown together in very little time and has memory leaks all over the shop and has to be restarted daily.

Then I had the idea of building it for Raspberry Pi, as libspotify has recently become available for armhf. It's still in beta but seems to work fine so far.

Combining libspotify and node.js (anyone who works with me will tell you how much of a JS nerd I am) I'm hoping to rewrite the application for RasPi.

The idea of having a simple communal music server appeals to me and it could in future also be extended to be a touchscreen jukebox style device for use in the home as well as linking to mobile apps.

I don't get much time to work on it so we'll have to see how long it takes!
