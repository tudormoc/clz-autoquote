# Local Network Deployment - Step by Step

## Initial Setup (Do Once)

**Step 1:** Install PM2
```bash
npm install -g pm2 pm2-windows-startup
```

**Step 2:** Build the app
```bash
npm run build
```

**Step 3:** Start the app
```bash
pm2 start ecosystem.config.js
```

**Step 4:** Enable auto-start on reboot (Windows)
```bash
pm2-startup install
pm2 save
```

**Step 5:** Open Windows Firewall
```bash
netsh advfirewall firewall add rule name="AutoQuote App" dir=in action=allow protocol=TCP localport=3000
```

**Step 6:** Find your server PC's IP
```bash
ipconfig
```
Look for "IPv4 Address" (example: 192.168.1.100)

**Step 7:** Access from any PC on network
Open browser: `http://YOUR_IP:3000` (example: http://192.168.1.100:3000)

---

## Daily Commands

**View app status:**
```bash
pm2 list
```

**View logs:**
```bash
pm2 logs autoquote
```

**Restart app:**
```bash
pm2 restart autoquote
```

**Stop app:**
```bash
pm2 stop autoquote
```

---

## Update After Code Changes

```bash
git pull
npm install
npm run build
pm2 restart autoquote
```
