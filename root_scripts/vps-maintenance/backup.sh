#!/usr/bin/env bash
# VPS Config Backup — stages critical dirs and pushes to GitHub
set -euo pipefail

LOG=/var/log/vps-backup.log
LOCK=/tmp/vps-backup.lock
STAGING=/tmp/vps-backup-staging
ENV_FILE=/root/.hermes/.env
REPO_URL_BASE="github.com/Victordtesla24/hostinger-vps-backup.git"
BRANCH=main

# Single-instance guard
exec 200>"$LOCK"
flock -n 200 || { echo "[$(date -Iseconds)] backup already running — skipping" >> "$LOG"; exit 0; }

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG"; }

# ── Load GitHub token ────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
    log "ERROR: $ENV_FILE not found — aborting"
    exit 1
fi

GITHUB_TOKEN=""
while IFS='=' read -r key val; do
    [[ "$key" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$key" ]] && continue
    key="${key// /}"
    val="${val%%#*}"          # strip inline comments
    val="${val%"${val##*[![:space:]]}"}"  # rtrim
    if [[ "$key" == "GITHUB_TOKEN" ]]; then
        GITHUB_TOKEN="$val"
    fi
done < "$ENV_FILE"

if [ -z "$GITHUB_TOKEN" ]; then
    log "ERROR: GITHUB_TOKEN not found in $ENV_FILE — aborting"
    exit 1
fi

REMOTE="https://${GITHUB_TOKEN}@${REPO_URL_BASE}"

log "=== VPS BACKUP START ==="

# ── Wipe and re-create staging area ─────────────────────────────────────────
rm -rf "$STAGING"
mkdir -p "$STAGING"

# ── Write .gitignore ─────────────────────────────────────────────────────────
cat > "$STAGING/.gitignore" << 'GITIGNORE'
# Dependencies
node_modules/
bower_components/
vendor/
.pnpm-store/

# Python environments
.venv/
venv/
env/
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
*.egg-info/
dist/
build/
.eggs/

# Caches
.cache/
.npm/
.yarn/
.pnp.*
*.eslintcache
.parcel-cache/
.turbo/
.next/
.nuxt/
.svelte-kit/
.astro/

# Databases / large data
*.db
*.sqlite
*.sqlite3
*.sql.gz
*.dump
*.rdb
dump.rdb

# Logs
*.log
*.log.*
logs/
log/

# Binaries / compiled
*.so
*.dylib
*.dll
*.exe
*.bin
*.out
*.a
*.o

# Archives
*.tar.gz
*.tar.bz2
*.tar.xz
*.zip
*.7z
*.rar
*.gz
*.tgz

# Secrets (belt-and-suspenders — they shouldn't be in backup dirs anyway)
.env
.env.*
*.pem
*.key
*.p12
*.pfx
id_rsa
id_ed25519

# Browser binaries
google/chrome/
firefox/

# Docker volumes / overlays
overlay2/
volumes/

# OS junk
.DS_Store
Thumbs.db
desktop.ini
GITIGNORE

# ── Snapshot sources ─────────────────────────────────────────────────────────
SOURCES=(
    "/opt"
    "/root/workspace"
    "/root/scripts"
)

for SRC in "${SOURCES[@]}"; do
    if [ ! -d "$SRC" ]; then
        log "SKIP: $SRC does not exist"
        continue
    fi

    DEST_NAME=$(echo "$SRC" | sed 's|^/||; s|/|_|g')
    log "Copying $SRC → $STAGING/$DEST_NAME"

    # rsync: skip .gitignore-matched patterns, preserve permissions, no symlink-follow
    rsync -a --no-links \
        --max-size=50m \
        --exclude='.git/' \
        --exclude='google/chrome/' \
        --exclude='node_modules/' \
        --exclude='.venv/' \
        --exclude='venv/' \
        --exclude='__pycache__/' \
        --exclude='.cache/' \
        --exclude='.npm/' \
        --exclude='.yarn/' \
        --exclude='*.pyc' \
        --exclude='*.log' \
        --exclude='*.log.*' \
        --exclude='*.db' \
        --exclude='*.sqlite' \
        --exclude='*.sqlite3' \
        --exclude='*.tar.gz' \
        --exclude='*.zip' \
        --exclude='*.so' \
        --exclude='*.bin' \
        --exclude='overlay2/' \
        --exclude='volumes/' \
        --exclude='.DS_Store' \
        "$SRC/" "$STAGING/$DEST_NAME/" 2>>"$LOG" || {
            log "WARNING: rsync for $SRC exited non-zero (partial copy) — continuing"
        }
done

# ── Also snapshot active crontabs ────────────────────────────────────────────
log "Snapshotting crontabs"
mkdir -p "$STAGING/crontabs"
crontab -l > "$STAGING/crontabs/root.crontab" 2>/dev/null || true
[ -d /var/spool/cron/crontabs ] && \
    cp -a /var/spool/cron/crontabs/. "$STAGING/crontabs/system/" 2>/dev/null || true

# ── Git init / push ──────────────────────────────────────────────────────────
log "Initialising git in staging"
cd "$STAGING"
git init -q
git config user.email "vps-backup@hostinger"
git config user.name  "VPS Backup Bot"

# Tune git for large payloads and slow links
git config http.postBuffer       524288000   # 500 MB
git config http.lowSpeedLimit    1000
git config http.lowSpeedTime     120
git config pack.windowMemory     256m
git config pack.packSizeLimit    256m
git config pack.threads          1

git remote add origin "$REMOTE" 2>/dev/null || \
    git remote set-url origin "$REMOTE"

log "Staging all files"
# Always create an orphan commit — keeps the repo thin (no history accumulation)
git checkout --orphan "$BRANCH" 2>/dev/null || true
git add -A

if git diff --cached --quiet && [ -z "$(git status --porcelain)" ]; then
    log "Nothing changed since last backup — no commit needed"
else
    COMMIT_MSG="backup: $(date -Iseconds)"
    git commit -q -m "$COMMIT_MSG" >> "$LOG" 2>&1

    log "Pushing to $REPO_URL_BASE branch=$BRANCH (orphan — replaces remote history)"
    # Retry up to 3 times with backoff to tolerate transient 408s
    for attempt in 1 2 3; do
        if git push origin "$BRANCH" --force >> "$LOG" 2>&1; then
            log "Push complete (attempt $attempt)"
            break
        fi
        log "Push attempt $attempt failed — retrying in 15s"
        sleep 15
    done
fi

# ── Cleanup staging ──────────────────────────────────────────────────────────
log "Cleaning up staging dir"
rm -rf "$STAGING"

log "=== VPS BACKUP COMPLETE ==="
