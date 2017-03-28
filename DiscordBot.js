"use strict"

const _           = require('lodash');
const fs          = require('fs');
const nodeCleanup = require('node-cleanup');
const wrap        = require('co-express');
const request     = require('co-request');
const QueuePlayer = require('./libs/QueuePlayer');
const querystring = require('querystring');
let db            = require('mongodb').MongoClient;

const Discord = require('discord.js');
const client  = new Discord.Client();

const config = JSON.parse(fs.readFileSync('./config/misc.json', 'utf8'));
const token  = config.tokens.discord;
const SC     = config.tokens.soundcloud;
const YT     = config.tokens.youtube;
const cmdTok = '$';

const validChans = JSON.parse(fs.readFileSync('./config/channels.json', 'utf8'));
const commands   = JSON.parse(fs.readFileSync('./config/commands.json', 'utf8'));
const admins     = config.admins;
let player;

// Listens for response from Discord
client.on('ready', wrap( function* () {
  try {
    db = yield db.connect(config.dbUrl);
    player = new QueuePlayer(client, SC, YT);
    console.log('Bot is ready!');
    if (client.guilds.size === 0 || process.argv.indexOf('-gi') >= 0) {
      const link = yield client.generateInvite(config.botPerms);
      console.log(`Bot invite link: ${link}`);
    }
  } catch (err) {
    console.log('Failed to connect to MongoDB server. Closing program.');
    process.exit(0);
  }
}));

// Listens for message from a channel
client.on('message', wrap( function* (message) {
  try {
    if (_.isNil(validChans[message.channel.id]) || message.author.bot) return;
    const content = message.content.trim().split(/\s+/g);
    if (content[0].charAt(0) !== cmdTok) return;
    const cmd = content[0].substr(1);
    if (_.isNil(commands[cmd])) {
      return message.reply(`Command not recognized! Use ${cmdTok}help to see list of commands.`);
    }
    console.log(`Processing command: ${cmd}`);
    let resp;
    if (commands[cmd].obj === "queue") resp = yield player[commands[cmd].func](message, content);
    else resp = yield eval(commands[cmd].func)(message, content);
    if (resp) message.reply(resp);
  } catch (e) {
    message.reply(`I failed to do that request: ${e}`);
    console.log(e.stack);
    _.forEach(admins, id => {
      client.users.get(id).sendCode(`Error caught:\n${e.stack}`);
    });
  }
}));

client.login(token);

// Returns a message that displays the list of commands
const help = function* (message) {
  let string = "Command List: <> = Argument, {} = Optional, () = Group, | = Or, & = And, &| = And/Or, + = One or many of these\n";
  string    += "--------------------------------------------------------------------------------------------------------------\n";
  _.forEach(commands, (cmd, key) => {
    string += `${cmdTok}${key}${cmd.detail.join('')}\n\n`;
  });
  message.channel.sendCode('css', string, { split : { prepend : '```css\n', append : '```' } });
  setTimeout( () => {
    message.channel.send('For more info check out github: **https://github.com/jbelford/DiscordMusicBot**');
  }, 1000);
  return false;
}

// Downloads/overwrites user information and then get's their list of favorited tracks
const download = function* (message, content) {
  if (content.length < 2) return 'Missing parameters: <user>';
  const user = content[1];
  const resp = yield request(`${SC.API}/resolve?url=http://soundcloud.com/${user}&client_id=${SC.CLIENT_ID}`);
  if (resp.statusCode !== 200) return "Failed to find that user's info!";
  const userDB = yield db.collection('users').findOneAndDelete({ permalink : user });
  if (!_.isNil(userDB.value)) {
    yield message.channel.send('Removed previous user info...');
  }
  const user_info = JSON.parse(resp.body);
  const newUser = {
    "permalink": user_info.permalink,
    "username" : user_info.username,
    "fullname" : user_info.full_name,
    "id"       : user_info.id,
    "favorites": user_info.public_favorites_count,
    "list"     : []
  }
  yield message.reply(`Discovered profile of ${user_info.full_name}`);
  return yield getFavorites(newUser, message, false);
}

