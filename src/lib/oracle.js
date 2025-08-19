import oracledb from "oracledb";

export async function getOracleConnection(
  userName,
  password,
  ipAddress,
  portNumber,
  serviceName
) {
  try {
    const dbResponse = await fetch("http://localhost:3000/api/auth/public-db");

    if (!dbResponse.ok) {
      console.error("Failed to fetch database info.");
      return null;
    }

    // const dbData = await dbResponse.json();
    

    // if (dbType !== "remote") {
    //   console.log("Database is not remote. Skipping OracleDB connection.");
    //   return null;
    // }

    const connection = await oracledb.getConnection({
      user: userName,
      password: password,
      connectString: `${ipAddress}:${portNumber}/${serviceName}`,
    });

    console.log("✅ Connected to OracleDB");
    return connection;
  } catch (error) {
    console.error("❌ OracleDB Connection Failed:", error.message);
    throw error;
  }
}
