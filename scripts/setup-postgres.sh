#!/bin/bash
set -e

echo "=== TRACE PostgreSQL Setup ==="
echo "Installing PostgreSQL in WSL, data on D:\\"

# Install PostgreSQL
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-client

# Stop default instance
sudo service postgresql stop 2>/dev/null || true

# Create data directory on D:\
PGDATA="/mnt/d/Projects/TRACE/data/pgdata"
mkdir -p "$PGDATA"
sudo chown postgres:postgres "$PGDATA"

# Get PG version bin path
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | head -1)
echo "Using PostgreSQL at $PGBIN"

# Initialize new cluster on D:\
sudo -u postgres "$PGBIN/initdb" -D "$PGDATA" 2>/dev/null || echo "Cluster may already exist"

# Configure
cat << 'PGCONF' | sudo tee "$PGDATA/postgresql.conf" > /dev/null
listen_addresses = 'localhost'
port = 5432
max_connections = 50
shared_buffers = 256MB
unix_socket_directories = '/var/run/postgresql'
log_destination = 'stderr'
logging_collector = off
PGCONF

cat << 'PGHBA' | sudo tee "$PGDATA/pg_hba.conf" > /dev/null
local all all trust
host all all 127.0.0.1/32 md5
host all all ::1/128 md5
PGHBA

# Start PostgreSQL
sudo mkdir -p /var/run/postgresql
sudo chown postgres:postgres /var/run/postgresql
sudo -u postgres "$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/postgresql.log" start || true
sleep 3

# Create database and run migrations
sudo -u postgres psql -c "CREATE DATABASE trace;" 2>/dev/null || echo "Database exists"
sudo -u postgres psql -d trace -f /mnt/d/Projects/TRACE/migrations/000_bootstrap.sql 2>&1
sudo -u postgres psql -d trace -f /mnt/d/Projects/TRACE/migrations/002_role_passwords.sql 2>&1
sudo -u postgres psql -d trace -f /mnt/d/Projects/TRACE/migrations/003_tables.sql 2>&1

echo ""
echo "=== PostgreSQL ready ==="
echo "Host: localhost:5432  Database: trace"
echo "Data: D:\\Projects\\TRACE\\data\\pgdata"
echo "DONE"
