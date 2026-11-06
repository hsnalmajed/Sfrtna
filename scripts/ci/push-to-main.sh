#!/usr/bin/env bash
# Commit data files from a workflow and push them to main, safely (6 Nov 2026).
#
#   bash scripts/ci/push-to-main.sh "Commit message" path [path…]
#   PULL_ARGS="-X theirs" bash scripts/ci/push-to-main.sh …   (this run wins)
#
# Why: on 5 Nov GitHub rejected one 750-file push after a 5-hour hotels run
# ("remote rejected … fatal error in commit_refs_rules") and the result was
# lost. Here the push is retried 3 times (another workflow may have pushed
# meanwhile, or GitHub may fail once); if it still fails, the change is split
# into commits of at most 200 files, pushed one by one. Paths that do not
# exist are skipped. "Nothing new" exits 0.
#
# Note: pushes made with GITHUB_TOKEN never start other workflows; release.yml
# picks such commits up within the hour (its hourly catch-up).
set -euo pipefail

MSG="$1"
shift
TRAILER="Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
PULL_ARGS="${PULL_ARGS:-}"
CHUNK="${CHUNK:-200}"

paths=()
for p in "$@"; do
  if [ -e "$p" ] || git ls-files --error-unmatch -- "$p" >/dev/null 2>&1; then paths+=("$p"); fi
done
if [ "${#paths[@]}" -eq 0 ]; then
  echo "Nothing new (no such paths)."
  exit 0
fi

git add -A -- "${paths[@]}"
if git diff --cached --quiet; then
  echo "Nothing new."
  exit 0
fi

git config user.name "Claude"
git config user.email "noreply@anthropic.com"
git commit -q -m "$MSG" -m "$TRAILER"

push_once() {
  # shellcheck disable=SC2086
  git pull -q --rebase --autostash $PULL_ARGS origin main && git push -q origin HEAD:main
}

push_retry() {
  local n
  for n in 1 2 3; do
    if push_once; then return 0; fi
    echo "Push failed (try $n of 3), waiting $((n * 60)) s."
    sleep $((n * 60))
  done
  return 1
}

if push_retry; then
  echo "Pushed."
  exit 0
fi

echo "::warning title=Push::One push failed 3 times — splitting it into commits of at most $CHUNK files."
list="$(mktemp)"
parts="$(mktemp -d)"
git reset -q --soft HEAD~1
git reset -q
git add -A -- "${paths[@]}"
# --no-renames: a deleted file paired with an identical new one must stay a
# deletion plus an addition, or the deletion is dropped.
git diff --cached --no-renames --name-only >"$list"
git reset -q
split -l "$CHUNK" -d "$list" "$parts/part-"
total=$(ls "$parts" | wc -l)
i=0
for part in "$parts"/part-*; do
  i=$((i + 1))
  xargs -a "$part" -d '\n' git add -A --
  git commit -q -m "$MSG (part $i of $total)" -m "$TRAILER"
  if ! push_retry; then
    echo "::error title=Push::Part $i of $total could not be pushed."
    exit 1
  fi
  echo "Pushed part $i of $total."
done
