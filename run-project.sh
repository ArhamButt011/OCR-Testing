#!/bin/bash

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR" || { echo "❌ Failed to navigate to the project folder!"; exit 1; }

echo "📌 Current directory: $(pwd)"

# ---- [1] Kill Any Process Using Port 3000 (Next.js) ----
echo "🔪 Checking for processes running on port 3000..."
PIDS=$(lsof -ti :3000)
if [ -n "$PIDS" ]; then
    echo "⚠️ Killing processes on port 3000: $PIDS..."
    kill -9 $PIDS
    sleep 2
    echo "✅ Processes on port 3000 killed!"
else
    echo "✅ No process running on port 3000."
fi

# ---- [2] Check and Install Node.js ----
echo "📌 Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "⚠️ Node.js not found. Installing..."
    
    NODE_VERSION="v22.14.0"
    ARCH_TYPE=$(uname -m)
    case "$ARCH_TYPE" in
        "x86_64") NODE_TAR="node-$NODE_VERSION-linux-x64.tar.xz" ;;
        "aarch64") NODE_TAR="node-$NODE_VERSION-linux-arm64.tar.xz" ;;
        *) echo "❌ Unsupported architecture: $ARCH_TYPE"; exit 1 ;;
    esac

    NODE_DIR="$HOME/node-$NODE_VERSION"

    if [ ! -f "$NODE_TAR" ]; then
        echo "❌ Node.js archive $NODE_TAR not found! Please place it in the script directory."
        exit 1
    fi

    echo "📦 Extracting Node.js from $NODE_TAR..."
    tar -xJf "$NODE_TAR" -C "$HOME/"

    # Add Node.js to PATH
    export PATH="$NODE_DIR/bin:$PATH"
    sudo ln -sf "$NODE_DIR/bin/node" /usr/local/bin/node
    sudo ln -sf "$NODE_DIR/bin/npm" /usr/local/bin/npm
    sudo ln -sf "$NODE_DIR/bin/npx" /usr/local/bin/npx

    echo "✅ Node.js installed! Version: $(node -v)"
else
    echo "✅ Node.js is already installed. Version: $(node -v)"
fi

# ---- [3] Ensure Docker is Installed & Running ----
echo "📌 Checking if Docker is running..."

# Check if Docker is available (Docker Desktop or Docker Engine)
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running!"

    # If Docker Desktop is installed, try launching it
    if command -v docker >/dev/null 2>&1 && docker --version | grep -q "Docker Desktop"; then
        echo "🚀 Attempting to start Docker Desktop..."
        nohup docker >/dev/null 2>&1 &
        sleep 5
    fi

    # Check again if Docker is running
    if ! docker info >/dev/null 2>&1; then
        echo "❌ Failed to start Docker! Please start Docker Desktop manually."
        exit 1
    fi
fi

echo "✅ Docker is running!"

# ---- [4] Ensure MongoDB is Running ----
echo "📌 Checking for processes running on port 27017..."
PIDS=$(lsof -ti :27017)
if [ -n "$PIDS" ]; then
    echo "⚠️ Killing processes on port 27017: $PIDS..."
    sudo kill -9 $PIDS
    sleep 2
    echo "✅ Processes on port 27017 killed!"
else
    echo "✅ No process running on port 27017."
fi

echo "📌 Checking if MongoDB container is running..."

if docker ps --format '{{.Names}}' | grep -q "mongodb-offline"; then
    echo "✅ MongoDB is already running!"
elif docker ps -a --format '{{.Names}}' | grep -q "mongodb-offline"; then
    echo "⚠️ MongoDB container exists but is stopped. Restarting..."
    docker start mongodb-offline || { echo "❌ Failed to start MongoDB!"; exit 1; }
else
    echo "📌 Checking if MongoDB image exists..."
    if ! docker images | grep -q "mongo"; then
        echo "🚀 Loading MongoDB from mongo-offline.tar..."
        docker load -i mongo-offline.tar || { echo "❌ Failed to load MongoDB image!"; exit 1; }
    fi

    echo "🚀 Starting a new MongoDB container..."
    docker run -d --name mongodb-offline -p 27017:27017 -v ~/mongo-data:/data/db mongo:latest
    echo "✅ MongoDB started successfully!"
fi


# ---- [5] Install Dependencies ----
echo "📌 Checking project dependencies..."
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install || { echo "❌ Failed to install dependencies!"; exit 1; }
else
    echo "♻️ Running npm rebuild..."
    npm rebuild || { echo "❌ Failed to rebuild dependencies!"; exit 1; }
fi

# ---- [6] Insert Admin User in MongoDB ----
echo "📌 Checking and inserting admin user in MongoDB..."

# Ensure MongoDB container is running before proceeding
if ! docker ps --format '{{.Names}}' | grep -q "mongodb-offline"; then
    echo "❌ MongoDB container is not running! Start MongoDB first."
    exit 1
fi

# Generate bcrypt hashed password
BCRYPT_PASSWORD=$(node -e "console.log(require('bcryptjs').hashSync('123456', 10))")

# Insert Admin User
docker exec -i mongodb-offline mongosh my-next-app --eval "
use my-next-app;
if (!db.getCollectionNames().includes('users')) { db.createCollection('users'); }
const adminUser = {
  name: 'Admin',
  email: 'admin@gmail.com',
  status: 3,
  role: 'admin',
  password: '$BCRYPT_PASSWORD',
  createdAt: new Date()
};
if (!db.users.findOne({ email: 'admin@gmail.com' })) {
  db.users.insertOne(adminUser);
  print('✅ Admin user inserted successfully!');
} else {
  print('⚠️ Admin user already exists!');
}"

# ---- [7] Build Next.js App ----
echo "📌 Checking if .next directory exists..."
if [ ! -d ".next" ]; then
    echo "🚀 Building Next.js application..."
    npm run build || { echo "❌ Failed to build the Next.js app!"; exit 1; }
else
    echo "✅ Build already exists. Skipping build step."
fi

# ---- [8] Start Next.js Application ----
echo "🚀 Starting Next.js server..."
nohup npm run start > nextjs.log 2>&1 &

# Wait for Next.js to start properly (increase delay if needed)
echo "⏳ Waiting for Next.js to start..."
sleep 10  # Increased wait time

# Check if Next.js is running
if curl --silent --fail http://localhost:3000 > /dev/null; then
    echo "✅ Next.js is running at http://localhost:3000"

    # Detect OS and open the browser accordingly
    case "$(uname)" in
        "Darwin") 
            echo "🖥️ Detected macOS. Opening browser..."
            open http://localhost:3000
            ;;
        "Linux") 
            echo "🐧 Detected Linux. Opening browser..."
            xdg-open http://localhost:3000
            ;;
        "MINGW"*) 
            echo "🖥️ Detected Windows (Git Bash). Opening browser..."
            start http://localhost:3000
            ;;
        "CYGWIN"*) 
            echo "🖥️ Detected Windows (Cygwin). Opening browser..."
            cygstart http://localhost:3000
            ;;
        "WSL"*) 
            echo "🐧 Detected Windows Subsystem for Linux (WSL). Opening browser..."
            wslview http://localhost:3000 || xdg-open http://localhost:3000
            ;;
        *)  
            echo "⚠️ Unknown OS. Please open http://localhost:3000 manually."
            ;;
    esac
else
    echo "❌ Next.js did not start properly. Check logs in nextjs.log!"
    exit 1
fi
