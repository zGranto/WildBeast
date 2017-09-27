'use strict'
process.title = 'WildBeast'

var Config

try {
  Config = require('./config.json')
} catch (e) {
  console.log('\nWildBeast encountered an error while trying to load the config file, please resolve this issue and restart WildBeast\n\n' + e.message)
  process.exit()
}

var argv = require('minimist')(process.argv.slice(2))
var Logger = require('./runtime/internal/logger.js').Logger

var Eris = require('eris')
var bot
var runtime = require('./runtime/runtime.js')
var timeout = runtime.internal.timeouts
var commands = runtime.commandcontrol.Commands
var aliases = runtime.commandcontrol.Aliases
var datacontrol = runtime.datacontrol

Logger.info('Initializing...')

if (argv.shardmode && !isNaN(argv.shardcount)) {
  Logger.info('Starting in ShardMode')
  bot = new Eris(Config.bot.token, {getAllUsers: true, maxShards: argv.shardcount})
} else {
  bot = new Eris(Config.bot.token, {getAllUsers: true})
}

var bugsnag = require('bugsnag')
bugsnag.register(Config.api_keys.bugsnag)

bot.on('ready', () => {
  runtime.internal.versioncheck.versionCheck(function (err, res) {
    if (err) {
      Logger.error('Version check failed, ' + err)
    } else if (res) {
      Logger.info(`Version check: ${res}`)
    }
  })
  Logger.info('Ready to start!', {
    botID: bot.user.id,
    version: require('./package.json').version
  })
  Logger.info(`Logged in as ${bot.user.username}#${bot.user.discriminator} (ID: ${bot.user.id}) and serving ${bot.users.size} users in ${bot.guilds.size} servers.`)
  if (argv.shutdownwhenready) {
    console.log('o okei bai')
    process.exit(0)
  }
})

