// Save as: test-lavalink.js
// Run with: node test-lavalink.js

const http = require('http');

const config = {
    host: 'localhost',
    port: 2333,
    password: 'youshallnotpass'
};

console.log('🔍 Testing Lavalink connection...\n');

// Test 1: Check if port is open
const options = {
    hostname: config.host,
    port: config.port,
    path: '/version',
    method: 'GET',
    headers: {
        'Authorization': config.password
    },
    timeout: 5000
};

const req = http.request(options, (res) => {
    console.log('✅ Lavalink server is responding!');
    console.log(`   Status: ${res.statusCode}`);
    console.log(`   Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log(`   Response: ${data}\n`);
        console.log('✅ Your Lavalink server is working correctly!');
        console.log('   The issue is in the bot configuration.\n');
    });
});

req.on('error', (error) => {
    console.error('❌ Cannot connect to Lavalink server!');
    console.error(`   Error: ${error.message}\n`);
    
    if (error.code === 'ECONNREFUSED') {
        console.log('💡 Solutions:');
        console.log('   1. Make sure Lavalink is running: java -jar Lavalink.jar');
        console.log('   2. Check if port 2333 is correct in application.yml');
        console.log('   3. Check firewall settings\n');
    } else if (error.code === 'ETIMEDOUT') {
        console.log('💡 Solutions:');
        console.log('   1. Lavalink might be starting up (wait 30 seconds)');
        console.log('   2. Check if the host/port is correct');
        console.log('   3. Check network connectivity\n');
    }
});

req.on('timeout', () => {
    console.error('❌ Connection timeout!');
    console.error('   Lavalink server is not responding\n');
    req.destroy();
});

req.end();

// Test 2: WebSocket endpoint
console.log('📡 Testing WebSocket endpoint...');
setTimeout(() => {
    const ws = require('http').request({
        hostname: config.host,
        port: config.port,
        path: '/v4/websocket',
        method: 'GET',
        headers: {
            'Authorization': config.password,
            'User-Id': '123456789',
            'Client-Name': 'TestBot/1.0.0'
        }
    }, (res) => {
        console.log(`   WebSocket endpoint status: ${res.statusCode}`);
        if (res.statusCode === 101) {
            console.log('✅ WebSocket endpoint is working!\n');
        }
    });
    
    ws.on('error', (err) => {
        console.log(`   WebSocket test: ${err.message}`);
    });
    
    ws.end();
}, 1000);