// Updates a user's list of tracks
const update = function* (message, content) {
  if (content.length < 2) return 'Missing parameters: <user>';
  const user = yield db.collection('users').findOne({ permalink : content[1] });
  if (_.isNil(user)) return `That user doesn't exist! Use \`${cmdTok}download\` instead.`;
  const resp = yield request(`${SC.API}/users/${user.id}/?client_id=${SC.CLIENT_ID}`);
  if (resp.statusCode !== 200) return `Error: ${resp.statusCode}`;
  const newFavs = JSON.parse(resp.body).public_favorites_count - user.favorites;
  if (newFavs <= 0) return "It doesn't appear that you have new favorites!\nIf you want to download anyway use `$download` instead.";
  user.favorites += newFavs;
  yield message.reply(`There appears to be ${newFavs} new songs.\nProceeding to update profile: ${user.username}`);
  return yield getFavorites(user, message, newFavs);
}

// This collects the list of favorites from a user on Soundcloud
const getFavorites = function* (user, message, newFavs) {
  let next_href  = `${SC.API}/users/${user.id}/favorites?limit=200&linked_partitioning=1&client_id=${SC.CLIENT_ID}`;
  const progress = yield message.channel.send(`Downloading favorites: 0%`);
  const total    = user.favorites;
  let flag       = true;
  let temp       = [];
  while (next_href && flag) {
    const resp = yield request(next_href);
    if (resp.statusCode !== 200) return `Error: ${resp.statusCode}`;
    const data = JSON.parse(resp.body);
    const favs = data.collection.filter( data => data.kind === 'track' && data.streamable).map((data, idx) => {
      const artwork = _.isNil(data.artwork_url) ? 'http://beatmakerleague.com/images/No_Album_Art.png' :
          data.artwork_url.replace("large", "t500x500");
      return {
        "title"      : data.title,
        "url"        : data.permalink_url,
        "stream_url" : data.stream_url,
        "poster"     : data.user.username,
        "pic"        : artwork,
        "src"        : "sc"
      };
    });
    if (newFavs) {
      if (newFavs > favs.length) {
        newFavs -= favs.length;
        temp = temp.concat(favs);
      } else {
        flag = false;
        temp = temp.concat(favs.slice(0, newFavs));
        user.list = temp.concat(user.list);
      }
    } else user.list = user.list.concat(favs);
    const complete = Math.round(((newFavs ? temp.length : user.list.length) / total) * 100);
    yield progress.edit(`Downloading favorites: ${complete}%`);
    next_href = _.isNil(data.next_href) ? false : data.next_href;
  }
  if (newFavs) yield db.collection('users').updateOne({ permalink : user.permalink }, { $set : user });
  else yield db.collection('users').insertOne(user);
  yield progress.edit('Downloading favorites: 100%');
  return `Finished ${newFavs ? "updating" : "downloading"} music list for the profile: ${user.username}\n` +
    `${total - user.list.length} songs were skipped because they either are playlists or were removed.`;
}

// Lists the users in the database
const list = function* (message, content) {
  let userList = "Users in database:\n"
  let i = 1;
  const users = yield db.collection('users').find().toArray();
  _.forEach(users, (user) => {
    userList += `${i++}: ${user.username} ~ Permalink: ${user.permalink} ~ Songs: ${user.list.length}\n`;
  })
  message.channel.sendCode('', userList, { split : { prepend : '```\n', append : '```' } });
  return false;
}

