#!/usr/bin/env bash
# Start, list and stop the servers a live lane boots, so none outlives the run.
# Each server runs in its own process group. The recorded pid is that group's
# leader, never a wrapper shell, and stop signals only that group, so a wrapper
# such as `npm start` and the server it forks stop together. The command must
# stay in the foreground. A command that daemonizes escapes its group and is
# unsupported.
#
# Usage:
#   lane.sh start <name> <port> [--dir <path>] [--wait <s>] [--] <command...>
#   lane.sh status
#   lane.sh stop <name> | --all
# State is per worktree, in <git dir>/lanes, or in $LANE_STATE when set, so
# --all never touches another worktree's lanes.
set -u

if [ -n "${LANE_STATE:-}" ]; then
	state=$LANE_STATE
else
	gitdir=$(git rev-parse --absolute-git-dir 2>/dev/null) || { echo "run inside the lane's worktree or set LANE_STATE" >&2; exit 2; }
	state=$gitdir/lanes
fi
case "$state" in /*) ;; *) state=$PWD/$state ;; esac
mkdir -p "$state" && chmod 700 "$state" || exit 1

# One connect attempt, given up after about a second. Where IPv6 is off, a
# connect to ::1 can hang instead of failing, and macOS has no `timeout`.
probe() {
	(exec 3<>"/dev/tcp/$1/$2") 2>/dev/null &
	p=$!
	for _ in 1 2 3 4 5 6 7 8 9 10; do
		kill -0 "$p" 2>/dev/null || { wait "$p"; return; }
		sleep 0.1
	done
	kill "$p" 2>/dev/null
	wait "$p" 2>/dev/null
	return 1
}
listening() { probe 127.0.0.1 "$1" || probe ::1 "$1"; }
group_alive() { kill -0 -- "-$1" 2>/dev/null; }

usage_start() { echo "usage: lane.sh start <name> <port> [--dir <path>] [--wait <s>] [--] <command...>" >&2; exit 2; }

start() {
	[ $# -ge 3 ] || usage_start
	name=$1 port=$2; shift 2
	[[ $name =~ ^[A-Za-z0-9_-]+$ ]] || { echo "lane name must match [A-Za-z0-9_-]+" >&2; exit 2; }
	[[ $port =~ ^[0-9]+$ ]] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || { echo "port must be a number from 1 to 65535" >&2; exit 2; }
	dir=. wait=60
	while [ $# -gt 0 ]; do
		case "$1" in
		--dir) dir=${2:?--dir needs a path}; shift 2 ;;
		--wait) wait=${2:?--wait needs seconds}; shift 2 ;;
		--) shift; break ;;
		*) break ;;
		esac
	done
	[[ $wait =~ ^[0-9]+$ ]] || { echo "--wait must be whole seconds" >&2; exit 2; }
	[ $# -gt 0 ] || usage_start
	[ -e "$state/$name.pid" ] && { echo "lane $name is already recorded; stop it first" >&2; exit 1; }
	listening "$port" && { echo "port $port is already in use" >&2; exit 1; }
	cd "$dir" || exit 1
	set -m
	nohup "$@" >"$state/$name.log" 2>&1 </dev/null &
	pid=$!
	set +m
	echo "$pid" >"$state/$name.pid"
	echo "$port" >"$state/$name.port"
	tries=$((wait * 2))
	while [ "$tries" -gt 0 ]; do
		if listening "$port"; then echo "lane $name pid $pid port $port ready"; return 0; fi
		if ! group_alive "$pid"; then
			echo "lane $name exited; log: $state/$name.log" >&2
			tail -5 "$state/$name.log" >&2
			stop_one "$name" >/dev/null
			exit 1
		fi
		sleep 0.5
		tries=$((tries - 1))
	done
	echo "lane $name not listening on $port after $wait s; stopping it. Log: $state/$name.log" >&2
	stop_one "$name" >&2
	exit 1
}

stop_one() {
	name=$1
	[ -e "$state/$name.pid" ] || { echo "no lane named $name" >&2; return 1; }
	pid=$(cat "$state/$name.pid") port=$(cat "$state/$name.port")
	if group_alive "$pid"; then
		kill -TERM -- "-$pid" 2>/dev/null
		# Wait for the whole group, not only its leader: a wrapper exits before the server it forked.
		for _ in $(seq 1 20); do
			group_alive "$pid" || listening "$port" || break
			sleep 0.25
		done
		kill -KILL -- "-$pid" 2>/dev/null || true
		for _ in $(seq 1 8); do listening "$port" || break; sleep 0.25; done
	elif listening "$port"; then
		echo "lane $name is gone but port $port answers: not ours, left alone" >&2
		rm -f "$state/$name.pid" "$state/$name.port"
		return 1
	fi
	if listening "$port"; then
		echo "lane $name stopped but port $port still answers: find its owner before you stop" >&2
		return 1
	fi
	rm -f "$state/$name.pid" "$state/$name.port"
	echo "lane $name stopped, port $port free"
}

case "${1:-}" in
start) shift; start "$@" ;;
status)
	found=0
	for f in "$state"/*.pid; do
		[ -e "$f" ] || continue
		found=1; n=$(basename "$f" .pid); p=$(cat "$f"); port=$(cat "$state/$n.port")
		if group_alive "$p"; then s=running; else s=gone; fi
		echo "$n pid $p port $port $s"
	done
	[ "$found" = 1 ] || echo "no lanes recorded"
	;;
stop)
	shift
	if [ "${1:-}" = "--all" ]; then
		rc=0
		for f in "$state"/*.pid; do [ -e "$f" ] && { stop_one "$(basename "$f" .pid)" || rc=1; }; done
		exit $rc
	fi
	[ -n "${1:-}" ] || { echo "usage: lane.sh stop <name> | --all" >&2; exit 2; }
	stop_one "$1"
	;;
*) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
