#!/bin/bash
# Run once to install cron jobs for The Nucleus

PYTHON=$(which python3)
SCRIPT_DIR="/data/.openclaw/workspace/the-nucleus/automations"

# Add cron jobs
(crontab -l 2>/dev/null; echo "# The Nucleus automations
0 7 * * 1 $PYTHON $SCRIPT_DIR/mailer.py weekly_report >> $SCRIPT_DIR/mailer.log 2>&1
0 8,12,16 * * * $PYTHON $SCRIPT_DIR/mailer.py reminders >> $SCRIPT_DIR/mailer.log 2>&1
") | crontab -

echo "Cron jobs installed:"
crontab -l | grep -A1 "Nucleus"
