
const Wallet = (() => {
  const NETWORKS = {
    nile:    { name: 'Nile Testnet', ok: true  },
    mainnet: { name: 'Tron Mainnet', ok: false },
    shasta:  { name: 'Shasta Testnet', ok: false },
  };
  const USDT = {
    nile:    'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
    mainnet: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  };
  const USDT_ABI = [{constant:true,inputs:[{name:'account',type:'address'}],name:'balanceOf',outputs:[{name:'',type:'uint256'}],type:'function'}];

  let state = {connected:false,address:null,addressShort:null,network:null,networkName:null,networkOk:false,trxBalance:null,usdtBalance:null,tronWeb:null};
  let _onConnect=()=>{}, _onDisconnect=()=>{}, _onBalance=()=>{};

  function short(a){return a?a.slice(0,6)+'...'+a.slice(-4):'';}

  function detectNet(tw){
    const h=tw.fullNode?.host||'';
    if(h.includes('nile'))return 'nile';
    if(h.includes('shasta'))return 'shasta';
    if(h.includes('trongrid')||h.includes('mainnet'))return 'mainnet';
    return 'nile';
  }

  async function readBal(tw,addr,net){
    try{
      const trxRaw=await tw.trx.getBalance(addr);
      const trx=(Number(trxRaw)/1e6).toFixed(2);
      let usdt='0.00';
      try{
        const c=await tw.contract(USDT_ABI,USDT[net]||USDT.nile);
        const r=await c.balanceOf(addr).call();
        usdt=(Number(r)/1e6).toFixed(2);
      }catch(e){}
      return{trx,usdt};
    }catch(e){return{trx:'0.00',usdt:'0.00'};}
  }

  async function buildState(tw){
    const address=tw.defaultAddress.base58;
    const network=detectNet(tw);
    const info=NETWORKS[network]||{name:'Unknown',ok:false};
    const bal=await readBal(tw,address,network);
    return{connected:true,address,addressShort:short(address),network,networkName:info.name,networkOk:info.ok,trxBalance:bal.trx,usdtBalance:bal.usdt,tronWeb:tw};
  }

  function showNoWallet(){
    const m=document.createElement('div');
    m.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;font-family:-apple-system,sans-serif';
    m.innerHTML='<div style="background:#050a05;border:1px solid rgba(0,255,170,.2);border-radius:14px;padding:32px;max-width:360px;text-align:center;color:#fff"><div style=\'font-size:40px;margin-bottom:16px\'>🔗</div><div style=\'font-size:18px;font-weight:800;color:#00ffaa;margin-bottom:8px\'>TronLink Not Found</div><div style=\'font-size:13px;color:#444;line-height:1.7;margin-bottom:20px\'>Install TronLink to use GlobalEscrowX.</div><a href=\'https://www.tronlink.org\' target=\'_blank\' style=\'display:block;background:#00ffaa;color:#000;padding:12px;border-radius:6px;font-size:12px;font-weight:800;text-decoration:none;margin-bottom:10px\'>INSTALL TRONLINK</a><div onclick=\'this.closest(\\"div[style]\\").remove()\' style=\'font-size:12px;color:#333;cursor:pointer;margin-top:8px\'>Dismiss</div></div>';
    document.body.appendChild(m);
  }

  function showWrongNet(name){
    removeWrongNet();
    const b=document.createElement('div');
    b.id='gex-wrong-net';
    b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999;background:#ff4444;color:#fff;padding:10px 20px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:space-between;font-family:-apple-system,sans-serif';
    b.innerHTML='<span>⚠️ Wrong network: <strong>'+name+'</strong> — Please switch to <strong>Nile Testnet</strong> in TronLink</span><span onclick=\'document.getElementById(\'gex-wrong-net\').remove()\' style=\'cursor:pointer;opacity:.7\'>✕</span>';
    document.body.insertBefore(b,document.body.firstChild);
  }

  function removeWrongNet(){const b=document.getElementById('gex-wrong-net');if(b)b.remove();}

  async function connect(){
    if(!window.tronWeb&&!window.tronLink){showNoWallet();return null;}
    try{
      if(window.tronLink?.request)await window.tronLink.request({method:'tron_requestAccounts'});
      let tries=0;
      while(!window.tronWeb?.defaultAddress?.base58&&tries<10){await new Promise(r=>setTimeout(r,300));tries++;}
      if(!window.tronWeb?.defaultAddress?.base58){alert('Could not connect. Please unlock TronLink.');return null;}
      state=await buildState(window.tronWeb);
      sessionStorage.setItem('gex_wallet',JSON.stringify({address:state.address,network:state.network}));
      _onConnect(state);
      if(!state.networkOk)showWrongNet(state.networkName);
      return state;
    }catch(e){console.error('[Wallet]',e);return null;}
  }

  function disconnect(){
    state={connected:false,address:null,addressShort:null,network:null,networkName:null,networkOk:false,trxBalance:null,usdtBalance:null,tronWeb:null};
    sessionStorage.removeItem('gex_wallet');
    _onDisconnect();
    removeWrongNet();
  }

  async function refreshBalances(){
    if(!state.connected||!state.tronWeb)return;
    const b=await readBal(state.tronWeb,state.address,state.network);
    state.trxBalance=b.trx;state.usdtBalance=b.usdt;
    _onBalance(state);
  }

  async function init(){
    const saved=sessionStorage.getItem('gex_wallet');
    if(saved&&window.tronWeb?.defaultAddress?.base58){
      try{state=await buildState(window.tronWeb);_onConnect(state);if(!state.networkOk)showWrongNet(state.networkName);}catch(e){}
    }
    window.addEventListener('message',async(e)=>{
      if(e.data?.message?.action==='accountsChanged'){
        if(window.tronWeb?.defaultAddress?.base58){state=await buildState(window.tronWeb);_onConnect(state);}
        else disconnect();
      }
      if(e.data?.message?.action==='setNode'){
        if(state.connected&&window.tronWeb){state=await buildState(window.tronWeb);_onConnect(state);if(!state.networkOk)showWrongNet(state.networkName);else removeWrongNet();}
      }
    });
    setInterval(refreshBalances,30000);
  }

  return{init,connect,disconnect,refreshBalances,getState:()=>({...state}),isConnected:()=>state.connected,onConnect:(f)=>{_onConnect=f;},onDisconnect:(f)=>{_onDisconnect=f;},onBalance:(f)=>{_onBalance=f;}};
})();
