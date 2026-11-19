#!/usr/bin/env bash
# Park resident MO devices on the NAS with sim-vault; the next ios-up.sh restores them. Run it only
# after the whole batch of iOS work is done. "MO tmp …" devices are not parked: down.sh deletes them.
# One device: `sim-vault park --shutdown --missing-ok`, exits with sim-vault's code (`sim-vault --help`).
# `all`: `sim-vault park --missing-ok` without --shutdown, so a device someone booted without a lease
# (old wrapper, Xcode) is refused with 6 instead of shut down. It tries both devices even if the first
# fails, prints "<name> rc=N" for each, and exits with the first non-zero code (codes are not ordered
# by severity, e.g. 8 busy vs 9 PosterBoard over limit). An interrupt (Ctrl-C, SIGTERM, or sim-vault
# exiting 130/143) stops the batch at once with that code; the next device is not touched.
#   park.sh <16-plus|18-pro-max|all>
source "$(dirname "$0")/lib.sh"
case "${1:-}" in
  all) TARGETS=(18-pro-max 16-plus) ;;
  16-plus|18-pro-max) TARGETS=("$1") ;;
  *) die "用法：park.sh <16-plus|18-pro-max|all>" ;;
esac
need_sim_vault
if [ "${#TARGETS[@]}" -eq 1 ]; then
  exec sim-vault park "$(simulator_name "${TARGETS[0]}")" --shutdown --missing-ok
fi
# A signal sent only to this shell runs the trap once the current sim-vault call has finished.
interrupted=0
trap 'interrupted=130' INT
trap 'interrupted=143' TERM
first_rc=0
for d in "${TARGETS[@]}"; do
  name="$(simulator_name "$d")"
  rc=0
  sim-vault park "$name" --missing-ok || rc=$?
  echo "${name} rc=${rc}"
  if [ "$interrupted" -ne 0 ] || [ "$rc" -eq 130 ] || [ "$rc" -eq 143 ]; then
    [ "$interrupted" -ne 0 ] || interrupted=$rc
    echo "✗ 收到中斷，停止整批（rc=${interrupted}），沒有收下一台" >&2
    exit "$interrupted"
  fi
  if [ "$first_rc" -eq 0 ] && [ "$rc" -ne 0 ]; then first_rc=$rc; fi
done
exit "$first_rc"