bot.on('messageCreate', msg => {
  if (msg.author.bot || msg.author.id === bot.user.id) {
    return
  }
  if (!bot.ready) return
  datacontrol.users.isKnown(msg.author)
  var prefix
  var loggingGuild = {}
  for (var k in msg.channel.guild) {
    loggingGuild[k] = msg.channel.guild[k]
  }
  loggingGuild.roles = []
  loggingGuild.emojis = []
  datacontrol.customize.getGuildData(msg.channel.guild).then(function (g) {
    if (!g.customize.prefix) {
      prefix = Config.settings.prefix
    } else {
      prefix = g.customize.prefix
    }
    var cmd
    var suffix
    if (msg.content.startsWith(prefix)) {
      cmd = msg.content.substr(prefix.length).split(' ')[0].toLowerCase()
      suffix = msg.content.substr(prefix.length).split(' ')
      suffix = suffix.slice(1, suffix.length).join(' ')
    } else if (msg.content.startsWith(bot.user.mention)) {
      cmd = msg.content.substr(bot.User.mention.length + 1).split(' ')[0].toLowerCase()
      suffix = msg.content.substr(bot.User.mention.length).split(' ')
      suffix = suffix.slice(2, suffix.length).join(' ')
    } else if (msg.content.startsWith(bot.user.nickMention)) {
      cmd = msg.content.substr(bot.user.nickMention.length + 1).split(' ')[0].toLowerCase()
      suffix = msg.content.substr(bot.user.nickMention.length).split(' ')
      suffix = suffix.slice(2, suffix.length).join(' ')
    }
    if (cmd === 'help') {
      runtime.commandcontrol.helpHandle(bot, msg, suffix)
    }
    if (aliases[cmd]) {
      cmd = aliases[cmd].name
    }
    if (commands[cmd]) {
      if (typeof commands[cmd] !== 'object') {
        return // ignore JS build-in array functions
      }
      Logger.info(`Executing <${msg.cleanContent}> from ${msg.author.username}`, {
        //author: msg.author,
        //guild: loggingGuild,
        botID: bot.user.id,
        cmd: cmd
      })
      if (commands[cmd].level === 'master') {
        if (Config.permissions.master.indexOf(msg.author.id) > -1) {
          try {
            commands[cmd].fn(msg, suffix, bot)
          } catch (e) {
            bot.createMessage(msg.channel.id, 'An error occurred while trying to process this command, you should let the bot author know. \n```' + e + '```')
            Logger.error(`Command error, thrown by ${commands[cmd].name}: ${e}`, {
              author: msg.author,
              guild: loggingGuild,
              botID: bot.user.id,
              cmd: cmd,
              error: e
            })
          }
        } else {
          bot.createMessage(msg.channel.id, 'This command is only for the bot owner.')
        }
      } else if (msg.channel.type === 0) {
        datacontrol.permissions.checkLevel(msg, msg.author.id, msg.member.roles).then(r => {
          if (r !== -1) {
            timeout.check(commands[cmd], msg.channel.guild.id, msg.author.id).then(t => {
              if (t !== true) {
                if (g.customize.timeout === null || g.customize.timeout === 'default') {
                  bot.createMessage(msg.channel.id, `Wait ${Math.round(t)} more seconds before using that again.`)
                } else {
                  bot.createMessage(msg.channel.id, g.customize.timeout.replace(/%user/g, msg.author.mention).replace(/%server/g, msg.channel.guild.name).replace(/%channel/, msg.channel.name).replace(/%timeout/, Math.round(t)))
                }
              } else {
                if (r >= commands[cmd].level) {
                  if (!commands[cmd].hasOwnProperty('nsfw')) {
                    try {
                      commands[cmd].fn(msg, suffix, bot)
                    } catch (e) {
                      bot.createMessage(msg.channel.id, 'An error occurred while trying to process this command, you should let the bot author know. \n```' + e + '```')
                      Logger.error(`Command error, thrown by ${commands[cmd].name}: ${e}`, {
                        author: msg.author,
                        guild: loggingGuild,
                        botID: bot.user.id,
                        cmd: cmd,
                        error: e
                      })
                    }
                  } else {
                      if (msg.channel.nsfw === true) {
                        try {
                          commands[cmd].fn(msg, suffix, bot)
                        } catch (e) {
                          bot.createMessage(msg.channel.id, 'An error occurred while trying to process this command, you should let the bot author know. \n```' + e + '```')
                          Logger.error(`Command error, thrown by ${commands[cmd].name}: ${e}`, {
                            author: msg.author,
                            guild: loggingGuild,
                            botID: bot.User.id,
                            cmd: cmd,
                            error: e
                          })
                        }
                      } else {
                        if (g.customize.nsfw === null || g.customize.nsfw === 'default') {
                          bot.createMessage(msg.channel.id, 'This channel does not allow NSFW commands, enable them by setting this channel to NSFW')
                        } else {
                          bot.createMessage(msg.channel.id, g.customize.nsfw.replace(/%user/g, msg.author.mention).replace(/%server/g, msg.guild.name).replace(/%channel/, msg.channel.name))
                        }
                      }
                  }
                } else {
                  if (g.customize.perms === null || g.customize.perms === 'default') {
                    if (r > -1 && !commands[cmd].hidden) {
                      var reason = (r > 4) ? '**This is a master user only command**, ask the bot owner to add you as a master user if you really think you should be able to use this command.' : 'Ask the server owner to modify your level with `setlevel`.'
                      bot.createMessage(msg.channel.id, 'You have no permission to run this command!\nYou need level ' + commands[cmd].level + ', you have level ' + r + '\n' + reason)
                    }
                  } else {
                    bot.createMessage(msg.channel.id, g.customize.perms.replace(/%user/g, msg.author.mention).replace(/%server/g, msg.channel.guild.name).replace(/%channel/, msg.channel.name).replace(/%nlevel/, commands[cmd].level).replace(/%ulevel/, r))
                  }
                }
              }
            })
          }
        }).catch(function (e) {
          Logger.error('Permission error: ' + e, {
            author: msg.author,
            guild: loggingGuild,
            botID: bot.user.id,
            cmd: cmd,
            error: e
          })
        })
      } else {
        if (commands[cmd].noDM) {
          bot.createMessage(msg.channel.id, 'This command cannot be used in DM, invite the bot to a server and try this command again.')
        } else {
          datacontrol.permissions.checkLevel(msg, msg.author.id, []).then(function (r) {
            if (r !== -1 && r >= commands[cmd].level) {
              try {
                commands[cmd].fn(msg, suffix, bot)
              } catch (e) {
                bot.createMessage(msg.channel.id, 'An error occurred while trying to process this command, you should let the bot author know. \n```' + e + '```')
                Logger.error(`Command error, thrown by ${commands[cmd].name}: ${e}`)
              }
            } else {
              if (r === -1) {
                bot.createMessage(msg.channel.id, 'You have been blacklisted from using this bot, for more help contact my developers.')
              } else {
                bot.createMessage(msg.channel.id, 'You have no permission to run this command in DM, you probably tried to use restricted commands that are either for master users only or only for server owners.')
              }
            }
          }).catch(function (e) {
            Logger.error('Permission error: ' + e, {
              author: msg.author,
              guild: loggingGuild,
              botID: bot.user.id,
              cmd: cmd,
              error: e
            })
          })
        }
      }
    }
  }).catch(function (e) {
    if (e.msg === 'None of the pools have an opened connection and failed to open a new one') {
      Logger.warn('RethinkDB server is not running or I could not connect, process will now exit.')
      process.exit(1)
    } else {
      Logger.error('Prefix error: ' + e, {
        author: msg.author,
        guild: loggingGuild,
        botID: bot.user.id,
        error: e
      })
    }
  })
})
/*
bot.Dispatcher.on(Event.GUILD_MEMBER_ADD, function (s) {
  datacontrol.permissions.isKnown(s.guild)
  datacontrol.customize.isKnown(s.guild)
  datacontrol.customize.check(s.guild).then((r) => {
    if (r === 'on' || r === 'channel') {
      datacontrol.customize.reply(s, 'welcomeMessage').then((x) => {
        if (x === null || x === 'default') {
          s.guild.generalChannel.sendMessage(`Welcome ${s.member.username} to ${s.guild.name}!`)
        } else {
          s.guild.generalChannel.sendMessage(x.replace(/%user/g, s.member.mention).replace(/%server/g, s.guild.name))
        }
      }).catch((e) => {
        Logger.error(e)
      })
    } else if (r === 'private') {
      datacontrol.customize.reply(s, 'welcomeMessage').then((x) => {
        if (x === null || x === 'default') {
          s.member.openDM().then((g) => g.sendMessage(`Welcome to ${s.guild.name}! Please enjoy your stay!`))
        } else {
          s.member.openDM().then((g) => g.sendMessage(x.replace(/%user/g, s.member.mention).replace(/%server/g, s.guild.name)))
        }
      }).catch((e) => {
        Logger.error(e)
      })
    }
  }).catch((e) => {
    Logger.error(e)
  })
  datacontrol.users.isKnown(s.member)
})

bot.Dispatcher.on(Event.GUILD_CREATE, function (s) {
  if (!bot.connected) return
  if (!s.becameAvailable) {
    datacontrol.permissions.isKnown(s.guild)
    datacontrol.customize.isKnown(s.guild)
  }
})

bot.Dispatcher.on(Event.GUILD_UPDATE, g => {
  if (!bot.connected) return
  var guild = g.getChanges()
  if (guild.before.owner_id !== guild.after.owner_id) {
    datacontrol.permissions.updateGuildOwner(g.guild)
  }
})

bot.Dispatcher.on(Event.GATEWAY_RESUMED, function () {
  Logger.info('Connection to the Discord gateway has been resumed.')
})

bot.Dispatcher.on(Event.PRESENCE_MEMBER_INFO_UPDATE, (user) => {
  datacontrol.users.isKnown(user.new).then(() => {
    if (user.old.username !== user.new.username) {
      datacontrol.users.namechange(user.new).catch((e) => {
        Logger.error(e)
      })
    }
  })
})

bot.Dispatcher.on(Event.GATEWAY_HELLO, (gatewayInfo) => {
  Logger.debug(`Gateway trace, ${gatewayInfo.data._trace}`, {
    botID: bot.User.id,
    gatewayTrace: gatewayInfo.data._trace
  })
})

bot.Dispatcher.on(Event.DISCONNECTED, function (e) {
  Logger.error('Disconnected from the Discord gateway: ' + e.error)
  Logger.info('Trying to login again...')
  start()
})

bot.Dispatcher.onAny((type, data) => {
  if (data.type === 'READY' || type === 'VOICE_CHANNEL_JOIN' || type === 'VOICE_CHANNEL_LEAVE' || type.indexOf('VOICE_USER') === 0 || type === 'PRESENCE_UPDATE' || type === 'TYPING_START' || type === 'GATEWAY_DISPATCH') return
  Bezerk.emit(type, data, bot)
})*/

process.on('unhandledRejection', (reason, p) => {
  if (p !== null && reason !== null) {
    bugsnag.notify(new Error(`Unhandled promise: ${require('util').inspect(p, {depth: 3})}: ${reason}`))
  }
})

bot.connect()
