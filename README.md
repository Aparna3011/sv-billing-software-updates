# SV IT Hub Billing

Offline GST billing and service management desktop application for IT companies.

## Run

```bash
npm install
npm run dev
```

Default login:

```text
Email: admin@svithub.local
Password: admin123
```

## Build

```bash
npm run build
```

The application stores SQLite data in Electron's `userData` directory and keeps all database access inside the main process through IPC.
