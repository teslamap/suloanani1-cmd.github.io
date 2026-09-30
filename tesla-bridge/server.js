import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const app = express();
app.use(express.json({limit:"256kb"}));
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 8080);
const BASE = process.env.PUBLIC_BASE_URL || "";
const TESLA_AUTH = "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3";
const TESLA_API = process.env.TESLA_API_BASE || "https://fleet-api.prd.eu.vn.cloud.tesla.com";
const TESLA_TOKEN_URL = "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token";

const dataDir = process.env.DATA_DIR || path.resolve("data");
fs.mkdirSync(dataDir,{recursive:true});
const db = new Database(path.join(dataDir,"tesla.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS oauth_state(
  state TEXT PRIMARY KEY, created_at INTEGER NOT NULL, nonce TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tokens(
  id INTEGER PRIMARY KEY CHECK(id=1),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS telemetry(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at INTEGER NOT NULL,
  vin TEXT,
  vehicle_speed REAL,
  soc REAL,
  odometer REAL,
  latitude REAL,
  longitude REAL,
  battery_range REAL,
  raw_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS trips(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  vin TEXT,
  start_soc REAL,
  end_soc REAL,
  start_odo REAL,
  end_odo REAL,
  start_lat REAL,
  start_lng REAL,
  end_lat REAL,
  end_lng REAL,
  distance_km REAL,
  battery_pct REAL,
  raw_start TEXT,
  raw_end TEXT
);
`);

const saveState=db.prepare("INSERT INTO oauth_state(state,created_at,nonce) VALUES(?,?,?)");
const getState=db.prepare("SELECT * FROM oauth_state WHERE state=?");
const deleteState=db.prepare("DELETE FROM oauth_state WHERE state=?");
const saveTokens=db.prepare("INSERT INTO tokens(id,access_token,refresh_token,expires_at,updated_at) VALUES(1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET access_token=excluded.access_token,refresh_token=COALESCE(excluded.refresh_token,tokens.refresh_token),expires_at=excluded.expires_at,updated_at=excluded.updated_at");
const getTokens=db.prepare("SELECT * FROM tokens WHERE id=1");
const insertTelemetry=db.prepare(`INSERT INTO telemetry(received_at,vin,vehicle_speed,soc,odometer,latitude,longitude,battery_range,raw_json) VALUES(?,?,?,?,?,?,?,?,?)`);

function authUrl(){
  const state=crypto.randomBytes(24).toString("hex");
  const nonce=crypto.randomBytes(24).toString("hex");
  saveState.run(state,Date.now(),nonce);
  const u=new URL("https://auth.tesla.com/oauth2/v3/authorize");
  u.searchParams.set("response_type","code");
  u.searchParams.set("client_id",process.env.TESLA_CLIENT_ID||"");
  u.searchParams.set("redirect_uri",`${BASE}/auth/callback`);
  u.searchParams.set("scope","openid offline_access vehicle_device_data vehicle_location");
  u.searchParams.set("state",state);
  u.searchParams.set("nonce",nonce);
  u.searchParams.set("prompt_missing_scopes","true");
  return u.toString();
}

app.get("/health",(req,res)=>res.json({ok:true,service:"tesla-fleet-bridge",tesla_api:TESLA_API}));
app.get("/auth/tesla",(req,res)=>{
  if(!process.env.TESLA_CLIENT_ID || !BASE) return res.status(503).json({error:"Tesla OAuth is not configured"});
  res.redirect(authUrl());
});
app.get("/auth/callback",async(req,res)=>{
  try{
    const {code,state}=req.query;
    const s=state && getState.get(state);
    if(!s || Date.now()-s.created_at>10*60*1000) return res.status(400).send("Invalid or expired OAuth state");
    deleteState.run(state);
    if(!code) return res.status(400).send("Missing authorization code");
    const body=new URLSearchParams({
      grant_type:"authorization_code",
      client_id:process.env.TESLA_CLIENT_ID,
      client_secret:process.env.TESLA_CLIENT_SECRET,
      code,
      audience:TESLA_API,
      redirect_uri:`${BASE}/auth/callback`
    });
    const r=await fetch(TESLA_TOKEN_URL,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
    const data=await r.json();
    if(!r.ok) return res.status(r.status).json(data);
    saveTokens.run(data.access_token,data.refresh_token||null,Date.now()+Number(data.expires_in||3600)*1000,Date.now());
    res.send("Tesla connected. You can close this page.");
  }catch(e){res.status(500).json({error:"OAuth callback failed"});}
});

async function token(){
  const t=getTokens.get();
  if(!t) throw new Error("Tesla account is not connected");
  if(t.expires_at-Date.now()>60000) return t.access_token;
  if(!t.refresh_token) throw new Error("No refresh token available");
  const body=new URLSearchParams({grant_type:"refresh_token",client_id:process.env.TESLA_CLIENT_ID,refresh_token:t.refresh_token});
  const r=await fetch(TESLA_TOKEN_URL,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
  const d=await r.json();
  if(!r.ok) throw new Error(d.error_description||d.error||"Token refresh failed");
  saveTokens.run(d.access_token,d.refresh_token||null,Date.now()+Number(d.expires_in||3600)*1000,Date.now());
  return d.access_token;
}

app.get("/api/vehicles",async(req,res)=>{
  try{
    const access=await token();
    const r=await fetch(`${TESLA_API}/api/1/vehicles`,{headers:{Authorization:`Bearer ${access}`}});
    res.status(r.status).json(await r.json());
  }catch(e){res.status(401).json({error:e.message});}
});

app.post("/telemetry",async(req,res)=>{
  try{
    const p=req.body||{};
    const d=p.data||p;
    const vin=p.vin||d.vin||null;
    const get=(...keys)=>{for(const k of keys){if(d[k]!==undefined)return d[k];} return null;};
    insertTelemetry.run(Date.now(),vin,get("VehicleSpeed","vehicle_speed","speed"),get("Soc","soc","SOC"),get("Odometer","odometer"),get("Latitude","latitude"),get("Longitude","longitude"),get("EstBatteryRange","est_battery_range"),JSON.stringify(p));
    res.json({ok:true});
  }catch(e){res.status(400).json({error:"Invalid telemetry payload"});}
});

app.get("/api/current-drive",async(req,res)=>{
  const rows=db.prepare("SELECT * FROM telemetry ORDER BY received_at DESC LIMIT 120").all();
  res.json({count:rows.length,telemetry:rows});
});

app.get("/api/trips",async(req,res)=>{
  const limit=Math.min(1000,Math.max(1,Number(req.query.limit)||100));
  res.json({trips:db.prepare("SELECT * FROM trips ORDER BY started_at DESC LIMIT ?").all(limit)});
});

app.get("/.well-known/appspecific/com.tesla.3p.public-key.pem",(req,res)=>{
  const key=process.env.TESLA_PUBLIC_KEY;
  if(!key) return res.status(404).send("Not configured");
  res.type("application/x-pem-file").send(key.endsWith("\n")?key:key+"\n");
});

app.listen(PORT,()=>console.log(`Tesla Fleet Bridge listening on :${PORT}`));
