# **ShuffleBot**
A focused bot for playing music in voice channels on Discord.

![Spotify Player](https://github.com/jbelford/ShuffleBot/tree/master/src/public/img/SpotifyPlayer.PNG)

### [Invite ShuffleBot to your server](https://discordapp.com/oauth2/authorize?client_id=270697360714235904&permissions=70745152&scope=bot)

## General Features
* **NEW** Import Spotify playlists!
* Instantly queue up songs / playlists from SoundCloud or Youtube!
* Make your own playlists and be able to use them wherever ShuffleBot is!
* Sync your SoundCloud favorites and queue them up in any order you like!
* Player reactive to changes and controlled by emojis

## Music Queue Features
* Spotify user? Import any playlist easily: ```$pl.import retro https://open.spotify.com/user/spotify/playlist/37i9dQZF1DXdLEN7aqioXM```
* Then go ahead and queue it up shuffled using your custom identifier! ```$q.add pl.retro --shuffle```
* Songs can be added via URLs from SoundCloud or YouTube (ex: ```$q.add https://www.youtube.com/watch?v=HEXWRTEbj1I```). If URL is a playlist then all songs will be added to the queue
* Songs can also be added by entering search terms (ex: ```$q.add what is love```)
* Songs can also be enqueued from saved SoundCloud favorites (ex: ```$q.add jack-belford-1 [ALL]```)
* Queue up the playlists you or people on your server have created! ```$q.add pl.edm --shuffle```
* Queue requests can be followed up with optional flags such as ```--shuffle``` and ```--next``` the former shuffles the list before adding to the queue and the latter tells the bot to add to the top of the queue.
* Multiple requests can also be strung together to quickly get the bot queued up! (ex: ```$q.add https://www.youtube.com/watch?v=HEXWRTEbj1I jack-belford-1 [0,200] --shuffle --next```)
