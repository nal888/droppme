# droppme

> file transfer generate · pick · copy · run

Ready-to-paste file transfer commands for Windows and Linux targets across many methods, languages, and tools.

## What it does

Given an attacker IP, port, and filename, **droppme** generates one-liner commands to transfer that file between attacker and target — in dozens of languages, shells, and tools. Pick whichever works in the target's environment.

Useful when:
- The first method fails (PowerShell blocked, `curl` not installed, AV catches certutil, etc.)
- You need an alternative quickly without scrolling through HTB notes or blog posts
- You're learning the variety of file-transfer techniques

## Features

- **84 techniques** covering Windows, Linux, and cross-platform methods
- **Smart filters** — OS, mode (download/upload), category, stealth tier, fileless only, HTB-only
- **"Server side" companion** — every technique shows the matching server command on the attacker (auto-hides when you tell it which server you have running)
- **Substitutions** — IP/port/filename/output dir auto-fill into every command
- **Click to copy** — one click puts the rendered command on your clipboard
- **References** — links to LOLBAS, GTFOBins, MS Docs, etc. for each technique
- **Smart search** — searches across labels, notes, commands, tools, meta tags

## Usage

1. Open the site
2. Enter your attacker IP, port, and the filename you're transferring
3. Pick a technique from the sidebar (filter or search to narrow it down)
4. Click the copy button — paste into the target shell

Bookmark with parameters in the URL:
```
https://yourname.github.io/droppme/?ip=10.10.14.46&port=8000&filename=payload.exe
```

## Adding new techniques

Edit `templates.json`. Each entry follows this shape:

```json
{
  "id": "unique_id",
  "label": "Display name",
  "command": "command with {ip} {port} {filename} {win_out} {nix_out}",
  "meta": ["windows", "powershell", "tool", "download", "stealth"],
  "notes": "Caveats, when to use, what to watch for.",
  "usage": "server-side companion command",
  "ua": "User-Agent string (if HTTP-based)",
  "source": "htb | community",
  "references": [
    {"label": "MS Docs", "url": "https://..."}
  ]
}
```

**Placeholders auto-substituted:**
- `{ip}` — attacker IP
- `{port}` — attacker port
- `{filename}` — filename being transferred
- `{win_out}` — auto-derived from output dir (Windows path)
- `{nix_out}` — auto-derived from output dir (Linux path)

## Sources & attribution

Techniques are drawn from public sources — primarily:
- [HTB Academy — File Transfers module](https://academy.hackthebox.com/module/24)
- [LOLBAS Project](https://lolbas-project.github.io/)
- [GTFOBins](https://gtfobins.github.io/)
- Microsoft Docs, OpenSSL docs, RFC 4918, etc.

The commands themselves aren't anyone's IP — they're documented usages of standard utilities. Descriptions and notes are paraphrased, not quoted. HTB Academy is credited as the primary curator.

## Disclaimer

For educational and authorized testing only.

**Stealth tiers** describe the technique's intrinsic footprint (UA, process, command pattern) — they are **not** a guarantee against modern AV. Most techniques work fine for CTF/HTB labs. Real engagements: modern Defender + AMSI flags many "fileless" classics — test before you rely on it.

## Local development

Just open `index.html` in a browser. Or serve with any static server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploying to GitHub Pages

1. Push this folder to a GitHub repo named `droppme` (or whatever)
2. Settings → Pages → Source → "Deploy from a branch" → main / root
3. Wait a minute. Site lives at `https://YOUR_USERNAME.github.io/REPO_NAME/`

## Tech

- Vanilla HTML, CSS, JavaScript — no framework, no build step
- Templates as JSON for easy editing
- All processing client-side, no data leaves the browser

## License

MIT — see `LICENSE`.
