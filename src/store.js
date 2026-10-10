'use strict';
const {DatabaseSync} = require('node:sqlite');
const fs = require('node:fs'); const path = require('node:path');
function openStore(file) {
  if(file!==':memory:') fs.mkdirSync(path.dirname(file), {recursive:true,mode:0o700});
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY, fingerprint TEXT, kind TEXT NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, payload TEXT NOT NULL, result TEXT, resolution TEXT);
    CREATE INDEX IF NOT EXISTS reviews_fingerprint ON reviews(fingerprint,created DESC);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, at INTEGER NOT NULL, actor TEXT NOT NULL, event TEXT NOT NULL, review_id TEXT, details TEXT NOT NULL);`);
  if(file!==':memory:') fs.chmodSync(file,0o600);
  db.prepare("UPDATE reviews SET status='failed',result=? WHERE status='running'").run(JSON.stringify({error:'Service restarted during review. Submit again.'}));
  const decode = r => r ? {...r,payload:JSON.parse(r.payload),result:r.result?JSON.parse(r.result):null,resolution:r.resolution?JSON.parse(r.resolution):null} : null;
  return {db,
    audit(actor,event,id,details={}) {db.prepare('INSERT INTO audit(at,actor,event,review_id,details) VALUES(?,?,?,?,?)').run(Date.now(),actor,event,id,JSON.stringify(details));},
    get(id){return decode(db.prepare('SELECT * FROM reviews WHERE id=?').get(id));},
    next(){return decode(db.prepare("SELECT * FROM reviews WHERE status='queued' ORDER BY created LIMIT 1").get());},
    add(r){db.prepare('INSERT INTO reviews(id,fingerprint,kind,status,created,expires,payload) VALUES(?,?,?,?,?,?,?)').run(r.id,r.fingerprint,r.kind,'queued',r.created,r.expires,JSON.stringify(r.payload));},
    status(id,status,result){db.prepare('UPDATE reviews SET status=?,result=? WHERE id=?').run(status,result?JSON.stringify(result):null,id);},
    latest(fp){return decode(db.prepare("SELECT * FROM reviews WHERE fingerprint=? AND kind='code' ORDER BY created DESC,rowid DESC LIMIT 1").get(fp));},
    resolve(id,res){db.prepare('UPDATE reviews SET resolution=? WHERE id=?').run(JSON.stringify(res),id);},
    transaction(fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}},
    count(){return db.prepare("SELECT count(*) AS n FROM reviews WHERE status IN ('queued','running')").get().n;},
    close(){db.close();}
  };
}
module.exports = {openStore};
