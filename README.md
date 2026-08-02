# luci-app-sms-tool

A LuCI application for OpenWrt that lets you **send and receive SMS** through an
attached USB/serial modem, with independent SIM-card (SM) and modem-memory (ME)
storage and a merged "All" inbox view.

It is a modern client-side LuCI app: the UI is JavaScript (rendered in the
browser) and the backend is a **ucode script exposed over ubus via rpcd**. There
is no Lua controller, no `.htm` templates, and no background polling daemon.

---

## Features

| Feature | Detail |
|---|---|
| Send SMS | Via `sms_tool` (handles PDU encoding); success detected from the modem's `+CMGS` reply |
| Receive SMS | Read on demand; the Inbox auto-refreshes client-side every 60 s |
| Storage (incoming) | SIM (`SM`) or modem memory (`ME`) — applied to the modem with `AT+CPMS` |
| Inbox view | `SM`, `ME`, or **All (SIM + Modem)**; the view choice is persisted |
| "All" view | Reads SM and ME separately and merges them, tagging each message with its real storage (does **not** rely on the modem's `MT`, which many modules implement as ME-only) |
| Per-message delete | Deletes from the message's own storage, so index collisions between SM and ME are handled correctly |
| Port config | Separate send / receive / control ports, configurable |
| Baud rate | Configurable |
| Compose | Live character counter, multi-part concatenated SMS up to 6 parts (918 chars) |
| Sent log | Browser `localStorage` |
| Drafts | Browser `localStorage` |
| Modem info | Manufacturer, model, IMEI, signal, network operator |
| Storage info | Live SIM and modem slot usage |

---

## Architecture

```
Browser (LuCI JS views)
        │  ubus / rpcd
        ▼
ucode backend  ──►  /usr/bin/sms_tool  ──►  modem (AT over /dev/ttyUSBx)
```

* **Views** — `htdocs/luci-static/resources/view/sms-tool/*.js` render the pages
  and call the backend over ubus (`rpc.declare`).
* **Backend** — `root/usr/share/rpcd/ucode/luci.sms-tool` is a ucode object
  published as ubus object `luci.sms-tool`. It shells out to `sms_tool`.
* **ACL** — `root/usr/share/rpcd/acl.d/luci-app-sms-tool.json` grants the LuCI
  session access to the ubus methods and the `sms-tool` uci config.
* **Storage application** — an init script, a tty hotplug hook, and an iface
  hotplug hook apply the incoming-store (`AT+CPMS`) to the modem. See
  *Storage model* below.

### Directory layout

```
luci-app-sms-tool/
├── Makefile
├── README.md
├── po/en/
│   └── luci-app-sms-tool.po                     # i18n strings
├── htdocs/luci-static/resources/view/sms-tool/
│   ├── inbox.js                                 # Inbox (receive, view switch, delete)
│   ├── compose.js                               # Compose (send) + modem info
│   ├── sent.js                                  # Sent log (localStorage)
│   ├── drafts.js                                # Drafts (localStorage)
│   └── settings.js                              # Port / storage settings
└── root/
    ├── etc/
    │   ├── config/sms-tool                      # UCI config
    │   ├── init.d/sms-tool                      # Applies AT+CPMS at boot; reload trigger
    │   ├── uci-defaults/99-sms-tool             # First-boot: enable + start service
    │   └── hotplug.d/
    │       ├── tty/40-sms-tool                  # Apply AT+CPMS when the modem tty appears
    │       └── iface/40-sms-tool                # Re-apply after a wwan* interface comes up
    └── usr/share/
        ├── luci/menu.d/luci-app-sms-tool.json   # Menu: Modem → SMS Messages
        └── rpcd/
            ├── acl.d/luci-app-sms-tool.json     # ubus/uci ACL
            └── ucode/luci.sms-tool              # ucode backend
```

---

## Dependencies

Only one runtime dependency, plus `luci-base` (pulled in automatically):

```
luci-base
sms-tool          # provides /usr/bin/sms_tool (obsy's AT-based SMS utility)
```

```sh
opkg update
opkg install sms-tool
# then install the luci-app-sms-tool .ipk
```

`gammu` and `microcom` are **not** required.

---

## Menu location

**LuCI → Modem → SMS Messages** (Inbox / Compose / Sent / Drafts / Settings).
The parent *Modem* menu is shared with other modem apps; if you have none, this
app provides the entry.

---

## Storage model

This is the part most modems get subtly wrong, so it's worth reading once.

The modem tracks SMS memory in three `AT+CPMS` slots: mem1 (read/delete
pointer), mem2 (send/write), and mem3 (**where incoming messages are stored**).
Two independent concepts in this app map onto those slots:

### Incoming store — `uci` option `storage`

Where the modem physically files **newly received** SMS (mem3). Must be a
concrete storage:

| Value | Meaning |
|---|---|
| `SM` | SIM card |
| `ME` | Modem/device memory (default) |

`MT` is **not** valid here — it is a read-only aggregate on the modem, not a
store target, so it is not offered in Settings.

This value is pushed to the modem with `AT+CPMS="<s>","<s>","<s>"` at the
points listed under *When the incoming store is applied*. Change it in
**Settings → SIM / Storage → Incoming Message Storage** and Save & Apply.

### Inbox view — `uci` option `view_storage`

Which storage the **Inbox lists** (mem1 only; this never changes where incoming
messages land):

| Value | Meaning |
|---|---|
| `SM` | SIM only |
| `ME` | Modem only |
| `MT` | **All** — SM and ME read separately and merged |

Because some modem firmware implements `MT` as ME-only (the SIM messages never
appear), the **All** view does not trust the modem's `MT`. The backend reads
`SM` and `ME` in turn and concatenates the results, tagging each message with
its true storage. That tag is used to badge each row and to delete from the
correct memory (index 0 can exist on both SM and ME).

The dropdown selection is persisted to `view_storage`, so the Inbox reopens on
the storage you last used.

### When the incoming store is applied

`AT+CPMS` mem3 is asserted:

1. **tty hotplug** (`/etc/hotplug.d/tty/40-sms-tool`) — when the configured
   modem port enumerates. This is the authoritative path and defeats the
   USB-serial boot race (the port often appears seconds after boot).
2. **iface hotplug** (`/etc/hotplug.d/iface/40-sms-tool`) — when a `wwan*`
   data interface comes up, in case connection setup reset the modem.
3. **init** (`/etc/init.d/sms-tool`) — at boot (bounded wait for the port) and
   on `reload` via a procd config-reload trigger.
4. **Save & Apply** on the Settings page — the UI also calls the backend
   `apply_storage` method directly for immediate effect.

Every application logs to `logread -e sms-tool`.

---

## UCI configuration

```uci
config sms-tool 'global'
    option enabled       '1'             # honored: gates the boot/hotplug CPMS apply
    option receive_port  '/dev/ttyUSB2'  # honored: read/delete/status/AT port
    option send_port     '/dev/ttyUSB2'  # honored: send port
    option baud_rate     '115200'        # honored
    option storage       'ME'            # honored: incoming store (mem3), SM|ME
    option view_storage  'ME'            # honored: Inbox view, SM|ME|MT (set from UI)
```

### Reserved / not yet wired

These keys ship in the default config and/or appear on the Settings page, but
the backend does not currently read them. They are safe to leave as-is:

```
modem_port          # shown in UI; backend uses receive_port/send_port
pin                 # no automatic PIN unlock is implemented
max_messages        # not enforced
poll_interval       # Inbox refresh is a fixed 60 s client-side timer
delete_after_read   # not implemented
log_enabled/log_file
```

Apply changes:

```sh
uci set sms-tool.global.storage='ME'
uci commit sms-tool
/etc/init.d/sms-tool reload      # re-applies AT+CPMS to the modem
```

---

## Finding your modem's ports

Most modems expose several serial interfaces; the AT/control port is the one
this app talks to.

```sh
ls /dev/ttyUSB* /dev/ttyACM*
dmesg | grep -i tty
# confirm which port answers AT:
sms_tool -d /dev/ttyUSB2 at 'AT'
```

Set `receive_port` / `send_port` to that port in Settings.

---

## Backend / debugging

There is no `sms-tool` CLI wrapper. The backend is the `sms_tool` binary plus
the ubus object. Useful commands from the router shell:

```sh
# Raw reads via the underlying binary
sms_tool -d /dev/ttyUSB2 -s SM -j recv
sms_tool -d /dev/ttyUSB2 -s ME -j recv

# Inspect / set the CPMS slots directly
sms_tool -d /dev/ttyUSB2 at 'AT+CPMS?'
sms_tool -d /dev/ttyUSB2 at 'AT+CPMS="ME","ME","ME"'

# Send
sms_tool -d /dev/ttyUSB2 send "+15551234567" "Hello from OpenWrt"

# Exercise the app's backend directly over ubus
ubus call luci.sms-tool get_state
ubus call luci.sms-tool read    '{"storage":"MT"}'
ubus call luci.sms-tool storage
ubus call luci.sms-tool modem_info
ubus call luci.sms-tool apply_storage
```

ubus methods provided by `luci.sms-tool`: `send`, `read`, `delete`,
`storage`, `modem_info`, `get_state`, `set_view`, `apply_storage`.

---

## Building

Place this directory in your OpenWrt buildroot under the LuCI feed
(`feeds/luci/applications/luci-app-sms-tool`), then:

```sh
./scripts/feeds update luci
./scripts/feeds install luci-app-sms-tool
make package/luci-app-sms-tool/{clean,compile} V=s
```

Bump `PKG_RELEASE` when changing files so buildroot rebuilds instead of reusing
a cached stamp. The `.ipk` lands in `bin/packages/<arch>/luci/`.

---

## Logs

```sh
logread -e sms-tool          # CPMS apply events (boot/hotplug/ifup)
```

---

## License

MIT
