---
title: Data browser
description: Browse and edit tables, run SQL, and look at Redis keys, from the dashboard.
sidebar:
  order: 3
---

A database's **Data** tab lets Developers and up look at and change its data without a database client. Warden reaches the database through its container, over SSH, so nothing is exposed to the internet.

## Postgres and MySQL

- **Tables**: the list on the left, with approximate row counts. Find one by name.
- **Rows**: 50 per page, sortable by any column. Long values are cut at 10,000 characters.
- **Edit a cell**: click it. The editor shows the value now and the new value; nothing changes until **Save change**. Values are typed as text and the database converts them to the column's type, or explains why it can't.
- **Add row**: columns left on **default** get the database's default, an automatic number, or NULL.
- **Delete rows**: select them, then type the table's name to confirm.

Tables without a primary key can be read but not edited here; use the SQL box.

## SQL box

Run any SQL; Ctrl or ⌘ + Enter runs it. Several statements show several results, up to 500 rows each.

**Every query runs read-only first.** If it would change data, the database refuses, nothing has changed, and Warden asks **This query changes data**. Choose **Run and change data** to run it for real.

Queries stop after 15 seconds, and a result over 32 MB is cut off: add a `LIMIT`.

## Redis

- **Keys**: search with a pattern such as `user:*`, then **Load more**. Warden uses `SCAN`, never `KEYS *`, which would freeze a big Redis.
- **Values**: shown by type. Strings can be edited; hashes, lists, sets, sorted sets and streams show their first 200 items.
- **Command box**: one command at a time, as in `redis-cli`. Commands that change data, and admin commands, ask first. `MONITOR`, `SUBSCRIBE`, `SHUTDOWN` and the like can't be run from here.

## What's recorded

Every SQL query and Redis command is recorded in the organization's audit log (Admins). Edits from the grid also appear in the project's Activity as which table and how many rows, never the values.
