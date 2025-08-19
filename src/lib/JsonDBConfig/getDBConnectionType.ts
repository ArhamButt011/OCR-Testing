import path from "path";
import fs from "fs";

export const getDBConnectionType = (): string | undefined => {
  try {
    const filePath = path.resolve(process.cwd(), "db-config.json");

    if (!fs.existsSync(filePath)) {
      console.error("❌ db-config.json not found at:", filePath);
      return;
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const config = JSON.parse(raw);

    const dbType = config.dbType;
    console.log("✅ DB Type:", dbType);
    return dbType;
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("❌ Error reading DB config:", err.message);
    } else {
      console.error("❌ Unknown error reading DB config");
    }
  }
};
