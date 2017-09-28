const Discord = require('discord.js');
const client = new Discord.Client();

client.on('ready', () => {
    console.log('I am ready!');
});

client.on('message', message => {
    if (message.content === 'ping') {
    	message.reply('pong');
  	}
});

// THIS  MUST  BE  THIS  WAY
client.login(process.env.MzYyMzk3NTE2MzI4NzMwNjI0.DK39rQ.w2e6wUYrHHfZB4spj-cKiW0yu5E);
