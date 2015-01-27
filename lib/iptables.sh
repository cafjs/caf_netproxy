#!/bin/bash
cat <(iptables-save -t $1 | grep -v $2 | head -n -2) $3 | iptables-restore