// This function gets called when the queue command is received
const editQueue = function* (message, content) {
  if (content.length === 1) return yield player.show(10, message);
  const parsed = parse(content.slice(2));
  if (content[1] !== 'add') return `Invalid syntax for ${cmdTok}queue. Check ${cmdTok}help.`;
  else if (parsed.user.length + parsed.yt.length === 0 && _.isNil(parsed.sc)) return yield searchYT(content.slice(2), parsed.next);
  let collected = [];
  for (const x in parsed.user)
    collected = collected.concat(yield getUserList(parsed.user[x], message));
  collected = collected.concat(yield getYTList(parsed.yt, message));
  collected = collected.concat(yield getSCList(parsed.sc, message));
  if (collected.length === 0) return 'Ultimately... there was nothing to add';
  if (parsed.shuffle) collected = yield player.shuffle(null, null, collected);
  player.enqueue(collected, parsed.next);
  return `Successfully added songs to the queue!`
}

// Parses the arguments for updating the queue
function parse(args) {
  const data = { user : [], yt : [], sc : null, shuffle: false, next: false };
  args = args.join(' ');
  const reg1  = /(^|\s)([^\s]+)\s+\[\s*(-?\d+|-?\d+\s*,\s*-?\d+|-\d+|ALL)\s*\]/gi
  const reg2  = /(^|\s)--shuffle($|\s)/gi
  const reg3  = /(^|\s)--next($|\s)/gi
  const regYT = /(^|\s)(https?:\/\/)?(www\.)?youtube\.com\/(watch|playlist)\?(v|list)=([^\s&]+)[^\s]*($|\s)/g
  const regSC = /(^|\s)(https?:\/\/)?(www\.)?soundcloud\.com(\/[^\s]+)($|\s)/g
  let match;
  for (let i = 0; (match = reg1.exec(args)) !== null; i++) {
    data.user[i] = match.slice(2, 4);
  }
  if ((match = regYT.exec(args)) !== null) data.yt = match.splice(5, 2).concat([match[0]]);
  if ((match = regSC.exec(args)) !== null) data.sc = match[4];
  if (reg2.exec(args) != null) data.shuffle = true;
  if (reg3.exec(args) != null) data.next = true;
  return data;
}

// Gets the list for a user in the database: value => ['username','0,100']
function* getUserList(value, message) {
  const user = yield db.collection('users').findOne({ permalink : value[0] });
  if (_.isNil(user)) {
    message.channel.send(`The user ${value[0]} isn't recognized.`);
    return [];
  }
  message.channel.send(`Adding ${user.permalink}'s tracks... Done`);
  if (value[1].toLowerCase() === "all") return user.list;
  const range = value[1].split(',').map( x => parseInt(x) );
  if (range.length > 1) return user.list.slice(range[0], range[1]);
  const list = range[0] < 0 ? user.list.slice(range[0]) : user.list.slice(0, range[0]);
  return list;
}

// Returns a list of songs given the youtube url ID
function* getYTList(ytData, message) {
  if (ytData.length === 0) return [];
  const notify = yield message.channel.send('Retrieving songs from youtube url...')
  const type = ytData[0] === 'v' ? 1 : 0;
  const scope = { "get" : ["playlistItems", "videos"], "id" : ["playlistId", "id"], "xtra" : ["&maxResults=50", ""] };
  const base = `${YT.API}/${scope.get[type]}?part=snippet&${scope.id[type]}=${ytData[1]}${scope.xtra[type]}&key=${YT.KEY}`;
  try {
    const collected = [];
    let link = base;
    while (link) {
      const resp = yield request(link);
      if (resp.statusCode !== 200) throw new Error(`Code: ${resp.statusCode}`);
      const data = JSON.parse(resp.body);
      link = !_.isNil(data.nextPageToken) ? `${base}&pageToken=${data.nextPageToken}` : false;
      _.forEach(data.items, song => {
        const artwork = _.isNil(song.snippet.thumbnails) ? 'http://beatmakerleague.com/images/No_Album_Art.png' :
          song.snippet.thumbnails.high.url;
        const id = type ? song.id : song.snippet.resourceId.videoId;
        collected.push({
          "title"  : song.snippet.title,
          "url"    : `https://www.youtube.com/watch?v=${id}`,
          "poster" : song.snippet.channelTitle,
          "pic"    : artwork,
          "src"    : "yt"
        });
      });
    }
    notify.edit(`${notify.content} Done`)
    return collected;
  } catch (e) {
    if (!_.isNil(e.stack)) console.log(e.stack);
    message.channel.send(`Failed to retrieve info from that youtube url! ${e}`);
    return [];
  }
}

