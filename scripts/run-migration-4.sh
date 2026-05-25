#!/bin/bash
sudo service postgresql start
sleep 2
sudo -u postgres psql -d trace -f /mnt/d/Projects/TRACE/migrations/004_actor_suspicion_identifiers.sql
echo "MIGRATION DONE"
