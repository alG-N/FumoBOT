# How to use PM2
- CTRL + C to stop nodemon, yarn dev run to enable nodemon
- pm2 start MainBOT\FumoBOTMain.js --name=fumobot (Create an application for the bot that keep running)
- pm2 stop fumobot (Stop the bot)
- pm2 restart fumobot (Restart the bpt)
- pm2 list (List of application)
- pm2 show fumobot (Show the Bot)
- pm2 logs fumobot (Logs the Bot, error, stuff, ...)
- pm2 flush --clear log (Clear the log)
