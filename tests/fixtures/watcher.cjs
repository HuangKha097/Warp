console.log(JSON.stringify({ready:true}));
setInterval(()=>console.log(JSON.stringify({heartbeat:true})),100);
