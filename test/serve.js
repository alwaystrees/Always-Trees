"use strict";
const bcrypt=require("bcryptjs");
process.env.NODE_ENV="test";process.env.PORT="4322";process.env.MONGODB_URI="mongodb://mock";
process.env.BASE_URL="http://127.0.0.1:4322";process.env.NOINDEX="true";
process.env.JWT_SECRET="test-secret";process.env.CRON_TOKEN="t";
process.env.ADMIN_PASSWORD_HASH=bcrypt.hashSync("test1234test",8);
const p=require.resolve("../src/db");
require.cache[p]={id:p,filename:p,loaded:true,exports:require("./mock-db")};
const {col,COLLECTIONS}=require("./mock-db");
const seed=require("../data/plants.json").items;
(async()=>{
  for(const s of seed) await col(COLLECTIONS.plants).insertOne({...s,published:true,createdAt:new Date()});
  await col(COLLECTIONS.settings).insertOne({_id:"adminState",db:{plants:seed,company:{name:"Always Trees Co., LTD"},items:[],customers:[],jobs:[],docs:[],contents:[],savedAt:Date.now()}});
  console.log("seeded",seed.length); require("../server"); })();
