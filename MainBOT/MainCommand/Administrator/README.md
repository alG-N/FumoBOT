# Administrator Module

A comprehensive admin system for FumoBOT with proper separation of concerns.

## Directory Structure

```
Administrator/
├── index.js                 # Main exports (use this for imports)
├── Config/
│   └── adminConfig.js       # All configuration constants
├── Service/
│   ├── BanService.js        # Ban management logic
│   ├── TicketService.js     # Ticket management logic
│   ├── GuildTrackingService.js  # Guild join/leave tracking
│   └── AdminActionService.js    # Admin action logic (items, fumos, currency)
├── Command/
│   ├── adminCommands.js     # Item/Fumo/Currency/Weather commands
│   ├── banCommands.js       # Ban/Unban commands
│   ├── ticketCommands.js    # Ticket system commands
│   └── migratePetsCommand.js # Pet migration command
├── Utils/
│   └── adminUtils.js        # Shared utility functions
├── Data/
│   ├── BannedList/
│   │   └── Banned.json      # Ban list data
│   └── ticketCounter.txt    # Ticket counter
└── [Legacy files]           # Backward compatibility re-exports
```

## Usage

### Import from main index (Recommended)

```javascript
const {
    registerAdminCommands,
    registerBanSystem,
    registerTicketSystem,
    initializeGuildTracking
} = require('./MainCommand/Administrator');
```

### Import specific services

```javascript
const BanService = require('./MainCommand/Administrator/Service/BanService');
const TicketService = require('./MainCommand/Administrator/Service/TicketService');
```

### Import configuration

```javascript
const { ADMIN_IDS, isAdmin } = require('./MainCommand/Administrator/Config/adminConfig');
```

## Admin Commands

| Command | Description | Permission |
|---------|-------------|------------|
| `.additem <userId> <itemName>` | Add item to user inventory | Admin |
| `.addfumo <userId>` | Add fumo to user inventory | Admin |
| `.addcurrency <userId>` | Add coins/gems to user | Admin |
| `.weather [name] [duration]` | Control weather events | Admin |
| `.ban <userId> [duration] [reason]` | Ban a user | Developer |
| `.unban <userId>` | Unban a user | Developer |
| `.baninfo <userId>` | Get ban information | Developer |
| `.banlist` | List all banned users | Developer |
| `.report` | Create support ticket | Anyone |
| `.migratepets` | Migrate pet abilities | Developer |

## Configuration

Edit `Config/adminConfig.js` to change:
- Admin user IDs
- Channel IDs (guild log, report channel)
- Ticket types and settings
- Item/Fumo rarities
- Currency types
- Embed colors

## Services

### BanService
- `banUser(userId, reason, durationMs)` - Ban a user
- `unbanUser(userId)` - Unban a user
- `isUserBanned(userId)` - Check if user is banned
- `getAllBans()` - Get all active bans
- `getBanInfo(userId)` - Get detailed ban info

### TicketService
- `createTicket(params)` - Create a new ticket
- `getTicketType(type)` - Get ticket type config
- `formatTicketFields(ticket)` - Format ticket for embed

### GuildTrackingService
- `initializeGuildTracking(client)` - Start tracking
- `getGuildStatistics(client)` - Get bot statistics
- `createGuildStatsEmbed(client)` - Create stats embed

### AdminActionService
- `addItemToUser(userId, itemName, quantity)` - Add items
- `addFumoToUser(userId, fumoName, quantity)` - Add fumos
- `addCurrencyToUser(userId, type, amount)` - Add currency
- `startWeather(name, duration, client)` - Start weather
- `stopWeather(name, client)` - Stop weather

## Backward Compatibility

The old files (`adminCommands.js`, `banSystem.js`, etc.) in the root Administrator folder now just re-export from the new locations. This means existing imports will continue to work.
