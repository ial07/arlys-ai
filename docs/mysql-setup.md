# MySQL Database Setup Guide

This guide explains how to set up the MySQL database for Arlys AI locally.

## Prerequisites

- MySQL Server 8.0+ installed on your machine
- Node.js 20+ installed

## Step 1: Install MySQL (if not installed)

### macOS (using Homebrew)

```bash
brew install mysql
brew services start mysql
```

### Verify MySQL is running

```bash
mysql --version
mysql -u root -p
```

## Step 2: Create the Database

Connect to MySQL and create the database:

```bash
mysql -u root -p
```

Then run:

```sql
CREATE DATABASE arlys_ai;
SHOW DATABASES;
```

Exit MySQL:

```sql
EXIT;
```

## Step 3: Configure Environment

Your `.env` file should have:

```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/arlys_ai"
```

Replace `YOUR_PASSWORD` with your MySQL root password. If no password, use:

```env
DATABASE_URL="mysql://root@localhost:3306/arlys_ai"
```

## Step 4: Generate Prisma Client & Push Schema

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (creates tables)
npm run db:push
```

## Step 5: Verify Setup

Open Prisma Studio to view your database:

```bash
npm run db:studio
```

This opens a web interface at http://localhost:5555 where you can browse your tables.

## Troubleshooting

### Error: Access denied for user 'root'

Check your MySQL password in the DATABASE_URL.

### Error: Can't connect to MySQL server

Make sure MySQL is running:

```bash
# macOS
brew services list

# Start if not running
brew services start mysql
```

### Error: Unknown database 'arlys_ai'

Create the database first (Step 2).

## Available Commands

| Command               | Description             |
| --------------------- | ----------------------- |
| `npm run db:generate` | Generate Prisma client  |
| `npm run db:push`     | Push schema to database |
| `npm run db:migrate`  | Create migration        |
| `npm run db:studio`   | Open Prisma Studio      |
