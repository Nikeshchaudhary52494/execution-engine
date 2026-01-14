# 🧠 Secure Code Execution Engine (Non-Interactive)

A **containerized, language-agnostic code execution engine** built using **Node.js, Docker, Redis, and BullMQ**.
This service allows user to submit code for execution in a **secure, isolated sandbox**, retrieve results asynchronously, and scale execution horizontally using worker queues.

> ⚠️ This version supports **non-interactive execution only**.
> A fully interactive execution engine is planned as a separate project.

---

## ✨ Features

* 🐳 **Docker-based isolation** per execution
* 🧵 **Asynchronous job processing** with BullMQ
* ⚡ **Horizontal scalability** using multiple workers
* 🔒 **Resource limits**

  * Memory limits
  * Process (PID) limits
  * Network isolation
* 🛡️ **Security protections**

  * Read-only filesystem
  * Fork-bomb detection
  * Output size limiting
  * Execution timeout
* 📦 **Language-agnostic architecture**
* 🔁 **Retries with exponential backoff**
* 🚦 **Job priorities**
* 🧹 Automatic cleanup of containers and temp files

---

## 🏗️ Architecture Overview

```
Client
  |
  | HTTP API
  v
API Service (Express)
  |
  | Job Queue (BullMQ)
  v
Redis
  |
  | Pull jobs
  v
Worker(s)
  |
  | Docker Sandbox
  v
Execution Result
```

* **API** handles job submission and status queries
* **Redis** acts as queue + result store
* **Workers** execute code inside Docker containers
* **Docker** enforces isolation and resource limits

---

## 🧪 Supported Languages

Currently supported:

* ✅ Python
* ✅ JavaScript
* ⚠️ C++ (compile + run, limited support)
* ⚠️ Java (experimental)

Languages are registered via a **language registry** (no if/else chains).

---

## 🚀 API Endpoints

### Submit a Job

```http
POST /v1/jobs
Content-Type: application/json
```

**Request body**

```json
{
  "language": "python",
  "code": "print(2 + 2)",
  "priority": 10,
  "timeoutMs": 3000,
  "metadata": {}
}
```

**Response**

```json
{
  "jobId": "42",
  "status": "queued"
}
```

---

### Get Job Result

```http
GET /v1/jobs/:jobId
```

**Possible responses**

**Queued / Running**

```json
{ "status": "running" }
```

**Completed**

```json
{
  "status": "completed",
  "output": "4",
  "exitCode": 0
}
```

**Failed**

```json
{
  "status": "completed",
  "error": "Time Limit Exceeded (program ran too long)",
  "exitCode": 124
}
```

---

## ⏱️ Execution Limits

| Limit Type       | Value (default) |
| ---------------- | --------------- |
| Time limit       | 3000 ms         |
| Memory limit     | 128 MB          |
| PID limit        | 50              |
| Output limit     | 4 KB            |
| Network access   | ❌ Disabled      |
| Filesystem write | ❌ Disabled      |

---

## 🔁 Retry & Backoff

Jobs are retried automatically for **infrastructure failures**:

* Attempts: `3`
* Backoff strategy: `exponential`
* Base delay: `1000 ms`

User-code errors (syntax errors, infinite loops, fork bombs) are **not retried**.

---

## ⚠️ Known Limitations

* ❌ **Interactive input is NOT supported**

  * `input()` / `scanf()` / runtime prompts are not interactive
* ❌ No real-time stdout streaming
* ❌ No persistent sessions
* ❌ No WebSocket support

> These limitations are intentional to keep this engine **simple, stable, and scalable**.

---

## 🧭 Why This Project Exists

This project was designed to:

* Learn secure sandbox execution
* Understand Docker isolation deeply
* Build a reusable execution microservice
* Explore queue-based distributed systems

It intentionally avoids interactive execution, which requires a **different architecture**.

---

## 🧩 Future Work (Separate Project)

A new execution engine is planned with:

* Real-time WebSocket communication
* Interactive stdin/stdout
* Stateful execution sessions
* Go-based backend for performance and concurrency

➡️ This repository will **remain non-interactive by design**.

---

## 🛠️ Tech Stack

* **Node.js**
* **Express**
* **Docker**
* **BullMQ**
* **Redis**
* **Alpine Linux images**

---
## ▶️ Running the Execution Engine (with Worker Scaling)

This project uses **Docker Compose** and supports **horizontal scaling of workers**.

### 1️⃣ Prerequisites

Make sure you have:

* Docker ≥ 20.x
* Docker Compose (v2 recommended)

Verify:

```bash
docker --version
docker compose version
```

---

### 2️⃣ Start the system (single worker)

From the project root:

```bash
docker compose up --build
```

This starts:

* API server → `http://localhost:3001`
* Redis
* 1 worker

---

### 3️⃣ Scale workers (recommended)

To run **multiple workers in parallel**:

```bash
docker compose up --build --scale worker=4
```

This will start:

* 1 API container
* 1 Redis container
* **4 worker containers**

Each worker will independently pull jobs from the queue.

---

### 4️⃣ Run in detached mode (production-like)

```bash
docker compose up -d --build --scale worker=4
```

Check running containers:

```bash
docker ps
```

---

### 5️⃣ Stop the system

```bash
docker compose down
```

To also remove volumes:

```bash
docker compose down -v
```

---

### 6️⃣ View logs

All services:

```bash
docker compose logs -f
```

Only workers:

```bash
docker compose logs -f worker
```

Only API:

```bash
docker compose logs -f api
```

---

### 7️⃣ Verify scaling

Submit multiple jobs quickly:

```bash
for i in {1..20}; do
  curl -X POST http://localhost:3001/v1/jobs \
    -H "Content-Type: application/json" \
    -d '{"language":"python","code":"print(\"hello\")"}' &
done
wait
```

You should see workers processing jobs in parallel.

---

## 🧠 Notes on Scaling

* Workers are **stateless**
* Redis handles job coordination
* You can safely scale workers up/down at runtime
* API does **not** need scaling initially

---
## ⚠️ Important Note: Language Runtime Images Must Be Pre-Pulled

This execution engine runs user code inside **Docker containers** for each language.

👉 **All language runtime images must be available locally on the host running the workers.**

If an image is **not present**, job execution will:

* Fail
* Or block while Docker tries to pull the image (very slow, unsafe in prod)

---

### ✅ Required Images (Example)

Make sure these images are pulled **before starting the system**:

```bash
docker pull python:3.9-alpine
docker pull node:18-alpine
docker pull gcc:latest
docker pull bellsoft/liberica-openjdk-alpine:17
```

Add or remove images depending on the languages you enable.

---

### 🚀 Recommended: Pre-pull All Images

For production or demos, run:

```bash
docker pull python:3.9-alpine \
  && docker pull node:18-alpine \
  && docker pull gcc:latest \
  && docker pull bellsoft/liberica-openjdk-alpine:17
```

This ensures:

* Fast job startup
* Predictable execution time
* No runtime network dependency

---

### 🔒 Why This Is Required

* Workers **do not auto-install runtimes**
* Pulling images at runtime:

  * Blocks worker threads
  * Breaks execution time guarantees
  * Can be abused for DoS attacks
* Pre-installed images = **deterministic sandbox**

---

### 🧠 Best Practice (Production)

* Use a **private Docker registry**
* Pin image versions (avoid `latest`)
* Warm worker nodes with required images
* Monitor image drift

---

### ❌ Common Mistake

> “It works on my machine but not on server”

Usually caused by:

* Missing language images on the server
* Different image versions across environments

