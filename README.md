# **Discord Music Bot**
A bot for playing music in voice channels on Discord. 

![alt-text](https://github.com/jbelford/DiscordMusicBot/raw/master/src/public/img/mainExample.gif "Example image")

## General Features
* Play queued songs in voice channels
* Songs can be requested via queries as well as SoundCloud or YouTube URL's 
* Playlists can be added to the queue (SoundCloud & YouTube)
* Can download SoundCloud users' favorites & add to queue on the fly
* **NEW** - Emoji reactions used as buttons to control player

## Music Queue Features
* Songs can be added via URLs from SoundCloud or YouTube (ex: ```$add https://www.youtube.com/watch?v=HEXWRTEbj1I```). If URL is a playlist then all songs will be added to the queue
* Songs can also be added by entering search terms (ex: ```$add what is love```)
* Songs can also be enqueued from saved SoundCloud favorites (ex: ```$add jack-belford-1 [ALL]```)
* Queue requests can be followed up with optional flags such as ```--shuffle``` and ```--next``` the former shuffles the list before adding to the queue and the latter tells the bot to add to the top of the queue.
* Multiple requests can also be strung together to quickly get the bot queued up! (ex: ```$add https://www.youtube.com/watch?v=HEXWRTEbj1I jack-belford-1 [0,200] --shuffle --next```)

## Store your SoundCloud favorites and queue them up whenever!

![alt-text](https://github.com/jbelford/DiscordMusicBot/raw/master/src/public/img/dlExample.gif "Example download")
