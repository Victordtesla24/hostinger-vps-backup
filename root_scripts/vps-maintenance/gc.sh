#!/usr/bin/env bash
# VPS Garbage Collection — Docker prune, journal vacuum, apt cache, temp cleanup
set -euo pipefail

LOG=/var/log/vps-gc.log
LOCK=/tmp/vps-gc.lock
JOURNAL_DAYS=30
JOURNAL_MAX_SIZE=200M

# Single-instance guard
exec 200>"$LOCK"
flock -n 200 || { echo "[$(date -Iseconds)] gc already running — skipping" >> "$LOG"; exit 0; }

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG"; }

log "=== VPS GC START ==="

# ── Docker ──────────────────────────────────────────────────────────────────
if command -v docker &>/dev/null && systemctl is-active --quiet docker; then
    log "Docker: pruning stopped containers"
    docker container prune -f >> "$LOG" 2>&1

    log "Docker: pruning dangling images"
    docker image prune -f >> "$LOG" 2>&1

    log "Docker: pruning unused volumes"
    docker volume prune -f >> "$LOG" 2>&1

    log "Docker: pruning unused networks"
    docker network prune -f >> "$LOG" 2>&1

    # Only prune build cache if older than 48h to avoid thrashing active builds
    log "Docker: pruning build cache >48h"
    docker buildx prune -f --filter "until=48h" >> "$LOG" 2>&1 || \
        docker builder prune -f --filter "until=48h" >> "$LOG" 2>&1 || true
else
    log "Docker: not running or not installed — skipping"
fi

# ── Journalctl ───────────────────────────────────────────────────────────────
log "Journal: vacuuming entries older than ${JOURNAL_DAYS}d (cap ${JOURNAL_MAX_SIZE})"
journalctl --vacuum-time="${JOURNAL_DAYS}d" >> "$LOG" 2>&1
journalctl --vacuum-size="$JOURNAL_MAX_SIZE"  >> "$LOG" 2>&1

# ── Apt cache ────────────────────────────────────────────────────────────────
if command -v apt-get &>/dev/null; then
    log "Apt: autoclean"
    apt-get autoclean -y >> "$LOG" 2>&1
    log "Apt: autoremove"
    apt-get autoremove -y >> "$LOG" 2>&1
fi

# ── /tmp — remove files not touched in 7 days (skip active sockets/pipes) ───
log "Temp: removing /tmp files older than 7 days"
find /tmp -mindepth 1 -maxdepth 2 \
    ! -name "vps-gc.lock" \
    -type f -atime +7 \
    -delete 2>/dev/null || true

# ── Old GC logs — keep last 30 ───────────────────────────────────────────────
LOG_COUNT=$(ls /var/log/vps-gc.log* 2>/dev/null | wc -l)
if [ "$LOG_COUNT" -gt 30 ]; then
    log "Log rotation: trimming old GC log backups"
    ls -t /var/log/vps-gc.log.* 2>/dev/null | tail -n +31 | xargs rm -f
fi

# ── System log rotation trigger ──────────────────────────────────────────────
if command -v logrotate &>/dev/null; then
    log "Logrotate: forcing rotation"
    logrotate -f /etc/logrotate.conf >> "$LOG" 2>&1 || true
fi

# ── Summary ──────────────────────────────────────────────────────────────────
DISK_FREE=$(df -h / | awk 'NR==2{print $4}')
log "=== VPS GC COMPLETE — free disk: ${DISK_FREE} ==="
