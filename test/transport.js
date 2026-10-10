'use strict';
// Exercise the actual HTTP request handler without a socket. Set
// TRUSTGATE_TEST_HTTP=1 to run these same cases over a real loopback connection.
const {Readable}=require('node:stream');
async function transport(server){
  if(process.env.TRUSTGATE_TEST_HTTP==='1'){
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const base=`http://127.0.0.1:${server.address().port}`;
    return (route,options)=>fetch(base+route,options);
  }
  return (route,options={})=>new Promise((resolve,reject)=>{
    const req=Readable.from(options.body?[Buffer.from(options.body)]:[]);req.url=route;req.method=options.method||'GET';req.headers=options.headers||{};
    const res={status:200,headers:{},writeHead(status,headers){this.status=status;this.headers=headers;},setHeader(k,v){this.headers[k]=v;},end(body){resolve(new Response(body,{status:this.status,headers:this.headers}));}};
    try{server.emit('request',req,res);}catch(e){reject(e);}
  });
}
module.exports={transport};