// Returns a list of songs given the SC url. May be a playlist or a single item
function* getSCList(endpoint, message) {
  if (_.isNil(endpoint)) return [];
  const notify = yield message.channel.send('Retrieving songs from soundcloud url...');
  try {
    const resp = yield request(`${SC.API}/resolve?url=http://soundcloud.com${endpoint}&client_id=${SC.CLIENT_ID}`);
    if (resp.statusCode !== 200) throw new Error(`Code: ${resp.statusCode}`);
    let data = JSON.parse(resp.body);
    if (data.kind !== "track" && data.kind !== "playlist") {
      notify.edit(`${notify.content} Failed. Not a track or playlist.`);
      return []
    }
    const missed = data.kind === "playlist" ? data.track_count - data.tracks.length : null;
    notify.edit(`${notify.content} Done\n${!_.isNil(missed) ? `${missed} tracks were missed as they aren't available.` : ''}`);
    data = data.kind === "track" ? [data] : data.tracks;
    return data.filter( song => song.kind === 'track' && song.streamable).map( song => {
      const artwork = _.isNil(song.artwork_url) ? 'http://beatmakerleague.com/images/No_Album_Art.png' :
          song.artwork_url.replace("large", "t500x500");
      return {
        "title"      : song.title,
        "url"        : song.permalink_url,
        "stream_url" : song.stream_url,
        "poster"     : song.user.username,
        "pic"        : artwork,
        "src"        : "sc"
      };
    });
  } catch (e) {
    if (!_.isNil(e.stack)) console.log(e.stack);
    message.channel.send(`Failed to retrieve info from that soundcloud url! ${e}`);
    return [];
  }
}

// Searches youtube given the search terms and returns single element list
function* searchYT(searchTerms, next) {
  searchTerms = searchTerms.join(' ').replace(/--shuffle/gi, '').replace(/--next/gi, '').trim();
  if (searchTerms.length < 3) return 'I can search for you but you got to give me more information!';
  const query = querystring.stringify({ q : searchTerms });
  try {
    const resp = yield request(`${YT.API}/search?part=snippet&${query}&maxResults=1&type=video&key=${YT.KEY}`);
    if (resp.statusCode !== 200) throw new Error(`Code: ${resp.statusCode}`);
    const data = JSON.parse(resp.body).items[0];
    if (_.isNil(data)) throw new Error('No songs fit that query');
    const artwork = _.isNil(data.snippet.thumbnails) ? 'http://beatmakerleague.com/images/No_Album_Art.png' :
          data.snippet.thumbnails.high.url;
    const item = [{
        "title"  : data.snippet.title,
        "url"    : `https://www.youtube.com/watch?v=${data.id.videoId}`,
        "poster" : data.snippet.channelTitle,
        "pic"    : artwork,
        "src"    : "yt"
    }];
    player.enqueue(item, next);
    return `Successfully enqueued *${item[0].title}*${next ? ' to be played next!' : ''}`;
  } catch (e) {
    return `YouTube search failed: ${e}`
  }
}

// A function for my own personal entertainment..
const runScript = function* (message, content) {
  if (admins.indexOf(message.author.id) < 0) return 'You do not have permission to use this command!';
  const codeSnippet = content.slice(1).join(' ');
  try {
    eval(codeSnippet);
  } catch (e) {
    return `An error occured: ${e}`;
  }
}

nodeCleanup((exitCode, signal) => {
  client.destroy();
});
