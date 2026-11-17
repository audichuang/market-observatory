#!/usr/bin/env bash
# Park resident MO devices on the NAS with `sim-vault park --shutdown --missing-ok`; the next ios-up.sh
# restores them. Run it only after the whole batch of iOS work is done. "MO tmp …" devices are not
# parked: down.sh deletes them. Exits with sim-vault's code (see `sim-vault --help`).
#   park.sh <16-plus|18-pro-max|all>
source "$(dirname "$0")/lib.sh"
case "${1:-}" in
  all) TARGETS=(18-pro-max 16-plus) ;;
  16-plus|18-pro-max) TARGETS=("$1") ;;
  *) die "用法：park.sh <16-plus|18-pro-max|all>" ;;
esac
need_sim_vault
for d in "${TARGETS[@]}"; do
  sim-vault park "$(simulator_name "$d")" --shutdown --missing-ok
done
