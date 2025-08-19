import { promises as fs } from "fs";
import path from "path";

export const jsonDBConnectionHandler = async (dbType) => {
  const filePath = path.join(process.cwd(), "db-config.json");
  try {
    await fs.writeFile(filePath, JSON.stringify({ dbType }, null, 2));
    console.log("DB type saved successfully");
  } catch {
  console.log("Failed to write file for db connection json");
}
};
