#!/bin/bash
export HAPROXY_PID=`cat $2`
echo $HAPROXY_PID
echo "DUUUUUUMMMMMMMMYYYYYYYYY"
echo "haproxy -f $1 -p $2 -sf $HAPROXY_PID"
