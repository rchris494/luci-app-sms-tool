# luci-app-sms-tool

A full-featured LuCI application for OpenWrt that lets you **send and receive SMS messages** via an attached USB/serial modem, with configurable send/receive ports and both SIM-card (SM) and modem-memory (ME) storage support.

---

## Features

| Feature | Detail |
|---|---|
| Send SMS | PDU-mode AT commands, auto-retry |
| Receive SMS | Polls modem on a configurable interval |
| Storage | SIM (SM), Modem memory (ME), or both (MT) |
| Port config | Separate configurable send and receive serial ports |
| Baud rate | 9600 – 460800, configurable per modem |
| SIM PIN | Optional automatic PIN unlock |
| Inbox | Filterable table with full-message viewer |
| Compose | Character counter, multi-part SMS support (up to 6 parts) |
| Sent log | Cached locally on the router |
| Drafts | Browser localStorage |
| Modem info | Manufacturer, model, IMEI, signal strength, network |
| Storage info | Live SIM and modem slot usage |
| Init service | procd-managed daemon, auto-restarts on crash |

---

## Directory Layout

```
luci-app-sms-tool/
├── Makefile
├── README.md
├── luasrc/
│   ├── controller/
│   │   └── sms-tool.lua          # LuCI controller + JSON API endpoints
│   └── view/sms-tool/
│       ├── inbox.htm             # Inbox (receive)
│       ├── compose.htm           # Compose (send)
│       ├── sent.htm              # Sent messages
│       ├── drafts.htm            # Draft messages
│       └── settings.htm         # Port / modem / storage settings
├── po/en/
│   └── luci-app-sms-tool.po      # English i18n strings
└── root/
    ├── etc/
    │   ├── config/sms-tool       # UCI configuration file
    │   └── init.d/sms-tool       # procd init script
    └── usr/
        ├── sbin/sms-tool         # Backend shell script
        └── share/rpcd/acl.d/
            └── luci-app-sms-tool.json  # RPCD ACL
```

---

## Dependencies

```
luci-base
sms-tool          (OpenWrt package for basic gammu/AT wrapper)
microcom          (serial terminal for AT commands, part of busybox-extras)
```

Install with:
```sh
opkg update
opkg install luci-app-sms-tool microcom
```

---

## UCI Configuration

```uci
config sms-tool 'global'
    option enabled          '1'
    option modem_port       '/dev/ttyUSB2'   # AT command / control port
    option receive_port     '/dev/ttyUSB1'   # Port used to READ incoming SMS
    option send_port        '/dev/ttyUSB2'   # Port used to SEND SMS
    option baud_rate        '115200'
    option pin              ''               # SIM PIN (leave blank if none)
    option storage          'SM'             # SM=SIM, ME=modem, MT=both
    option poll_interval    '30'             # seconds between inbox polls
    option max_messages     '500'
    option delete_after_read '0'            # 1 = delete from modem after fetch
    option log_enabled      '1'
    option log_file         '/var/log/sms-tool.log'
```

Edit via LuCI → Services → SMS Tool → Settings, or directly:
```sh
uci set sms-tool.global.receive_port=/dev/ttyUSB0
uci set sms-tool.global.send_port=/dev/ttyUSB1
uci commit sms-tool
/etc/init.d/sms-tool restart
```

---

## Port Configuration

Most USB modems expose **multiple serial interfaces**:

| Interface | Typical use |
|---|---|
| `/dev/ttyUSB0` | Diagnostic / NMEA |
| `/dev/ttyUSB1` | AT commands (receive, status) |
| `/dev/ttyUSB2` | AT commands (send, PPP data) |
| `/dev/ttyUSB3` | Audio / reserved |

You can set the **receive port** and **send port** independently, which is useful when:
- Your modem locks one port during a data session
- You want to separate read polling from send operations
- You have a dual-SIM modem with separate logical interfaces

To discover your modem's ports:
```sh
ls /dev/ttyUSB* /dev/ttyACM*
dmesg | grep tty
```

---

## Message Storage

| Value | Description |
|---|---|
| `SM` | SIM card memory (typically 20–50 slots) |
| `ME` | Modem/device internal memory (varies by modem) |
| `MT` | Modem-preferred — uses ME first, falls back to SM |

Switch storage at runtime from the Inbox page without restarting the service.

---

## Backend CLI

The `/usr/sbin/sms-tool` script can be used directly from the command line:

```sh
# Send an SMS
sms-tool send +447700900123 "Hello from OpenWrt"

# List messages from SIM
sms-tool read SM

# List messages from modem memory
sms-tool read ME

# Delete message index 3 from SIM
sms-tool delete 3 SM

# Show storage usage
sms-tool storage

# Show modem info
sms-tool modem_info

# Start the polling daemon manually
sms-tool daemon

# Initialise modem (PIN unlock, storage set, PDU mode)
sms-tool init
```

---

## Building

Place this directory inside `feeds/luci/applications/` of your OpenWrt buildroot, then:

```sh
./scripts/feeds update luci
./scripts/feeds install luci-app-sms-tool
make package/luci-app-sms-tool/compile V=s
```

The `.ipk` will be in `bin/packages/<arch>/luci/`.

---

## Logs

```sh
logread | grep sms-tool
tail -f /var/log/sms-tool.log
```

---

## License

MIT
