#!/bin/bash
# Daily update, run on James's Mac by launchd (see launchd/com.kiruijk.nse-stock-digest.plist).
# AFX, the price source, doesn't answer requests from GitHub's servers, so the update
# runs here instead of in GitHub Actions. Steps: pull, test, fetch + render, check
# freshness, commit, push. A failure shows a macOS notification; details go to
# logs/daily-update.log.

REPO="$(cd "$(dirname "$0")" && pwd)"
LOG="$REPO/logs/daily-update.log"
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"

mkdir -p "$REPO/logs"
exec >>"$LOG" 2>&1
echo
echo "===== $(date '+%Y-%m-%d %H:%M:%S %Z') ====="

notify() {
  osascript -e "display notification \"$1\" with title \"NSE Stock Digest\"" || true
}

fail() {
  echo "FAILED: $1"
  notify "Daily update failed: $1 (see logs/daily-update.log)"
  exit 1
}

cd "$REPO" || fail "repo not found"

# Don't touch a working copy with someone's unfinished changes in it
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  fail "uncommitted changes in the repo; commit or stash them first"
fi

git pull --ff-only || fail "git pull"
npm test >/dev/null || fail "tests"
node update-stocks.js || fail "update script"

FILES="index.html sitemap.xml robots.txt stocks/ sectors/ data/market.json data/history/ data/details/"
MESSAGE="🤖 Update NSE prices and news - $(date -u '+%Y-%m-%d %H:%M:%S')"
git add $FILES
if git diff --cached --quiet; then
  echo "No changes to commit"
else
  git -c user.name="Stock Bot" -c user.email="bot@github.com" commit -q -m "$MESSAGE" || fail "git commit"
  pushed=""
  for attempt in 1 2 3; do
    if git push -q; then pushed=1; break; fi
    # Someone pushed during the run: start from the remote and merge this run's data into
    # it file by file (never a line-level git merge of JSON), then re-render
    echo "Push rejected; merging onto the latest remote (attempt $attempt)"
    SAVED="$(mktemp -d)/data"
    cp -r data "$SAVED"
    git fetch -q origin main && git reset -q --hard origin/main
    node merge-bot-data.js "$SAVED" && node update-stocks.js --render-only >/dev/null || fail "merge after rejected push"
    git add $FILES
    git diff --cached --quiet || git -c user.name="Stock Bot" -c user.email="bot@github.com" commit -q -m "$MESSAGE"
  done
  [ -n "$pushed" ] || fail "git push (3 attempts)"
  echo "Pushed $(git log -1 --format=%h)"
fi

# After the push, so good data is saved even if some tickers are stale
node check-freshness.js || fail "freshness check (stale or missing prices)"
echo "Done"
