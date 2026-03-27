# Cron Schedule Reference

These jobs run via OpenClaw heartbeats (container has no cron daemon).
If migrating to a machine with cron, use:

```bash
0 8 * * *   cd /path/to/the-nucleus && python3 automations/mailer.py reminders
0 12 * * *  cd /path/to/the-nucleus && python3 automations/mailer.py reminders
0 16 * * *  cd /path/to/the-nucleus && python3 automations/mailer.py reminders
0 8 * * 1   cd /path/to/the-nucleus && python3 automations/mailer.py weekly_report
0 8 * * *   python3 automations/phase6.py meta_pull
0 */2 * * * python3 automations/phase6.py fireflies
0 9 * * *   python3 automations/phase6.py stale_check
```
