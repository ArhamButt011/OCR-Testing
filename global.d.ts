declare namespace NodeJS {
    interface Global {
      _mongoClientPromise?: Promise<MongoClient>;
    }
  }
  
  declare var global: NodeJS.Global;
  