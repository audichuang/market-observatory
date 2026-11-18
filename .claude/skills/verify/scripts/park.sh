#!/usr/bin/env bash
# Park resident MO devices on the NAS with `sim-vault park --shutdown --missing-ok`; the next ios-up.sh
# restores them. Run it only after the whole batch of iOS work is done. "MO tmp …" devices are not
# parked: down.sh deletes them. One device: exits with sim-vault's code (see `sim-vault --help`).
# `all` tries both devices even if the first fails, prints "<name> rc=N" for each, and exits with the
# first non-zero code (codes are not ordered by severity, e.g. 8 busy vs 9 PosterBoard over limit).
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
first_rc=0
for d in "${TARGETS[@]}"; do
  name="$(simulator_name "$d")"
  rc=0
  sim-vault park "$name" --shutdown --missing-ok || rc=$?
  echo "${name} rc=${rc}"
  if [ "$first_rc" -eq 0 ] && [ "$rc" -ne 0 ]; then first_rc=$rc; fi
done
exit "$first_rc"
