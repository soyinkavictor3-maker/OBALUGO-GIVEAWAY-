const express=require("express");
const session=require("express-session");
const Database=require("better-sqlite3");
const path=require("path");
const crypto=require("crypto");

const app=express();
const db=new Database("giveaway.db");
db.pragma("journal_mode=WAL");
db.exec(`CREATE TABLE IF NOT EXISTS accounts(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT NOT NULL,
 password TEXT NOT NULL,
 claimed INTEGER NOT NULL DEFAULT 0,
 claimed_at TEXT
)`);
const ADMIN_USER=process.env.ADMIN_USER||"obalugo";
const ADMIN_PASS=process.env.ADMIN_PASS||"CHANGE_THIS_PASSWORD";
const PORT=process.env.PORT||3000;
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({secret:process.env.SESSION_SECRET||crypto.randomBytes(32).toString("hex"),resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production"}}));
app.use(express.static(path.join(__dirname,"public")));

function admin(req,res,next){if(req.session.admin)return next();res.status(401).json({error:"Admin login required"});}
app.post("/api/admin/login",(req,res)=>{if(req.body.username===ADMIN_USER&&req.body.password===ADMIN_PASS){req.session.admin=true;return res.json({ok:true})}res.status(401).json({error:"Invalid login"})});
app.post("/api/admin/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/admin/accounts",admin,(req,res)=>res.json(db.prepare("SELECT id,username,claimed,claimed_at FROM accounts ORDER BY id DESC").all()));
app.post("/api/admin/accounts",admin,(req,res)=>{
 const u=String(req.body.username||"").trim(),p=String(req.body.password||"");
 if(!u||!p)return res.status(400).json({error:"Username/email and password are required"});
 const r=db.prepare("INSERT INTO accounts(username,password) VALUES(?,?)").run(u,p);
 res.json({ok:true,id:r.lastInsertRowid});
});
app.delete("/api/admin/accounts/:id",admin,(req,res)=>{db.prepare("DELETE FROM accounts WHERE id=?").run(req.params.id);res.json({ok:true})});
app.get("/api/accounts/count",(req,res)=>res.json({available:db.prepare("SELECT COUNT(*) n FROM accounts WHERE claimed=0").get().n}));

// Claim returns one intentionally-added giveaway credential and marks it claimed atomically.
app.post("/api/claim",(req,res)=>{
 const tx=db.transaction(()=>{
   const a=db.prepare("SELECT * FROM accounts WHERE claimed=0 ORDER BY id LIMIT 1").get();
   if(!a)return null;
   db.prepare("UPDATE accounts SET claimed=1,claimed_at=datetime('now') WHERE id=? AND claimed=0").run(a.id);
   return {username:a.username,password:a.password};
 });
 const a=tx();
 if(!a)return res.status(409).json({error:"No CPM accounts are available right now."});
 res.json({ok:true,account:a});
});
app.get("/api/admin/status",(req,res)=>res.json({loggedIn:!!req.session.admin}));
app.listen(PORT,()=>console.log("OBALUGO GIVEAWAY running on port "+PORT));