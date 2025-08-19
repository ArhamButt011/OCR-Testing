#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Navigate to the Next.js project folder
cd "$SCRIPT_DIR" || { echo "❌ Failed to navigate to the Next.js project folder!"; exit 1; }

echo "📌 Current directory: $(pwd)"

# Kill any process running on port 3000
echo "🔪 Checking for processes running on port 3000..."
PIDS=$(lsof -ti :3000)
if [ -n "$PIDS" ]; then
    echo "⚠️ Killing processes on port 3000: $PIDS..."
    kill -9 $PIDS
    sleep 2  # Give time for the OS to release the port
    echo "✅ Processes on port 3000 killed!"
else
    echo "✅ No process running on port 3000."
fi

# Ensure no lingering Next.js processes
NEXT_PIDS=$(ps aux | grep 'next' | grep -v grep | awk '{print $2}')
if [ -n "$NEXT_PIDS" ]; then
    echo "⚠️ Killing lingering Next.js processes: $NEXT_PIDS..."
    kill -9 $NEXT_PIDS
    echo "✅ Next.js processes killed!"
fi

echo "📌 Checking if MongoDB container is running..."
# Check if MongoDB container is already running
if docker ps --format '{{.Names}}' | grep -q "mongodb-offline"; then
    echo "✅ MongoDB is already running!"
else
    echo "🚀 Starting MongoDB in Docker..."
    docker run -d --name mongodb-offline -p 27017:27017 -v ~/mongo-data:/data/db mongo:latest
    echo "✅ MongoDB started successfully!"
fi

# Wait for MongoDB to initialize
sleep 5

echo "📌 Checking and inserting admin user in MongoDB..."
BCRYPT_PASSWORD=$(node -e "console.log(require('bcryptjs').hashSync('123456', 10))")

docker exec -i mongodb-offline mongosh <<EOF
use my-next-app;
const adminUser = {
  name: "Admin",
  email: "admin@gmail.com",
  status: 3,
  role: "admin",
  password: "$BCRYPT_PASSWORD",
  createdAt: new Date()
};
if (!db.users.findOne({ email: "admin@gmail.com" })) {
  db.users.insertOne(adminUser);
  print("✅ Admin user inserted successfully!");
} else {
  print("⚠️ Admin user already exists!");
}
EOF

echo "📌 Starting Next.js application..."

# Install dependencies if not installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install || { echo "❌ Failed to install dependencies!"; exit 1; }
fi

# Build the Next.js app (for production)
npm run build || { echo "❌ Failed to build the Next.js app!"; exit 1; }

# Start Next.js in the background
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
