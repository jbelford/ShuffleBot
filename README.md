# **Discord Music Bot**
A bot for playing music in voice channels on Discord. 

![alt-text](https://github.com/jbelford/DiscordMusicBot/raw/master/img/newExample.gif "Example image")

## General Features
* Play queued songs in voice channels
* Songs can be requested via SoundCloud or YouTube URL's 
* Playlists can be added to the queue (SoundCloud & YouTube)
* Can download SoundCloud users' favorites & add to queue on the fly
* **NEW** - Emoji reactions used as buttons to control player (One of the first of its kind!)

## Music Queue Features
* Songs can be added via URLs from SoundCloud or YouTube (ex: ```$queue add https://www.youtube.com/watch?v=HEXWRTEbj1I```). If URL is a playlist then all songs will be added to the queue
* Songs can also be added by entering search terms (ex: ```$queue add what is love```)
* Songs can also be enqueued from saved SoundCloud favorites (ex: ```$queue add jack-belford-1 [ALL]```)
* Queue requests can be followed up with optional flags such as ```--shuffle``` and ```--next``` the former shuffles the list before adding to the queue and the latter tells the bot to add to the top of the queue.
* Multiple requests can also be strung together to quickly get the bot queued up! (ex: ```$queue add https://www.youtube.com/watch?v=HEXWRTEbj1I jack-belford-1 [0,200] --shuffle --next```)

## Store your SoundCloud favorites and queue them up whenever!

![alt-text](https://github.com/jbelford/DiscordMusicBot/raw/master/img/downloadExample.gif "Example download")

## Requirements
* MongoDB
* YouTube API Key
* SoundCloud API Key
* Discord API Key

## Setup

1) In `/config` create two files: `misc.json` and `channels.json`
2) Copy the contents of `miscTemplate.json` to `misc.json` & similarly for `channels.json`
3) `channels.json` contains the ID's and names of channels you wish the bot to listen on. To get the ID of a channel right-click it and select `Copy ID`. Add as many as you like.
4) In `misc.json` the field `admins` is an array of ID's for users who you wish to permit access to admin commands.
5) `dbUrl` is the link to your MongoDB server you wish the bot to use. This is where SoundCloud favorites will be stored. If you're locally hosting then it should be something like `mongodb://localhost:27017/DB_NAME` on Windows.
6) In `tokens` you need to provide a bot token in the field `discord`. You must also provide a client ID for your SoundCloud app in `CLIENT_ID`. The same for the key for `youtube`. 
7) Once these fields are filled with valid items the bot should be ready to go.

#### Mongo Setup
Follow the instructions found here: https://docs.mongodb.com/manual/administration/install-community/

For Windows I recommend taking the extra steps to setup Mongo as a service. Otherwise you'll have to start up a command prompt and start up Mongo everytime you want to run the bot. 

#### Discord, SoundCloud, and YouTube
* [Discord](https://discordapp.com/developers/applications/me)
* [SoundCloud](https://docs.google.com/forms/d/e/1FAIpQLSfNxc82RJuzC0DnISat7n4H-G7IsPQIdaMpe202iiHZEoso9w/viewform)
* [YouTube](https://developers.google.com/youtube/v3/getting-started)
