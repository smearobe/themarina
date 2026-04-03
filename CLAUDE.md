# The Marina — NHL ProClubs Stats Site

A live stats website for The Marina, an NHL ProClubs team on PS5. Pulls data from EA's ProClubs API and presents it as a sports team site with team overview, sortable player stats, and player cards.

---

## Stack

- **Backend**: Node.js / Express — proxies EA API requests (EA blocks direct browser requests from non-EA origins)
- **Frontend**: Plain HTML + vanilla JS + CSS in `public/`
- **No database** — data is fetched live from EA's API on each page load
- **No build step** — plain files served statically

---

## Hosting & Deployment

- **Provider**: Hetzner VPS — `5.161.181.165`
- **SSH**: `marina@5.161.181.165` → `/home/marina/themarina`
- **Process**: systemd service named `themarina`
- **Domain**: `https://themarina.smearobe.com`
- **DNS**: Cloudflare (proxy/orange cloud can be left on)
- **SSL**: Let's Encrypt via certbot (auto-renews)
- **Deploy**: Run `./deploy.sh` — commits, pushes to GitHub, SSHes in, pulls, restarts systemd
- **GitHub**: https://github.com/smearobe/themarina

---

## Project Structure

```
server.js          # Express app — proxies EA API, serves static files
public/
  index.html       # Single page app shell
  style.css        # All styles
  app.js           # All frontend logic
deploy.sh          # One-command deploy to Hetzner
package.json
```

---

## EA API

The EA ProClubs API blocks server-side requests unless realistic browser headers are sent. The Express server proxies all requests with spoofed headers to get around this.

- **Club ID**: `80678`
- **Platform**: `common-gen5` (PS5)
- **Member stats endpoint**: `https://proclubs.ea.com/api/nhl/members/stats?platform=common-gen5&clubId=80678`
- **Club info endpoint**: `https://proclubs.ea.com/api/nhl/clubs/info?platform=common-gen5&clubIds=80678`

If EA changes their API or WAF rules and requests start returning 403, update the headers in `server.js`.

---

## Frontend Features

- **Team Overview tab** — aggregated record with win/loss bar, offensive/defensive totals, 12-category leaders board
- **Player Stats tab** — sortable table with 5 stat group filters (Scoring, Shooting, Defence, Special Teams, Discipline)
- **Player Cards tab** — visual grid of all players
- **Player Modal** — full stat breakdown, opens from any tab by clicking a player

---

## Server Management

```bash
# SSH in
ssh marina@5.161.181.165

# Service commands
sudo systemctl status themarina
sudo systemctl restart themarina
sudo systemctl stop themarina

# View logs
journalctl -u themarina -f
```

---

## Deploy

```bash
./deploy.sh
```

Commits any uncommitted changes, pushes to GitHub, SSHes into Hetzner, pulls, runs `npm install --production`, restarts the systemd service.
