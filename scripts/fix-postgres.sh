#!/bin/bash
# TRACE — Fix PostgreSQL auth and verify migrations
set -e

echo "=== Fixing PostgreSQL auth ==="

# Ensure PostgreSQL is running
sudo service postgresql start
sleep 2

# Verify connection works
sudo -u postgres psql -c "SELECT 1;" && echo "PostgreSQL is up"

# Create database if needed
sudo -u postgres psql -c "CREATE DATABASE trace;" 2>/dev/null || echo "Database 'trace' already exists"

# Run migrations
echo ""
echo "--- Running bootstrap ---"
sudo -u postgres psql -d trace -f /mnt/d/Projects/TRACE/migrations/000_bootstrap.sql

echo ""
echo "--- Setting role passwords ---"
sudo -u postgres psql -d trace -f /mnt/d/Projects/TRACE/migrations/002_role_passwords.sql

echo ""
echo "--- Creating tables ---"
sudo -u postgres psql -d trace -f /mnt/d/Projects/TRACE/migrations/003_tables.sql

# Update pg_hba.conf to allow password auth from localhost
PGHBA=$(sudo -u postgres psql -t -c "SHOW hba_file;")
PGHBA=$(echo "$PGHBA" | xargs)  # trim whitespace
echo ""
echo "pg_hba.conf: $PGHBA"

# Add md5 auth line for trace roles if not present
if ! sudo grep -q "trace" "$PGHBA" 2>/dev/null; then
    echo "" | sudo tee -a "$PGHBA" > /dev/null
    echo "# TRACE roles" | sudo tee -a "$PGHBA" > /dev/null
    echo "host trace trace_ops 127.0.0.1/32 md5" | sudo tee -a "$PGHBA" > /dev/null
    echo "host trace trace_ident 127.0.0.1/32 md5" | sudo tee -a "$PGHBA" > /dev/null
    echo "host trace trace_evidence 127.0.0.1/32 md5" | sudo tee -a "$PGHBA" > /dev/null
    echo "host trace trace_ops ::1/128 md5" | sudo tee -a "$PGHBA" > /dev/null
    echo "host trace trace_ident ::1/128 md5" | sudo tee -a "$PGHBA" > /dev/null
    echo "host trace trace_evidence ::1/128 md5" | sudo tee -a "$PGHBA" > /dev/null
    echo "Added TRACE auth rules"
else
    echo "TRACE auth rules already present"
fi

# Reload PostgreSQL config
sudo -u postgres psql -c "SELECT pg_reload_conf();"

# Verify trace_ops can connect
echo ""
echo "--- Verifying trace_ops connection ---"
PGPASSWORD=trace_ops_dev psql -h 127.0.0.1 -U trace_ops -d trace -c "SELECT current_user, current_database();" 2>&1 || echo "FAILED - check password"

echo ""
echo "=== Done ==="
