# How to use PM2
- CTRL + C to stop nodemon, yarn dev run to enable nodemon
- pm2 start MainBOT\FumoBOTMain.js --name=fumobot (Create an application for the bot that keep running)
- pm2 stop fumobot (Stop the bot)
- pm2 restart fumobot (Restart the bpt)
- pm2 list (List of application)
- pm2 show fumobot (Show the Bot)
- pm2 logs fumobot (Logs the Bot, error, stuff, ...)
- pm2 flush --clear log (Clear the log)

# List of what I need to do (26/11 - 30/11)
### Add detailed logs/enhancement, feature and bug for the .crategacha
  - The log should show:
    + Detailed log of Rare Fumo, when obtained, obtained by who?
    + Shiny/alG logs 
    + Error handling logs
    + Logs when a fumo pity reached, by who?
  - Feature:
    + No idea...
  - Bug:
    + No bug for now

### Add detailed logs/enhancement, feature and bug for the .eventgacha
  - The log should show:
    + Detailed log of a Rare Fumo, when obtained, obtained by who?
    + When user limit's roll reached
    + Logs when a fumo pity reached, by who?
    + Error handling logs
    + Shiny/alG logs 
  - Feature:
    + Personally, the timer should be based on real time, so it wouldnt reset everytime I rerun the bot
    + No other idea...
  - Bug:
    + No bug for now...

### Add detailed logs/enhancement, feature and bug for the Farm Management
  - The log should show
    + 
  - Feature:
    +
  - Bug:
    +

### 